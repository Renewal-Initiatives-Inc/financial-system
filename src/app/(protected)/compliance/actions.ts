'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines } from '@/lib/db/schema'
import { completeDeadline } from '@/lib/compliance/deadline-generator'

export type ComplianceDeadlineRow = typeof complianceDeadlines.$inferSelect

export async function getComplianceDeadlines(filters?: {
  category?: string
  status?: string
}): Promise<ComplianceDeadlineRow[]> {
  const conditions = []

  if (filters?.category) {
    conditions.push(
      eq(
        complianceDeadlines.category,
        filters.category as (typeof complianceDeadlines.category.enumValues)[number]
      )
    )
  }
  if (filters?.status) {
    conditions.push(
      eq(
        complianceDeadlines.status,
        filters.status as (typeof complianceDeadlines.status.enumValues)[number]
      )
    )
  }

  return db
    .select()
    .from(complianceDeadlines)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(complianceDeadlines.dueDate)
}

export async function markDeadlineComplete(
  deadlineId: number,
  userId: string
): Promise<void> {
  await completeDeadline(deadlineId, userId)
  revalidatePath('/compliance')
}

export async function updateDeadlineNotes(
  deadlineId: number,
  notes: string
): Promise<void> {
  await db
    .update(complianceDeadlines)
    .set({ notes })
    .where(eq(complianceDeadlines.id, deadlineId))

  revalidatePath('/compliance')
}
