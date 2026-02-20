import { db } from '@/lib/db'
import { funds, vendors, transactions, transactionLines, accounts } from '@/lib/db/schema'
import { and, eq, lte, sql } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const getFundBalanceDefinition: CopilotToolDefinition = {
  name: 'getFundBalance',
  description:
    'Calculate the balance of a specific fund, including assets, liabilities, and net assets breakdown.',
  input_schema: {
    type: 'object',
    properties: {
      fundId: { type: 'number', description: 'Fund ID' },
      asOfDate: { type: 'string', description: 'As-of date YYYY-MM-DD (optional, defaults to today)' },
    },
    required: ['fundId'],
  },
}

export async function handleGetFundBalance(input: {
  fundId: number
  asOfDate?: string
}): Promise<{
  fundId: number
  fundName: string
  restrictionType: string
  assets: string
  liabilities: string
  netAssets: string
  funderName?: string | null
  fundingAmount?: string | null
  fundingType?: string | null
  fundingStatus?: string | null
} | { error: string }> {
  const [fund] = await db.select().from(funds).where(eq(funds.id, input.fundId))

  if (!fund) {
    return { error: `Fund ${input.fundId} not found` }
  }

  // Calculate balances by account type for this fund
  const dateConditions = input.asOfDate
    ? [lte(transactions.date, input.asOfDate)]
    : []

  const rows = await db
    .select({
      accountType: accounts.type,
      normalBalance: accounts.normalBalance,
      debitTotal: sql<string>`COALESCE(SUM(${transactionLines.debit}), '0')`,
      creditTotal: sql<string>`COALESCE(SUM(${transactionLines.credit}), '0')`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactionLines.fundId, input.fundId),
        eq(transactions.isVoided, false),
        ...dateConditions
      )
    )
    .groupBy(accounts.type, accounts.normalBalance)

  let totalAssets = 0
  let totalLiabilities = 0
  let totalNetAssets = 0

  for (const row of rows) {
    const debits = parseFloat(row.debitTotal)
    const credits = parseFloat(row.creditTotal)
    const balance =
      row.normalBalance === 'DEBIT' ? debits - credits : credits - debits

    switch (row.accountType) {
      case 'ASSET':
        totalAssets += balance
        break
      case 'LIABILITY':
        totalLiabilities += balance
        break
      case 'NET_ASSET':
      case 'REVENUE':
      case 'EXPENSE':
        // Revenue (credit normal) increases net assets
        // Expense (debit normal) decreases net assets
        totalNetAssets += balance
        break
    }
  }

  return {
    fundId: fund.id,
    fundName: fund.name,
    restrictionType: fund.restrictionType,
    assets: totalAssets.toFixed(2),
    liabilities: totalLiabilities.toFixed(2),
    netAssets: totalNetAssets.toFixed(2),
    funderName: fund.funderId
      ? (await db.select({ name: vendors.name }).from(vendors).where(eq(vendors.id, fund.funderId)).then(r => r[0]?.name ?? null))
      : null,
    fundingAmount: fund.amount ?? null,
    fundingType: fund.type ?? null,
    fundingStatus: fund.status ?? null,
  }
}
