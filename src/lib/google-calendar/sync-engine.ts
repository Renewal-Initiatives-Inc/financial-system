import { eq, isNull, ne, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines } from '@/lib/db/schema'
import * as calendarClient from './client'
import type { GoogleCalendarEvent } from './types'

const CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID ?? ''
const SITE_URL = 'https://finance.renewalinitiatives.org'

function buildDescriptionText(deadline: {
  legalCitation: string | null
  referenceUrl: string | null
  recommendedActions: string | null
}): string | undefined {
  const parts: string[] = []

  if (deadline.legalCitation) {
    parts.push(`Legal Citation: ${deadline.legalCitation}`)
  }

  if (deadline.referenceUrl) {
    parts.push(`Reference: ${deadline.referenceUrl}`)
  }

  if (deadline.recommendedActions) {
    let actions: string[]
    try {
      const parsed = JSON.parse(deadline.recommendedActions)
      actions = Array.isArray(parsed) ? parsed.map(String) : [deadline.recommendedActions]
    } catch {
      actions = deadline.recommendedActions.split('\n').map((l) => l.trim()).filter(Boolean)
    }
    const body =
      actions.length > 1
        ? actions.map((a) => `• ${a}`).join('\n')
        : actions[0]
    parts.push(`Recommended Actions:\n${body}`)
  }

  return parts.length > 0 ? parts.join('\n\n') : undefined
}

function buildEvent(deadline: {
  id: number
  taskName: string
  dueDate: string
  legalCitation: string | null
  referenceUrl: string | null
  recommendedActions: string | null
}): GoogleCalendarEvent {
  return {
    summary: deadline.taskName,
    description: buildDescriptionText(deadline),
    location: `${SITE_URL}/compliance?deadline=${deadline.id}`,
    start: { date: deadline.dueDate },
    end: { date: deadline.dueDate },
    source: { title: 'Compliance Calendar', url: `${SITE_URL}/compliance?deadline=${deadline.id}` },
  }
}

export async function syncComplianceCalendar(): Promise<{
  created: number
  updated: number
  deleted: number
}> {
  if (!CALENDAR_ID) {
    throw new Error('GOOGLE_CALENDAR_ID environment variable is not set.')
  }

  // Fetch all non-reminder, non-completed deadlines
  const deadlines = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.isReminder, false),
        ne(complianceDeadlines.status, 'completed')
      )
    )

  let created = 0
  let updated = 0

  const activeEventIds = new Set<string>()

  for (const deadline of deadlines) {
    const event = buildEvent(deadline)

    if (!deadline.googleEventId) {
      const eventId = await calendarClient.createEvent(CALENDAR_ID, event)
      await db
        .update(complianceDeadlines)
        .set({ googleEventId: eventId })
        .where(eq(complianceDeadlines.id, deadline.id))
      activeEventIds.add(eventId)
      created++
    } else {
      await calendarClient.updateEvent(CALENDAR_ID, deadline.googleEventId, event)
      activeEventIds.add(deadline.googleEventId)
      updated++
    }
  }

  // Also sync reminder rows
  const reminderDeadlines = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.isReminder, true),
        ne(complianceDeadlines.status, 'completed')
      )
    )

  for (const reminder of reminderDeadlines) {
    const event = buildEvent(reminder)
    if (!reminder.googleEventId) {
      const eventId = await calendarClient.createEvent(CALENDAR_ID, event)
      await db
        .update(complianceDeadlines)
        .set({ googleEventId: eventId })
        .where(eq(complianceDeadlines.id, reminder.id))
      activeEventIds.add(eventId)
      created++
    } else {
      await calendarClient.updateEvent(CALENDAR_ID, reminder.googleEventId, event)
      activeEventIds.add(reminder.googleEventId)
      updated++
    }
  }

  // Orphan cleanup: delete Google events not in our DB
  const googleEvents = await calendarClient.listEvents(CALENDAR_ID)
  let deleted = 0
  for (const gEvent of googleEvents) {
    if (!activeEventIds.has(gEvent.id)) {
      await calendarClient.deleteEvent(CALENDAR_ID, gEvent.id)
      deleted++
    }
  }

  return { created, updated, deleted }
}

export async function generateReminderRows(): Promise<{
  created: number
  skipped: number
}> {
  // Fetch all parent (non-reminder) deadlines
  const parentDeadlines = await db
    .select()
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.isReminder, false))

  let created = 0
  let skipped = 0

  for (const parent of parentDeadlines) {
    // Check if a reminder row already exists
    const [existing] = await db
      .select({ id: complianceDeadlines.id })
      .from(complianceDeadlines)
      .where(
        and(
          eq(complianceDeadlines.parentDeadlineId, parent.id),
          eq(complianceDeadlines.isReminder, true)
        )
      )

    if (existing) {
      skipped++
      continue
    }

    // Compute reminder date: 14 days before due date
    const dueDate = new Date(parent.dueDate)
    const reminderDate = new Date(dueDate)
    reminderDate.setDate(reminderDate.getDate() - 14)
    const reminderDateStr = reminderDate.toISOString().split('T')[0]

    const [inserted] = await db
      .insert(complianceDeadlines)
      .values({
        taskName: `REMINDER: ${parent.taskName}`,
        dueDate: reminderDateStr,
        category: parent.category,
        recurrence: parent.recurrence,
        status: 'upcoming',
        isReminder: true,
        parentDeadlineId: parent.id,
      })
      .returning({ id: complianceDeadlines.id, googleEventId: complianceDeadlines.googleEventId })

    // Create Google Calendar event for reminder and store ID on parent's googleReminderEventId
    if (CALENDAR_ID && inserted) {
      const reminderEvent = buildEvent({
        id: inserted.id,
        taskName: `REMINDER: ${parent.taskName}`,
        dueDate: reminderDateStr,
        legalCitation: parent.legalCitation,
        referenceUrl: parent.referenceUrl,
        recommendedActions: parent.recommendedActions,
      })
      const reminderEventId = await calendarClient.createEvent(CALENDAR_ID, reminderEvent)

      // Store Google event ID on the reminder row
      await db
        .update(complianceDeadlines)
        .set({ googleEventId: reminderEventId })
        .where(eq(complianceDeadlines.id, inserted.id))

      // Store reminder event ID on parent row
      await db
        .update(complianceDeadlines)
        .set({ googleReminderEventId: reminderEventId })
        .where(eq(complianceDeadlines.id, parent.id))
    }

    created++
  }

  return { created, skipped }
}
