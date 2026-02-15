import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactionLines,
  transactions,
  accounts,
  budgetLines,
  budgets,
  cipCostCodes,
} from '@/lib/db/schema'
import { calculateVariance, type VarianceSeverity } from './variance'

export interface CIPCostCodeVariance {
  costCodeId: number
  costCodeName: string
  costCodeCategory: string
  actual: number
  dollarVariance: number
  percentVariance: number | null
  severity: VarianceSeverity
}

export interface CIPSubAccountVariance {
  accountId: number
  accountCode: string
  accountName: string
  budgetAmount: number
  actualAmount: number
  dollarVariance: number
  percentVariance: number | null
  severity: VarianceSeverity
  costCodes: CIPCostCodeVariance[]
}

/**
 * Get CIP budget vs actual at sub-account and cost-code level.
 * CIP accounts are identified by subType = 'cip' or parent account having subType 'cip'.
 * Returns empty array if no CIP budget lines exist.
 */
export async function getCIPBudgetVsActual(
  budgetId: number,
  fundId?: number
): Promise<CIPSubAccountVariance[]> {
  // Fetch the budget record to get fiscal year
  const [budget] = await db
    .select({ fiscalYear: budgets.fiscalYear })
    .from(budgets)
    .where(eq(budgets.id, budgetId))

  if (!budget) return []

  const fiscalYear = budget.fiscalYear
  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`

  // Get CIP budget lines (accounts with subType containing 'cip')
  const conditions = [
    eq(budgetLines.budgetId, budgetId),
    sql`${accounts.subType} ILIKE '%cip%'`,
  ]
  if (fundId) conditions.push(eq(budgetLines.fundId, fundId))

  const cipLines = await db
    .select({
      accountId: budgetLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      annualAmount: budgetLines.annualAmount,
      fundId: budgetLines.fundId,
    })
    .from(budgetLines)
    .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .where(and(...conditions))
    .orderBy(accounts.code)

  if (cipLines.length === 0) return []

  const results: CIPSubAccountVariance[] = []

  for (const line of cipLines) {
    const budgetAmount = Number(line.annualAmount)

    // Get actuals grouped by cost code for this account
    const fundConditions = [
      eq(transactionLines.accountId, line.accountId),
      eq(transactions.isVoided, false),
      gte(transactions.date, startDate),
      lte(transactions.date, endDate),
    ]
    if (fundId) {
      fundConditions.push(eq(transactionLines.fundId, fundId))
    } else {
      fundConditions.push(eq(transactionLines.fundId, line.fundId))
    }

    const costCodeActuals = await db
      .select({
        costCodeId: cipCostCodes.id,
        costCodeName: cipCostCodes.name,
        costCodeCategory: cipCostCodes.category,
        totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .leftJoin(cipCostCodes, eq(transactionLines.cipCostCodeId, cipCostCodes.id))
      .where(and(...fundConditions))
      .groupBy(cipCostCodes.id, cipCostCodes.name, cipCostCodes.category)

    const costCodes: CIPCostCodeVariance[] = []
    let totalActual = 0

    for (const cc of costCodeActuals) {
      // CIP is an asset (debit normal) — actual = debits - credits
      const actual = Number(cc.totalDebit) - Number(cc.totalCredit)
      totalActual += actual

      if (cc.costCodeId) {
        const variance = calculateVariance(actual, 0) // No per-cost-code budget
        costCodes.push({
          costCodeId: cc.costCodeId,
          costCodeName: cc.costCodeName ?? 'Unknown',
          costCodeCategory: cc.costCodeCategory ?? 'Unknown',
          actual,
          ...variance,
        })
      }
    }

    const subAccountVariance = calculateVariance(totalActual, budgetAmount)

    results.push({
      accountId: line.accountId,
      accountCode: line.accountCode,
      accountName: line.accountName,
      budgetAmount,
      actualAmount: totalActual,
      ...subAccountVariance,
      costCodes: costCodes.sort((a, b) => a.costCodeName.localeCompare(b.costCodeName)),
    })
  }

  return results
}
