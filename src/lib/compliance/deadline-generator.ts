import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines, tenants } from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

interface AnnualDeadline {
  taskName: string
  month: number // 1-indexed
  day: number
  category: 'tax' | 'tenant' | 'grant' | 'budget'
  recurrence: 'annual' | 'monthly' | 'per_tenant' | 'one_time'
}

const ANNUAL_DEADLINES: AnnualDeadline[] = [
  // Tax deadlines
  { taskName: 'Form 990 filing', month: 5, day: 15, category: 'tax', recurrence: 'annual' },
  { taskName: 'Form PC filing', month: 5, day: 15, category: 'tax', recurrence: 'annual' },
  { taskName: 'Federal 941 (Q1)', month: 4, day: 30, category: 'tax', recurrence: 'annual' },
  { taskName: 'Federal 941 (Q2)', month: 7, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'Federal 941 (Q3)', month: 10, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'Federal 941 (Q4)', month: 1, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'MA M-941 (Q1)', month: 4, day: 30, category: 'tax', recurrence: 'annual' },
  { taskName: 'MA M-941 (Q2)', month: 7, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'MA M-941 (Q3)', month: 10, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'MA M-941 (Q4)', month: 1, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'W-2 filing', month: 1, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: '1099-NEC filing', month: 1, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'Annual in-kind review', month: 12, day: 31, category: 'tax', recurrence: 'annual' },
  { taskName: 'Officer compensation review', month: 6, day: 30, category: 'tax', recurrence: 'annual' },
  { taskName: 'Conflict of interest attestation', month: 6, day: 30, category: 'tax', recurrence: 'annual' },
  { taskName: 'Insurance renewal (Hiscox BOP)', month: 12, day: 31, category: 'tax', recurrence: 'annual' },
  // Budget deadlines
  { taskName: 'Budget draft (ED)', month: 10, day: 31, category: 'budget', recurrence: 'annual' },
  { taskName: 'Budget board circulation', month: 11, day: 30, category: 'budget', recurrence: 'annual' },
  { taskName: 'Budget board approval', month: 12, day: 31, category: 'budget', recurrence: 'annual' },
  { taskName: 'Quarterly board prep (Q1)', month: 3, day: 15, category: 'budget', recurrence: 'annual' },
  { taskName: 'Quarterly board prep (Q2)', month: 6, day: 15, category: 'budget', recurrence: 'annual' },
  { taskName: 'Quarterly board prep (Q3)', month: 9, day: 15, category: 'budget', recurrence: 'annual' },
  { taskName: 'Quarterly board prep (Q4)', month: 12, day: 15, category: 'budget', recurrence: 'annual' },
]

/**
 * Generate annual compliance deadlines for a given fiscal year.
 * Idempotent — skips deadlines that already exist for the year.
 */
export async function generateAnnualDeadlines(
  fiscalYear: number
): Promise<{ created: number; skipped: number }> {
  let created = 0
  let skipped = 0

  for (const deadline of ANNUAL_DEADLINES) {
    // Q4 deadlines with month=1 belong to the next calendar year
    const calendarYear = deadline.month === 1 && deadline.taskName.includes('Q4')
      ? fiscalYear + 1
      : fiscalYear
    const dueDate = `${calendarYear}-${String(deadline.month).padStart(2, '0')}-${String(deadline.day).padStart(2, '0')}`

    // Check for existing deadline (idempotent)
    const [existing] = await db
      .select()
      .from(complianceDeadlines)
      .where(
        and(
          eq(complianceDeadlines.taskName, deadline.taskName),
          eq(complianceDeadlines.dueDate, dueDate)
        )
      )

    if (existing) {
      skipped++
      continue
    }

    await db.insert(complianceDeadlines).values({
      taskName: deadline.taskName,
      dueDate,
      category: deadline.category,
      recurrence: deadline.recurrence,
      status: 'upcoming',
    })
    created++
  }

  return { created, skipped }
}

/**
 * Generate per-tenant compliance deadlines (interest anniversary).
 * Called when deposits are collected — also called by the seed for existing tenants.
 */
export async function generateTenantDeadlines(
  tenantId: number
): Promise<{ created: number }> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  if (!tenant || !tenant.tenancyAnniversary) return { created: 0 }

  const taskName = `Security deposit interest — ${tenant.name} (Unit ${tenant.unitNumber})`

  // Check for existing (idempotent)
  const [existing] = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.taskName, taskName),
        eq(complianceDeadlines.tenantId, tenantId)
      )
    )

  if (existing) return { created: 0 }

  await db.insert(complianceDeadlines).values({
    taskName,
    dueDate: tenant.tenancyAnniversary,
    category: 'tenant',
    recurrence: 'per_tenant',
    status: 'upcoming',
    tenantId,
  })

  return { created: 1 }
}

/**
 * Mark a compliance deadline as completed.
 */
export async function completeDeadline(
  deadlineId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(complianceDeadlines)
      .set({ status: 'completed' })
      .where(eq(complianceDeadlines.id, deadlineId))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'compliance_deadline',
      entityId: deadlineId,
      afterState: { status: 'completed' },
    })
  })
}
