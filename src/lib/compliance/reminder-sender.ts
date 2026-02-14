import { and, eq, lte, gte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines } from '@/lib/db/schema'

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

async function sendReminderEmail(
  subject: string,
  body: string
): Promise<boolean> {
  const apiKey = process.env.POSTMARK_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL

  if (!apiKey || !adminEmail) {
    console.error('Postmark or admin email not configured — skipping compliance reminder')
    return false
  }

  try {
    const response = await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL ?? adminEmail,
        To: adminEmail,
        Subject: subject,
        TextBody: body,
      }),
    })

    return response.ok
  } catch (err) {
    console.error('Failed to send compliance reminder:', err)
    return false
  }
}

/**
 * Check for upcoming compliance deadlines and send Postmark reminders.
 * Sends at 30 days and 7 days before due date.
 */
export async function checkAndSendReminders(): Promise<{
  reminders30d: number
  reminders7d: number
}> {
  const today = new Date().toISOString().split('T')[0]
  const in30Days = addDays(today, 30)
  const in7Days = addDays(today, 7)

  let reminders30d = 0
  let reminders7d = 0

  // 30-day reminders: due within 30 days, not yet sent
  const due30 = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.hasReminder30dSent, false),
        eq(complianceDeadlines.status, 'upcoming'),
        lte(complianceDeadlines.dueDate, in30Days),
        gte(complianceDeadlines.dueDate, today)
      )
    )

  for (const deadline of due30) {
    const sent = await sendReminderEmail(
      `Compliance reminder (30 days): ${deadline.taskName}`,
      [
        `Compliance deadline approaching:`,
        '',
        `Task: ${deadline.taskName}`,
        `Due date: ${deadline.dueDate}`,
        `Category: ${deadline.category}`,
        '',
        'This is a 30-day advance reminder.',
      ].join('\n')
    )

    if (sent) {
      await db
        .update(complianceDeadlines)
        .set({ hasReminder30dSent: true, status: 'reminded' })
        .where(eq(complianceDeadlines.id, deadline.id))
      reminders30d++
    }
  }

  // 7-day reminders: due within 7 days, 30d sent but 7d not yet sent
  const due7 = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.hasReminder7dSent, false),
        sql`${complianceDeadlines.status} != 'completed'`,
        lte(complianceDeadlines.dueDate, in7Days),
        gte(complianceDeadlines.dueDate, today)
      )
    )

  for (const deadline of due7) {
    const sent = await sendReminderEmail(
      `URGENT compliance reminder (7 days): ${deadline.taskName}`,
      [
        `Compliance deadline imminent:`,
        '',
        `Task: ${deadline.taskName}`,
        `Due date: ${deadline.dueDate}`,
        `Category: ${deadline.category}`,
        '',
        'This deadline is due within 7 days. Please take action.',
      ].join('\n')
    )

    if (sent) {
      await db
        .update(complianceDeadlines)
        .set({ hasReminder7dSent: true })
        .where(eq(complianceDeadlines.id, deadline.id))
      reminders7d++
    }
  }

  return { reminders30d, reminders7d }
}
