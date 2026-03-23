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
  invoices,
  accounts,
  vendors,
  purchaseOrders,
  funds,
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
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import { getFiscalYearFromDate, isYearLocked } from '@/lib/fiscal-year-lock'
import { decrypt } from '@/lib/encryption'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
}

export async function cancelReconciliationSession(
  sessionId: number
): Promise<void> {
  // Detach any bank matches tied to this session (keep the matches, just unlink)
  await db
    .update(bankMatches)
    .set({ reconciliationSessionId: null })
    .where(eq(bankMatches.reconciliationSessionId, sessionId))

  // Delete the session
  await db
    .delete(reconciliationSessions)
    .where(eq(reconciliationSessions.id, sessionId))

  revalidatePath('/bank-rec')
  revalidatePath('/match-transactions/bank')
}

export async function signOffReconciliation(
  sessionId: number,
  userId: string
): Promise<void> {
  await signOff(sessionId, userId)
  revalidatePath('/bank-rec')
  revalidatePath('/match-transactions/bank')
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
  revalidatePath('/match-transactions/bank')
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

// --- Invoice match suggestions ---

export type InvoiceSuggestionRow = {
  bankTransactionId: number
  invoiceId: number
  invoiceNumber: string | null
  poNumber: string | null
  vendorName: string
  invoiceAmount: string
  invoiceDate: string
  confidence: number
  isPaid: boolean
  // Bank transaction details
  bankDate: string
  bankMerchant: string | null
  bankAmount: string
}

export async function getInvoiceSuggestions(
  bankAccountId: number
): Promise<InvoiceSuggestionRow[]> {
  const rows = await db
    .select({
      bankTransactionId: bankTransactions.id,
      invoiceMatchConfidence: bankTransactions.invoiceMatchConfidence,
      bankDate: bankTransactions.date,
      bankMerchant: bankTransactions.merchantName,
      bankAmount: bankTransactions.amount,
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      purchaseOrderId: invoices.purchaseOrderId,
      vendorName: vendors.name,
      invoiceAmount: invoices.amount,
      invoiceDate: invoices.invoiceDate,
      paymentStatus: invoices.paymentStatus,
    })
    .from(bankTransactions)
    .innerJoin(invoices, eq(bankTransactions.suggestedInvoiceId, invoices.id))
    .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        sql`${bankTransactions.suggestedInvoiceId} IS NOT NULL`,
        eq(invoices.paymentStatus, 'POSTED') // Hide once paid
      )
    )

  return rows.map((r) => ({
    bankTransactionId: r.bankTransactionId,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoiceNumber,
    poNumber: r.purchaseOrderId ? `PO-${r.purchaseOrderId}` : null,
    vendorName: r.vendorName ?? 'Unknown',
    invoiceAmount: r.invoiceAmount,
    invoiceDate: r.invoiceDate,
    confidence: parseFloat(r.invoiceMatchConfidence ?? '0'),
    isPaid: r.paymentStatus === 'PAID',
    bankDate: r.bankDate,
    bankMerchant: r.bankMerchant,
    bankAmount: r.bankAmount,
  }))
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
  revalidatePath('/match-transactions/bank')
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

export type PastSession = {
  id: number
  bankAccountId: number
  bankAccountName: string
  statementDate: string
  statementBalance: string
  status: string
  signedOffBy: string | null
  signedOffAt: Date | null
  createdAt: Date
}

export async function getPastSessions(bankAccountId: number): Promise<PastSession[]> {
  const rows = await db
    .select({
      id: reconciliationSessions.id,
      bankAccountId: reconciliationSessions.bankAccountId,
      bankAccountName: bankAccounts.name,
      statementDate: reconciliationSessions.statementDate,
      statementBalance: reconciliationSessions.statementBalance,
      status: reconciliationSessions.status,
      signedOffBy: reconciliationSessions.signedOffBy,
      signedOffAt: reconciliationSessions.signedOffAt,
      createdAt: reconciliationSessions.createdAt,
    })
    .from(reconciliationSessions)
    .innerJoin(bankAccounts, eq(reconciliationSessions.bankAccountId, bankAccounts.id))
    .where(eq(reconciliationSessions.bankAccountId, bankAccountId))
    .orderBy(reconciliationSessions.statementDate)

  return rows.map((r) => ({
    ...r,
    statementDate: String(r.statementDate),
    statementBalance: String(r.statementBalance),
  }))
}

// --- Invoice Match Confirmation ---

export type ConfirmInvoiceMatchResult = {
  success: boolean
  glTransactionId?: number
  lockedYearWarning?: { year: number; message: string }
  error?: string
}

/**
 * Confirm an invoice match: create clearing JE and update invoice to PAID.
 * AP invoices: DR AP (2000) / CR Cash
 * AR invoices: DR Cash / CR AR (1110)
 */
export async function confirmInvoiceMatch(
  bankTransactionId: number,
  invoiceId: number
): Promise<ConfirmInvoiceMatchResult> {
  const user = await getAuthUser()

  // 1. Fetch invoice with PO details and direction
  const [invoice] = await db
    .select({
      id: invoices.id,
      amount: invoices.amount,
      paymentStatus: invoices.paymentStatus,
      fundId: invoices.fundId,
      purchaseOrderId: invoices.purchaseOrderId,
      invoiceNumber: invoices.invoiceNumber,
      vendorId: invoices.vendorId,
      direction: invoices.direction,
    })
    .from(invoices)
    .where(eq(invoices.id, invoiceId))

  if (!invoice) {
    return { success: false, error: `Invoice ${invoiceId} not found` }
  }

  // 2. Validate: must be POSTED (not already paid)
  if (invoice.paymentStatus !== 'POSTED') {
    return {
      success: false,
      error: `Invoice is already ${invoice.paymentStatus} — cannot confirm match`,
    }
  }

  const isAR = invoice.direction === 'AR'

  // 3. Fetch bank transaction
  const [bankTxn] = await db
    .select({
      id: bankTransactions.id,
      bankAccountId: bankTransactions.bankAccountId,
      date: bankTransactions.date,
      amount: bankTransactions.amount,
    })
    .from(bankTransactions)
    .where(eq(bankTransactions.id, bankTransactionId))

  if (!bankTxn) {
    return { success: false, error: `Bank transaction ${bankTransactionId} not found` }
  }

  // 4. Fetch bank account → checking GL account
  const [bankAccount] = await db
    .select({ glAccountId: bankAccounts.glAccountId })
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankTxn.bankAccountId))

  if (!bankAccount?.glAccountId) {
    return { success: false, error: 'Bank account has no linked GL account' }
  }

  // 5. Look up offset account: AP (2000) for AP invoices, AR (1110) for AR invoices
  const offsetCode = isAR ? '1110' : '2000'
  const offsetLabel = isAR ? 'Grants Receivable (1110)' : 'Accounts Payable (2000)'
  const [offsetAccount] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, offsetCode))

  if (!offsetAccount) {
    return { success: false, error: `${offsetLabel} account not found` }
  }

  // Look up counterparty name
  let counterpartyName: string | null = null
  if (isAR && invoice.fundId) {
    const [fund] = await db.select({ name: funds.name }).from(funds).where(eq(funds.id, invoice.fundId))
    counterpartyName = fund?.name ?? null
  } else if (invoice.vendorId) {
    counterpartyName = (await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, invoice.vendorId)))[0]?.name ?? null
  }

  const invoiceRef = invoice.invoiceNumber || (isAR ? `AR-${invoice.id}` : `INV-${invoice.id}`)
  const poRef = invoice.purchaseOrderId ? `PO-${invoice.purchaseOrderId}` : null

  // 6. Soft lock warning check
  const fiscalYear = getFiscalYearFromDate(bankTxn.date)
  const locked = await isYearLocked(fiscalYear)
  if (locked) {
    // Surface the warning but proceed — the GL engine will also check
  }

  // 7. Create clearing GL transaction
  // AP: DR AP / CR Cash (payment out)
  // AR: DR Cash / CR AR (payment in)
  const invoiceAmount = parseFloat(invoice.amount)
  const fundId = invoice.fundId ?? 1 // Default to unrestricted fund

  const memo = isAR
    ? `Payment received: ${invoiceRef} — ${counterpartyName ?? 'funder'}`
    : `Payment: ${invoiceRef}${poRef ? ` / ${poRef}` : ''} — ${counterpartyName ?? 'vendor'}`

  const lines = isAR
    ? [
        // AR: DR Cash, CR Grants Receivable
        { accountId: bankAccount.glAccountId, fundId, debit: invoiceAmount, credit: null },
        { accountId: offsetAccount.id, fundId, debit: null, credit: invoiceAmount },
      ]
    : [
        // AP: DR Accounts Payable, CR Cash
        { accountId: offsetAccount.id, fundId, debit: invoiceAmount, credit: null },
        { accountId: bankAccount.glAccountId, fundId, debit: null, credit: invoiceAmount },
      ]

  const txnResult = await createTransaction({
    date: bankTxn.date,
    memo,
    sourceType: 'BANK_MATCH',
    sourceReferenceId: `invoice-match:${invoiceId}:bank:${bankTransactionId}`,
    isSystemGenerated: true,
    createdBy: user.id,
    lines,
  })

  // 8. Update invoice → PAID with linkage
  await db
    .update(invoices)
    .set({
      paymentStatus: 'PAID',
      bankTransactionId,
      clearingTransactionId: txnResult.transaction.id,
      paidAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, invoiceId))

  // 8b. Clear the invoice suggestion from the bank transaction
  await db
    .update(bankTransactions)
    .set({
      suggestedInvoiceId: null,
      invoiceMatchConfidence: null,
      updatedAt: new Date(),
    })
    .where(eq(bankTransactions.id, bankTransactionId))

  // 9. Create bank match record (cash line from the clearing JE)
  const cashLine = txnResult.transaction.lines.find(
    (l) => l.accountId === bankAccount.glAccountId
  )

  if (cashLine) {
    await createMatch({
      bankTransactionId,
      glTransactionLineId: cashLine.id,
      matchType: 'manual',
      userId: user.id,
    })
  }

  // 10. Audit log
  await db.transaction(async (tx) => {
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: user.id,
      action: 'updated',
      entityType: 'invoice',
      entityId: invoiceId,
      beforeState: { paymentStatus: 'POSTED' },
      afterState: {
        paymentStatus: 'PAID',
        bankTransactionId,
        clearingTransactionId: txnResult.transaction.id,
      },
    })
  })

  // 11. Revalidate
  revalidatePath('/bank-rec')
  if (isAR && invoice.fundId) {
    revalidatePath(`/revenue/funding-sources/${invoice.fundId}`)
    revalidatePath('/revenue/funding-sources')
  }
  if (invoice.purchaseOrderId) {
    revalidatePath(`/expenses/purchase-orders/${invoice.purchaseOrderId}`)
  }
  revalidatePath('/liabilities/payables')

  return {
    success: true,
    glTransactionId: txnResult.transaction.id,
    lockedYearWarning: txnResult.lockedYearWarning,
  }
}

/**
 * Dismiss an invoice suggestion on a bank transaction.
 * Clears suggestedInvoiceId without blocking GL matching.
 */
export async function dismissInvoiceSuggestion(
  bankTransactionId: number
): Promise<void> {
  await db
    .update(bankTransactions)
    .set({
      suggestedInvoiceId: null,
      invoiceMatchConfidence: null,
      updatedAt: new Date(),
    })
    .where(eq(bankTransactions.id, bankTransactionId))

  revalidatePath('/bank-rec')
}
