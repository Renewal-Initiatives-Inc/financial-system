import { and, eq, lte, lt, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prepaidSchedules, transactions, transactionLines } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

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
  scheduleDescription: string,
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
        sql`${transactions.memo} LIKE ${'%' + scheduleDescription + '%'}`,
        sql`to_char(${transactions.date}::date, 'YYYY-MM') = ${yearMonth}`
      )
    )

  return Number(result[0].count) > 0
}

/**
 * Get the last day of a given year-month as YYYY-MM-DD.
 */
function lastDayOfMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-').map(Number)
  // Day 0 of next month = last day of this month
  const d = new Date(year, month, 0)
  return d.toISOString().split('T')[0]
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
      schedule.description,
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
 * Catch-up amortization: processes all missing months from each schedule's
 * start date through the asOfDate month. Prevents missed months when backdating
 * or when cron runs are missed.
 */
export async function generateAmortizationEntriesWithCatchUp(
  asOfDate: string,
  userId: string
): Promise<AmortizationResult> {
  const schedules = await getActiveSchedules(asOfDate)
  const asOfYM = asOfDate.slice(0, 7)

  let entriesCreated = 0
  let totalAmount = 0

  for (const schedule of schedules) {
    // Walk month-by-month from schedule start through asOfDate
    const startYM = schedule.startDate.slice(0, 7)
    let currentYM = startYM

    // Track running amortized total for this schedule across catch-up months
    let runningAmortized = Number(schedule.amountAmortized)
    const scheduleTotal = Number(schedule.totalAmount)

    while (currentYM <= asOfYM) {
      // Skip if already fully amortized
      if (runningAmortized >= scheduleTotal) break

      const alreadyProcessed = await hasAmortizationForMonth(
        schedule.glPrepaidAccountId,
        schedule.description,
        currentYM
      )

      if (!alreadyProcessed) {
        let monthlyAmount = calculateMonthlyAmortization(schedule)

        // Final month: use remaining balance to avoid rounding drift
        const remaining = Math.round((scheduleTotal - runningAmortized) * 100) / 100
        if (remaining < monthlyAmount) {
          monthlyAmount = remaining
        }

        if (monthlyAmount > 0) {
          // Use last day of the catch-up month as the transaction date
          const entryDate = lastDayOfMonth(currentYM)
          const dateObj = new Date(entryDate)
          const monthYear = dateObj.toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })

          await createTransaction({
            date: entryDate,
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

          runningAmortized = Math.round((runningAmortized + monthlyAmount) * 100) / 100

          await db
            .update(prepaidSchedules)
            .set({ amountAmortized: String(runningAmortized) })
            .where(eq(prepaidSchedules.id, schedule.id))

          // Mark as inactive if fully amortized
          if (runningAmortized >= scheduleTotal) {
            await db
              .update(prepaidSchedules)
              .set({ isActive: false })
              .where(eq(prepaidSchedules.id, schedule.id))
          }

          entriesCreated++
          totalAmount += monthlyAmount
        }
      }

      // Advance to next month
      const [y, m] = currentYM.split('-').map(Number)
      const nextMonth = m === 12 ? 1 : m + 1
      const nextYear = m === 12 ? y + 1 : y
      currentYM = `${nextYear}-${String(nextMonth).padStart(2, '0')}`
    }
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
