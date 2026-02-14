import { db } from '@/lib/db'
import { accounts, transactionLines } from '@/lib/db/schema'
import { and, eq, ilike, or, sql } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const searchAccountsDefinition: CopilotToolDefinition = {
  name: 'searchAccounts',
  description:
    'Search the chart of accounts by name, code, or type. Returns account details with current balances.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search by account name or code (optional)' },
      type: {
        type: 'string',
        description: 'Filter by account type: ASSET, LIABILITY, NET_ASSET, REVENUE, EXPENSE (optional)',
      },
      activeOnly: { type: 'boolean', description: 'Only return active accounts (default true)' },
    },
  },
}

export async function handleSearchAccounts(input: {
  query?: string
  type?: string
  activeOnly?: boolean
}): Promise<{
  accounts: Array<{
    id: number
    code: string
    name: string
    type: string
    subType: string | null
    normalBalance: string
    isActive: boolean
    balance: string
  }>
}> {
  const conditions = []

  if (input.query) {
    conditions.push(
      or(
        ilike(accounts.name, `%${input.query}%`),
        ilike(accounts.code, `%${input.query}%`)
      )
    )
  }

  if (input.type) {
    conditions.push(eq(accounts.type, input.type as 'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE'))
  }

  if (input.activeOnly !== false) {
    conditions.push(eq(accounts.isActive, true))
  }

  const rows = await db
    .select()
    .from(accounts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(accounts.code)

  // Calculate balance for each account
  const results = await Promise.all(
    rows.map(async (row) => {
      const totals = await db
        .select({
          totalDebits: sql<string>`COALESCE(SUM(${transactionLines.debit}), '0')`,
          totalCredits: sql<string>`COALESCE(SUM(${transactionLines.credit}), '0')`,
        })
        .from(transactionLines)
        .where(eq(transactionLines.accountId, row.id))

      const debits = parseFloat(totals[0]?.totalDebits || '0')
      const credits = parseFloat(totals[0]?.totalCredits || '0')
      const balance =
        row.normalBalance === 'DEBIT' ? debits - credits : credits - debits

      return {
        id: row.id,
        code: row.code,
        name: row.name,
        type: row.type,
        subType: row.subType,
        normalBalance: row.normalBalance,
        isActive: row.isActive,
        balance: balance.toFixed(2),
      }
    })
  )

  return { accounts: results }
}
