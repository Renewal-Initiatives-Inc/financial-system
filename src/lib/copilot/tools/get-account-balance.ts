import { db } from '@/lib/db'
import { accounts, transactions, transactionLines } from '@/lib/db/schema'
import { and, eq, lte, sql } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const getAccountBalanceDefinition: CopilotToolDefinition = {
  name: 'getAccountBalance',
  description:
    'Calculate the balance of a specific account, optionally as of a specific date.',
  input_schema: {
    type: 'object',
    properties: {
      accountId: { type: 'number', description: 'Account ID' },
      asOfDate: { type: 'string', description: 'As-of date YYYY-MM-DD (optional, defaults to today)' },
    },
    required: ['accountId'],
  },
}

export async function handleGetAccountBalance(input: {
  accountId: number
  asOfDate?: string
}): Promise<{
  accountId: number
  accountCode: string
  accountName: string
  balance: string
  debitTotal: string
  creditTotal: string
} | { error: string }> {
  // Look up the account
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, input.accountId))

  if (!account) {
    return { error: `Account ${input.accountId} not found` }
  }

  const conditions = [eq(transactionLines.accountId, input.accountId)]

  if (input.asOfDate) {
    // Join with transactions to filter by date
    const totals = await db
      .select({
        debitTotal: sql<string>`COALESCE(SUM(${transactionLines.debit}), '0')`,
        creditTotal: sql<string>`COALESCE(SUM(${transactionLines.credit}), '0')`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .where(
        and(
          eq(transactionLines.accountId, input.accountId),
          lte(transactions.date, input.asOfDate),
          eq(transactions.isVoided, false)
        )
      )

    const debits = parseFloat(totals[0]?.debitTotal || '0')
    const credits = parseFloat(totals[0]?.creditTotal || '0')
    const balance =
      account.normalBalance === 'DEBIT' ? debits - credits : credits - debits

    return {
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      balance: balance.toFixed(2),
      debitTotal: debits.toFixed(2),
      creditTotal: credits.toFixed(2),
    }
  }

  // No date filter
  const totals = await db
    .select({
      debitTotal: sql<string>`COALESCE(SUM(${transactionLines.debit}), '0')`,
      creditTotal: sql<string>`COALESCE(SUM(${transactionLines.credit}), '0')`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, input.accountId),
        eq(transactions.isVoided, false)
      )
    )

  const debits = parseFloat(totals[0]?.debitTotal || '0')
  const credits = parseFloat(totals[0]?.creditTotal || '0')
  const balance =
    account.normalBalance === 'DEBIT' ? debits - credits : credits - debits

  return {
    accountId: account.id,
    accountCode: account.code,
    accountName: account.name,
    balance: balance.toFixed(2),
    debitTotal: debits.toFixed(2),
    creditTotal: credits.toFixed(2),
  }
}
