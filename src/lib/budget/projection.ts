import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactionLines,
  transactions,
  accounts,
  funds,
  budgetLines,
  budgets,
} from '@/lib/db/schema'

export interface ProjectionLineData {
  sourceLabel: string
  lineType: 'INFLOW' | 'OUTFLOW'
  autoAmount: number
  sortOrder: number
}

/**
 * Get starting cash balance from GL (sum of all cash-type account balances).
 * Cash accounts = ASSET type with sub_type containing 'cash' or 'bank'
 * or account code starting with '1010' (per the chart of accounts).
 */
export async function getStartingCash(): Promise<number> {
  const result = await db
    .select({
      balance: sql<string>`
        COALESCE(SUM(${transactionLines.debit}), 0) - COALESCE(SUM(${transactionLines.credit}), 0)
      `,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(accounts.type, 'ASSET'),
        eq(transactions.isVoided, false),
        sql`${accounts.code} LIKE '1010%'`
      )
    )

  return Number(result[0]?.balance ?? 0)
}

/**
 * Get the average monthly actual for an account+fund over the last 3 months.
 */
export async function getThreeMonthActualAverage(
  accountId: number,
  fundId: number
): Promise<number> {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const startDate = threeMonthsAgo.toISOString().split('T')[0]
  const endDate = now.toISOString().split('T')[0]

  const result = await db
    .select({
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
      normalBalance: accounts.normalBalance,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactionLines.accountId, accountId),
        eq(transactionLines.fundId, fundId),
        eq(transactions.isVoided, false),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate)
      )
    )
    .groupBy(accounts.normalBalance)

  if (result.length === 0) return 0

  const row = result[0]
  const debits = Number(row.totalDebit)
  const credits = Number(row.totalCredit)
  const total = row.normalBalance === 'CREDIT' ? credits - debits : debits - credits

  return Math.round((total / 3) * 100) / 100
}

/**
 * Generate projection lines for a given starting month.
 * Tries budget data first, falls back to 3-month GL average.
 * Optional fundId parameter for fund-specific projections.
 */
export async function generateProjectionLines(
  startMonth: number,
  budgetId?: number,
  fundId?: number
): Promise<{ month: number; lines: ProjectionLineData[] }[]> {
  const months: { month: number; lines: ProjectionLineData[] }[] = []

  for (let i = 0; i < 3; i++) {
    const month = ((startMonth - 1 + i) % 12) + 1
    const lines: ProjectionLineData[] = []

    // Try budget-based projection
    if (budgetId) {
      const conditions = [eq(budgetLines.budgetId, budgetId)]
      if (fundId) conditions.push(eq(budgetLines.fundId, fundId))

      const bLines = await db
        .select({
          accountId: budgetLines.accountId,
          accountName: accounts.name,
          accountType: accounts.type,
          fundId: budgetLines.fundId,
          monthlyAmounts: budgetLines.monthlyAmounts,
        })
        .from(budgetLines)
        .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
        .where(and(...conditions))

      for (const bl of bLines) {
        const monthly = bl.monthlyAmounts as number[]
        const amount = monthly[month - 1] ?? 0
        if (Math.abs(amount) < 0.01) continue

        const isInflow = bl.accountType === 'REVENUE'
        lines.push({
          sourceLabel: bl.accountName,
          lineType: isInflow ? 'INFLOW' : 'OUTFLOW',
          autoAmount: Math.abs(amount),
          sortOrder: isInflow ? lines.filter((l) => l.lineType === 'INFLOW').length : 100 + lines.filter((l) => l.lineType === 'OUTFLOW').length,
        })
      }
    }

    // If no budget lines found, fall back to 3-month average
    if (lines.length === 0) {
      // Find account+fund combos with recent activity
      const now = new Date()
      const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
      const startDate = threeMonthsAgo.toISOString().split('T')[0]
      const endDate = now.toISOString().split('T')[0]

      const fundConditions = [
        eq(accounts.isActive, true),
        eq(transactions.isVoided, false),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
      ]
      if (fundId) fundConditions.push(eq(transactionLines.fundId, fundId))

      const activeAccountFunds = await db
        .selectDistinct({
          accountId: transactionLines.accountId,
          accountName: accounts.name,
          accountType: accounts.type,
          fundId: transactionLines.fundId,
        })
        .from(transactionLines)
        .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
        .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
        .where(and(...fundConditions))

      for (const acct of activeAccountFunds) {
        if (acct.accountType !== 'REVENUE' && acct.accountType !== 'EXPENSE') continue

        const avg = await getThreeMonthActualAverage(acct.accountId, acct.fundId)
        if (Math.abs(avg) < 0.01) continue

        const isInflow = acct.accountType === 'REVENUE'
        lines.push({
          sourceLabel: acct.accountName,
          lineType: isInflow ? 'INFLOW' : 'OUTFLOW',
          autoAmount: Math.abs(avg),
          sortOrder: isInflow ? lines.filter((l) => l.lineType === 'INFLOW').length : 100 + lines.filter((l) => l.lineType === 'OUTFLOW').length,
        })
      }
    }

    months.push({ month, lines })
  }

  return months
}
