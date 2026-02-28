import { eq, and, desc, sql, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  cipConversions,
  funds,
  fundingSourceRateHistory,
  transactions,
  transactionLines,
} from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

// The 3 structures that must be converted for construction to be "complete"
const REQUIRED_STRUCTURES = ['Lodging', 'Barn', 'Garage']

export interface ConstructionStatus {
  isConstructionComplete: boolean
  structuresConverted: string[]
}

/**
 * Determine whether all structures have been converted from CIP to fixed assets.
 * Construction is complete when all 3 structures have conversion records.
 */
export async function getConstructionStatus(): Promise<ConstructionStatus> {
  const conversions = await db
    .select({ structureName: cipConversions.structureName })
    .from(cipConversions)

  const convertedNames = conversions.map((c) => c.structureName)

  const isComplete = REQUIRED_STRUCTURES.every((s) =>
    convertedNames.includes(s)
  )

  return {
    isConstructionComplete: isComplete,
    structuresConverted: convertedNames,
  }
}

/**
 * Look up the effective interest rate for a funding source at a given date.
 * Returns the most recent rate entry on or before the target date, or null.
 */
export async function getEffectiveRate(
  fundId: number,
  asOfDate: string
): Promise<number | null> {
  const [row] = await db
    .select({ rate: fundingSourceRateHistory.rate })
    .from(fundingSourceRateHistory)
    .where(
      and(
        eq(fundingSourceRateHistory.fundId, fundId),
        sql`${fundingSourceRateHistory.effectiveDate} <= ${asOfDate}`
      )
    )
    .orderBy(desc(fundingSourceRateHistory.effectiveDate))
    .limit(1)

  return row ? parseFloat(row.rate) : null
}

/**
 * Calculate interest for a given period using Actual/365 day-count convention.
 * Interest = principal * rate * (daysInPeriod / 365)
 */
export function calculatePeriodInterest(
  drawnAmount: number,
  interestRate: number,
  periodStartDate: string,
  periodEndDate: string
): number {
  if (drawnAmount <= 0 || interestRate <= 0) return 0

  const start = new Date(periodStartDate)
  const end = new Date(periodEndDate)
  const daysInPeriod = Math.round(
    (end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysInPeriod <= 0) return 0

  const interest = drawnAmount * interestRate * (daysInPeriod / 365)
  return Math.round(interest * 100) / 100
}

/**
 * Get the drawn balance on Loans Payable (2500) for a specific fund as of a date.
 * Credits increase the balance (draws), debits decrease it (repayments).
 */
export async function getDrawnBalance(
  fundId: number,
  asOfDate: string
): Promise<number> {
  const [loansPayable] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '2500'))

  if (!loansPayable) return 0

  const [result] = await db
    .select({
      balance: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0) - COALESCE(SUM(${transactionLines.debit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(
      transactions,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(
      and(
        eq(transactionLines.accountId, loansPayable.id),
        eq(transactionLines.fundId, fundId),
        lte(transactions.date, asOfDate),
        eq(transactions.isVoided, false)
      )
    )

  return parseFloat(result?.balance ?? '0')
}

/**
 * Build the sourceReferenceId used for idempotency on accrual entries.
 */
export function accrualRefId(fundId: number, yearMonth: string): string {
  return `interest-accrual:${fundId}:${yearMonth}`
}

/**
 * Check whether an accrual has already been posted for a fund+month.
 */
export async function hasAccrualForMonth(
  fundId: number,
  yearMonth: string
): Promise<boolean> {
  const refId = accrualRefId(fundId, yearMonth)
  const [existing] = await db
    .select({ id: transactions.id })
    .from(transactions)
    .where(
      and(
        eq(transactions.sourceReferenceId, refId),
        eq(transactions.isVoided, false)
      )
    )
    .limit(1)
  return !!existing
}

export interface AccrualResult {
  fundId: number
  fundName: string
  yearMonth: string
  drawnBalance: number
  rate: number
  interest: number
  transactionId: number | null
  skipped: boolean
  skipReason?: string
}

/**
 * Accrue interest for a single LOAN fund for a given month.
 *
 * Posts: DR 5100 Interest Expense / CR 2520 Accrued Interest Payable
 * Idempotent — skips if an accrual already exists for this fund+month.
 */
export async function accrueInterestForFund(
  fundId: number,
  fundName: string,
  yearMonth: string
): Promise<AccrualResult> {
  const base = { fundId, fundName, yearMonth }

  // Idempotency check
  if (await hasAccrualForMonth(fundId, yearMonth)) {
    return {
      ...base,
      drawnBalance: 0,
      rate: 0,
      interest: 0,
      transactionId: null,
      skipped: true,
      skipReason: 'Accrual already posted',
    }
  }

  // Period = first to last day of month
  const [yearStr, monthStr] = yearMonth.split('-')
  const year = parseInt(yearStr)
  const month = parseInt(monthStr)
  const periodStart = `${yearMonth}-01`
  const periodEnd = new Date(year, month, 0).toISOString().split('T')[0] // last day of month

  // Get drawn balance as of end of period
  const drawnBalance = await getDrawnBalance(fundId, periodEnd)
  if (drawnBalance <= 0) {
    return {
      ...base,
      drawnBalance,
      rate: 0,
      interest: 0,
      transactionId: null,
      skipped: true,
      skipReason: 'No outstanding balance',
    }
  }

  // Get effective rate
  const rate = await getEffectiveRate(fundId, periodEnd)
  if (!rate || rate <= 0) {
    return {
      ...base,
      drawnBalance,
      rate: 0,
      interest: 0,
      transactionId: null,
      skipped: true,
      skipReason: 'No effective rate found',
    }
  }

  // Calculate interest
  const interest = calculatePeriodInterest(
    drawnBalance,
    rate,
    periodStart,
    periodEnd
  )
  if (interest <= 0) {
    return {
      ...base,
      drawnBalance,
      rate,
      interest: 0,
      transactionId: null,
      skipped: true,
      skipReason: 'Calculated interest is zero',
    }
  }

  // Look up GL accounts
  const [interestExpense] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '5100'))
  const [accruedInterest] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2520'))

  if (!interestExpense || !accruedInterest) {
    throw new Error(
      'Required accounts not found: Interest Expense (5100) and/or Accrued Interest Payable (2520)'
    )
  }

  // Post accrual journal entry
  const txnResult = await createTransaction({
    date: periodEnd,
    memo: `Monthly interest accrual - ${fundName} (${yearMonth})`,
    sourceType: 'SYSTEM',
    sourceReferenceId: accrualRefId(fundId, yearMonth),
    isSystemGenerated: true,
    createdBy: 'system:interest-accrual',
    lines: [
      {
        accountId: interestExpense.id,
        fundId,
        debit: interest,
        credit: null,
      },
      {
        accountId: accruedInterest.id,
        fundId,
        debit: null,
        credit: interest,
      },
    ],
  })

  return {
    ...base,
    drawnBalance,
    rate,
    interest,
    transactionId: txnResult.transaction.id,
    skipped: false,
  }
}

/**
 * Find all active LOAN-category funds.
 */
export async function getActiveLoanFunds(): Promise<
  { id: number; name: string }[]
> {
  return db
    .select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(
      and(eq(funds.fundingCategory, 'LOAN'), eq(funds.status, 'ACTIVE'))
    )
}
