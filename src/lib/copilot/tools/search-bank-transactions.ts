import { db } from '@/lib/db'
import { bankTransactions, bankAccounts } from '@/lib/db/schema'
import { and, desc, eq, gte, ilike, lte, sql } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const searchBankTransactionsDefinition: CopilotToolDefinition = {
  name: 'searchBankTransactions',
  description:
    'Search the Plaid bank transaction feed. Returns raw bank transactions with merchant name, amount, date, pending status, and match tier (1=auto-matched, 2=needs review, 3=exception, null=unclassified). Use this to verify whether a specific payment appeared in the bank feed, check matching status, or investigate unreconciled items.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search merchant name (optional)' },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      matchTier: {
        type: 'number',
        description: 'Filter by match tier: 1=auto-matched, 2=needs review, 3=exception (optional)',
      },
      isPending: { type: 'boolean', description: 'Filter to pending-only transactions (optional)' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
  },
}

export async function handleSearchBankTransactions(input: {
  query?: string
  dateFrom?: string
  dateTo?: string
  matchTier?: number
  isPending?: boolean
  limit?: number
}): Promise<{
  transactions: Array<{
    id: number
    date: string
    merchantName: string | null
    amount: string
    isPending: boolean
    paymentChannel: string | null
    matchTier: number | null
    matchStatus: string
    bankAccount: string
  }>
  total: number
}> {
  const maxResults = Math.min(input.limit || 20, 50)

  const conditions = []
  if (input.query) {
    conditions.push(ilike(bankTransactions.merchantName, `%${input.query}%`))
  }
  if (input.dateFrom) {
    conditions.push(gte(bankTransactions.date, input.dateFrom))
  }
  if (input.dateTo) {
    conditions.push(lte(bankTransactions.date, input.dateTo))
  }
  if (input.matchTier !== undefined) {
    conditions.push(eq(bankTransactions.matchTier, input.matchTier))
  }
  if (input.isPending !== undefined) {
    conditions.push(eq(bankTransactions.isPending, input.isPending))
  }

  const rows = await db
    .select({
      id: bankTransactions.id,
      date: bankTransactions.date,
      merchantName: bankTransactions.merchantName,
      amount: bankTransactions.amount,
      isPending: bankTransactions.isPending,
      paymentChannel: bankTransactions.paymentChannel,
      matchTier: bankTransactions.matchTier,
      bankAccountName: bankAccounts.name,
      bankAccountLast4: bankAccounts.last4,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(bankTransactions.date))
    .limit(maxResults)

  const tierLabels: Record<number, string> = {
    1: 'auto-matched',
    2: 'needs review',
    3: 'exception',
  }

  return {
    transactions: rows.map((row) => ({
      id: row.id,
      date: row.date,
      merchantName: row.merchantName,
      amount: row.amount,
      isPending: row.isPending,
      paymentChannel: row.paymentChannel,
      matchTier: row.matchTier,
      matchStatus: row.matchTier ? (tierLabels[row.matchTier] ?? 'unknown') : 'unclassified',
      bankAccount: `${row.bankAccountName} (...${row.bankAccountLast4})`,
    })),
    total: rows.length,
  }
}
