/**
 * GL-only entry detection (REC-P0-011).
 *
 * Identifies GL entries that have no expected bank counterpart,
 * so they don't appear as "unmatched" warnings during reconciliation.
 */

import { eq, and, sql, between, notInArray, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
  bankMatches,
  bankAccounts,
} from '@/lib/db/schema'

// --- Types ---

export interface GlEntryRow {
  lineId: number
  transactionId: number
  date: string
  memo: string
  accountId: number
  accountName: string
  accountCode: string
  fundId: number
  fundName: string
  debit: string | null
  credit: string | null
  amount: number
  sourceType: string
  isGlOnly: boolean
  isMatched: boolean
}

// --- GL-only source types ---

/** Source types that never have a bank counterpart */
const GL_ONLY_SOURCE_TYPES = ['SYSTEM', 'FY25_IMPORT'] as const

/** Account name patterns that indicate GL-only entries */
const GL_ONLY_ACCOUNT_PATTERNS = [
  'accumulated depreciation',
  'net assets with donor restrictions',
  'net assets without donor restrictions',
  'accrued interest payable',
] as const

/**
 * Check if a GL entry is GL-only (no expected bank counterpart).
 */
export function isGlOnlyEntry(entry: {
  sourceType: string
  accountName: string
}): boolean {
  // Check source type
  if (
    GL_ONLY_SOURCE_TYPES.includes(
      entry.sourceType as (typeof GL_ONLY_SOURCE_TYPES)[number]
    )
  ) {
    return true
  }

  // Check account name patterns
  const lowerName = entry.accountName.toLowerCase()
  return GL_ONLY_ACCOUNT_PATTERNS.some((pattern) =>
    lowerName.includes(pattern)
  )
}

/**
 * Get unmatched GL entries for a bank account within a date range,
 * filtering out GL-only entries.
 */
export async function getUnmatchedGlEntries(
  bankAccountId: number,
  dateRange: { start: string; end: string }
): Promise<GlEntryRow[]> {
  // Get GL account ID for this bank account
  const [bankAcct] = await db
    .select({ glAccountId: bankAccounts.glAccountId })
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))

  if (!bankAcct) return []

  // Get all GL lines for this cash account in the date range
  const entries = await db
    .select({
      lineId: transactionLines.id,
      transactionId: transactionLines.transactionId,
      date: transactions.date,
      memo: transactions.memo,
      accountId: transactionLines.accountId,
      accountName: accounts.name,
      accountCode: accounts.code,
      fundId: transactionLines.fundId,
      fundName: funds.name,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
      sourceType: transactions.sourceType,
      isVoided: transactions.isVoided,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(
      and(
        eq(transactionLines.accountId, bankAcct.glAccountId),
        eq(transactions.isVoided, false),
        between(transactions.date, dateRange.start, dateRange.end)
      )
    )
    .orderBy(transactions.date)

  // Get matched line IDs
  const matchedLines = await db
    .select({ lineId: bankMatches.glTransactionLineId })
    .from(bankMatches)

  const matchedSet = new Set(matchedLines.map((m) => m.lineId))

  return entries.map((e) => {
    const amount = e.debit ? parseFloat(e.debit) : e.credit ? -parseFloat(e.credit) : 0

    return {
      lineId: e.lineId,
      transactionId: e.transactionId,
      date: e.date,
      memo: e.memo,
      accountId: e.accountId,
      accountName: e.accountName,
      accountCode: e.accountCode,
      fundId: e.fundId,
      fundName: e.fundName,
      debit: e.debit,
      credit: e.credit,
      amount,
      sourceType: e.sourceType,
      isGlOnly: isGlOnlyEntry({
        sourceType: e.sourceType,
        accountName: e.accountName,
      }),
      isMatched: matchedSet.has(e.lineId),
    }
  })
}

/**
 * Get outstanding items: GL entries without bank match that are NOT GL-only.
 */
export async function getOutstandingItems(
  bankAccountId: number,
  dateRange: { start: string; end: string }
): Promise<GlEntryRow[]> {
  const allEntries = await getUnmatchedGlEntries(bankAccountId, dateRange)
  return allEntries.filter((e) => !e.isMatched && !e.isGlOnly)
}
