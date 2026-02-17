/**
 * Bank reconciliation matching engine (REC-P0-006, REC-P0-007, REC-P0-008).
 *
 * Trust-escalation model: suggest → confirm → rule → auto-approve.
 */

import { eq, and, sql, between, isNull, not, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  bankTransactions,
  bankMatches,
  matchingRules,
  transactionLines,
  transactions,
  accounts,
} from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export interface MatchCandidate {
  glTransactionLineId: number
  transactionId: number
  date: string
  memo: string | null
  accountName: string
  debit: string | null
  credit: string | null
  amount: number
  confidenceScore: number
}

export interface CreateMatchParams {
  bankTransactionId: number
  glTransactionLineId: number
  matchType: 'auto' | 'manual' | 'rule'
  confidenceScore?: number
  ruleId?: number
  reconciliationSessionId?: number
  userId: string
}

export interface SplitMatchParams {
  bankTransactionId: number
  splits: { glTransactionLineId: number; amount: number }[]
  reconciliationSessionId?: number
  userId: string
}

// --- Matching algorithm ---

/**
 * Find GL transaction line candidates that could match a bank transaction.
 * Criteria: exact amount, ±3 days, merchant name tiebreaker.
 */
export async function findMatchCandidates(
  bankTxn: {
    id: number
    amount: string
    date: string
    merchantName: string | null
    bankAccountId: number
  }
): Promise<MatchCandidate[]> {
  const bankAmount = Math.abs(parseFloat(bankTxn.amount))
  const bankDate = new Date(bankTxn.date)
  const dateMin = new Date(bankDate)
  dateMin.setDate(dateMin.getDate() - 3)
  const dateMax = new Date(bankDate)
  dateMax.setDate(dateMax.getDate() + 3)

  const dateMinStr = dateMin.toISOString().substring(0, 10)
  const dateMaxStr = dateMax.toISOString().substring(0, 10)

  // Get the GL account ID for this bank account
  const bankAccountGlId = await db
    .select({ glAccountId: sql<number>`ba.gl_account_id` })
    .from(sql`bank_accounts ba`)
    .where(sql`ba.id = ${bankTxn.bankAccountId}`)
    .then((rows) => rows[0]?.glAccountId)

  if (!bankAccountGlId) return []

  // Get IDs of GL lines already matched
  const alreadyMatched = await db
    .select({ lineId: bankMatches.glTransactionLineId })
    .from(bankMatches)

  const matchedLineIds = alreadyMatched.map((m) => m.lineId)

  // Query unmatched GL transaction lines
  // Bank outflow (positive amount) = GL debit to cash account
  // Bank inflow (negative amount) = GL credit to cash account
  const isOutflow = parseFloat(bankTxn.amount) > 0

  const candidates = await db
    .select({
      lineId: transactionLines.id,
      transactionId: transactionLines.transactionId,
      accountId: transactionLines.accountId,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
      memo: transactionLines.memo,
      txnDate: transactions.date,
      txnMemo: transactions.memo,
      txnIsVoided: transactions.isVoided,
      accountName: accounts.name,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactionLines.accountId, bankAccountGlId),
        eq(transactions.isVoided, false),
        between(transactions.date, dateMinStr, dateMaxStr),
        isOutflow
          ? sql`${transactionLines.debit} IS NOT NULL AND ABS(${transactionLines.debit}::numeric - ${bankAmount}) < 0.01`
          : sql`${transactionLines.credit} IS NOT NULL AND ABS(${transactionLines.credit}::numeric - ${bankAmount}) < 0.01`
      )
    )

  // Filter out already-matched lines in JS (avoids subquery complexity)
  const matchedSet = new Set(matchedLineIds)
  const filtered = candidates.filter((c) => !matchedSet.has(c.lineId))

  // Score candidates
  return filtered
    .map((c) => {
      let score = 1.0

      // Date proximity bonus
      const daysDiff = Math.abs(
        (new Date(c.txnDate).getTime() - bankDate.getTime()) /
          (1000 * 60 * 60 * 24)
      )
      if (daysDiff === 0) score += 0.05
      else if (daysDiff <= 1) score += 0.03

      // Merchant name tiebreaker
      if (bankTxn.merchantName) {
        const merchant = bankTxn.merchantName.toLowerCase()
        const memo = (c.txnMemo ?? '').toLowerCase()
        const lineMemo = (c.memo ?? '').toLowerCase()
        if (memo.includes(merchant) || lineMemo.includes(merchant)) {
          score += 0.1
        }
      }

      const lineAmount = c.debit
        ? parseFloat(c.debit)
        : c.credit
          ? parseFloat(c.credit)
          : 0

      return {
        glTransactionLineId: c.lineId,
        transactionId: c.transactionId,
        date: c.txnDate,
        memo: c.txnMemo,
        accountName: c.accountName,
        debit: c.debit,
        credit: c.credit,
        amount: lineAmount,
        confidenceScore: Math.round(score * 100) / 100,
      }
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
}

/**
 * Apply matching rules to a bank transaction. Returns true if auto-matched.
 */
export async function applyMatchingRules(
  bankTransactionId: number
): Promise<boolean> {
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, bankTransactionId))

  if (!bankTxn || bankTxn.isPending) return false

  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  for (const rule of rules) {
    const criteria = rule.criteria as {
      merchantPattern?: string
      amountExact?: string
      description?: string
    }

    let matches = true

    // Check merchant pattern (case-insensitive substring)
    if (criteria.merchantPattern && bankTxn.merchantName) {
      const pattern = criteria.merchantPattern.toLowerCase()
      if (!bankTxn.merchantName.toLowerCase().includes(pattern)) {
        matches = false
      }
    } else if (criteria.merchantPattern && !bankTxn.merchantName) {
      matches = false
    }

    // Check exact amount
    if (criteria.amountExact) {
      if (
        Math.abs(parseFloat(bankTxn.amount) - parseFloat(criteria.amountExact)) >
        0.01
      ) {
        matches = false
      }
    }

    if (!matches) continue

    // Rule matches — find the best GL candidate and auto-match
    const candidates = await findMatchCandidates({
      id: bankTxn.id,
      amount: bankTxn.amount,
      date: bankTxn.date,
      merchantName: bankTxn.merchantName,
      bankAccountId: bankTxn.bankAccountId,
    })

    if (candidates.length > 0) {
      await createMatch({
        bankTransactionId: bankTxn.id,
        glTransactionLineId: candidates[0].glTransactionLineId,
        matchType: 'rule',
        confidenceScore: candidates[0].confidenceScore,
        ruleId: rule.id,
        userId: 'system-rule-engine',
      })

      // Increment rule hit count
      await db
        .update(matchingRules)
        .set({ hitCount: sql`${matchingRules.hitCount} + 1` })
        .where(eq(matchingRules.id, rule.id))

      return true
    }
  }

  return false
}

/**
 * Create a match between a bank transaction and a GL transaction line.
 */
export async function createMatch(params: CreateMatchParams): Promise<number> {
  const [match] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(bankMatches)
      .values({
        bankTransactionId: params.bankTransactionId,
        glTransactionLineId: params.glTransactionLineId,
        matchType: params.matchType,
        confidenceScore: params.confidenceScore
          ? String(params.confidenceScore)
          : null,
        confirmedBy: params.userId,
        confirmedAt: new Date(),
        ruleId: params.ruleId ?? null,
        reconciliationSessionId: params.reconciliationSessionId ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: params.userId,
      action: 'created',
      entityType: 'bank_match',
      entityId: result[0].id,
      afterState: {
        bankTransactionId: params.bankTransactionId,
        glTransactionLineId: params.glTransactionLineId,
        matchType: params.matchType,
      },
    })

    return result
  })

  return match.id
}

/**
 * Create split matches (1:many). Validates that split amounts sum to bank transaction amount.
 */
export async function createSplitMatches(
  params: SplitMatchParams
): Promise<number[]> {
  // Get bank transaction
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, params.bankTransactionId))

  if (!bankTxn) throw new Error('Bank transaction not found')

  // Validate split sum
  const bankAmount = Math.abs(parseFloat(bankTxn.amount))
  const splitSum = params.splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)

  if (Math.abs(bankAmount - splitSum) > 0.01) {
    throw new Error(
      `Split amounts ($${splitSum.toFixed(2)}) do not equal bank transaction amount ($${bankAmount.toFixed(2)})`
    )
  }

  const matchIds: number[] = []
  for (const split of params.splits) {
    const id = await createMatch({
      bankTransactionId: params.bankTransactionId,
      glTransactionLineId: split.glTransactionLineId,
      matchType: 'manual',
      reconciliationSessionId: params.reconciliationSessionId,
      userId: params.userId,
    })
    matchIds.push(id)
  }

  return matchIds
}

/**
 * Remove a match (unmatch).
 */
export async function removeMatch(
  matchId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(bankMatches)
      .where(eq(bankMatches.id, matchId))

    if (!existing) throw new Error('Match not found')

    await tx.delete(bankMatches).where(eq(bankMatches.id, matchId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'voided',
      entityType: 'bank_match',
      entityId: matchId,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: { deleted: true },
    })
  })
}
