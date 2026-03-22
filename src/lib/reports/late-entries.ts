import { and, sql, lte, gt, desc, eq, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, transactionLines, accounts, fiscalYearLocks } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LateEntryRow {
  transactionId: number
  date: string
  createdAt: string
  memo: string
  sourceType: string
  totalAmount: number
  daysLate: number
}

export interface LateEntriesFilters {
  periodEndDate: string
  lookbackDays?: number // default 30
}

export interface LateEntriesData {
  rows: LateEntryRow[]
  periodEndDate: string
  lookbackDays: number
  totalLateEntries: number
  totalLateAmount: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getLateEntriesData(
  filters: LateEntriesFilters
): Promise<LateEntriesData> {
  const now = new Date().toISOString()
  const { periodEndDate, lookbackDays = 30 } = filters

  // Use actual lock date from fiscal_year_locks if the period's fiscal year
  // has been locked. This gives us the real close date rather than a heuristic.
  const fiscalYear = parseInt(periodEndDate.substring(0, 4), 10)
  let closeDate = periodEndDate
  const [lockRow] = await db
    .select({ lockedAt: fiscalYearLocks.lockedAt })
    .from(fiscalYearLocks)
    .where(eq(fiscalYearLocks.fiscalYear, fiscalYear))
  if (lockRow?.lockedAt) {
    closeDate = lockRow.lockedAt.toISOString().split('T')[0]
  }

  // Find transactions where:
  // - transaction date <= periodEndDate (belongs to the reporting period or earlier)
  // - createdAt > closeDate (was created after the period closed)
  // - createdAt <= closeDate + lookbackDays (within lookback window)
  const lookbackEnd = new Date(closeDate)
  lookbackEnd.setDate(lookbackEnd.getDate() + lookbackDays)
  const lookbackEndStr = lookbackEnd.toISOString()

  const txnRows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      createdAt: transactions.createdAt,
      memo: transactions.memo,
      sourceType: transactions.sourceType,
    })
    .from(transactions)
    .where(
      and(
        lte(transactions.date, periodEndDate),
        gt(transactions.createdAt, new Date(closeDate + 'T23:59:59')),
        lte(transactions.createdAt, new Date(lookbackEndStr)),
        eq(transactions.isVoided, false),
        // Exclude YEAR_END_CLOSE entries — they are expected post-close
        // activity, not "late entries."
        ne(transactions.sourceType, 'YEAR_END_CLOSE'),
      )
    )
    .orderBy(desc(transactions.createdAt))

  if (txnRows.length === 0) {
    return {
      rows: [],
      periodEndDate,
      lookbackDays,
      totalLateEntries: 0,
      totalLateAmount: 0,
      generatedAt: now,
    }
  }

  // Get debit totals for each transaction
  const txnIds = txnRows.map((t) => t.id)
  const amountRows = await db
    .select({
      transactionId: transactionLines.transactionId,
      totalDebit: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
    })
    .from(transactionLines)
    .where(
      sql`${transactionLines.transactionId} IN (${sql.join(
        txnIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )
    .groupBy(transactionLines.transactionId)

  const amountMap = new Map(
    amountRows.map((r) => [r.transactionId, parseFloat(r.totalDebit)])
  )

  const periodEnd = new Date(closeDate + 'T23:59:59')

  const rows: LateEntryRow[] = txnRows.map((t) => {
    const createdAt = t.createdAt
    const daysLate = Math.ceil(
      (createdAt.getTime() - periodEnd.getTime()) / (1000 * 60 * 60 * 24)
    )

    return {
      transactionId: t.id,
      date: t.date,
      createdAt: createdAt.toISOString(),
      memo: t.memo,
      sourceType: t.sourceType,
      totalAmount: amountMap.get(t.id) ?? 0,
      daysLate: Math.max(daysLate, 1),
    }
  })

  // Sort by days late descending
  rows.sort((a, b) => b.daysLate - a.daysLate)

  const totalLateAmount = rows.reduce((s, r) => s + r.totalAmount, 0)

  return {
    rows,
    periodEndDate,
    lookbackDays,
    totalLateEntries: rows.length,
    totalLateAmount: Math.round(totalLateAmount * 100) / 100,
    generatedAt: now,
  }
}
