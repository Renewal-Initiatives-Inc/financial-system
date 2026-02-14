import { and, eq, lte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prepaidSchedules, transactions, transactionLines } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

export interface AmortizationResult {
  entriesCreated: number
  totalAmount: number
}

/**
 * Calculate the number of months between two dates.
 */
function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate)
  const end = new Date(endDate)
  return (
    (end.getFullYear() - start.getFullYear()) * 12 +
    (end.getMonth() - start.getMonth())
  )
}

/**
 * Calculate monthly amortization amount for a prepaid schedule.
 */
export function calculateMonthlyAmortization(schedule: {
  totalAmount: string
  startDate: string
  endDate: string
}): number {
  const months = monthsBetween(schedule.startDate, schedule.endDate)
  if (months <= 0) return 0
  const total = Number(schedule.totalAmount)
  return Math.round((total / months) * 100) / 100
}

/**
 * Get all active prepaid schedules that should be amortized as of a given date.
 */
export async function getActiveSchedules(asOfDate: string) {
  return db
    .select()
    .from(prepaidSchedules)
    .where(
      and(
        eq(prepaidSchedules.isActive, true),
        lte(prepaidSchedules.startDate, asOfDate),
        sql`${prepaidSchedules.amountAmortized}::numeric < ${prepaidSchedules.totalAmount}::numeric`
      )
    )
}

/**
 * Check if amortization has already been posted for a given schedule and month.
 */
async function hasAmortizationForMonth(
  glPrepaidAccountId: number,
  glExpenseAccountId: number,
  yearMonth: string
): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .innerJoin(
      transactionLines,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(
      and(
        eq(transactions.sourceType, 'SYSTEM'),
        eq(transactions.isSystemGenerated, true),
        eq(transactions.isVoided, false),
        eq(transactionLines.accountId, glPrepaidAccountId),
        sql`to_char(${transactions.date}::date, 'YYYY-MM') = ${yearMonth}`
      )
    )

  return Number(result[0].count) > 0
}

/**
 * Generate monthly amortization entries for all active prepaid schedules.
 * Idempotent: skips schedules that already have entries for the target month.
 */
export async function generateAmortizationEntries(
  asOfDate: string,
  userId: string
): Promise<AmortizationResult> {
  const yearMonth = asOfDate.slice(0, 7)
  const schedules = await getActiveSchedules(asOfDate)

  let entriesCreated = 0
  let totalAmount = 0

  for (const schedule of schedules) {
    // Idempotency check
    const alreadyProcessed = await hasAmortizationForMonth(
      schedule.glPrepaidAccountId,
      schedule.glExpenseAccountId,
      yearMonth
    )
    if (alreadyProcessed) continue

    // Calculate amount
    let monthlyAmount = calculateMonthlyAmortization(schedule)

    // Final month: use remaining balance to avoid rounding drift
    const remaining =
      Math.round(
        (Number(schedule.totalAmount) - Number(schedule.amountAmortized)) * 100
      ) / 100
    if (remaining < monthlyAmount) {
      monthlyAmount = remaining
    }

    if (monthlyAmount <= 0) continue

    const dateObj = new Date(asOfDate)
    const monthYear = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    // Create GL entry: DR Expense, CR Prepaid
    await createTransaction({
      date: asOfDate,
      memo: `Prepaid amortization - ${schedule.description} - ${monthYear}`,
      sourceType: 'SYSTEM',
      isSystemGenerated: true,
      createdBy: userId,
      lines: [
        {
          accountId: schedule.glExpenseAccountId,
          fundId: schedule.fundId,
          debit: monthlyAmount,
          credit: null,
        },
        {
          accountId: schedule.glPrepaidAccountId,
          fundId: schedule.fundId,
          debit: null,
          credit: monthlyAmount,
        },
      ],
    })

    // Update amountAmortized on the schedule
    const newAmortized =
      Math.round(
        (Number(schedule.amountAmortized) + monthlyAmount) * 100
      ) / 100

    await db
      .update(prepaidSchedules)
      .set({ amountAmortized: String(newAmortized) })
      .where(eq(prepaidSchedules.id, schedule.id))

    // Mark as inactive if fully amortized
    if (newAmortized >= Number(schedule.totalAmount)) {
      await db
        .update(prepaidSchedules)
        .set({ isActive: false })
        .where(eq(prepaidSchedules.id, schedule.id))
    }

    entriesCreated++
    totalAmount += monthlyAmount
  }

  return {
    entriesCreated,
    totalAmount: Math.round(totalAmount * 100) / 100,
  }
}

/**
 * Handle a refund/true-up on a prepaid schedule.
 * Reduces totalAmount by refund, recalculates monthlyAmount for remaining months.
 */
export async function handleRefundTrueUp(
  scheduleId: number,
  refundAmount: number,
  userId: string
): Promise<void> {
  const [schedule] = await db
    .select()
    .from(prepaidSchedules)
    .where(eq(prepaidSchedules.id, scheduleId))

  if (!schedule) throw new Error(`Prepaid schedule ${scheduleId} not found`)

  const currentTotal = Number(schedule.totalAmount)
  const currentAmortized = Number(schedule.amountAmortized)

  if (refundAmount > currentTotal - currentAmortized) {
    throw new Error('Refund amount exceeds remaining unamortized balance')
  }

  const newTotal = Math.round((currentTotal - refundAmount) * 100) / 100

  // Recalculate monthly amount for remaining months
  const remainingBalance = newTotal - currentAmortized
  const today = new Date().toISOString().split('T')[0]
  const remainingMonths = monthsBetween(today, schedule.endDate)
  const newMonthlyAmount =
    remainingMonths > 0
      ? Math.round((remainingBalance / remainingMonths) * 100) / 100
      : remainingBalance

  await db
    .update(prepaidSchedules)
    .set({
      totalAmount: String(newTotal),
      monthlyAmount: String(newMonthlyAmount),
    })
    .where(eq(prepaidSchedules.id, scheduleId))

  // Mark inactive if fully amortized after refund
  if (currentAmortized >= newTotal) {
    await db
      .update(prepaidSchedules)
      .set({ isActive: false })
      .where(eq(prepaidSchedules.id, scheduleId))
  }
}
