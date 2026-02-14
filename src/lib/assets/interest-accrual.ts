import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  ahpLoanConfig,
  cipConversions,
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

export interface InterestAccrualResult {
  mode: 'construction' | 'post-construction'
  amount: number
  transactionId: number
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
 * Calculate interest for a given period using Actual/365 day-count convention.
 * Interest = drawnAmount * rate * (daysInPeriod / 365)
 *
 * NOTE: Do NOT use rate/12 — the AHP loan specifies Actual/365,
 * which produces different amounts per month (28-31 days).
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
 * Check if interest accrual has already been posted for a given month.
 */
async function hasAccrualForMonth(yearMonth: string): Promise<boolean> {
  // Look up Accrued Interest Payable account (2520)
  const aipAccount = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, '2520'),
  })
  if (!aipAccount) return false

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
        eq(transactionLines.accountId, aipAccount.id),
        sql`to_char(${transactions.date}::date, 'YYYY-MM') = ${yearMonth}`
      )
    )

  return Number(result[0].count) > 0
}

/**
 * Look up the General Fund ID.
 */
async function getGeneralFundId(): Promise<number> {
  const fund = await db.query.funds.findFirst({
    where: (f, { eq }) => eq(f.name, 'General Fund'),
  })
  if (!fund) throw new Error('General Fund not found')
  return fund.id
}

/**
 * Generate the monthly AHP interest accrual entry.
 *
 * During construction: DR CIP - Construction Interest (1550), CR Accrued Interest Payable (2520)
 * Post-construction:  DR Interest Expense (5100), CR Accrued Interest Payable (2520)
 *
 * Idempotent: skips if already accrued for the target month.
 */
export async function generateInterestAccrualEntry(
  asOfDate: string,
  userId: string
): Promise<InterestAccrualResult | null> {
  // Read AHP loan config
  const [loanConfig] = await db.select().from(ahpLoanConfig).limit(1)
  if (!loanConfig) {
    throw new Error('AHP loan config not found. Run seed first.')
  }

  const drawnAmount = Number(loanConfig.currentDrawnAmount)
  if (drawnAmount <= 0) return null // No interest to accrue

  const yearMonth = asOfDate.slice(0, 7)

  // Idempotency check
  const alreadyProcessed = await hasAccrualForMonth(yearMonth)
  if (alreadyProcessed) return null

  // Determine period: first of month to asOfDate
  const periodStart = `${yearMonth}-01`
  const rate = Number(loanConfig.currentInterestRate)

  const interest = calculatePeriodInterest(
    drawnAmount,
    rate,
    periodStart,
    asOfDate
  )

  if (interest <= 0) return null

  // Check construction status for GL routing
  const { isConstructionComplete } = await getConstructionStatus()
  const mode = isConstructionComplete ? 'post-construction' : 'construction'

  const generalFundId = await getGeneralFundId()

  // Determine debit account based on mode
  const debitAccountCode = isConstructionComplete ? '5100' : '1550'
  const debitAccount = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, debitAccountCode),
  })
  if (!debitAccount) {
    throw new Error(`Account ${debitAccountCode} not found`)
  }

  // Credit: Accrued Interest Payable (2520)
  const creditAccount = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, '2520'),
  })
  if (!creditAccount) {
    throw new Error('Accrued Interest Payable account (2520) not found')
  }

  const dateObj = new Date(asOfDate)
  const monthYear = dateObj.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const memoPrefix = isConstructionComplete
    ? 'AHP interest accrual'
    : 'AHP interest accrual (construction)'

  const result = await createTransaction({
    date: asOfDate,
    memo: `${memoPrefix} - ${monthYear}`,
    sourceType: 'SYSTEM',
    isSystemGenerated: true,
    createdBy: userId,
    lines: [
      {
        accountId: debitAccount.id,
        fundId: generalFundId,
        debit: interest,
        credit: null,
      },
      {
        accountId: creditAccount.id,
        fundId: generalFundId,
        debit: null,
        credit: interest,
      },
    ],
  })

  return {
    mode,
    amount: interest,
    transactionId: result.transaction.id,
  }
}
