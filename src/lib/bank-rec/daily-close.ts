/**
 * Daily close orchestrator (Phase 23a Task 4).
 *
 * Reads pre-computed tier counts from bank_transactions rows
 * (classification happens at sync time via classifyBankTransactions).
 */

import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, bankTransactions, bankMatches } from '@/lib/db/schema'
import { classifyBankTransactions } from './matcher'

export interface DailyCloseResult {
  accountResults: {
    bankAccountId: number
    bankAccountName: string
    autoMatched: number
    pendingReview: number
    exceptions: number
    errors: string[]
  }[]
  totals: {
    autoMatched: number
    pendingReview: number
    exceptions: number
  }
  errors: string[]
}

/**
 * Run daily close: classify any remaining unclassified transactions,
 * then read stored tier counts from DB.
 */
export async function runDailyClose(): Promise<DailyCloseResult> {
  const activeAccounts = await db
    .select({ id: bankAccounts.id, name: bankAccounts.name })
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))

  const result: DailyCloseResult = {
    accountResults: [],
    totals: { autoMatched: 0, pendingReview: 0, exceptions: 0 },
    errors: [],
  }

  for (const account of activeAccounts) {
    try {
      // Classify any remaining unclassified transactions
      const classResult = await classifyBankTransactions(account.id)

      // Read stored tier counts from DB
      const tierCounts = await db
        .select({
          tier: bankTransactions.matchTier,
          count: sql<number>`count(*)::int`,
        })
        .from(bankTransactions)
        .where(
          and(
            eq(bankTransactions.bankAccountId, account.id),
            eq(bankTransactions.isPending, false)
          )
        )
        .groupBy(bankTransactions.matchTier)

      const tierMap = new Map(tierCounts.map((r) => [r.tier, r.count]))

      // Count auto-matches from bank_matches table
      const autoMatched = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(bankMatches)
        .innerJoin(bankTransactions, eq(bankMatches.bankTransactionId, bankTransactions.id))
        .where(
          and(
            eq(bankTransactions.bankAccountId, account.id),
            eq(bankMatches.matchType, 'auto')
          )
        )
        .then((rows) => rows[0]?.count ?? 0)

      const pendingReview = tierMap.get(2) ?? 0
      const exceptions = tierMap.get(3) ?? 0

      result.accountResults.push({
        bankAccountId: account.id,
        bankAccountName: account.name,
        autoMatched,
        pendingReview,
        exceptions,
        errors: classResult.errors,
      })

      result.totals.autoMatched += autoMatched
      result.totals.pendingReview += pendingReview
      result.totals.exceptions += exceptions

      if (classResult.errors.length > 0) {
        result.errors.push(
          ...classResult.errors.map((e) => `${account.name}: ${e}`)
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`${account.name}: ${message}`)
      console.error(`Daily close failed for ${account.name}:`, message)
    }
  }

  return result
}
