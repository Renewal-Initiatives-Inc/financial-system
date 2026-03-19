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
  recurringExpectations,
  appSettings,
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

// --- Three-Tier Auto-Match Engine (Phase 23a) ---

export interface TierClassification {
  tier: 1 | 2 | 3
  reason: string
  candidate?: MatchCandidate
  ruleId?: number
}

export interface AutoMatchResult {
  autoMatched: number
  pendingReview: number
  exceptions: number
  errors: string[]
}

export interface BatchReviewItem {
  bankTransaction: typeof bankTransactions.$inferSelect
  candidate: MatchCandidate
  reason: string
  ruleId?: number
}

export interface ExceptionItem {
  bankTransaction: typeof bankTransactions.$inferSelect
  reason: string
}

/**
 * Load auto-match threshold settings from app_settings.
 */
async function getThresholds(): Promise<{
  autoMatchMinHitCount: number
  autoMatchMinConfidence: number
  autoMatchMaxAmount: number
  reviewMinConfidence: number
}> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)

  const map = new Map(rows.map((r) => [r.key, r.value]))

  return {
    autoMatchMinHitCount: parseInt(map.get('autoMatchMinHitCount') ?? '5'),
    autoMatchMinConfidence: parseFloat(map.get('autoMatchMinConfidence') ?? '0.95'),
    autoMatchMaxAmount: parseFloat(map.get('autoMatchMaxAmount') ?? '500.00'),
    reviewMinConfidence: parseFloat(map.get('reviewMinConfidence') ?? '0.70'),
  }
}

/**
 * Check if a bank transaction matches a recurring expectation.
 * Returns the matching expectation or null.
 */
async function matchRecurringExpectation(
  bankTxn: { amount: string; date: string; merchantName: string | null; bankAccountId: number }
): Promise<(typeof recurringExpectations.$inferSelect) | null> {
  if (!bankTxn.merchantName) return null

  const expectations = await db
    .select()
    .from(recurringExpectations)
    .where(
      and(
        eq(recurringExpectations.bankAccountId, bankTxn.bankAccountId),
        eq(recurringExpectations.isActive, true)
      )
    )

  const bankAmount = Math.abs(parseFloat(bankTxn.amount))
  const bankDate = new Date(bankTxn.date)
  const bankDay = bankDate.getDate()

  for (const exp of expectations) {
    // Test merchant pattern (regex)
    try {
      const regex = new RegExp(exp.merchantPattern, 'i')
      if (!regex.test(bankTxn.merchantName)) continue
    } catch {
      continue
    }

    // Amount within tolerance
    const expectedAmt = parseFloat(exp.expectedAmount)
    const tolerance = parseFloat(exp.amountTolerance)
    if (Math.abs(bankAmount - expectedAmt) > tolerance) continue

    // Timing check: expectedDay ±3 adjusted by frequency
    const expectedDay = exp.expectedDay
    let dayMatch = false

    if (exp.frequency === 'weekly' || exp.frequency === 'biweekly') {
      // expectedDay is day of week (1=Mon, 7=Sun)
      const bankDayOfWeek = bankDate.getDay() === 0 ? 7 : bankDate.getDay()
      dayMatch = Math.abs(bankDayOfWeek - expectedDay) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay + 7) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay - 7) <= 3
    } else {
      // expectedDay is day of month
      dayMatch = Math.abs(bankDay - expectedDay) <= 3 ||
        // Handle month boundary (e.g., expected 1st, txn on 30th)
        Math.abs(bankDay - expectedDay + 31) <= 3 ||
        Math.abs(bankDay - expectedDay - 31) <= 3
    }

    if (!dayMatch) continue

    return exp
  }

  return null
}

/**
 * Classify a bank transaction into Tier 1 (auto), Tier 2 (review), or Tier 3 (exception).
 */
export async function classifyMatchTier(
  bankTxn: typeof bankTransactions.$inferSelect,
  candidates: MatchCandidate[],
  rules: (typeof matchingRules.$inferSelect)[],
  thresholds: {
    autoMatchMinHitCount: number
    autoMatchMinConfidence: number
    autoMatchMaxAmount: number
    reviewMinConfidence: number
  }
): Promise<TierClassification> {
  const bankAmount = Math.abs(parseFloat(bankTxn.amount))

  // Check for recurring expectation match
  const recurringMatch = await matchRecurringExpectation({
    amount: bankTxn.amount,
    date: bankTxn.date,
    merchantName: bankTxn.merchantName,
    bankAccountId: bankTxn.bankAccountId,
  })

  if (recurringMatch && candidates.length > 0) {
    return {
      tier: 1,
      reason: `Recurring expectation match: ${recurringMatch.description}`,
      candidate: candidates[0],
    }
  }

  // No candidates at all
  if (candidates.length === 0) {
    // New merchant?
    const hasRule = rules.some((r) => {
      const criteria = r.criteria as { merchantPattern?: string }
      if (!criteria.merchantPattern || !bankTxn.merchantName) return false
      return bankTxn.merchantName.toLowerCase().includes(criteria.merchantPattern.toLowerCase())
    })

    if (!hasRule && !recurringMatch) {
      return { tier: 3, reason: 'No match candidates and no matching rule — new merchant' }
    }
    return { tier: 3, reason: 'No GL match candidates found' }
  }

  const best = candidates[0]

  // Multiple candidates with similar confidence (ambiguous)
  if (candidates.length > 1) {
    const diff = best.confidenceScore - candidates[1].confidenceScore
    if (diff < 0.05) {
      return {
        tier: 3,
        reason: `Ambiguous: ${candidates.length} candidates with similar confidence`,
        candidate: best,
      }
    }
  }

  // Below review threshold
  if (best.confidenceScore < thresholds.reviewMinConfidence) {
    return { tier: 3, reason: `Low confidence (${best.confidenceScore})`, candidate: best }
  }

  // Find the matching rule for this transaction
  const matchedRule = rules.find((r) => {
    const criteria = r.criteria as { merchantPattern?: string; amountExact?: string }
    let ruleMatches = true
    if (criteria.merchantPattern && bankTxn.merchantName) {
      if (!bankTxn.merchantName.toLowerCase().includes(criteria.merchantPattern.toLowerCase())) {
        ruleMatches = false
      }
    } else if (criteria.merchantPattern && !bankTxn.merchantName) {
      ruleMatches = false
    }
    if (criteria.amountExact) {
      if (Math.abs(parseFloat(bankTxn.amount) - parseFloat(criteria.amountExact)) > 0.01) {
        ruleMatches = false
      }
    }
    return ruleMatches
  })

  // Tier 1: all conditions met
  if (
    best.confidenceScore >= thresholds.autoMatchMinConfidence &&
    matchedRule &&
    matchedRule.autoMatchEligible &&
    matchedRule.hitCount >= thresholds.autoMatchMinHitCount &&
    bankAmount <= thresholds.autoMatchMaxAmount
  ) {
    return {
      tier: 1,
      reason: `Auto-match: confidence ${best.confidenceScore}, rule hit count ${matchedRule.hitCount}`,
      candidate: best,
      ruleId: matchedRule.id,
    }
  }

  // Tier 2: has a candidate but doesn't meet all auto-match criteria
  if (best.confidenceScore >= thresholds.reviewMinConfidence) {
    const reasons: string[] = []
    if (!matchedRule) reasons.push('no matching rule')
    else if (!matchedRule.autoMatchEligible) reasons.push('rule not auto-match eligible')
    else if (matchedRule.hitCount < thresholds.autoMatchMinHitCount) reasons.push(`rule hit count ${matchedRule.hitCount} < ${thresholds.autoMatchMinHitCount}`)
    if (best.confidenceScore < thresholds.autoMatchMinConfidence) reasons.push(`confidence ${best.confidenceScore} < ${thresholds.autoMatchMinConfidence}`)
    if (bankAmount > thresholds.autoMatchMaxAmount) reasons.push(`amount $${bankAmount} > max $${thresholds.autoMatchMaxAmount}`)

    return {
      tier: 2,
      reason: reasons.join('; ') || 'Review needed',
      candidate: best,
      ruleId: matchedRule?.id,
    }
  }

  return { tier: 3, reason: `Below review threshold (${best.confidenceScore} < ${thresholds.reviewMinConfidence})` }
}

/**
 * Run auto-match for all unmatched bank transactions on a given bank account.
 * Processes Tier 1 items automatically; returns counts per tier.
 */
export async function runAutoMatch(
  bankAccountId: number
): Promise<AutoMatchResult> {
  const thresholds = await getThresholds()
  const result: AutoMatchResult = { autoMatched: 0, pendingReview: 0, exceptions: 0, errors: [] }

  // Get all unmatched, non-pending bank transactions
  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedSet = new Set(matchedBankIds.map((m) => m.bankTxnId))

  const allBankTxns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false)
      )
    )

  const unmatchedTxns = allBankTxns.filter((t) => !matchedSet.has(t.id))

  if (unmatchedTxns.length === 0) return result

  // Load rules once
  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  for (const txn of unmatchedTxns) {
    try {
      const candidates = await findMatchCandidates({
        id: txn.id,
        amount: txn.amount,
        date: txn.date,
        merchantName: txn.merchantName,
        bankAccountId: txn.bankAccountId,
      })

      const classification = await classifyMatchTier(txn, candidates, rules, thresholds)

      if (classification.tier === 1 && classification.candidate) {
        // Execute auto-match
        await createMatch({
          bankTransactionId: txn.id,
          glTransactionLineId: classification.candidate.glTransactionLineId,
          matchType: 'auto',
          confidenceScore: classification.candidate.confidenceScore,
          ruleId: classification.ruleId,
          userId: 'system-auto-match',
        })

        // Update rule hit count if applicable
        if (classification.ruleId) {
          await db
            .update(matchingRules)
            .set({ hitCount: sql`${matchingRules.hitCount} + 1` })
            .where(eq(matchingRules.id, classification.ruleId))
        }

        // Update recurring expectation last matched time
        if (classification.reason.startsWith('Recurring expectation match')) {
          const recurringMatch = await matchRecurringExpectation({
            amount: txn.amount,
            date: txn.date,
            merchantName: txn.merchantName,
            bankAccountId: txn.bankAccountId,
          })
          if (recurringMatch) {
            await db
              .update(recurringExpectations)
              .set({ lastMatchedAt: new Date(), updatedAt: new Date() })
              .where(eq(recurringExpectations.id, recurringMatch.id))
          }
        }

        result.autoMatched++
      } else if (classification.tier === 2) {
        result.pendingReview++
      } else {
        result.exceptions++
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      result.errors.push(`Transaction ${txn.id}: ${message}`)
    }
  }

  return result
}

/**
 * Get Tier 2 (batch review) candidates for a bank account.
 */
export async function getBatchReviewCandidates(
  bankAccountId: number
): Promise<BatchReviewItem[]> {
  const thresholds = await getThresholds()
  const items: BatchReviewItem[] = []

  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedSet = new Set(matchedBankIds.map((m) => m.bankTxnId))

  const allBankTxns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false)
      )
    )

  const unmatchedTxns = allBankTxns.filter((t) => !matchedSet.has(t.id))
  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  for (const txn of unmatchedTxns) {
    const candidates = await findMatchCandidates({
      id: txn.id,
      amount: txn.amount,
      date: txn.date,
      merchantName: txn.merchantName,
      bankAccountId: txn.bankAccountId,
    })

    const classification = await classifyMatchTier(txn, candidates, rules, thresholds)

    if (classification.tier === 2 && classification.candidate) {
      items.push({
        bankTransaction: txn,
        candidate: classification.candidate,
        reason: classification.reason,
        ruleId: classification.ruleId,
      })
    }
  }

  return items
}

/**
 * Get Tier 3 (exception) items for a bank account.
 */
export async function getExceptions(
  bankAccountId: number
): Promise<ExceptionItem[]> {
  const thresholds = await getThresholds()
  const items: ExceptionItem[] = []

  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedSet = new Set(matchedBankIds.map((m) => m.bankTxnId))

  const allBankTxns = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false)
      )
    )

  const unmatchedTxns = allBankTxns.filter((t) => !matchedSet.has(t.id))
  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  for (const txn of unmatchedTxns) {
    const candidates = await findMatchCandidates({
      id: txn.id,
      amount: txn.amount,
      date: txn.date,
      merchantName: txn.merchantName,
      bankAccountId: txn.bankAccountId,
    })

    const classification = await classifyMatchTier(txn, candidates, rules, thresholds)

    if (classification.tier === 3) {
      items.push({
        bankTransaction: txn,
        reason: classification.reason,
      })
    }
  }

  return items
}
