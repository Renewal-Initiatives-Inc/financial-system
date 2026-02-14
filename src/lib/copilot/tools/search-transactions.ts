import { db } from '@/lib/db'
import { transactions, transactionLines, accounts, funds } from '@/lib/db/schema'
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const searchTransactionsDefinition: CopilotToolDefinition = {
  name: 'searchTransactions',
  description:
    'Search GL transaction history. Can filter by keyword, date range, account, or fund.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search memo text (optional)' },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      accountId: { type: 'number', description: 'Filter by account ID (optional)' },
      fundId: { type: 'number', description: 'Filter by fund ID (optional)' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
  },
}

export async function handleSearchTransactions(input: {
  query?: string
  dateFrom?: string
  dateTo?: string
  accountId?: number
  fundId?: number
  limit?: number
}): Promise<{
  transactions: Array<{
    id: number
    date: string
    memo: string
    sourceType: string
    isVoided: boolean
    totalDebits: string
    totalCredits: string
  }>
}> {
  const maxResults = Math.min(input.limit || 20, 50)

  const conditions = []
  if (input.query) {
    conditions.push(ilike(transactions.memo, `%${input.query}%`))
  }
  if (input.dateFrom) {
    conditions.push(gte(transactions.date, input.dateFrom))
  }
  if (input.dateTo) {
    conditions.push(lte(transactions.date, input.dateTo))
  }

  // If filtering by account or fund, join through transaction_lines
  if (input.accountId || input.fundId) {
    const lineConditions = []
    if (input.accountId) lineConditions.push(eq(transactionLines.accountId, input.accountId))
    if (input.fundId) lineConditions.push(eq(transactionLines.fundId, input.fundId))

    const matchingTxIds = db
      .selectDistinct({ id: transactionLines.transactionId })
      .from(transactionLines)
      .where(and(...lineConditions))

    conditions.push(sql`${transactions.id} IN (${matchingTxIds})`)
  }

  const rows = await db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      sourceType: transactions.sourceType,
      isVoided: transactions.isVoided,
    })
    .from(transactions)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(transactions.date))
    .limit(maxResults)

  // Get totals for each transaction
  const results = await Promise.all(
    rows.map(async (row) => {
      const totals = await db
        .select({
          totalDebits: sql<string>`COALESCE(SUM(${transactionLines.debit}), '0')`,
          totalCredits: sql<string>`COALESCE(SUM(${transactionLines.credit}), '0')`,
        })
        .from(transactionLines)
        .where(eq(transactionLines.transactionId, row.id))

      return {
        id: row.id,
        date: row.date,
        memo: row.memo,
        sourceType: row.sourceType,
        isVoided: row.isVoided,
        totalDebits: totals[0]?.totalDebits || '0',
        totalCredits: totals[0]?.totalCredits || '0',
      }
    })
  )

  return { transactions: results }
}
