'use server'

import { eq, and, sql, asc } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { importReviewItems, accounts, funds } from '@/lib/db/schema'
import {
  parseAndStore,
  submitApproved,
  getConsumedMatchIds,
  type UserSelections,
  type ReviewRecommendation,
  type MatchData,
  type AccrualData,
} from '@/lib/migration/review-engine'
import type { QboParsedTransaction } from '@/lib/migration/qbo-csv-parser'

// ── Types ──

export type ReviewItemRow = typeof importReviewItems.$inferSelect

export interface ReviewSummary {
  total: number
  approved: number
  skipped: number
  pending: number
  debitsBalance: string
  creditsBalance: string
}

export type AccountRow = typeof accounts.$inferSelect
export type FundRow = Pick<typeof funds.$inferSelect, 'id' | 'name' | 'restrictionType' | 'isActive'>

export interface ReviewItemDetail {
  item: ReviewItemRow
  parsedData: QboParsedTransaction
  recommendation: ReviewRecommendation
  matchData: MatchData | null
  accrualData: AccrualData | null
  userSelections: UserSelections | null
  consumedMatchIds: Set<string>
  accounts: AccountRow[]
  funds: FundRow[]
}

export interface AdjacentItems {
  prevId: number | null
  nextId: number | null
  currentIndex: number
  total: number
}

// ── Summary Page Actions ──

export async function parseAndLoadCsv(
  formData: FormData
): Promise<{ batchId: string; count: number; errors: Array<{ transactionNo: string; message: string }> }> {
  const file = formData.get('csv') as File | null
  if (!file) {
    return { batchId: '', count: 0, errors: [{ transactionNo: '', message: 'No file uploaded' }] }
  }

  const csvContent = await file.text()
  const cutoffDate = (formData.get('cutoffDate') as string) || '2025-12-31'

  const result = await parseAndStore(csvContent, cutoffDate)
  revalidatePath('/migration-review')

  return {
    batchId: result.batchId,
    count: result.totalTransactions,
    errors: result.errors,
  }
}

export async function getActiveBatchId(): Promise<string | null> {
  const result = await db
    .select({ batchId: importReviewItems.batchId })
    .from(importReviewItems)
    .limit(1)

  return result[0]?.batchId ?? null
}

export async function getReviewItems(
  batchId: string,
  filter?: 'all' | 'approved' | 'skipped' | 'pending'
): Promise<ReviewItemRow[]> {
  const conditions = [eq(importReviewItems.batchId, batchId)]

  if (filter && filter !== 'all') {
    conditions.push(eq(importReviewItems.status, filter))
  }

  return db
    .select()
    .from(importReviewItems)
    .where(and(...conditions))
    .orderBy(asc(importReviewItems.transactionDate), asc(importReviewItems.id))
}

export async function getReviewSummary(batchId: string): Promise<ReviewSummary> {
  const rows = await db
    .select({
      status: importReviewItems.status,
      count: sql<number>`count(*)::int`,
    })
    .from(importReviewItems)
    .where(eq(importReviewItems.batchId, batchId))
    .groupBy(importReviewItems.status)

  let total = 0
  let approved = 0
  let skipped = 0
  let pending = 0

  for (const row of rows) {
    const count = Number(row.count)
    total += count
    if (row.status === 'approved') approved = count
    else if (row.status === 'skipped') skipped = count
    else if (row.status === 'pending') pending = count
  }

  // Calculate balance across all approved items
  const balanceRows = await db
    .select({
      recommendation: importReviewItems.recommendation,
      userSelections: importReviewItems.userSelections,
    })
    .from(importReviewItems)
    .where(
      and(
        eq(importReviewItems.batchId, batchId),
        eq(importReviewItems.status, 'approved')
      )
    )

  let totalDebits = 0
  let totalCredits = 0

  for (const row of balanceRows) {
    const rec = row.recommendation as ReviewRecommendation
    for (const line of rec.lines) {
      totalDebits += line.debit ?? 0
      totalCredits += line.credit ?? 0
    }
  }

  return {
    total,
    approved,
    skipped,
    pending,
    debitsBalance: totalDebits.toFixed(2),
    creditsBalance: totalCredits.toFixed(2),
  }
}

export async function resetItem(id: number): Promise<void> {
  await db
    .update(importReviewItems)
    .set({
      status: 'pending',
      userSelections: null,
      approvedBy: null,
      approvedAt: null,
      glTransactionId: null,
      updatedAt: new Date(),
    })
    .where(eq(importReviewItems.id, id))

  revalidatePath('/migration-review')
}

export async function submitFinal(
  batchId: string,
  userId: string
): Promise<{ success: boolean; posted: number; errors: string[] }> {
  const result = await submitApproved(batchId, userId)

  revalidatePath('/migration-review')

  return {
    success: result.errors.length === 0,
    posted: result.posted,
    errors: result.errors.map((e) => `#${e.transactionNo}: ${e.message}`),
  }
}

// ── Transaction Review Page Actions ──

export async function getReviewItem(id: number): Promise<ReviewItemDetail | null> {
  const items = await db
    .select()
    .from(importReviewItems)
    .where(eq(importReviewItems.id, id))
    .limit(1)

  if (items.length === 0) return null

  const item = items[0]
  const consumedMatchIds = await getConsumedMatchIds(item.batchId)

  const accountRows = await db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, true))

  const fundRows = await db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
      isActive: funds.isActive,
    })
    .from(funds)
    .where(eq(funds.isActive, true))

  return {
    item,
    parsedData: item.parsedData as QboParsedTransaction,
    recommendation: item.recommendation as ReviewRecommendation,
    matchData: item.matchData as MatchData | null,
    accrualData: item.accrualData as AccrualData | null,
    userSelections: item.userSelections as UserSelections | null,
    consumedMatchIds,
    accounts: accountRows,
    funds: fundRows,
  }
}

export async function approveItem(
  id: number,
  selections: UserSelections,
  userId: string
): Promise<void> {
  await db
    .update(importReviewItems)
    .set({
      status: 'approved',
      userSelections: selections,
      approvedBy: userId,
      approvedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(importReviewItems.id, id))

  revalidatePath('/migration-review')
}

export async function skipItem(id: number): Promise<void> {
  await db
    .update(importReviewItems)
    .set({
      status: 'skipped',
      updatedAt: new Date(),
    })
    .where(eq(importReviewItems.id, id))

  revalidatePath('/migration-review')
}

export async function getAdjacentItems(
  id: number,
  batchId: string
): Promise<AdjacentItems> {
  // Get all item IDs in order
  const allItems = await db
    .select({ id: importReviewItems.id })
    .from(importReviewItems)
    .where(eq(importReviewItems.batchId, batchId))
    .orderBy(asc(importReviewItems.transactionDate), asc(importReviewItems.id))

  const currentIndex = allItems.findIndex((item) => item.id === id)
  const prevId = currentIndex > 0 ? allItems[currentIndex - 1].id : null
  const nextId = currentIndex < allItems.length - 1 ? allItems[currentIndex + 1].id : null

  return {
    prevId,
    nextId,
    currentIndex: currentIndex + 1,
    total: allItems.length,
  }
}

export async function getNextPendingId(
  batchId: string,
  afterId: number
): Promise<number | null> {
  const items = await db
    .select({ id: importReviewItems.id })
    .from(importReviewItems)
    .where(
      and(
        eq(importReviewItems.batchId, batchId),
        eq(importReviewItems.status, 'pending'),
        sql`${importReviewItems.id} > ${afterId}`
      )
    )
    .orderBy(asc(importReviewItems.id))
    .limit(1)

  if (items.length > 0) return items[0].id

  // Wrap around — find first pending item
  const wrap = await db
    .select({ id: importReviewItems.id })
    .from(importReviewItems)
    .where(
      and(
        eq(importReviewItems.batchId, batchId),
        eq(importReviewItems.status, 'pending')
      )
    )
    .orderBy(asc(importReviewItems.id))
    .limit(1)

  return wrap[0]?.id ?? null
}

export async function deleteBatch(batchId: string): Promise<void> {
  await db
    .delete(importReviewItems)
    .where(eq(importReviewItems.batchId, batchId))

  revalidatePath('/migration-review')
}
