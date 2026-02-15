import { eq, and, sql, gte, lte, desc, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TransactionHistoryLine {
  lineId: number
  accountCode: string
  accountName: string
  fundName: string
  debit: number
  credit: number
  memo: string | null
}

export interface TransactionHistoryRow {
  id: number
  date: string
  memo: string
  sourceType: string
  isVoided: boolean
  isReversed: boolean
  totalDebit: number
  totalCredit: number
  createdAt: string
  createdBy: string
  lines: TransactionHistoryLine[]
}

export interface TransactionHistoryFilters {
  startDate?: string
  endDate?: string
  sourceType?: string
  accountId?: number
  fundId?: number
  memoSearch?: string
  amountMin?: number
  amountMax?: number
  page?: number
  pageSize?: number
}

export interface TransactionHistoryData {
  rows: TransactionHistoryRow[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getTransactionHistoryData(
  filters?: TransactionHistoryFilters
): Promise<TransactionHistoryData> {
  const now = new Date().toISOString()
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  // Build WHERE conditions for transactions
  const conditions = []

  if (filters?.startDate) {
    conditions.push(gte(transactions.date, filters.startDate))
  }
  if (filters?.endDate) {
    conditions.push(lte(transactions.date, filters.endDate))
  }
  if (filters?.sourceType) {
    conditions.push(sql`${transactions.sourceType} = ${filters.sourceType}`)
  }
  if (filters?.memoSearch) {
    conditions.push(ilike(transactions.memo, `%${filters.memoSearch}%`))
  }

  // For account/fund/amount filters, we need to filter via lines
  if (filters?.accountId || filters?.fundId || filters?.amountMin || filters?.amountMax) {
    const lineConditions = []
    if (filters?.accountId) {
      lineConditions.push(eq(transactionLines.accountId, filters.accountId))
    }
    if (filters?.fundId) {
      lineConditions.push(eq(transactionLines.fundId, filters.fundId))
    }

    // Get transaction IDs matching line filters
    const matchingTxnIds = await db
      .selectDistinct({ transactionId: transactionLines.transactionId })
      .from(transactionLines)
      .where(lineConditions.length > 0 ? and(...lineConditions) : undefined)

    const txnIds = matchingTxnIds.map((r) => r.transactionId)
    if (txnIds.length === 0) {
      return {
        rows: [],
        totalCount: 0,
        page,
        pageSize,
        totalPages: 0,
        generatedAt: now,
      }
    }
    conditions.push(
      sql`${transactions.id} IN (${sql.join(txnIds.map((id) => sql`${id}`), sql`, `)})`
    )
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Count total
  const countResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(transactions)
    .where(whereClause)

  const totalCount = parseInt(countResult[0]?.count ?? '0')

  // Get paginated transactions
  const txnRows = await db
    .select()
    .from(transactions)
    .where(whereClause)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .limit(pageSize)
    .offset(offset)

  if (txnRows.length === 0) {
    return {
      rows: [],
      totalCount,
      page,
      pageSize,
      totalPages: Math.ceil(totalCount / pageSize),
      generatedAt: now,
    }
  }

  // Get lines for these transactions
  const txnIds = txnRows.map((t) => t.id)
  const lineRows = await db
    .select({
      lineId: transactionLines.id,
      transactionId: transactionLines.transactionId,
      accountCode: accounts.code,
      accountName: accounts.name,
      fundName: funds.name,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
      memo: transactionLines.memo,
    })
    .from(transactionLines)
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .where(
      sql`${transactionLines.transactionId} IN (${sql.join(
        txnIds.map((id) => sql`${id}`),
        sql`, `
      )})`
    )

  // Group lines by transaction
  const linesByTxn = new Map<number, TransactionHistoryLine[]>()
  for (const line of lineRows) {
    const lines = linesByTxn.get(line.transactionId) ?? []
    lines.push({
      lineId: line.lineId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      fundName: line.fundName,
      debit: parseFloat(line.debit ?? '0'),
      credit: parseFloat(line.credit ?? '0'),
      memo: line.memo,
    })
    linesByTxn.set(line.transactionId, lines)
  }

  // Build result rows
  const rows: TransactionHistoryRow[] = txnRows.map((t) => {
    const lines = linesByTxn.get(t.id) ?? []
    const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = lines.reduce((s, l) => s + l.credit, 0)

    return {
      id: t.id,
      date: t.date,
      memo: t.memo,
      sourceType: t.sourceType,
      isVoided: t.isVoided,
      isReversed: t.reversedById !== null,
      totalDebit: Math.round(totalDebit * 100) / 100,
      totalCredit: Math.round(totalCredit * 100) / 100,
      createdAt: t.createdAt.toISOString(),
      createdBy: t.createdBy,
      lines,
    }
  })

  // Apply amount filters client-side (after aggregation)
  let filteredRows = rows
  if (filters?.amountMin !== undefined) {
    filteredRows = filteredRows.filter((r) => r.totalDebit >= filters.amountMin!)
  }
  if (filters?.amountMax !== undefined) {
    filteredRows = filteredRows.filter((r) => r.totalDebit <= filters.amountMax!)
  }

  return {
    rows: filteredRows,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    generatedAt: now,
  }
}
