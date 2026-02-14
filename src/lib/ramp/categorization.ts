/**
 * Auto-categorization engine for Ramp credit card transactions.
 *
 * Handles:
 * - Rule matching (merchant pattern + description keywords)
 * - GL posting (DR Expense, CR Credit Card Payable)
 * - Batch posting after sync
 */

import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { rampTransactions, categorizationRules, accounts } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

// --- Types ---

interface RampTxnForMatching {
  merchantName: string
  description: string | null
}

interface RuleForMatching {
  id: number
  criteria: { merchantPattern?: string; descriptionKeywords?: string[] }
  glAccountId: number
  fundId: number
  autoApply: boolean
  hitCount: number
}

// --- Rule matching ---

/**
 * Match a transaction against a set of categorization rules.
 *
 * Matching algorithm:
 * 1. Filter rules where autoApply = true
 * 2. For each rule, check criteria:
 *    a. merchantPattern: case-insensitive substring match on merchantName
 *    b. descriptionKeywords: any keyword found in description (case-insensitive)
 * 3. If multiple rules match, pick the one with highest hitCount (most used = most trusted)
 * 4. Return matching rule or null
 */
export function matchRule(
  transaction: RampTxnForMatching,
  rules: RuleForMatching[]
): RuleForMatching | null {
  const activeRules = rules.filter((r) => r.autoApply)
  if (activeRules.length === 0) return null

  const matches: RuleForMatching[] = []

  for (const rule of activeRules) {
    let matched = false

    // Check merchant pattern (case-insensitive substring)
    if (rule.criteria.merchantPattern) {
      const pattern = rule.criteria.merchantPattern.toLowerCase()
      if (transaction.merchantName.toLowerCase().includes(pattern)) {
        matched = true
      }
    }

    // Check description keywords (any keyword match)
    if (
      !matched &&
      rule.criteria.descriptionKeywords &&
      rule.criteria.descriptionKeywords.length > 0 &&
      transaction.description
    ) {
      const desc = transaction.description.toLowerCase()
      const keywordMatch = rule.criteria.descriptionKeywords.some((kw) =>
        desc.includes(kw.toLowerCase())
      )
      if (keywordMatch) {
        matched = true
      }
    }

    if (matched) {
      matches.push(rule)
    }
  }

  if (matches.length === 0) return null
  // Pick the rule with highest hit count (most trusted)
  return matches.reduce((best, r) => (r.hitCount > best.hitCount ? r : best))
}

// --- Auto-categorize on sync ---

/**
 * Run auto-categorization on a newly synced Ramp transaction.
 * Returns true if the transaction was auto-categorized.
 */
export async function autoCategorize(rampTxnId: number): Promise<boolean> {
  // Fetch the transaction
  const [txn] = await db
    .select()
    .from(rampTransactions)
    .where(eq(rampTransactions.id, rampTxnId))

  if (!txn || txn.status !== 'uncategorized') return false

  // Fetch all auto-apply rules
  const rules = await db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.autoApply, true))

  const typedRules: RuleForMatching[] = rules.map((r) => ({
    id: r.id,
    criteria: r.criteria as { merchantPattern?: string; descriptionKeywords?: string[] },
    glAccountId: r.glAccountId,
    fundId: r.fundId,
    autoApply: r.autoApply,
    hitCount: r.hitCount,
  }))

  const match = matchRule(
    { merchantName: txn.merchantName, description: txn.description },
    typedRules
  )

  if (!match) return false

  // Apply categorization
  await db
    .update(rampTransactions)
    .set({
      glAccountId: match.glAccountId,
      fundId: match.fundId,
      status: 'categorized',
      categorizationRuleId: match.id,
    })
    .where(eq(rampTransactions.id, rampTxnId))

  // Increment hit count on the matched rule
  await db
    .update(categorizationRules)
    .set({ hitCount: sql`${categorizationRules.hitCount} + 1` })
    .where(eq(categorizationRules.id, match.id))

  return true
}

// --- GL posting ---

/**
 * Post a categorized Ramp transaction to the GL.
 *
 * Entry pattern:
 * - Purchase (positive amount): DR [Expense Account], CR Credit Card Payable
 * - Refund (negative amount):   DR Credit Card Payable, CR [Expense Account]
 */
export async function postCategorizedTransaction(
  rampTxnId: number,
  userId: string
): Promise<{ glTransactionId: number }> {
  // Fetch the Ramp transaction
  const [txn] = await db
    .select()
    .from(rampTransactions)
    .where(eq(rampTransactions.id, rampTxnId))

  if (!txn) throw new Error(`Ramp transaction ${rampTxnId} not found`)
  if (txn.status === 'uncategorized') {
    throw new Error('Cannot post uncategorized transaction (INV-009)')
  }
  if (txn.status === 'posted' || txn.glTransactionId) {
    throw new Error('Transaction already posted to GL')
  }
  if (!txn.glAccountId || !txn.fundId) {
    throw new Error('Transaction must have GL account and fund assigned')
  }

  // Look up Credit Card Payable account by code
  const [ccPayable] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '2020'))

  if (!ccPayable) {
    throw new Error('Credit Card Payable account (2020) not found in chart of accounts')
  }

  const amount = Number(txn.amount)
  const isRefund = amount < 0
  const absAmount = Math.abs(amount)

  // Build GL entry lines
  const lines = isRefund
    ? [
        // Refund: DR Credit Card Payable, CR Expense Account
        { accountId: ccPayable.id, fundId: txn.fundId, debit: absAmount, credit: null },
        { accountId: txn.glAccountId, fundId: txn.fundId, debit: null, credit: absAmount },
      ]
    : [
        // Purchase: DR Expense Account, CR Credit Card Payable
        { accountId: txn.glAccountId, fundId: txn.fundId, debit: absAmount, credit: null },
        { accountId: ccPayable.id, fundId: txn.fundId, debit: null, credit: absAmount },
      ]

  const result = await createTransaction({
    date: txn.date,
    memo: `Ramp: ${txn.merchantName}${txn.description ? ` - ${txn.description}` : ''}`,
    sourceType: 'RAMP',
    sourceReferenceId: txn.rampId,
    isSystemGenerated: false,
    lines,
    createdBy: userId,
  })

  // Update Ramp transaction with GL reference
  await db
    .update(rampTransactions)
    .set({
      status: 'posted',
      glTransactionId: result.transaction.id,
    })
    .where(eq(rampTransactions.id, rampTxnId))

  return { glTransactionId: result.transaction.id }
}

/**
 * Batch-post all categorized (but not yet posted) Ramp transactions.
 * Called after sync + auto-categorization.
 */
export async function batchPostCategorized(
  userId: string
): Promise<{ posted: number; failed: number }> {
  const pending = await db
    .select({ id: rampTransactions.id })
    .from(rampTransactions)
    .where(
      and(
        eq(rampTransactions.status, 'categorized'),
        sql`${rampTransactions.glTransactionId} IS NULL`
      )
    )

  let posted = 0
  let failed = 0

  for (const txn of pending) {
    try {
      await postCategorizedTransaction(txn.id, userId)
      posted++
    } catch (err) {
      console.error(`Failed to post Ramp transaction ${txn.id}:`, err)
      failed++
    }
  }

  return { posted, failed }
}
