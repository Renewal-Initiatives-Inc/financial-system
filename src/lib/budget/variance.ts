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

export type VarianceSeverity = 'normal' | 'warning' | 'critical'

export interface VarianceResult {
  dollarVariance: number
  percentVariance: number | null
  severity: VarianceSeverity
}

export interface BudgetVarianceRow {
  accountId: number
  accountCode: string
  accountName: string
  accountType: string
  fundId: number
  fundName: string
  budgetAmount: number
  actualAmount: number
  dollarVariance: number
  percentVariance: number | null
  severity: VarianceSeverity
}

/**
 * Calculate dollar and percentage variance with severity classification.
 * - >10% = warning (yellow)
 * - >25% = critical (red)
 */
export function calculateVariance(actual: number, budget: number): VarianceResult {
  const dollarVariance = actual - budget
  const percentVariance = budget !== 0 ? (dollarVariance / budget) * 100 : null
  let severity: VarianceSeverity = 'normal'
  if (percentVariance !== null) {
    const absPercent = Math.abs(percentVariance)
    if (absPercent > 25) severity = 'critical'
    else if (absPercent > 10) severity = 'warning'
  }
  return { dollarVariance, percentVariance, severity }
}

/**
 * Get actual GL amounts for an account+fund in a date range.
 * Revenue accounts (Credit normal): actual = credits - debits
 * Expense accounts (Debit normal): actual = debits - credits
 * Excludes voided transactions.
 */
export async function getActualsForPeriod(
  accountId: number,
  fundId: number,
  startDate: string,
  endDate: string
): Promise<number> {
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

  // Revenue/liability/net asset = credit normal → actual = credits - debits
  // Expense/asset = debit normal → actual = debits - credits
  return row.normalBalance === 'CREDIT' ? credits - debits : debits - credits
}

/**
 * Build full budget vs actual comparison for a budget.
 * Optionally filter by month and/or fund.
 */
export async function getBudgetVsActual(
  budgetId: number,
  month?: number,
  fundId?: number
): Promise<BudgetVarianceRow[]> {
  // Fetch the budget record to get its fiscal year
  const [budget] = await db
    .select({ fiscalYear: budgets.fiscalYear })
    .from(budgets)
    .where(eq(budgets.id, budgetId))

  if (!budget) return []

  const fiscalYear = budget.fiscalYear

  // Get budget lines with account and fund info
  const conditions = [eq(budgetLines.budgetId, budgetId)]
  if (fundId) conditions.push(eq(budgetLines.fundId, fundId))

  const lines = await db
    .select({
      accountId: budgetLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      normalBalance: accounts.normalBalance,
      fundId: budgetLines.fundId,
      fundName: funds.name,
      annualAmount: budgetLines.annualAmount,
      monthlyAmounts: budgetLines.monthlyAmounts,
    })
    .from(budgetLines)
    .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .innerJoin(funds, eq(budgetLines.fundId, funds.id))
    .where(and(...conditions))
    .orderBy(accounts.code)

  // For each line, compute budget amount and actuals
  const rows: BudgetVarianceRow[] = []

  for (const line of lines) {
    const monthly = line.monthlyAmounts as number[]
    let budgetAmount: number

    if (month !== undefined) {
      // Single month
      budgetAmount = monthly[month - 1] ?? 0
    } else {
      // YTD — sum all months up to current
      const now = new Date()
      const currentMonth = now.getMonth() + 1
      budgetAmount = monthly.slice(0, currentMonth).reduce((a, b) => a + b, 0)
    }

    // Determine date range based on budget's fiscal year
    let startDate: string
    let endDate: string

    if (month !== undefined) {
      startDate = `${fiscalYear}-${String(month).padStart(2, '0')}-01`
      const lastDay = new Date(fiscalYear, month, 0).getDate()
      endDate = `${fiscalYear}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
    } else {
      // YTD
      startDate = `${fiscalYear}-01-01`
      const now = new Date()
      // If viewing current FY, cap at today; otherwise use full year
      if (fiscalYear === now.getFullYear()) {
        endDate = now.toISOString().split('T')[0]
      } else {
        endDate = `${fiscalYear}-12-31`
      }
    }

    const actualAmount = await getActualsForPeriod(
      line.accountId,
      line.fundId,
      startDate,
      endDate
    )

    const variance = calculateVariance(actualAmount, budgetAmount)

    rows.push({
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      accountType: line.accountType,
      fundId: line.fundId,
      fundName: line.fundName,
      budgetAmount,
      actualAmount,
      ...variance,
    })
  }

  return rows
}
