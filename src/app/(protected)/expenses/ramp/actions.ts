'use server'

import { revalidatePath } from 'next/cache'
import { and, count, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  rampTransactions,
  categorizationRules,
  accounts,
  funds,
} from '@/lib/db/schema'
import {
  categorizeRampTransactionSchema,
  bulkCategorizeSchema,
  type CategorizeRampTransaction,
  type BulkCategorize,
} from '@/lib/validators'
import { postCategorizedTransaction } from '@/lib/ramp/categorization'
import { fetchTransactions } from '@/lib/integrations/ramp'
import { autoCategorize, batchPostCategorized } from '@/lib/ramp/categorization'
import { getUserId } from '@/lib/auth'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type RampTransactionRow = typeof rampTransactions.$inferSelect & {
  glAccountName: string | null
  glAccountCode: string | null
  fundName: string | null
}

export type RampStats = {
  pending: number
  uncategorized: number
  categorized: number
  posted: number
  autoCategorized: number
  aiSuggested: number
  manualRequired: number
  postedToday: number
}

// --- Queries ---

export async function getRampTransactions(filters?: {
  status?: string
  search?: string
}): Promise<RampTransactionRow[]> {
  const conditions = []

  if (filters?.status && filters.status !== 'all') {
    conditions.push(
      eq(
        rampTransactions.status,
        filters.status as (typeof rampTransactions.status.enumValues)[number]
      )
    )
  }
  if (filters?.search) {
    conditions.push(ilike(rampTransactions.merchantName, `%${filters.search}%`))
  }

  const rows = await db
    .select({
      id: rampTransactions.id,
      rampId: rampTransactions.rampId,
      date: rampTransactions.date,
      amount: rampTransactions.amount,
      merchantName: rampTransactions.merchantName,
      description: rampTransactions.description,
      cardholder: rampTransactions.cardholder,
      isPending: rampTransactions.isPending,
      status: rampTransactions.status,
      glAccountId: rampTransactions.glAccountId,
      fundId: rampTransactions.fundId,
      glTransactionId: rampTransactions.glTransactionId,
      categorizationRuleId: rampTransactions.categorizationRuleId,
      syncedAt: rampTransactions.syncedAt,
      createdAt: rampTransactions.createdAt,
      glAccountName: accounts.name,
      glAccountCode: accounts.code,
      fundName: funds.name,
    })
    .from(rampTransactions)
    .leftJoin(accounts, eq(rampTransactions.glAccountId, accounts.id))
    .leftJoin(funds, eq(rampTransactions.fundId, funds.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(rampTransactions.date))

  return rows
}

export async function getRampStats(): Promise<RampStats> {
  const result = await db
    .select({
      status: rampTransactions.status,
      isPending: rampTransactions.isPending,
      count: count(),
    })
    .from(rampTransactions)
    .groupBy(rampTransactions.status, rampTransactions.isPending)

  const stats: RampStats = {
    pending: 0,
    uncategorized: 0,
    categorized: 0,
    posted: 0,
    autoCategorized: 0,
    aiSuggested: 0,
    manualRequired: 0,
    postedToday: 0,
  }
  for (const row of result) {
    if (row.isPending) {
      stats.pending += row.count
    } else if (row.status === 'uncategorized') {
      stats.uncategorized = row.count
    } else if (row.status === 'categorized') {
      stats.categorized = row.count
    } else if (row.status === 'posted') {
      stats.posted = row.count
    }
  }

  // Count auto-categorized (have a categorizationRuleId)
  const [autoResult] = await db
    .select({ count: count() })
    .from(rampTransactions)
    .where(
      and(
        eq(rampTransactions.isPending, false),
        sql`${rampTransactions.categorizationRuleId} IS NOT NULL`
      )
    )
  stats.autoCategorized = autoResult?.count ?? 0

  // AI suggested and manual required are computed client-side (from uncategorized transactions with/without AI suggestions)
  // For now, manualRequired = uncategorized (refined after AI suggestions are fetched client-side)
  stats.manualRequired = stats.uncategorized

  // Count posted today
  const today = new Date().toISOString().substring(0, 10)
  const [todayResult] = await db
    .select({ count: count() })
    .from(rampTransactions)
    .where(
      and(
        eq(rampTransactions.status, 'posted'),
        sql`${rampTransactions.createdAt}::date = ${today}::date`
      )
    )
  stats.postedToday = todayResult?.count ?? 0

  return stats
}

// --- Mutations ---

export async function categorizeRampTransaction(
  data: CategorizeRampTransaction,
  aiSuggestion?: {
    accountId: number
    fundId: number
    confidence: 'high' | 'medium' | 'low'
  } | null
): Promise<void> {
  const userId = await getUserId()
  const validated = categorizeRampTransactionSchema.parse(data)

  // Guard: cannot categorize pending transactions
  const [txnCheck] = await db
    .select({ isPending: rampTransactions.isPending })
    .from(rampTransactions)
    .where(eq(rampTransactions.id, validated.rampTransactionId))
  if (txnCheck?.isPending) {
    throw new Error('Cannot categorize a pending transaction. Wait for it to clear.')
  }

  // Set categorization
  await db
    .update(rampTransactions)
    .set({
      glAccountId: validated.glAccountId,
      fundId: validated.fundId,
      status: 'categorized',
    })
    .where(eq(rampTransactions.id, validated.rampTransactionId))

  // Post to GL immediately (TXN-P0-028)
  await postCategorizedTransaction(validated.rampTransactionId, userId)

  // Log AI acceptance/override for calibration tracking
  if (aiSuggestion) {
    const aiAccepted =
      aiSuggestion.accountId === validated.glAccountId &&
      aiSuggestion.fundId === validated.fundId

    await logAudit(db as unknown as NeonDatabase<Record<string, unknown>>, {
      userId,
      action: 'updated',
      entityType: 'ramp_categorization',
      entityId: validated.rampTransactionId,
      afterState: {
        glAccountId: validated.glAccountId,
        fundId: validated.fundId,
        aiConfidence: aiSuggestion.confidence,
        aiAccepted,
        ...(!aiAccepted && {
          aiSuggestedAccountId: aiSuggestion.accountId,
          aiSuggestedFundId: aiSuggestion.fundId,
        }),
      },
    })
  }

  // Optionally create auto-categorization rule
  if (validated.createRule) {
    const [txn] = await db
      .select({ merchantName: rampTransactions.merchantName })
      .from(rampTransactions)
      .where(eq(rampTransactions.id, validated.rampTransactionId))

    if (txn) {
      await db.insert(categorizationRules).values({
        criteria: { merchantPattern: txn.merchantName },
        glAccountId: validated.glAccountId,
        fundId: validated.fundId,
        autoApply: true,
        createdBy: userId,
      })
    }
  }

  revalidatePath('/expenses/ramp')
}

export async function bulkCategorizeRampTransactions(
  data: BulkCategorize
): Promise<{ succeeded: number; failed: number }> {
  const userId = await getUserId()
  const validated = bulkCategorizeSchema.parse(data)

  let succeeded = 0
  let failed = 0

  for (const id of validated.rampTransactionIds) {
    try {
      await categorizeRampTransaction(
        {
          rampTransactionId: id,
          glAccountId: validated.glAccountId,
          fundId: validated.fundId,
          createRule: false,
        }
      )
      succeeded++
    } catch {
      failed++
    }
  }

  // Optionally create rule from the first transaction in the batch
  if (validated.createRule && validated.rampTransactionIds.length > 0) {
    const [txn] = await db
      .select({ merchantName: rampTransactions.merchantName })
      .from(rampTransactions)
      .where(eq(rampTransactions.id, validated.rampTransactionIds[0]))

    if (txn) {
      await db.insert(categorizationRules).values({
        criteria: { merchantPattern: txn.merchantName },
        glAccountId: validated.glAccountId,
        fundId: validated.fundId,
        autoApply: true,
        createdBy: userId,
      })
    }
  }

  revalidatePath('/expenses/ramp')
  return { succeeded, failed }
}

export async function triggerRampSync(options?: {
  fullHistory?: boolean
}): Promise<{ synced: number; autoCategorized: number; cleared: number }> {
  const userId = await getUserId()
  const fullHistory = options?.fullHistory ?? false

  let fetchParams: { from_date?: string; to_date?: string } | undefined
  if (!fullHistory) {
    const now = new Date()
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    fetchParams = {
      from_date: sevenDaysAgo.toISOString().substring(0, 10),
      to_date: now.toISOString().substring(0, 10),
    }
  }
  // fullHistory: omit date params to fetch all available transactions

  const transactions = await fetchTransactions(fetchParams)

  let synced = 0
  let cleared = 0
  let autoCategorized = 0
  const newClearedIds: number[] = []

  for (const txn of transactions) {
    const result = await db
      .insert(rampTransactions)
      .values({
        rampId: txn.rampId,
        date: txn.date,
        amount: String(txn.amount),
        merchantName: txn.merchantName,
        description: txn.description,
        cardholder: txn.cardholder,
        isPending: txn.isPending,
        status: 'uncategorized',
      })
      .onConflictDoNothing({ target: rampTransactions.rampId })
      .returning({ id: rampTransactions.id })

    if (result.length > 0) {
      synced++
      if (!txn.isPending) {
        newClearedIds.push(result[0].id)
      }
    } else if (!txn.isPending) {
      // Check for pending→cleared transition
      const [existing] = await db
        .select({ id: rampTransactions.id, isPending: rampTransactions.isPending })
        .from(rampTransactions)
        .where(eq(rampTransactions.rampId, txn.rampId))

      if (existing?.isPending) {
        await db
          .update(rampTransactions)
          .set({
            isPending: false,
            amount: String(txn.amount),
            date: txn.date,
          })
          .where(eq(rampTransactions.id, existing.id))
        cleared++
        newClearedIds.push(existing.id)
      }
    }
  }

  // Skip auto-categorization on full history sync — wait for QBO import
  // before posting to GL to avoid double-counting
  if (!fullHistory) {
    for (const id of newClearedIds) {
      const categorized = await autoCategorize(id)
      if (categorized) autoCategorized++
    }

    await batchPostCategorized(userId)
  }

  revalidatePath('/expenses/ramp')
  return { synced, autoCategorized, cleared }
}

// --- AI Categorization ---

export type AiSuggestion = {
  accountId: number
  accountName: string
  fundId: number
  fundName: string
  confidence: 'high' | 'medium' | 'low'
  reasoning: string
}

export async function getAiCategorization(
  rampTransactionId: number
): Promise<AiSuggestion | null> {
  const { getAiSuggestion } = await import('@/lib/ramp/ai-categorization')
  return getAiSuggestion(rampTransactionId)
}

export async function batchAiCategorize(
  rampTransactionIds: number[]
): Promise<Record<number, AiSuggestion>> {
  const { batchAiCategorize: batchAi } = await import('@/lib/ramp/ai-categorization')
  const results = await batchAi(rampTransactionIds)
  const record: Record<number, AiSuggestion> = {}
  for (const [id, suggestion] of results) {
    record[id] = suggestion
  }
  return record
}

// --- Shared data fetchers ---

export async function getAccountOptions(): Promise<
  { id: number; name: string; code: string; type: string }[]
> {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      code: accounts.code,
      type: accounts.type,
    })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}

export async function getFundOptions(): Promise<
  { id: number; name: string; restrictionType: string }[]
> {
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(
      and(
        eq(funds.isActive, true),
        or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
      )
    )
    .orderBy(funds.name)
}

/**
 * Find a matching categorization rule for a given merchant name.
 * Used to pre-fill the categorization dialog (TXN-P0-025).
 */
export async function findMatchingRule(merchantName: string): Promise<{
  glAccountId: number
  fundId: number
} | null> {
  const rules = await db
    .select()
    .from(categorizationRules)
    .where(eq(categorizationRules.autoApply, true))
    .orderBy(desc(categorizationRules.hitCount))

  for (const rule of rules) {
    const criteria = rule.criteria as { merchantPattern?: string; descriptionKeywords?: string[] }
    if (criteria.merchantPattern) {
      if (merchantName.toLowerCase().includes(criteria.merchantPattern.toLowerCase())) {
        return { glAccountId: rule.glAccountId, fundId: rule.fundId }
      }
    }
  }

  return null
}
