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
} from '@/lib/db/schema'
import {
  findMatchCandidates,
  createMatch,
  createSplitMatches,
  removeMatch,
  applyMatchingRules,
  getBatchReviewCandidates,
  getExceptions,
  runAutoMatch,
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
import type { MatchCandidate } from '@/lib/bank-rec/matcher'

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
  await createMatch({
    bankTransactionId,
    glTransactionLineId,
    matchType: 'manual',
    reconciliationSessionId: sessionId ?? undefined,
    userId,
  })
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
  userId: string
): Promise<void> {
  await removeMatch(matchId, userId)
  revalidatePath('/bank-rec')
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
  sessionId: number | null,
  userId: string
): Promise<void> {
  // Get bank account's GL account
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, data.bankTransactionId))

  if (!bankTxn) throw new Error('Bank transaction not found')

  const [bankAcct] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankTxn.bankAccountId))

  if (!bankAcct) throw new Error('Bank account not found')

  const amount = parseFloat(data.amount)
  const isOutflow = amount > 0 // positive = outflow in Plaid convention

  // Create GL entry via GL engine
  const result = await createTransaction({
    date: data.date,
    memo: data.memo,
    sourceType: 'BANK_FEED',
    sourceReferenceId: `bank-txn-${data.bankTransactionId}`,
    createdBy: userId,
    isSystemGenerated: false,
    lines: isOutflow
      ? [
          // Outflow: Debit expense account, Credit cash account
          {
            accountId: data.accountId,
            fundId: data.fundId,
            debit: Math.abs(amount),
            credit: null,
          },
          {
            accountId: bankAcct.glAccountId,
            fundId: data.fundId,
            debit: null,
            credit: Math.abs(amount),
          },
        ]
      : [
          // Inflow: Debit cash account, Credit revenue/other account
          {
            accountId: bankAcct.glAccountId,
            fundId: data.fundId,
            debit: Math.abs(amount),
            credit: null,
          },
          {
            accountId: data.accountId,
            fundId: data.fundId,
            debit: null,
            credit: Math.abs(amount),
          },
        ],
  })

  // Find the cash account line to match
  const cashLineId = result.transaction.lines.find(
    (l) => l.accountId === bankAcct.glAccountId
  )?.id

  if (cashLineId) {
    await createMatch({
      bankTransactionId: data.bankTransactionId,
      glTransactionLineId: cashLineId,
      matchType: 'manual',
      reconciliationSessionId: sessionId ?? undefined,
      userId,
    })
  }

  revalidatePath('/bank-rec')
}

export async function createMatchingRuleAction(
  criteria: { merchantPattern?: string; amountExact?: string },
  action: { glAccountId: number; fundId: number },
  userId: string
): Promise<void> {
  await db.insert(matchingRules).values({
    criteria,
    action,
    createdBy: userId,
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

    // Run rule matching on newly added unmatched transactions
    const unmatchedTxns = await db
      .select({ id: bankTransactions.id })
      .from(bankTransactions)
      .where(
        and(
          eq(bankTransactions.bankAccountId, bankAccountId),
          eq(bankTransactions.isPending, false)
        )
      )

    const matchedIds = await db
      .select({ bankTxnId: bankMatches.bankTransactionId })
      .from(bankMatches)

    const matchedSet = new Set(matchedIds.map((m) => m.bankTxnId))
    for (const txn of unmatchedTxns) {
      if (!matchedSet.has(txn.id)) {
        await applyMatchingRules(txn.id)
      }
    }

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

export type { BatchReviewItem, ExceptionItem }

export async function getDailyCloseSummary(
  bankAccountId: number
): Promise<DailyCloseSummary> {
  // Get tier counts by running classification
  const [reviewItems, exceptionItems] = await Promise.all([
    getBatchReviewCandidates(bankAccountId),
    getExceptions(bankAccountId),
  ])

  // Count today's auto-matched transactions
  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId, matchType: bankMatches.matchType })
    .from(bankMatches)

  const autoMatchedCount = matchedBankIds.filter((m) => m.matchType === 'auto').length

  // Get reconciliation balance if session exists
  const session = await getReconciliationSession(bankAccountId)
  const balance = session.balance

  return {
    autoMatched: autoMatchedCount,
    pendingReview: reviewItems.length,
    exceptions: exceptionItems.length,
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

      approved++
    } catch {
      failed++
    }
  }

  revalidatePath('/bank-rec')
  return { approved, failed }
}

export async function getRecentAutoMatches(
  bankAccountId: number
): Promise<BankTransactionRow[]> {
  const autoMatches = await db
    .select({
      bankTxnId: bankMatches.bankTransactionId,
      matchId: bankMatches.id,
      matchType: bankMatches.matchType,
      confirmedAt: bankMatches.confirmedAt,
    })
    .from(bankMatches)
    .where(eq(bankMatches.matchType, 'auto'))

  const autoMatchedIds = new Set(autoMatches.map((m) => m.bankTxnId))

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
    .filter((t) => autoMatchedIds.has(t.id))
    .map((t) => {
      const match = autoMatches.find((m) => m.bankTxnId === t.id)
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
        matchType: 'auto',
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
