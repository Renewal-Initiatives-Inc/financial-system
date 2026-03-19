/**
 * Daily close orchestrator (Phase 23a Task 4).
 *
 * Runs auto-match across all active bank accounts and aggregates results.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts } from '@/lib/db/schema'
import { applyMatchingRules } from './matcher'
import { runAutoMatch } from './matcher'
import type { AutoMatchResult } from './matcher'

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
 * Run daily close: auto-match across all active bank accounts.
 * Called after Plaid sync completes (or independently if sync fails).
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
      const matchResult = await runAutoMatch(account.id)

      result.accountResults.push({
        bankAccountId: account.id,
        bankAccountName: account.name,
        autoMatched: matchResult.autoMatched,
        pendingReview: matchResult.pendingReview,
        exceptions: matchResult.exceptions,
        errors: matchResult.errors,
      })

      result.totals.autoMatched += matchResult.autoMatched
      result.totals.pendingReview += matchResult.pendingReview
      result.totals.exceptions += matchResult.exceptions

      if (matchResult.errors.length > 0) {
        result.errors.push(
          ...matchResult.errors.map((e) => `${account.name}: ${e}`)
        )
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`${account.name}: ${message}`)
      console.error(`Daily close auto-match failed for ${account.name}:`, message)
    }
  }

  return result
}
