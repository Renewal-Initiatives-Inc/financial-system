import { eq, sql } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { bankAccounts, bankTransactions } from '@/lib/db/schema'
import { syncTransactions, type PlaidTransactionRecord } from '@/lib/integrations/plaid'

export interface HistorySyncResult {
  bankAccountId: number
  transactionsSynced: number
  dateRange: { earliest: string; latest: string } | null
  cursorSaved: string
}

export interface HistorySyncSummary {
  bankAccountId: number
  totalTransactions: number
  dateRange: { earliest: string; latest: string } | null
  monthlyBreakdown: Array<{ month: string; count: number }>
}

/**
 * Pull up to 24 months of bank transaction history from Plaid.
 * Uses cursor-based pagination to fetch all available history.
 *
 * Per D-102: starting balance is $0 (accounts opened when company had $0 net cash).
 * Plaid sign convention: positive = money out, negative = money in (stored as-is).
 */
export async function syncBankHistory(
  db: NeonDatabase<any>,
  bankAccountId: number
): Promise<HistorySyncResult> {
  // Load bank account record
  const [bankAccount] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))

  if (!bankAccount) {
    throw new Error(`Bank account ${bankAccountId} not found`)
  }

  // Start with null cursor for full history (or existing cursor for incremental)
  let cursor: string | null = null
  let totalSynced = 0
  let allTransactions: PlaidTransactionRecord[] = []

  // Pagination loop — keep fetching until hasMore is false
  let hasMore = true
  while (hasMore) {
    try {
      const result = await syncTransactions(
        bankAccount.plaidAccessToken,
        cursor,
        bankAccount.plaidAccountId ?? undefined
      )

      // Insert added transactions
      if (result.added.length > 0) {
        await insertBankTransactions(db, bankAccountId, result.added)
        allTransactions = allTransactions.concat(result.added)
        totalSynced += result.added.length
      }

      // Handle modified transactions (update existing)
      if (result.modified.length > 0) {
        await updateBankTransactions(db, result.modified)
      }

      // Handle removed transactions (delete)
      if (result.removed.length > 0) {
        await removeBankTransactions(db, result.removed)
      }

      cursor = result.nextCursor
      hasMore = result.hasMore
    } catch (error) {
      // On Plaid rate limit or transient error, save progress and re-throw
      if (cursor) {
        await saveCursor(db, bankAccountId, cursor)
      }
      throw error
    }
  }

  // Save final cursor
  if (cursor) {
    await saveCursor(db, bankAccountId, cursor)
  }

  // Calculate date range
  const dateRange = allTransactions.length > 0
    ? {
        earliest: allTransactions.reduce((min, t) => t.date < min ? t.date : min, allTransactions[0].date),
        latest: allTransactions.reduce((max, t) => t.date > max ? t.date : max, allTransactions[0].date),
      }
    : null

  return {
    bankAccountId,
    transactionsSynced: totalSynced,
    dateRange,
    cursorSaved: cursor ?? '',
  }
}

/**
 * Get a summary of synced bank history for a bank account.
 */
export async function getHistorySyncSummary(
  db: NeonDatabase<any>,
  bankAccountId: number
): Promise<HistorySyncSummary> {
  // Total count and date range
  const statsResult = await db.execute(sql`
    SELECT
      COUNT(*) as total_count,
      MIN(date) as earliest_date,
      MAX(date) as latest_date
    FROM ${bankTransactions}
    WHERE bank_account_id = ${bankAccountId}
  `)

  const stats = statsResult.rows[0] as {
    total_count: string
    earliest_date: string | null
    latest_date: string | null
  }

  // Monthly breakdown
  const monthlyResult = await db.execute(sql`
    SELECT
      TO_CHAR(date, 'YYYY-MM') as month,
      COUNT(*) as count
    FROM ${bankTransactions}
    WHERE bank_account_id = ${bankAccountId}
    GROUP BY TO_CHAR(date, 'YYYY-MM')
    ORDER BY month
  `)

  const monthlyBreakdown = (monthlyResult.rows as any[]).map((r) => ({
    month: r.month as string,
    count: parseInt(r.count, 10),
  }))

  const totalCount = parseInt(stats.total_count, 10)

  return {
    bankAccountId,
    totalTransactions: totalCount,
    dateRange: totalCount > 0 && stats.earliest_date && stats.latest_date
      ? { earliest: stats.earliest_date, latest: stats.latest_date }
      : null,
    monthlyBreakdown,
  }
}

// --- Internal helpers ---

async function insertBankTransactions(
  db: NeonDatabase<any>,
  bankAccountId: number,
  records: PlaidTransactionRecord[]
): Promise<void> {
  // Use ON CONFLICT to handle duplicates gracefully
  for (const record of records) {
    await db.execute(sql`
      INSERT INTO ${bankTransactions} (
        bank_account_id, plaid_transaction_id, amount, date,
        merchant_name, category, is_pending, payment_channel, raw_data
      )
      VALUES (
        ${bankAccountId},
        ${record.plaidTransactionId},
        ${String(record.amount)},
        ${record.date},
        ${record.merchantName},
        ${record.category},
        ${record.isPending},
        ${record.paymentChannel},
        ${JSON.stringify(record.rawData)}::jsonb
      )
      ON CONFLICT (plaid_transaction_id) DO UPDATE SET
        amount = EXCLUDED.amount,
        date = EXCLUDED.date,
        merchant_name = EXCLUDED.merchant_name,
        category = EXCLUDED.category,
        is_pending = EXCLUDED.is_pending,
        payment_channel = EXCLUDED.payment_channel,
        raw_data = EXCLUDED.raw_data,
        updated_at = NOW()
    `)
  }
}

async function updateBankTransactions(
  db: NeonDatabase<any>,
  records: PlaidTransactionRecord[]
): Promise<void> {
  for (const record of records) {
    await db.execute(sql`
      UPDATE ${bankTransactions}
      SET
        amount = ${String(record.amount)},
        date = ${record.date},
        merchant_name = ${record.merchantName},
        category = ${record.category},
        is_pending = ${record.isPending},
        payment_channel = ${record.paymentChannel},
        raw_data = ${JSON.stringify(record.rawData)}::jsonb,
        updated_at = NOW()
      WHERE plaid_transaction_id = ${record.plaidTransactionId}
    `)
  }
}

async function removeBankTransactions(
  db: NeonDatabase<any>,
  plaidTransactionIds: string[]
): Promise<void> {
  for (const id of plaidTransactionIds) {
    await db.execute(sql`
      DELETE FROM ${bankTransactions}
      WHERE plaid_transaction_id = ${id}
    `)
  }
}

async function saveCursor(
  db: NeonDatabase<any>,
  bankAccountId: number,
  cursor: string
): Promise<void> {
  await db
    .update(bankAccounts)
    .set({ plaidCursor: cursor })
    .where(eq(bankAccounts.id, bankAccountId))
}
