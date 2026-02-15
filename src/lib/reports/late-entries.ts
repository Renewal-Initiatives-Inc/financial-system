import { and, sql, lte, gt, desc, eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, transactionLines, accounts } from '@/lib/db/schema'

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

  // Find transactions where:
  // - transaction date <= periodEndDate (belongs to the reporting period or earlier)
  // - createdAt > periodEndDate (was created after the period closed)
  // - createdAt <= periodEndDate + lookbackDays (within lookback window)
  const lookbackEnd = new Date(periodEndDate)
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
        gt(transactions.createdAt, new Date(periodEndDate + 'T23:59:59')),
        lte(transactions.createdAt, new Date(lookbackEndStr)),
        eq(transactions.isVoided, false)
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

  const periodEnd = new Date(periodEndDate + 'T23:59:59')

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
