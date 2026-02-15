import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  budgets,
  budgetLines,
  cipCostCodes,
  funds,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CostCodeDetail {
  costCodeId: number
  costCode: string
  costCodeName: string
  actual: number
}

export interface CapitalBudgetRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  budget: number
  actual: number
  variance: number
  variancePercent: number | null
  costCodes: CostCodeDetail[]
}

export interface CapitalBudgetFilters {
  year: number
  fundId?: number
}

export interface CapitalBudgetData {
  rows: CapitalBudgetRow[]
  totalBudget: number
  totalActual: number
  totalVariance: number
  year: number
  fundName: string | null
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getCapitalBudgetData(
  filters: CapitalBudgetFilters
): Promise<CapitalBudgetData> {
  const now = new Date().toISOString()
  const { year } = filters
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // Find CIP and fixed asset accounts (capital accounts)
  const capitalAccounts = await db
    .select({ id: accounts.id, code: accounts.code, name: accounts.name, subType: accounts.subType })
    .from(accounts)
    .where(
      and(
        eq(accounts.isActive, true),
        sql`(${accounts.subType} ILIKE '%cip%' OR ${accounts.subType} ILIKE '%construction%' OR ${accounts.subType} ILIKE '%capital%' OR ${accounts.subType} ILIKE '%fixed asset%' OR ${accounts.name} ILIKE '%cip%' OR ${accounts.name} ILIKE '%construction in progress%')`
      )
    )

  if (capitalAccounts.length === 0) {
    return {
      rows: [],
      totalBudget: 0,
      totalActual: 0,
      totalVariance: 0,
      year,
      fundName: null,
      generatedAt: now,
    }
  }

  const accountIds = capitalAccounts.map((a) => a.id)

  // Get budget amounts
  const approvedBudget = await db
    .select({
      accountId: budgetLines.accountId,
      annualAmount: budgetLines.annualAmount,
    })
    .from(budgetLines)
    .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
    .where(
      and(
        eq(budgets.fiscalYear, year),
        eq(budgets.status, 'APPROVED'),
        sql`${budgetLines.accountId} IN (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})`
      )
    )

  const budgetMap = new Map<number, number>()
  for (const bl of approvedBudget) {
    const current = budgetMap.get(bl.accountId) ?? 0
    budgetMap.set(bl.accountId, current + parseFloat(bl.annualAmount))
  }

  // Get actuals with cost code breakdown
  const txnConditions = [
    sql`${transactionLines.accountId} IN (${sql.join(accountIds.map((id) => sql`${id}`), sql`, `)})`,
    eq(transactions.isVoided, false),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
  ]
  if (filters.fundId) {
    txnConditions.push(eq(transactionLines.fundId, filters.fundId))
  }

  const actualLines = await db
    .select({
      accountId: transactionLines.accountId,
      cipCostCodeId: transactionLines.cipCostCodeId,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(and(...txnConditions))

  // Aggregate actuals by account and cost code
  const actualsByAccount = new Map<number, number>()
  const costCodeActuals = new Map<string, number>() // key: `${accountId}-${costCodeId}`

  for (const line of actualLines) {
    const amount = parseFloat(line.debit ?? '0') - parseFloat(line.credit ?? '0')
    const current = actualsByAccount.get(line.accountId) ?? 0
    actualsByAccount.set(line.accountId, current + amount)

    if (line.cipCostCodeId) {
      const key = `${line.accountId}-${line.cipCostCodeId}`
      const cc = costCodeActuals.get(key) ?? 0
      costCodeActuals.set(key, cc + amount)
    }
  }

  // Get cost code names
  const allCostCodes = await db.select().from(cipCostCodes).orderBy(cipCostCodes.sortOrder)
  const costCodeMap = new Map(allCostCodes.map((c) => [c.id, c]))

  // Get fund name if filtered
  let fundName: string | null = null
  if (filters.fundId) {
    const fundRow = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, filters.fundId))
      .limit(1)
    fundName = fundRow[0]?.name ?? null
  }

  // Build rows
  const rows: CapitalBudgetRow[] = capitalAccounts.map((acct) => {
    const budget = budgetMap.get(acct.id) ?? 0
    const actual = actualsByAccount.get(acct.id) ?? 0
    const variance = budget - actual
    const variancePercent = budget !== 0 ? (variance / budget) * 100 : null

    // Cost code breakdown for this account
    const costCodes: CostCodeDetail[] = []
    for (const [key, amount] of costCodeActuals) {
      const [aId, ccId] = key.split('-').map(Number)
      if (aId === acct.id) {
        const cc = costCodeMap.get(ccId)
        costCodes.push({
          costCodeId: ccId,
          costCode: cc?.code ?? '',
          costCodeName: cc?.name ?? 'Unknown',
          actual: Math.round(amount * 100) / 100,
        })
      }
    }
    costCodes.sort((a, b) => a.costCode.localeCompare(b.costCode))

    return {
      accountId: acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      subType: acct.subType,
      budget: Math.round(budget * 100) / 100,
      actual: Math.round(actual * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePercent: variancePercent !== null ? Math.round(variancePercent * 10) / 10 : null,
      costCodes,
    }
  })

  const totalBudget = rows.reduce((s, r) => s + r.budget, 0)
  const totalActual = rows.reduce((s, r) => s + r.actual, 0)

  return {
    rows,
    totalBudget: Math.round(totalBudget * 100) / 100,
    totalActual: Math.round(totalActual * 100) / 100,
    totalVariance: Math.round((totalBudget - totalActual) * 100) / 100,
    year,
    fundName,
    generatedAt: now,
  }
}
