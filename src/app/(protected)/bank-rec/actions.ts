'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bankAccounts,
  bankTransactions,
  bankMatches,
  matchingRules,
  reconciliationSessions,
  transactionLines,
} from '@/lib/db/schema'
import {
  findMatchCandidates,
  createMatch,
  createSplitMatches,
  removeMatch,
  applyMatchingRules,
  getBatchReviewCandidates,
  getExceptions,
  classifyBankTransactions,
  reclassifyUnmatched,
  type BatchReviewItem,
  type ExceptionItem,
  type AutoMatchResult,
} from '@/lib/bank-rec/matcher'
import { getUnmatchedGlEntries, type GlEntryRow } from '@/lib/bank-rec/gl-only-categories'
import {
  createReconciliationSession,
  getActiveSession,
  getReconciliationSummary,
  calculateReconciliationBalance,
  signOffReconciliation as signOff,
  type ReconciliationSummary,
  type ReconciliationBalance,
} from '@/lib/bank-rec/reconciliation'
import { getRampSettlementSummary } from '@/lib/ramp/settlement-crosscheck'
import { createTransaction } from '@/lib/gl/engine'
import { decrypt } from '@/lib/encryption'
import { syncTransactions } from '@/lib/integrations/plaid'
import { sendPlaidSyncFailureEmail } from '@/lib/integrations/plaid-sync-notification'
import { auth } from '@/lib/auth'
import type { MatchCandidate } from '@/lib/bank-rec/matcher'

/** Get authenticated user info for audit trails. Falls back to 'system' if no session. */
async function getAuthUser(): Promise<{ id: string; name: string }> {
  const session = await auth()
  return {
    id: session?.user?.id ?? 'system',
    name: session?.user?.name ?? 'system',
  }
}

// --- Types ---

export type BankAccountOption = {
  id: number
  name: string
  institution: string
  last4: string
}

export type BankTransactionRow = {
  id: number
  bankAccountId: number
  plaidTransactionId: string
  amount: string
  date: string
  merchantName: string | null
  category: string | null
  isPending: boolean
  isMatched: boolean
  matchId: number | null
  matchType: string | null
  glTransactionId: number | null
}

export type SessionData = {
  session: typeof reconciliationSessions.$inferSelect | null
  summary: ReconciliationSummary | null
  balance: ReconciliationBalance | null
}

export type CrossCheckResult = {
  settlementAmount: number
  rampTotal: number
  rampCount: number
  variance: number
  isMatched: boolean
}

// --- Server Actions ---

export async function getBankAccountsForSelector(): Promise<BankAccountOption[]> {
  return db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      institution: bankAccounts.institution,
      last4: bankAccounts.last4,
    })
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))
    .orderBy(bankAccounts.name)
}

export async function getBankTransactions(
  bankAccountId: number,
  statementDate?: string
): Promise<BankTransactionRow[]> {
  const conditions = [eq(bankTransactions.bankAccountId, bankAccountId)]
  if (statementDate) {
    conditions.push(lte(bankTransactions.date, statementDate))
  }

  const txns = await db
    .select()
    .from(bankTransactions)
    .where(and(...conditions))
    .orderBy(bankTransactions.date)

  // Get matches for these transactions
  const matchedResult = await db
    .select({
      bankTxnId: bankMatches.bankTransactionId,
      matchId: bankMatches.id,
      matchType: bankMatches.matchType,
    })
    .from(bankMatches)

  const matchMap = new Map(
    matchedResult.map((m) => [m.bankTxnId, { matchId: m.matchId, matchType: m.matchType }])
  )

  return txns.map((t) => {
    const match = matchMap.get(t.id)
    return {
      id: t.id,
      bankAccountId: t.bankAccountId,
      plaidTransactionId: t.plaidTransactionId,
      amount: t.amount,
      date: t.date,
      merchantName: t.merchantName,
      category: t.category,
      isPending: t.isPending,
      isMatched: !!match,
      matchId: match?.matchId ?? null,
      matchType: match?.matchType ?? null,
      glTransactionId: null,
    }
  })
}

export async function getMatchableGlEntries(
  bankAccountId: number,
  statementDate?: string
): Promise<GlEntryRow[]> {
  return getUnmatchedGlEntries(bankAccountId, {
    start: '1900-01-01',
    end: statementDate ?? new Date().toISOString().substring(0, 10),
  })
}

export async function getMatchSuggestions(
  bankTransactionId: number
): Promise<MatchCandidate[]> {
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, bankTransactionId))

  if (!bankTxn) return []

  return findMatchCandidates({
    id: bankTxn.id,
    amount: bankTxn.amount,
    date: bankTxn.date,
    merchantName: bankTxn.merchantName,
    bankAccountId: bankTxn.bankAccountId,
  })
}

export async function confirmMatch(
  bankTransactionId: number,
  glTransactionLineId: number,
  sessionId: number | null,
  userId: string
): Promise<void> {
  // Get bank account ID for reclassification
  const [txn] = await db
    .select({ bankAccountId: bankTransactions.bankAccountId })
    .from(bankTransactions)
    .where(eq(bankTransactions.id, bankTransactionId))

  await createMatch({
    bankTransactionId,
    glTransactionLineId,
    matchType: 'manual',
    reconciliationSessionId: sessionId ?? undefined,
    userId,
  })

  // Reclassify unmatched after consuming a GL line (fire and forget)
  if (txn) {
    reclassifyUnmatched(txn.bankAccountId).catch(console.error)
  }

  revalidatePath('/bank-rec')
}

export async function splitAndMatch(
  bankTransactionId: number,
  splits: { glTransactionLineId: number; amount: number }[],
  sessionId: number | null,
  userId: string
): Promise<void> {
  await createSplitMatches({
    bankTransactionId,
    splits,
    reconciliationSessionId: sessionId ?? undefined,
    userId,
  })
  revalidatePath('/bank-rec')
}

export async function rejectMatch(
  matchId: number,
  userId: string,
  bankAccountId?: number
): Promise<void> {
  await removeMatch(matchId, userId)

  // Reclassify unmatched after freeing a GL line (fire and forget)
  if (bankAccountId) {
    reclassifyUnmatched(bankAccountId).catch(console.error)
  }

  revalidatePath('/bank-rec')
}

/**
 * Shared helper: fetch bank txn + bank acct, create GL entry, match cash lines.
 * Used by both single-entry and split-entry flows.
 */
async function createGlEntryWithMatch(params: {
  bankTransactionId: number
  date: string
  memo: string
  sourceRefSuffix: string
  splits: { accountId: number; fundId: number; amount: number }[]
  sessionId?: number
  userId: string
}): Promise<void> {
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, params.bankTransactionId))

  if (!bankTxn) throw new Error('Bank transaction not found')

  const [bankAcct] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankTxn.bankAccountId))

  if (!bankAcct) throw new Error('Bank account not found')

  const isOutflow = parseFloat(bankTxn.amount) > 0

  // Build debit/credit lines: one offsetting + one cash per split
  const lines: { accountId: number; fundId: number; debit: number | null; credit: number | null }[] = []
  for (const split of params.splits) {
    const amt = Math.abs(split.amount)
    if (isOutflow) {
      lines.push({ accountId: split.accountId, fundId: split.fundId, debit: amt, credit: null })
      lines.push({ accountId: bankAcct.glAccountId, fundId: split.fundId, debit: null, credit: amt })
    } else {
      lines.push({ accountId: bankAcct.glAccountId, fundId: split.fundId, debit: amt, credit: null })
      lines.push({ accountId: split.accountId, fundId: split.fundId, debit: null, credit: amt })
    }
  }

  const result = await createTransaction({
    date: params.date,
    memo: params.memo,
    sourceType: 'BANK_FEED',
    sourceReferenceId: `bank-txn-${params.sourceRefSuffix}-${params.bankTransactionId}`,
    createdBy: params.userId,
    isSystemGenerated: false,
    lines,
  })

  // Match cash-side lines to the bank transaction
  const cashLines = result.transaction.lines.filter(
    (l) => l.accountId === bankAcct.glAccountId
  )
  for (const line of cashLines) {
    await createMatch({
      bankTransactionId: params.bankTransactionId,
      glTransactionLineId: line.id,
      matchType: 'manual',
      reconciliationSessionId: params.sessionId,
      userId: params.userId,
    })
  }
}

export async function createInlineGlEntry(
  data: {
    date: string
    memo: string
    accountId: number
    fundId: number
    amount: string
    bankTransactionId: number
  },
  sessionId: number | null
): Promise<void> {
  const user = await getAuthUser()

  await createGlEntryWithMatch({
    bankTransactionId: data.bankTransactionId,
    date: data.date,
    memo: data.memo,
    sourceRefSuffix: 'inline',
    splits: [{ accountId: data.accountId, fundId: data.fundId, amount: parseFloat(data.amount) }],
    sessionId: sessionId ?? undefined,
    userId: user.name,
  })

  revalidatePath('/bank-rec')
}

export async function splitAndCreateGlEntries(
  data: {
    bankTransactionId: number
    date: string
    memo: string
    splits: { accountId: number; fundId: number; amount: number }[]
  },
  sessionId: number | null
): Promise<void> {
  const user = await getAuthUser()

  // Validate split total matches bank transaction
  const [bankTxn] = await db
    .select({ amount: bankTransactions.amount })
    .from(bankTransactions)
    .where(eq(bankTransactions.id, data.bankTransactionId))

  if (!bankTxn) throw new Error('Bank transaction not found')

  const bankAmount = Math.abs(parseFloat(bankTxn.amount))
  const splitSum = data.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)

  if (Math.abs(bankAmount - splitSum) > 0.01) {
    throw new Error(
      `Split amounts ($${splitSum.toFixed(2)}) do not equal bank transaction amount ($${bankAmount.toFixed(2)})`
    )
  }

  await createGlEntryWithMatch({
    bankTransactionId: data.bankTransactionId,
    date: data.date,
    memo: data.memo,
    sourceRefSuffix: 'split',
    splits: data.splits,
    sessionId: sessionId ?? undefined,
    userId: user.name,
  })

  revalidatePath('/bank-rec')
}

export async function createMatchingRuleAction(
  criteria: { merchantPattern?: string; amountExact?: string },
  action: { glAccountId: number; fundId: number }
): Promise<void> {
  const user = await getAuthUser()
  await db.insert(matchingRules).values({
    criteria,
    action,
    createdBy: user.name,
  })
  revalidatePath('/bank-rec')
}

export async function getReconciliationSession(
  bankAccountId: number
): Promise<SessionData> {
  const session = await getActiveSession(bankAccountId)
  if (!session) return { session: null, summary: null, balance: null }

  const [summary, balance] = await Promise.all([
    getReconciliationSummary(session.id),
    calculateReconciliationBalance(session.id),
  ])

  return { session, summary, balance }
}

export async function startReconciliationSession(
  bankAccountId: number,
  statementDate: string,
  statementBalance: string,
  userId: string
): Promise<void> {
  await createReconciliationSession({
    bankAccountId,
    statementDate,
    statementBalance,
    userId,
  })
  revalidatePath('/bank-rec')
}

export async function signOffReconciliation(
  sessionId: number,
  userId: string
): Promise<void> {
  await signOff(sessionId, userId)
  revalidatePath('/bank-rec')
}

export async function triggerManualSync(
  bankAccountId: number,
  _userId: string
): Promise<{ added: number; modified: number }> {
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))

  if (!account) throw new Error('Bank account not found')

  try {
    const accessToken = decrypt(account.plaidAccessToken)
    let cursor = account.plaidCursor
    let hasMore = true
    let totalAdded = 0
    let totalModified = 0

    while (hasMore) {
      const result = await syncTransactions(accessToken, cursor)

      for (const txn of result.added) {
        await db
          .insert(bankTransactions)
          .values({
            bankAccountId: account.id,
            plaidTransactionId: txn.plaidTransactionId,
            amount: String(txn.amount),
            date: txn.date,
            merchantName: txn.merchantName,
            category: txn.category,
            isPending: txn.isPending,
            paymentChannel: txn.paymentChannel,
            rawData: txn.rawData,
          })
          .onConflictDoNothing({
            target: bankTransactions.plaidTransactionId,
          })
        totalAdded++
      }

      for (const txn of result.modified) {
        await db
          .update(bankTransactions)
          .set({
            amount: String(txn.amount),
            date: txn.date,
            merchantName: txn.merchantName,
            category: txn.category,
            isPending: txn.isPending,
            paymentChannel: txn.paymentChannel,
            rawData: txn.rawData,
            updatedAt: new Date(),
          })
          .where(eq(bankTransactions.plaidTransactionId, txn.plaidTransactionId))
        totalModified++
      }

      for (const plaidId of result.removed) {
        await db
          .delete(bankTransactions)
          .where(eq(bankTransactions.plaidTransactionId, plaidId))
      }

      cursor = result.nextCursor
      hasMore = result.hasMore
    }

    await db
      .update(bankAccounts)
      .set({ plaidCursor: cursor })
      .where(eq(bankAccounts.id, account.id))

    // Classify all unclassified transactions (composite scoring + tier assignment)
    await classifyBankTransactions(bankAccountId)

    revalidatePath('/bank-rec')
    return { added: totalAdded, modified: totalModified }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await sendPlaidSyncFailureEmail(message, account.name)
    throw new Error(`Sync failed: ${message}`)
  }
}

// --- Phase 23b: Dashboard server actions ---

export type DailyCloseSummary = {
  autoMatched: number
  pendingReview: number
  exceptions: number
  variance: number
  isReconciled: boolean
  glBalance: number
  bankBalance: number
  outstandingChecks: number
  outstandingDeposits: number
}

export async function getDailyCloseSummary(
  bankAccountId: number,
  precomputed?: { pendingReview: number; exceptions: number }
): Promise<DailyCloseSummary> {
  // Count auto-matched transactions
  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId, matchType: bankMatches.matchType })
    .from(bankMatches)

  const autoMatchedCount = matchedBankIds.filter((m) => m.matchType === 'auto').length

  // Get reconciliation balance if session exists
  const session = await getReconciliationSession(bankAccountId)
  const balance = session.balance

  return {
    autoMatched: autoMatchedCount,
    pendingReview: precomputed?.pendingReview ?? 0,
    exceptions: precomputed?.exceptions ?? 0,
    variance: balance?.variance ?? 0,
    isReconciled: balance?.isReconciled ?? false,
    glBalance: balance?.glBalance ?? 0,
    bankBalance: balance?.bankBalance ?? 0,
    outstandingChecks: balance?.outstandingChecks ?? 0,
    outstandingDeposits: balance?.outstandingDeposits ?? 0,
  }
}

export async function getBatchReviewItems(
  bankAccountId: number
): Promise<BatchReviewItem[]> {
  return getBatchReviewCandidates(bankAccountId)
}

export async function getExceptionItems(
  bankAccountId: number
): Promise<ExceptionItem[]> {
  return getExceptions(bankAccountId)
}

export async function bulkApproveMatches(
  items: { bankTransactionId: number; glTransactionLineId: number; ruleId?: number }[],
  sessionId: number | null,
  userId: string
): Promise<{ approved: number; failed: number }> {
  let approved = 0
  let failed = 0
  const bankAccountIds = new Set<number>()

  for (const item of items) {
    try {
      await createMatch({
        bankTransactionId: item.bankTransactionId,
        glTransactionLineId: item.glTransactionLineId,
        matchType: 'manual',
        reconciliationSessionId: sessionId ?? undefined,
        userId,
      })

      // Increment rule hit count if applicable
      if (item.ruleId) {
        await db
          .update(matchingRules)
          .set({ hitCount: sql`${matchingRules.hitCount} + 1` })
          .where(eq(matchingRules.id, item.ruleId))
      }

      // Collect bank account IDs for reclassification
      const [txn] = await db
        .select({ bankAccountId: bankTransactions.bankAccountId })
        .from(bankTransactions)
        .where(eq(bankTransactions.id, item.bankTransactionId))
      if (txn) bankAccountIds.add(txn.bankAccountId)

      approved++
    } catch {
      failed++
    }
  }

  // Reclassify unmatched for all affected accounts (fire and forget)
  for (const accountId of bankAccountIds) {
    reclassifyUnmatched(accountId).catch(console.error)
  }

  revalidatePath('/bank-rec')
  return { approved, failed }
}

export async function getRecentAutoMatches(
  bankAccountId: number
): Promise<BankTransactionRow[]> {
  // Get matched transactions for this bank account with their GL transaction ID
  const matches = await db
    .select({
      bankTxnId: bankMatches.bankTransactionId,
      matchId: bankMatches.id,
      matchType: bankMatches.matchType,
      glTransactionId: transactionLines.transactionId,
    })
    .from(bankMatches)
    .innerJoin(transactionLines, eq(bankMatches.glTransactionLineId, transactionLines.id))
    .innerJoin(bankTransactions, eq(bankMatches.bankTransactionId, bankTransactions.id))
    .where(eq(bankTransactions.bankAccountId, bankAccountId))

  if (matches.length === 0) return []

  const matchMap = new Map(
    matches.map((m) => [m.bankTxnId, { matchId: m.matchId, matchType: m.matchType, glTransactionId: m.glTransactionId }])
  )

  const txns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false)
      )
    )
    .orderBy(bankTransactions.date)

  return txns
    .filter((t) => matchMap.has(t.id))
    .map((t) => {
      const match = matchMap.get(t.id)
      return {
        id: t.id,
        bankAccountId: t.bankAccountId,
        plaidTransactionId: t.plaidTransactionId,
        amount: t.amount,
        date: t.date,
        merchantName: t.merchantName,
        category: t.category,
        isPending: t.isPending,
        isMatched: true,
        matchId: match?.matchId ?? null,
        matchType: match?.matchType ?? null,
        glTransactionId: match?.glTransactionId ?? null,
      }
    })
}

export async function getRampCrossCheck(
  periodStart: string,
  periodEnd: string,
  settlementAmount: number
): Promise<CrossCheckResult> {
  const rampSummary = await getRampSettlementSummary(periodStart, periodEnd)
  const variance = Math.round((settlementAmount - rampSummary.totalCategorized) * 100) / 100

  return {
    settlementAmount,
    rampTotal: rampSummary.totalCategorized,
    rampCount: rampSummary.transactionCount,
    variance,
    isMatched: Math.abs(variance) < 0.01,
  }
}
