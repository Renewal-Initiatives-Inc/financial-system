import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, transactionLines, transactions, budgetLines, budgets, funds } from '@/lib/db/schema'
import { calculateVariance, type VarianceResult } from '@/lib/budget/variance'

// ---------------------------------------------------------------------------
// D-031: 13 property expense categories
// ---------------------------------------------------------------------------

const PROPERTY_EXPENSE_CATEGORIES = [
  'Property Taxes',
  'Property Insurance',
  'Management Fees',
  'Commissions',
  'Landscaping',
  'Repairs & Maintenance',
  'Electric',
  'Gas',
  'Water/Sewer',
  'Internet',
  'Security & Fire Monitoring',
  'Trash',
  'Other Operating',
] as const

export type PropertyExpenseCategory = (typeof PROPERTY_EXPENSE_CATEGORIES)[number]

export interface PropertyExpenseRow {
  category: string
  actual: number
  budget: number | null
  variance: VarianceResult | null
}

export interface PropertyExpensesData {
  startDate: string
  endDate: string
  rows: PropertyExpenseRow[]
  total: { actual: number; budget: number | null }
  fundName: string | null
}

export interface PropertyExpensesFilters {
  startDate: string
  endDate: string
  fundId?: number | null
}

// ---------------------------------------------------------------------------
// Category matching: map account name to one of the 13 categories
// ---------------------------------------------------------------------------

const CATEGORY_PATTERNS: { pattern: RegExp; category: PropertyExpenseCategory }[] = [
  { pattern: /property\s*tax/i, category: 'Property Taxes' },
  { pattern: /property\s*insurance/i, category: 'Property Insurance' },
  { pattern: /management\s*fee/i, category: 'Management Fees' },
  { pattern: /commission/i, category: 'Commissions' },
  { pattern: /landscap/i, category: 'Landscaping' },
  { pattern: /repair|maintenance/i, category: 'Repairs & Maintenance' },
  { pattern: /electric/i, category: 'Electric' },
  { pattern: /\bgas\b/i, category: 'Gas' },
  { pattern: /water|sewer/i, category: 'Water/Sewer' },
  { pattern: /internet|telecom/i, category: 'Internet' },
  { pattern: /security|fire\s*monitor/i, category: 'Security & Fire Monitoring' },
  { pattern: /trash|waste|refuse/i, category: 'Trash' },
]

function mapAccountToCategory(accountName: string): PropertyExpenseCategory {
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(accountName)) return category
  }
  return 'Other Operating'
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getPropertyExpensesData(
  filters: PropertyExpensesFilters
): Promise<PropertyExpensesData> {
  const { startDate, endDate, fundId } = filters

  // ---- Fund name lookup ----
  let fundName: string | null = null
  if (fundId) {
    const [fund] = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, fundId))
      .limit(1)
    fundName = fund?.name ?? null
  }

  // ---- Query expense accounts with subType 'Property Ops' ----
  // These are the property operating expense accounts
  const conditions = [
    eq(transactions.isVoided, false),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    eq(accounts.type, 'EXPENSE'),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  const actualRows = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(
      accounts.id,
      accounts.name,
      accounts.subType,
      accounts.normalBalance
    )

  // ---- Filter to Property Ops accounts only ----
  const propertyAccounts = actualRows.filter(
    (row) => row.subType === 'Property Ops'
  )

  // ---- Aggregate actuals by category ----
  const categoryActuals = new Map<string, number>()
  const categoryAccountIds = new Map<string, number[]>()

  for (const category of PROPERTY_EXPENSE_CATEGORIES) {
    categoryActuals.set(category, 0)
    categoryAccountIds.set(category, [])
  }

  for (const row of propertyAccounts) {
    const category = mapAccountToCategory(row.accountName)
    const debits = Number(row.totalDebit)
    const credits = Number(row.totalCredit)
    // Expense accounts: debit normal balance => actual = debits - credits
    const actual = debits - credits

    categoryActuals.set(
      category,
      (categoryActuals.get(category) ?? 0) + actual
    )

    const ids = categoryAccountIds.get(category) ?? []
    ids.push(row.accountId)
    categoryAccountIds.set(category, ids)
  }

  // ---- Budget amounts per category ----
  const year = parseInt(endDate.slice(0, 4), 10)
  const [approvedBudget] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.fiscalYear, year), eq(budgets.status, 'APPROVED')))
    .limit(1)

  const categoryBudgets = new Map<string, number>()
  let hasBudget = false

  if (approvedBudget) {
    const budgetConditions = [eq(budgetLines.budgetId, approvedBudget.id)]
    if (fundId) budgetConditions.push(eq(budgetLines.fundId, fundId))

    const lines = await db
      .select({
        accountId: budgetLines.accountId,
        accountName: accounts.name,
        subType: accounts.subType,
        monthlyAmounts: budgetLines.monthlyAmounts,
      })
      .from(budgetLines)
      .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
      .where(
        and(
          ...budgetConditions,
          eq(accounts.type, 'EXPENSE'),
          eq(accounts.subType, 'Property Ops')
        )
      )

    // Determine month range for budget
    const startMonth = parseInt(startDate.slice(5, 7), 10) - 1
    const endMonth = parseInt(endDate.slice(5, 7), 10) - 1

    for (const line of lines) {
      const category = mapAccountToCategory(line.accountName)
      const monthly = line.monthlyAmounts as number[]
      let amount = 0
      for (let m = startMonth; m <= endMonth; m++) {
        amount += monthly[m] ?? 0
      }
      categoryBudgets.set(
        category,
        (categoryBudgets.get(category) ?? 0) + amount
      )
      hasBudget = true
    }
  }

  // ---- Build result rows ----
  const rows: PropertyExpenseRow[] = []
  let totalActual = 0
  let totalBudget = 0

  for (const category of PROPERTY_EXPENSE_CATEGORIES) {
    const actual = categoryActuals.get(category) ?? 0
    const budget = hasBudget ? (categoryBudgets.get(category) ?? 0) : null
    const variance = budget !== null ? calculateVariance(actual, budget) : null

    totalActual += actual
    if (budget !== null) totalBudget += budget

    // Only include categories that have activity or budget
    if (actual !== 0 || (budget !== null && budget !== 0)) {
      rows.push({ category, actual, budget, variance })
    }
  }

  // If no rows have data, show all categories with zeros
  if (rows.length === 0) {
    for (const category of PROPERTY_EXPENSE_CATEGORIES) {
      rows.push({
        category,
        actual: 0,
        budget: hasBudget ? 0 : null,
        variance: hasBudget ? calculateVariance(0, 0) : null,
      })
    }
  }

  return {
    startDate,
    endDate,
    rows,
    total: {
      actual: totalActual,
      budget: hasBudget ? totalBudget : null,
    },
    fundName,
  }
}
