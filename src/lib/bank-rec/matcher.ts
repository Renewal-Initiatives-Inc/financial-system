/**
 * Bank reconciliation matching engine (REC-P0-006, REC-P0-007, REC-P0-008).
 *
 * Evidence-based composite scoring model. Classification runs at sync time,
 * results stored in bank_transactions columns for fast DB reads at render time.
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
import { jaroWinklerSimilarity, normalizeMerchantName } from './string-similarity'
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
  confidenceScore: number // 0-100 scale
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

// --- Composite Scoring ---

interface CompositeScoreInput {
  bankAmount: number
  glAmount: number
  bankMerchantName: string | null
  glMemo: string | null
  glLineMemo: string | null
  bankDate: Date
  glDate: Date
  ruleHitCount: number
  isRecurringMatch: boolean
}

/**
 * Evidence-based composite scoring model.
 *
 * score = amount×0.40 + description×0.30 + date×0.15 + history×0.15
 *
 * Returns score on 0-100 scale.
 */
export function computeCompositeScore(input: CompositeScoreInput): number {
  // Amount sub-score (40%): 100 if exact (±$0.01), 0 otherwise
  const amountScore = Math.abs(input.bankAmount - input.glAmount) < 0.01 ? 100 : 0

  // Description sub-score (30%): Jaro-Winkler similarity
  let descriptionScore = 0
  if (input.bankMerchantName) {
    const normalizedMerchant = normalizeMerchantName(input.bankMerchantName)
    const memo = input.glMemo ?? input.glLineMemo ?? ''
    if (memo) {
      const normalizedMemo = normalizeMerchantName(memo)
      descriptionScore = jaroWinklerSimilarity(normalizedMerchant, normalizedMemo) * 100
    }
  }

  // Date sub-score (15%): max(0, 100 - daysDiff × 15) — 0 after 7 days
  const daysDiff = Math.abs(
    (input.bankDate.getTime() - input.glDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const dateScore = Math.max(0, 100 - daysDiff * 15)

  // History sub-score (15%): rule hit count or recurring match
  let historyScore = 0
  if (input.isRecurringMatch) {
    historyScore = 100
  } else if (input.ruleHitCount >= 5) {
    historyScore = 100
  } else if (input.ruleHitCount >= 3) {
    historyScore = 75
  } else if (input.ruleHitCount >= 1) {
    historyScore = 50
  }

  let score =
    amountScore * 0.4 +
    descriptionScore * 0.3 +
    dateScore * 0.15 +
    historyScore * 0.15

  // New merchant penalty: cap at 85 if rule hitCount < 3
  if (input.ruleHitCount < 3 && !input.isRecurringMatch) {
    score = Math.min(score, 85)
  }

  return Math.round(score * 100) / 100
}

// --- Thresholds ---

export interface MatchThresholds {
  autoMatchMinScore: number // Tier 1 threshold (default 92)
  reviewMinScore: number // Tier 2 threshold (default 60)
  autoMatchMaxAmount: number
  autoMatchMinHitCount: number
}

async function getThresholds(): Promise<MatchThresholds> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)

  const map = new Map(rows.map((r) => [r.key, r.value]))

  return {
    autoMatchMinScore: parseFloat(map.get('autoMatchMinScore') ?? '92'),
    reviewMinScore: parseFloat(map.get('reviewMinScore') ?? '60'),
    autoMatchMaxAmount: parseFloat(map.get('autoMatchMaxAmount') ?? '500.00'),
    autoMatchMinHitCount: parseInt(map.get('autoMatchMinHitCount') ?? '5'),
  }
}

// --- Matching algorithm ---

/**
 * Find GL transaction line candidates that could match a bank transaction.
 * Uses composite scoring model instead of naive base+bonus approach.
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

  // Filter out already-matched lines in JS
  const matchedSet = new Set(matchedLineIds)
  const filtered = candidates.filter((c) => !matchedSet.has(c.lineId))

  // Look up offsetting lines for display
  const txnIds = [...new Set(filtered.map((c) => c.transactionId))]
  const offsetLines = txnIds.length > 0
    ? await db
        .select({
          transactionId: transactionLines.transactionId,
          accountId: transactionLines.accountId,
          accountName: accounts.name,
          accountCode: accounts.code,
        })
        .from(transactionLines)
        .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
        .where(
          and(
            inArray(transactionLines.transactionId, txnIds),
            not(eq(transactionLines.accountId, bankAccountGlId))
          )
        )
    : []

  const offsetMap = new Map<number, string>()
  for (const ol of offsetLines) {
    if (!offsetMap.has(ol.transactionId)) {
      offsetMap.set(ol.transactionId, `${ol.accountCode} — ${ol.accountName}`)
    }
  }

  // Load matching rules for history scoring
  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  // Check recurring expectation
  const recurringMatch = await matchRecurringExpectation({
    amount: bankTxn.amount,
    date: bankTxn.date,
    merchantName: bankTxn.merchantName,
    bankAccountId: bankTxn.bankAccountId,
  })

  // Find best matching rule for this transaction
  const matchedRule = findMatchingRule(bankTxn, rules)

  // Score candidates using composite model
  return filtered
    .map((c) => {
      const glAmount = c.debit ? parseFloat(c.debit) : c.credit ? parseFloat(c.credit) : 0

      const score = computeCompositeScore({
        bankAmount,
        glAmount,
        bankMerchantName: bankTxn.merchantName,
        glMemo: c.txnMemo,
        glLineMemo: c.memo,
        bankDate,
        glDate: new Date(c.txnDate),
        ruleHitCount: matchedRule?.hitCount ?? 0,
        isRecurringMatch: !!recurringMatch,
      })

      return {
        glTransactionLineId: c.lineId,
        transactionId: c.transactionId,
        date: c.txnDate,
        memo: c.txnMemo,
        accountName: offsetMap.get(c.transactionId) ?? c.accountName,
        debit: c.debit,
        credit: c.credit,
        amount: glAmount,
        confidenceScore: score,
      }
    })
    .sort((a, b) => b.confidenceScore - a.confidenceScore)
}

/**
 * Find the best matching rule for a bank transaction.
 */
function findMatchingRule(
  bankTxn: { amount: string; merchantName: string | null },
  rules: (typeof matchingRules.$inferSelect)[]
): (typeof matchingRules.$inferSelect) | undefined {
  return rules.find((r) => {
    const criteria = r.criteria as { merchantPattern?: string; amountExact?: string }
    if (criteria.merchantPattern && bankTxn.merchantName) {
      if (!bankTxn.merchantName.toLowerCase().includes(criteria.merchantPattern.toLowerCase())) {
        return false
      }
    } else if (criteria.merchantPattern && !bankTxn.merchantName) {
      return false
    }
    if (criteria.amountExact) {
      if (Math.abs(parseFloat(bankTxn.amount) - parseFloat(criteria.amountExact)) > 0.01) {
        return false
      }
    }
    return true
  })
}

/**
 * Check if a bank transaction matches a recurring expectation.
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
    try {
      const regex = new RegExp(exp.merchantPattern, 'i')
      if (!regex.test(bankTxn.merchantName)) continue
    } catch {
      continue
    }

    const expectedAmt = parseFloat(exp.expectedAmount)
    const tolerance = parseFloat(exp.amountTolerance)
    if (Math.abs(bankAmount - expectedAmt) > tolerance) continue

    const expectedDay = exp.expectedDay
    let dayMatch = false

    if (exp.frequency === 'weekly' || exp.frequency === 'biweekly') {
      const bankDayOfWeek = bankDate.getDay() === 0 ? 7 : bankDate.getDay()
      dayMatch = Math.abs(bankDayOfWeek - expectedDay) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay + 7) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay - 7) <= 3
    } else {
      dayMatch = Math.abs(bankDay - expectedDay) <= 3 ||
        Math.abs(bankDay - expectedDay + 31) <= 3 ||
        Math.abs(bankDay - expectedDay - 31) <= 3
    }

    if (!dayMatch) continue
    return exp
  }

  return null
}

// --- Match CRUD ---

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

    if (criteria.merchantPattern && bankTxn.merchantName) {
      const pattern = criteria.merchantPattern.toLowerCase()
      if (!bankTxn.merchantName.toLowerCase().includes(pattern)) {
        matches = false
      }
    } else if (criteria.merchantPattern && !bankTxn.merchantName) {
      matches = false
    }

    if (criteria.amountExact) {
      if (
        Math.abs(parseFloat(bankTxn.amount) - parseFloat(criteria.amountExact)) >
        0.01
      ) {
        matches = false
      }
    }

    if (!matches) continue

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
  const [bankTxn] = await db
    .select()
    .from(bankTransactions)
    .where(eq(bankTransactions.id, params.bankTransactionId))

  if (!bankTxn) throw new Error('Bank transaction not found')

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

// --- Pre-computed Classification Engine ---

export interface TierClassification {
  tier: 1 | 2 | 3
  reason: string
  candidate?: MatchCandidate
  ruleId?: number
}

export interface AutoMatchResult {
  classified: number
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
 * Classify all unclassified bank transactions for a bank account.
 * Writes tier, suggested GL line, confidence, and reason to bank_transactions rows.
 * Auto-matches Tier 1 items immediately.
 *
 * Called at sync time (not render time).
 */
export async function classifyBankTransactions(
  bankAccountId: number
): Promise<AutoMatchResult> {
  const thresholds = await getThresholds()
  const result: AutoMatchResult = {
    classified: 0,
    autoMatched: 0,
    pendingReview: 0,
    exceptions: 0,
    errors: [],
  }

  // Get unclassified, non-pending transactions (matchTier IS NULL)
  const unclassified = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false),
        isNull(bankTransactions.matchTier)
      )
    )

  if (unclassified.length === 0) return result

  // Load rules once
  const rules = await db
    .select()
    .from(matchingRules)
    .where(eq(matchingRules.isActive, true))

  for (const txn of unclassified) {
    try {
      const candidates = await findMatchCandidates({
        id: txn.id,
        amount: txn.amount,
        date: txn.date,
        merchantName: txn.merchantName,
        bankAccountId: txn.bankAccountId,
      })

      const classification = determineTier(txn, candidates, rules, thresholds)

      // Write classification to bank_transactions row
      await db
        .update(bankTransactions)
        .set({
          matchTier: classification.tier,
          suggestedGlLineId: classification.candidate?.glTransactionLineId ?? null,
          suggestedConfidence: classification.candidate
            ? String(classification.candidate.confidenceScore)
            : null,
          suggestedReason: classification.reason,
          suggestedRuleId: classification.ruleId ?? null,
          updatedAt: new Date(),
        })
        .where(eq(bankTransactions.id, txn.id))

      result.classified++

      if (classification.tier === 1 && classification.candidate) {
        // Auto-match: create bank_match immediately
        await createMatch({
          bankTransactionId: txn.id,
          glTransactionLineId: classification.candidate.glTransactionLineId,
          matchType: 'auto',
          confidenceScore: classification.candidate.confidenceScore,
          ruleId: classification.ruleId,
          userId: 'system-auto-match',
        })

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
 * Re-classify all unmatched transactions for a bank account.
 * Called after approve/reject actions to re-evaluate freed/consumed GL lines.
 */
export async function reclassifyUnmatched(
  bankAccountId: number
): Promise<AutoMatchResult> {
  // Get IDs of transactions that already have a bank_match
  const matchedBankIds = await db
    .select({ bankTxnId: bankMatches.bankTransactionId })
    .from(bankMatches)

  const matchedSet = new Set(matchedBankIds.map((m) => m.bankTxnId))

  // Reset matchTier to NULL for all non-pending txns without a bank_match
  const allTxns = await db
    .select({ id: bankTransactions.id })
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.isPending, false)
      )
    )

  const unmatchedIds = allTxns.filter((t) => !matchedSet.has(t.id)).map((t) => t.id)

  if (unmatchedIds.length > 0) {
    await db
      .update(bankTransactions)
      .set({
        matchTier: null,
        suggestedGlLineId: null,
        suggestedConfidence: null,
        suggestedReason: null,
        suggestedRuleId: null,
        updatedAt: new Date(),
      })
      .where(inArray(bankTransactions.id, unmatchedIds))
  }

  // Re-classify
  return classifyBankTransactions(bankAccountId)
}

/**
 * Determine tier for a transaction (pure logic, no DB writes).
 */
function determineTier(
  bankTxn: typeof bankTransactions.$inferSelect,
  candidates: MatchCandidate[],
  rules: (typeof matchingRules.$inferSelect)[],
  thresholds: MatchThresholds
): TierClassification {
  const bankAmount = Math.abs(parseFloat(bankTxn.amount))

  // No candidates at all → Tier 3
  if (candidates.length === 0) {
    const hasRule = rules.some((r) => {
      const criteria = r.criteria as { merchantPattern?: string }
      if (!criteria.merchantPattern || !bankTxn.merchantName) return false
      return bankTxn.merchantName.toLowerCase().includes(criteria.merchantPattern.toLowerCase())
    })

    if (!hasRule) {
      return { tier: 3, reason: 'No match candidates and no matching rule — new merchant' }
    }
    return { tier: 3, reason: 'No GL match candidates found' }
  }

  const best = candidates[0]

  // Multiple candidates within 5 points → Tier 3 (ambiguous)
  if (candidates.length > 1) {
    const diff = best.confidenceScore - candidates[1].confidenceScore
    if (diff < 5) {
      return {
        tier: 3,
        reason: `Ambiguous: ${candidates.length} candidates within 5 points`,
        candidate: best,
      }
    }
  }

  // Below review threshold → Tier 3
  if (best.confidenceScore < thresholds.reviewMinScore) {
    return {
      tier: 3,
      reason: `Low confidence (${best.confidenceScore} < ${thresholds.reviewMinScore})`,
      candidate: best,
    }
  }

  // Find matching rule
  const matchedRule = findMatchingRule(bankTxn, rules)

  // Tier 1: score ≥ 92 + additional guards
  if (
    best.confidenceScore >= thresholds.autoMatchMinScore &&
    matchedRule &&
    matchedRule.autoMatchEligible &&
    matchedRule.hitCount >= thresholds.autoMatchMinHitCount &&
    bankAmount <= thresholds.autoMatchMaxAmount
  ) {
    return {
      tier: 1,
      reason: `Auto-match: score ${best.confidenceScore}, rule hits ${matchedRule.hitCount}`,
      candidate: best,
      ruleId: matchedRule.id,
    }
  }

  // Tier 2: has a candidate at review threshold but doesn't meet auto-match criteria
  const reasons: string[] = []
  if (!matchedRule) reasons.push('no matching rule')
  else if (!matchedRule.autoMatchEligible) reasons.push('rule not auto-match eligible')
  else if (matchedRule.hitCount < thresholds.autoMatchMinHitCount) reasons.push(`rule hits ${matchedRule.hitCount} < ${thresholds.autoMatchMinHitCount}`)
  if (best.confidenceScore < thresholds.autoMatchMinScore) reasons.push(`score ${best.confidenceScore} < ${thresholds.autoMatchMinScore}`)
  if (bankAmount > thresholds.autoMatchMaxAmount) reasons.push(`amount $${bankAmount} > max $${thresholds.autoMatchMaxAmount}`)

  return {
    tier: 2,
    reason: reasons.join('; ') || 'Review needed',
    candidate: best,
    ruleId: matchedRule?.id,
  }
}

// --- Legacy compatibility: DB-read functions for actions.ts ---

/**
 * Get Tier 2 (batch review) items from pre-computed columns.
 * Looks up the OFFSETTING line (expense/revenue account), not the checking-side line.
 */
export async function getBatchReviewCandidates(
  bankAccountId: number
): Promise<BatchReviewItem[]> {
  // Step 1: Get tier-2 transactions with their suggested GL line
  const rows = await db
    .select({
      bt: bankTransactions,
      glLineId: transactionLines.id,
      glTransactionId: transactionLines.transactionId,
      glAccountId: transactionLines.accountId,
      glDebit: transactionLines.debit,
      glCredit: transactionLines.credit,
      glMemo: transactionLines.memo,
      glTxnDate: transactions.date,
      glTxnMemo: transactions.memo,
    })
    .from(bankTransactions)
    .leftJoin(transactionLines, eq(bankTransactions.suggestedGlLineId, transactionLines.id))
    .leftJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.matchTier, 2)
      )
    )

  const withGl = rows.filter((r) => r.glLineId != null)
  if (withGl.length === 0) return []

  // Step 2: Look up offsetting lines for each GL transaction
  // (the suggested line is the checking-side; users want the expense/revenue account)
  const txnIds = [...new Set(withGl.map((r) => r.glTransactionId!).filter(Boolean))]
  const checkingAccountId = withGl[0]?.glAccountId

  const offsetLines = txnIds.length > 0
    ? await db
        .select({
          transactionId: transactionLines.transactionId,
          accountName: accounts.name,
          accountCode: accounts.code,
        })
        .from(transactionLines)
        .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
        .where(
          and(
            inArray(transactionLines.transactionId, txnIds),
            checkingAccountId
              ? not(eq(transactionLines.accountId, checkingAccountId))
              : sql`true`
          )
        )
    : []

  // Build map: transactionId → first offsetting account display name
  const offsetMap = new Map<number, string>()
  for (const ol of offsetLines) {
    if (!offsetMap.has(ol.transactionId)) {
      offsetMap.set(ol.transactionId, `${ol.accountCode} — ${ol.accountName}`)
    }
  }

  return withGl.map((r) => {
    const glAmount = r.glDebit ? parseFloat(r.glDebit) : r.glCredit ? parseFloat(r.glCredit) : 0
    const offsetName = r.glTransactionId ? offsetMap.get(r.glTransactionId) : undefined

    return {
      bankTransaction: r.bt,
      candidate: {
        glTransactionLineId: r.glLineId!,
        transactionId: r.glTransactionId!,
        date: r.glTxnDate ?? r.bt.date,
        memo: r.glTxnMemo,
        accountName: offsetName ?? 'Unknown',
        debit: r.glDebit,
        credit: r.glCredit,
        amount: glAmount,
        confidenceScore: r.bt.suggestedConfidence
          ? parseFloat(r.bt.suggestedConfidence)
          : 0,
      },
      reason: r.bt.suggestedReason ?? 'Review needed',
      ruleId: r.bt.suggestedRuleId ?? undefined,
    }
  })
}

/**
 * Get Tier 3 (exception) items from pre-computed columns — single query.
 */
export async function getExceptions(
  bankAccountId: number
): Promise<ExceptionItem[]> {
  const rows = await db
    .select()
    .from(bankTransactions)
    .where(
      and(
        eq(bankTransactions.bankAccountId, bankAccountId),
        eq(bankTransactions.matchTier, 3)
      )
    )

  return rows.map((bt) => ({
    bankTransaction: bt,
    reason: bt.suggestedReason ?? 'No match found',
  }))
}

// --- Legacy runAutoMatch (delegates to new classification engine) ---

export async function runAutoMatch(
  bankAccountId: number
): Promise<AutoMatchResult> {
  return classifyBankTransactions(bankAccountId)
}

// Keep classifyMatchTier export for backward compatibility
export { determineTier as classifyMatchTier }
