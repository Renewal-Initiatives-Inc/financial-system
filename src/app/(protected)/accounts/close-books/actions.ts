'use server'

import { and, eq, gte, lte, sql, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  bankAccounts,
  reconciliationSessions,
  bankTransactions,
  bankMatches,
  functionalAllocations,
  fiscalYearLocks,
  fixedAssets,
} from '@/lib/db/schema'
import { getUserId } from '@/lib/auth'
import { isYearLocked, lockYear } from '@/lib/fiscal-year-lock'
import { logAudit } from '@/lib/audit/logger'
import {
  computeClosingEntries,
  type ClosingEntriesPreview,
} from '@/lib/year-end-close/compute-closing-entries'
import { createTransaction } from '@/lib/gl/engine'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// ── Types ──

export interface ChecklistItem {
  id: string
  label: string
  passed: boolean
  detail?: string
}

export interface ChecklistResult {
  allPassed: boolean
  items: ChecklistItem[]
}

// ── Pre-Close Checklist ──

export async function runPreCloseChecklist(
  fiscalYear: number
): Promise<ChecklistResult> {
  await getUserId() // auth gate

  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`
  const decStart = `${fiscalYear}-12-01`
  const decEnd = `${fiscalYear}-12-31`

  const items: ChecklistItem[] = []

  // 1. Bank recs complete — every active bank account has a completed
  //    reconciliation session with statementDate >= last day of fiscal year
  const activeBanks = await db
    .select({ id: bankAccounts.id, name: bankAccounts.name })
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))

  if (activeBanks.length === 0) {
    items.push({
      id: 'bank_recs_complete',
      label: 'Bank reconciliations complete for all active accounts',
      passed: true,
      detail: 'No active bank accounts — check passes automatically.',
    })
  } else {
    const completedRecs = await db
      .select({ bankAccountId: reconciliationSessions.bankAccountId })
      .from(reconciliationSessions)
      .where(
        and(
          eq(reconciliationSessions.status, 'completed'),
          gte(reconciliationSessions.statementDate, endDate)
        )
      )
    const reconciledBankIds = new Set(completedRecs.map((r) => r.bankAccountId))
    const missingBanks = activeBanks.filter((b) => !reconciledBankIds.has(b.id))

    items.push({
      id: 'bank_recs_complete',
      label: 'Bank reconciliations complete for all active accounts',
      passed: missingBanks.length === 0,
      detail:
        missingBanks.length > 0
          ? `Missing completed reconciliation (statement date ≥ ${endDate}) for: ${missingBanks.map((b) => b.name).join(', ')}`
          : undefined,
    })
  }

  // 2. No unmatched bank transactions in the fiscal year
  //    A bank transaction is "unmatched" if no bankMatches row exists for it
  //    and it is not pending
  const unmatchedResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(bankTransactions)
    .leftJoin(bankMatches, eq(bankTransactions.id, bankMatches.bankTransactionId))
    .where(
      and(
        gte(bankTransactions.date, startDate),
        lte(bankTransactions.date, endDate),
        eq(bankTransactions.isPending, false),
        isNull(bankMatches.id)
      )
    )
  const unmatchedCount = unmatchedResult[0]?.count ?? 0

  items.push({
    id: 'no_unmatched_bank_transactions',
    label: 'All bank transactions matched for the fiscal year',
    passed: unmatchedCount === 0,
    detail:
      unmatchedCount > 0
        ? `${unmatchedCount} unmatched bank transaction${unmatchedCount === 1 ? '' : 's'} dated in ${fiscalYear}. Resolve these in Bank Reconciliation before closing.`
        : undefined,
  })

  // 3. Payroll December posted — at least one non-voided transaction with
  //    sourceType TIMESHEET or SYSTEM dated in December
  const payrollResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(transactions)
    .where(
      and(
        sql`${transactions.sourceType} IN ('TIMESHEET', 'SYSTEM')`,
        gte(transactions.date, decStart),
        lte(transactions.date, decEnd),
        eq(transactions.isVoided, false)
      )
    )
  const payrollCount = payrollResult[0]?.count ?? 0

  items.push({
    id: 'payroll_december_posted',
    label: 'December payroll posted',
    passed: payrollCount > 0,
    detail:
      payrollCount === 0
        ? `No payroll/system transactions found for December ${fiscalYear}. If the organization had no December payroll, this may be expected — verify before proceeding.`
        : undefined,
  })

  // 4. Depreciation December posted — at least one SYSTEM transaction in December
  //    that debits account 5200 (Depreciation Expense).
  //    Auto-passes if the org has no active fixed assets (nothing to depreciate).
  const activeAssetResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(fixedAssets)
    .where(eq(fixedAssets.isActive, true))
  const activeAssetCount = activeAssetResult[0]?.count ?? 0

  if (activeAssetCount === 0) {
    items.push({
      id: 'depreciation_december_posted',
      label: 'December depreciation posted',
      passed: true,
      detail: 'No active fixed assets — depreciation check passes automatically.',
    })
  } else {
    const depreciationResult = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(transactions)
      .innerJoin(transactionLines, eq(transactions.id, transactionLines.transactionId))
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(
        and(
          eq(transactions.sourceType, 'SYSTEM'),
          gte(transactions.date, decStart),
          lte(transactions.date, decEnd),
          eq(transactions.isVoided, false),
          eq(accounts.code, '5200'),
          sql`${transactionLines.debit} IS NOT NULL`
        )
      )
    const depreciationCount = depreciationResult[0]?.count ?? 0

    items.push({
      id: 'depreciation_december_posted',
      label: 'December depreciation posted',
      passed: depreciationCount > 0,
      detail:
        depreciationCount === 0
          ? `No depreciation expense (account 5200) posted for December ${fiscalYear}. Post depreciation from Assets > Fixed Assets before closing.`
          : undefined,
    })
  }

  // 5. Functional allocation complete — at least one functional_allocations
  //    record exists for the fiscal year.
  //    Check if there are ANY allocations for ANY year first — if none exist at all,
  //    the org hasn't set up functional allocations yet, which is acceptable
  //    for a first-time close.
  const allocResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, fiscalYear))
  const allocCount = allocResult[0]?.count ?? 0

  const anyAllocResult = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(functionalAllocations)
  const anyAllocCount = anyAllocResult[0]?.count ?? 0

  if (anyAllocCount === 0) {
    // Org has never set up functional allocations — auto-pass with note
    items.push({
      id: 'functional_allocation_complete',
      label: 'Functional expense allocation complete',
      passed: true,
      detail: 'No functional allocations configured. Set up allocations at Compliance > Functional Allocation before generating Form 990 reports.',
    })
  } else {
    items.push({
      id: 'functional_allocation_complete',
      label: 'Functional expense allocation complete',
      passed: allocCount > 0,
      detail:
        allocCount === 0
          ? `No functional allocation records found for fiscal year ${fiscalYear}. Set up allocations at Compliance > Functional Allocation.`
          : undefined,
    })
  }

  // 6. Year not already closed
  const alreadyLocked = await isYearLocked(fiscalYear)

  items.push({
    id: 'year_not_already_closed',
    label: 'Fiscal year not already closed',
    passed: !alreadyLocked,
    detail: alreadyLocked
      ? `Fiscal year ${fiscalYear} is already closed. To make adjustments, reopen the year in Settings > Fiscal Years first.`
      : undefined,
  })

  return {
    allPassed: items.every((item) => item.passed),
    items,
  }
}

// ── Closing Entries Preview (server action wrapper) ──

export async function getClosingEntriesPreview(
  fiscalYear: number
): Promise<ClosingEntriesPreview> {
  await getUserId() // auth gate
  return computeClosingEntries(fiscalYear)
}

// ── Post Year-End Close ──

export async function postYearEndClose(
  fiscalYear: number
): Promise<{ success: boolean; transactionIds: number[]; error?: string }> {
  const userId = await getUserId()

  // Re-compute closing entries server-side (don't trust client preview data)
  const preview = await computeClosingEntries(fiscalYear)

  if (preview.funds.length === 0) {
    return {
      success: false,
      transactionIds: [],
      error: `No revenue or expense activity found for fiscal year ${fiscalYear}. Nothing to close.`,
    }
  }

  try {
    const transactionIds: number[] = []

    // Post closing JEs per fund — each goes through the GL engine's own
    // db.transaction() for atomicity and audit logging.
    for (const fund of preview.funds) {
      const lines: Array<{
        accountId: number
        fundId: number
        debit?: number | null
        credit?: number | null
        memo?: string | null
      }> = []

      // Zero out each revenue account.
      // Normal case: positive amount = credit balance → debit to zero.
      // Abnormal case: negative amount = debit balance → credit to zero.
      for (const rev of fund.revenueLines) {
        if (rev.amount === 0) continue
        if (rev.amount > 0) {
          lines.push({ accountId: rev.accountId, fundId: fund.fundId, debit: rev.amount, credit: null })
        } else {
          lines.push({ accountId: rev.accountId, fundId: fund.fundId, debit: null, credit: Math.abs(rev.amount) })
        }
      }

      // Zero out each expense account.
      // Normal case: positive amount = debit balance → credit to zero.
      // Abnormal case: negative amount = credit balance → debit to zero.
      for (const exp of fund.expenseLines) {
        if (exp.amount === 0) continue
        if (exp.amount > 0) {
          lines.push({ accountId: exp.accountId, fundId: fund.fundId, debit: null, credit: exp.amount })
        } else {
          lines.push({ accountId: exp.accountId, fundId: fund.fundId, debit: Math.abs(exp.amount), credit: null })
        }
      }

      // Retained earnings line — net difference
      // netToRetainedEarnings > 0 means revenue > expenses → credit RE
      // netToRetainedEarnings < 0 means expenses > revenue → debit RE
      if (fund.netToRetainedEarnings > 0) {
        lines.push({
          accountId: fund.retainedEarningsAccountId,
          fundId: fund.fundId,
          debit: null,
          credit: Math.round(fund.netToRetainedEarnings * 100) / 100,
        })
      } else if (fund.netToRetainedEarnings < 0) {
        lines.push({
          accountId: fund.retainedEarningsAccountId,
          fundId: fund.fundId,
          debit: Math.round(Math.abs(fund.netToRetainedEarnings) * 100) / 100,
          credit: null,
        })
      }

      if (lines.length < 2) continue // Skip funds with insufficient lines

      // Post via GL engine — YEAR_END_CLOSE is exempt from soft lock check
      const result = await createTransaction({
        date: `${fiscalYear}-12-31`,
        memo: `Year-end closing entry — ${fiscalYear} — ${fund.fundName}`,
        sourceType: 'YEAR_END_CLOSE',
        sourceReferenceId: `year-end-close:${fiscalYear}:${fund.fundId}`,
        isSystemGenerated: true,
        createdBy: userId,
        lines,
      })

      transactionIds.push(result.transaction.id)
    }

    // All JEs posted — now lock the year and write audit log atomically
    await db.transaction(async (tx) => {
      await lockYear(fiscalYear, userId)

      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId,
        action: 'posted',
        entityType: 'fiscal_year_locks',
        entityId: fiscalYear,
        afterState: {
          fiscalYear,
          fundsClosedCount: preview.funds.length,
          transactionIds,
          totalNetChange: preview.totalNetChange,
        },
      })
    })

    return { success: true, transactionIds }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unknown error during year-end close'
    return { success: false, transactionIds: [], error: message }
  }
}
