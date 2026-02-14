/**
 * Reconciliation session management (REC-P0-013, REC-P0-015).
 *
 * Persistent sessions, formal sign-off, two-way balance calculation.
 */

import { eq, and, sql, between, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  reconciliationSessions,
  bankAccounts,
  bankTransactions,
  bankMatches,
  transactionLines,
  transactions,
} from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import { getOutstandingItems } from './gl-only-categories'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

// --- Types ---

export interface ReconciliationSummary {
  sessionId: number
  bankAccountId: number
  bankAccountName: string
  statementDate: string
  statementBalance: number
  status: string
  matchedBankCount: number
  unmatchedBankCount: number
  matchedGlCount: number
  outstandingCount: number
  signedOffBy: string | null
  signedOffAt: Date | null
}

export interface ReconciliationBalance {
  glBalance: number
  bankBalance: number
  outstandingDeposits: number
  outstandingChecks: number
  bankItemsNotInGl: number
  adjustedBankBalance: number
  variance: number
  isReconciled: boolean
}

// --- Session management ---

/**
 * Create a new reconciliation session.
 */
export async function createReconciliationSession(params: {
  bankAccountId: number
  statementDate: string
  statementBalance: string
  userId: string
}): Promise<{ id: number }> {
  const [session] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(reconciliationSessions)
      .values({
        bankAccountId: params.bankAccountId,
        statementDate: params.statementDate,
        statementBalance: params.statementBalance,
        status: 'in_progress',
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId: params.userId,
      action: 'created',
      entityType: 'reconciliation_session',
      entityId: result[0].id,
      afterState: {
        bankAccountId: params.bankAccountId,
        statementDate: params.statementDate,
        statementBalance: params.statementBalance,
      },
    })

    return result
  })

  return { id: session.id }
}

/**
 * Get the active (in-progress) reconciliation session for a bank account.
 */
export async function getActiveSession(
  bankAccountId: number
): Promise<(typeof reconciliationSessions.$inferSelect) | null> {
  const [session] = await db
    .select()
    .from(reconciliationSessions)
    .where(
      and(
        eq(reconciliationSessions.bankAccountId, bankAccountId),
        eq(reconciliationSessions.status, 'in_progress')
      )
    )
    .orderBy(reconciliationSessions.createdAt)
    .limit(1)

  return session ?? null
}

/**
 * Get reconciliation summary for a session.
 */
export async function getReconciliationSummary(
  sessionId: number
): Promise<ReconciliationSummary | null> {
  const [session] = await db
    .select({
      id: reconciliationSessions.id,
      bankAccountId: reconciliationSessions.bankAccountId,
      bankAccountName: bankAccounts.name,
      statementDate: reconciliationSessions.statementDate,
      statementBalance: reconciliationSessions.statementBalance,
      status: reconciliationSessions.status,
      signedOffBy: reconciliationSessions.signedOffBy,
      signedOffAt: reconciliationSessions.signedOffAt,
    })
    .from(reconciliationSessions)
    .innerJoin(
      bankAccounts,
      eq(reconciliationSessions.bankAccountId, bankAccounts.id)
    )
    .where(eq(reconciliationSessions.id, sessionId))

  if (!session) return null

  // Count matched bank transactions for this session
  const matchedBankResult = await db
    .select({ count: sql<number>`count(DISTINCT ${bankMatches.bankTransactionId})` })
    .from(bankMatches)
    .where(eq(bankMatches.reconciliationSessionId, sessionId))

  // Count unmatched bank transactions
  const allBankTxns = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, session.bankAccountId),
        eq(bankTransactions.isPending, false),
        lte(bankTransactions.date, session.statementDate)
      )
    )

  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedBankSet = new Set(matchedBankIds.map((m) => m.bankTxnId))
  const unmatchedBank = allBankTxns.filter((t) => !matchedBankSet.has(t.id))

  // Count matched GL lines
  const matchedGlResult = await db
    .select({ count: sql<number>`count(DISTINCT ${bankMatches.glTransactionLineId})` })
    .from(bankMatches)
    .where(eq(bankMatches.reconciliationSessionId, sessionId))

  // Get outstanding items
  const outstanding = await getOutstandingItems(session.bankAccountId, {
    start: '1900-01-01',
    end: session.statementDate,
  })

  return {
    sessionId: session.id,
    bankAccountId: session.bankAccountId,
    bankAccountName: session.bankAccountName,
    statementDate: session.statementDate,
    statementBalance: parseFloat(session.statementBalance),
    status: session.status,
    matchedBankCount: Number(matchedBankResult[0]?.count ?? 0),
    unmatchedBankCount: unmatchedBank.length,
    matchedGlCount: Number(matchedGlResult[0]?.count ?? 0),
    outstandingCount: outstanding.length,
    signedOffBy: session.signedOffBy,
    signedOffAt: session.signedOffAt,
  }
}

/**
 * Calculate the two-way reconciliation balance (REC-P0-010).
 *
 * GL Balance = Sum of cash account GL entries through statement date
 * Bank Balance = Statement balance from session
 * Reconciling Items:
 *   + Outstanding deposits (GL inflows with no bank match)
 *   - Outstanding checks (GL outflows with no bank match)
 *   + Bank items not in GL (unmatched bank transactions)
 * Adjusted Bank Balance = Bank Balance ± Reconciling Items
 * Reconciled when: GL Balance = Adjusted Bank Balance
 */
export async function calculateReconciliationBalance(
  sessionId: number
): Promise<ReconciliationBalance> {
  const [session] = await db
    .select()
    .from(reconciliationSessions)
    .where(eq(reconciliationSessions.id, sessionId))

  if (!session) throw new Error('Session not found')

  const [bankAcct] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, session.bankAccountId))

  if (!bankAcct) throw new Error('Bank account not found')

  // GL Balance: sum of all debits - credits for this cash account through statement date
  const [glResult] = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}::numeric), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}::numeric), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, bankAcct.glAccountId),
        eq(transactions.isVoided, false),
        lte(transactions.date, session.statementDate)
      )
    )

  const glBalance =
    parseFloat(glResult?.totalDebit ?? '0') -
    parseFloat(glResult?.totalCredit ?? '0')

  // Bank balance from statement
  const bankBalance = parseFloat(session.statementBalance)

  // Outstanding items (GL entries with no bank match, not GL-only)
  const outstanding = await getOutstandingItems(session.bankAccountId, {
    start: '1900-01-01',
    end: session.statementDate,
  })

  // Outstanding deposits (GL credits to cash = inflows, positive amounts that reduce GL debit balance)
  const outstandingDeposits = outstanding
    .filter((o) => o.credit !== null)
    .reduce((sum, o) => sum + parseFloat(o.credit!), 0)

  // Outstanding checks (GL debits to cash = outflows that haven't cleared the bank)
  const outstandingChecks = outstanding
    .filter((o) => o.debit !== null)
    .reduce((sum, o) => sum + parseFloat(o.debit!), 0)

  // Bank items not in GL
  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedSet = new Set(matchedBankIds.map((m) => m.bankTxnId))

  const allBankTxns = await db
    .select({ id: bankTransactions.id, amount: bankTransactions.amount })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, session.bankAccountId),
        eq(bankTransactions.isPending, false),
        lte(bankTransactions.date, session.statementDate)
      )
    )

  const bankItemsNotInGl = allBankTxns
    .filter((t) => !matchedSet.has(t.id))
    .reduce((sum, t) => sum + parseFloat(t.amount), 0)

  // Adjusted bank balance
  // Bank balance + outstanding checks - outstanding deposits + bank items not in GL
  const adjustedBankBalance =
    bankBalance + outstandingChecks - outstandingDeposits + bankItemsNotInGl

  const variance = Math.round((glBalance - adjustedBankBalance) * 100) / 100

  return {
    glBalance: Math.round(glBalance * 100) / 100,
    bankBalance,
    outstandingDeposits: Math.round(outstandingDeposits * 100) / 100,
    outstandingChecks: Math.round(outstandingChecks * 100) / 100,
    bankItemsNotInGl: Math.round(bankItemsNotInGl * 100) / 100,
    adjustedBankBalance: Math.round(adjustedBankBalance * 100) / 100,
    variance,
    isReconciled: Math.abs(variance) < 0.01,
  }
}

/**
 * Formal sign-off for a reconciliation session (REC-P0-013).
 */
export async function signOffReconciliation(
  sessionId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [session] = await tx
      .select()
      .from(reconciliationSessions)
      .where(eq(reconciliationSessions.id, sessionId))

    if (!session) throw new Error('Session not found')
    if (session.status === 'completed') {
      throw new Error('Session already signed off')
    }

    await tx
      .update(reconciliationSessions)
      .set({
        status: 'completed',
        signedOffBy: userId,
        signedOffAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(reconciliationSessions.id, sessionId))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'signed_off',
      entityType: 'reconciliation_session',
      entityId: sessionId,
      afterState: {
        statementDate: session.statementDate,
        statementBalance: session.statementBalance,
        signedOffBy: userId,
      },
    })
  })
}

/**
 * Edit a previously reconciled match with mandatory change note.
 */
export async function editReconciledItem(
  matchId: number,
  changes: { notes: string },
  changeNote: string,
  userId: string
): Promise<void> {
  if (!changeNote.trim()) {
    throw new Error('Change note is required when editing a reconciled item')
  }

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bankMatches)
      .where(eq(bankMatches.id, matchId))

    if (!existing) throw new Error('Match not found')

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'bank_match',
      entityId: matchId,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: { changeNote },
    })
  })
}
