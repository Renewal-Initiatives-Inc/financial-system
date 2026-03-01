import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines, funds, tenants } from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import type { ExtractedMilestone, ExtractedCovenant } from '@/lib/ai/contract-extraction'

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
  // Annual rate review — SSA announces SS wage base mid-October
  { taskName: 'Annual tax rate review (SS wage base)', month: 10, day: 15, category: 'tax', recurrence: 'annual' },
  // Functional allocation — year-end
  { taskName: 'Year-end functional allocation review', month: 12, day: 15, category: 'tax', recurrence: 'annual' },
  // Public support — trajectory review for 509(a)(1) status (relevant ~FY2028+)
  { taskName: 'Public support trajectory review', month: 6, day: 30, category: 'tax', recurrence: 'annual' },
  // Grant reporting
  { taskName: 'Annual grant compliance review', month: 12, day: 31, category: 'grant', recurrence: 'annual' },
  // Policy-system alignment: Financial Policies & Procedures Section 7 (Compliance)
  { taskName: 'MA Secretary of State Annual Report', month: 11, day: 1, category: 'tax', recurrence: 'annual' },
  { taskName: 'UBIT annual review', month: 12, day: 31, category: 'tax', recurrence: 'annual' },
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

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'compliance_deadline',
      entityId: deadlineId,
      afterState: { status: 'completed' },
    })
  })
}

// --- Funding source deadline helpers ---

function lastDayOfMonth(year: number, month: number): string {
  // month is 1-indexed; Date(year, month, 0) gives last day of previous month
  const d = new Date(year, month, 0)
  return `${year}-${String(month).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Quarterly end dates: Mar 31, Jun 30, Sep 30, Dec 31 */
const QUARTER_END_MONTHS = [3, 6, 9, 12]

/** Semi-annual end dates: Jun 30, Dec 31 */
const SEMI_ANNUAL_END_MONTHS = [6, 12]

function generateReportingDates(
  frequency: string,
  startDate: string,
  endDate: string
): string[] {
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  const dates: string[] = []

  const startYear = start.getFullYear()
  const endYear = end.getFullYear()

  if (frequency === 'monthly') {
    for (let y = startYear; y <= endYear; y++) {
      for (let m = 1; m <= 12; m++) {
        const due = lastDayOfMonth(y, m)
        if (due >= startDate && due <= endDate) dates.push(due)
      }
    }
  } else if (frequency === 'quarterly') {
    for (let y = startYear; y <= endYear; y++) {
      for (const m of QUARTER_END_MONTHS) {
        const due = lastDayOfMonth(y, m)
        if (due >= startDate && due <= endDate) dates.push(due)
      }
    }
  } else if (frequency === 'semi-annual') {
    for (let y = startYear; y <= endYear; y++) {
      for (const m of SEMI_ANNUAL_END_MONTHS) {
        const due = lastDayOfMonth(y, m)
        if (due >= startDate && due <= endDate) dates.push(due)
      }
    }
  } else if (frequency === 'annual') {
    for (let y = startYear; y <= endYear; y++) {
      const due = `${y}-12-31`
      if (due >= startDate && due <= endDate) dates.push(due)
    }
  }

  return dates
}

async function insertIfNotExists(
  taskName: string,
  dueDate: string,
  category: 'tax' | 'tenant' | 'grant' | 'budget',
  recurrence: 'annual' | 'monthly' | 'per_tenant' | 'one_time',
  fundId: number
): Promise<boolean> {
  const [existing] = await db
    .select()
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.taskName, taskName),
        eq(complianceDeadlines.dueDate, dueDate),
        eq(complianceDeadlines.fundId, fundId)
      )
    )
  if (existing) return false

  await db.insert(complianceDeadlines).values({
    taskName,
    dueDate,
    category: 'grant',
    recurrence,
    status: 'upcoming',
    fundId,
  })
  return true
}

/**
 * Generate compliance deadlines for a funding source based on its
 * reportingFrequency, extractedMilestones, extractedCovenants, and endDate.
 * Idempotent — skips deadlines that already exist.
 */
export async function generateFundingSourceDeadlines(
  fundId: number
): Promise<{ created: number; skipped: number }> {
  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, fundId))

  if (!fund) return { created: 0, skipped: 0 }

  let created = 0
  let skipped = 0

  // 1. Reporting deadlines from reportingFrequency
  if (fund.reportingFrequency && fund.startDate && fund.endDate) {
    const dates = generateReportingDates(
      fund.reportingFrequency.toLowerCase(),
      fund.startDate,
      fund.endDate
    )
    for (const dueDate of dates) {
      const monthLabel = new Date(dueDate + 'T00:00:00').toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      const taskName = `Report submission — ${fund.name} (${monthLabel})`
      const inserted = await insertIfNotExists(
        taskName,
        dueDate,
        'grant',
        fund.reportingFrequency.toLowerCase() === 'monthly' ? 'monthly' : 'annual',
        fundId
      )
      if (inserted) created++
      else skipped++
    }
  }

  // 2. Milestone deadlines from extractedMilestones
  if (fund.extractedMilestones && Array.isArray(fund.extractedMilestones)) {
    const milestones = fund.extractedMilestones as ExtractedMilestone[]
    for (const milestone of milestones) {
      if (!milestone.date) continue
      const taskName = `Milestone — ${fund.name}: ${milestone.name}`
      const inserted = await insertIfNotExists(
        taskName,
        milestone.date,
        'grant',
        'one_time',
        fundId
      )
      if (inserted) created++
      else skipped++
    }
  }

  // 3. Covenant deadlines from extractedCovenants
  if (fund.extractedCovenants && Array.isArray(fund.extractedCovenants)) {
    const covenants = fund.extractedCovenants as ExtractedCovenant[]
    for (const covenant of covenants) {
      if (!covenant.deadline) continue
      const taskName = `Covenant — ${fund.name}: ${covenant.description.slice(0, 80)}`
      const inserted = await insertIfNotExists(
        taskName,
        covenant.deadline,
        'grant',
        'one_time',
        fundId
      )
      if (inserted) created++
      else skipped++
    }
  }

  // 4. Close-out deadlines from endDate
  if (fund.endDate) {
    const endMs = new Date(fund.endDate + 'T00:00:00').getTime()

    // 30 days before end → close-out preparation
    const prep30 = new Date(endMs - 30 * 24 * 60 * 60 * 1000)
    const prep30Date = prep30.toISOString().split('T')[0]
    const prepInserted = await insertIfNotExists(
      `Close-out preparation — ${fund.name}`,
      prep30Date,
      'grant',
      'one_time',
      fundId
    )
    if (prepInserted) created++
    else skipped++

    // On endDate → grant period end
    const endInserted = await insertIfNotExists(
      `Grant period end — ${fund.name}`,
      fund.endDate,
      'grant',
      'one_time',
      fundId
    )
    if (endInserted) created++
    else skipped++
  }

  return { created, skipped }
}
