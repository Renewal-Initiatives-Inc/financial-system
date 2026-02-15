import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  fixedAssets,
} from '@/lib/db/schema'

export type Form990Type = '990-N' | '990-EZ' | 'Full 990'

export interface Filing990Determination {
  formType: Form990Type
  grossReceipts: number
  grossReceiptsAverage: number
  totalAssets: number
  yearsOfOperation: number
  thresholdDetails: {
    grossReceiptsThreshold: number
    assetsThreshold: number
    grossReceiptsExceeded: boolean
    assetsExceeded: boolean
  }
}

export interface ThresholdStatus {
  currentAssets: number
  assetsThreshold: number
  ytdGrossReceipts: number
  grossReceiptsThreshold: number
  isFullFormTriggered: boolean
}

/**
 * Compute gross receipts (total revenue) for a fiscal year range.
 */
async function getGrossReceipts(startDate: string, endDate: string): Promise<number> {
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        COALESCE(CAST(${transactionLines.credit} AS numeric), 0) - COALESCE(CAST(${transactionLines.debit} AS numeric), 0)
      ), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'REVENUE'),
        eq(transactions.isVoided, false),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )

  return parseFloat(result[0]?.total ?? '0')
}

/**
 * Compute total assets as of a date (end-of-year balance).
 * Includes CIP (Construction in Progress) as assets.
 */
async function getTotalAssets(): Promise<number> {
  // Sum all ASSET account balances (debit normal balance: debits - credits)
  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(
        COALESCE(CAST(${transactionLines.debit} AS numeric), 0) - COALESCE(CAST(${transactionLines.credit} AS numeric), 0)
      ), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(eq(accounts.type, 'ASSET'), eq(transactions.isVoided, false))
    )

  return parseFloat(result[0]?.total ?? '0')
}

/**
 * Determine which 990 form RI must file for a given fiscal year.
 *
 * Rules:
 * - Year 1: gross receipts for that year only
 * - Years 1-3: average gross receipts over years of existence
 * - Year 4+: rolling 3-year average of prior years
 *
 * Thresholds:
 * - 990-N: gross receipts ≤ $50K
 * - 990-EZ: gross receipts < $200K AND total assets < $500K
 * - Full 990: either threshold exceeded
 *
 * Total assets test: end-of-year balance (no averaging) — includes CIP
 */
export async function determine990FormType(
  currentYear: number
): Promise<Filing990Determination> {
  // RI was founded in 2025 — first fiscal year
  const foundingYear = 2025
  const yearsOfOperation = currentYear - foundingYear + 1

  let grossReceiptsAverage: number

  if (yearsOfOperation <= 0) {
    grossReceiptsAverage = 0
  } else if (yearsOfOperation <= 3) {
    // Years 1-3: average over all years of existence
    let totalReceipts = 0
    for (let y = foundingYear; y <= currentYear; y++) {
      totalReceipts += await getGrossReceipts(`${y}-01-01`, `${y}-12-31`)
    }
    grossReceiptsAverage = totalReceipts / yearsOfOperation
  } else {
    // Year 4+: rolling 3-year average of prior years
    let totalReceipts = 0
    for (let y = currentYear - 3; y < currentYear; y++) {
      totalReceipts += await getGrossReceipts(`${y}-01-01`, `${y}-12-31`)
    }
    grossReceiptsAverage = totalReceipts / 3
  }

  const grossReceipts = await getGrossReceipts(
    `${currentYear}-01-01`,
    `${currentYear}-12-31`
  )
  const totalAssets = await getTotalAssets()

  const grossReceiptsExceeded = grossReceiptsAverage >= 200000
  const assetsExceeded = totalAssets >= 500000

  let formType: Form990Type
  if (grossReceiptsAverage <= 50000) {
    formType = '990-N'
  } else if (!grossReceiptsExceeded && !assetsExceeded) {
    formType = '990-EZ'
  } else {
    formType = 'Full 990'
  }

  return {
    formType,
    grossReceipts,
    grossReceiptsAverage,
    totalAssets,
    yearsOfOperation,
    thresholdDetails: {
      grossReceiptsThreshold: 200000,
      assetsThreshold: 500000,
      grossReceiptsExceeded,
      assetsExceeded,
    },
  }
}

/**
 * Quick check for dashboard alert: have we crossed the Full 990 threshold?
 */
export async function check990Thresholds(): Promise<ThresholdStatus> {
  const currentYear = new Date().getFullYear()
  const determination = await determine990FormType(currentYear)

  return {
    currentAssets: determination.totalAssets,
    assetsThreshold: 500000,
    ytdGrossReceipts: determination.grossReceipts,
    grossReceiptsThreshold: 200000,
    isFullFormTriggered: determination.formType === 'Full 990',
  }
}
