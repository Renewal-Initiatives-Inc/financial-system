'use server'

import { revalidatePath } from 'next/cache'
import { eq, ilike, and, desc, count } from 'drizzle-orm'
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

// --- Types ---

export type RampTransactionRow = typeof rampTransactions.$inferSelect & {
  glAccountName: string | null
  glAccountCode: string | null
  fundName: string | null
}

export type RampStats = {
  uncategorized: number
  categorized: number
  posted: number
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
      count: count(),
    })
    .from(rampTransactions)
    .groupBy(rampTransactions.status)

  const stats: RampStats = { uncategorized: 0, categorized: 0, posted: 0 }
  for (const row of result) {
    if (row.status in stats) {
      stats[row.status as keyof RampStats] = row.count
    }
  }
  return stats
}

// --- Mutations ---

export async function categorizeRampTransaction(
  data: CategorizeRampTransaction,
  userId: string
): Promise<void> {
  const validated = categorizeRampTransactionSchema.parse(data)

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
  data: BulkCategorize,
  userId: string
): Promise<{ succeeded: number; failed: number }> {
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
        },
        userId
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

export async function triggerRampSync(
  userId: string
): Promise<{ synced: number; autoCategorized: number }> {
  const now = new Date()
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
  const fromDate = sevenDaysAgo.toISOString().substring(0, 10)
  const toDate = now.toISOString().substring(0, 10)

  const transactions = await fetchTransactions({
    from_date: fromDate,
    to_date: toDate,
  })

  let synced = 0
  let autoCategorized = 0
  const newIds: number[] = []

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
        status: 'uncategorized',
      })
      .onConflictDoNothing({ target: rampTransactions.rampId })
      .returning({ id: rampTransactions.id })

    if (result.length > 0) {
      synced++
      newIds.push(result[0].id)
    }
  }

  for (const id of newIds) {
    const categorized = await autoCategorize(id)
    if (categorized) autoCategorized++
  }

  await batchPostCategorized(userId)

  revalidatePath('/expenses/ramp')
  return { synced, autoCategorized }
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
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(eq(funds.isActive, true))
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
