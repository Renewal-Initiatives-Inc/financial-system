import { eq, and, sql, gte, lte, ilike, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  funds,
  budgetLines,
  budgets,
} from '@/lib/db/schema'
import { calculateVariance, type VarianceResult } from '@/lib/budget/variance'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ActivitiesRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  currentPeriod: number
  yearToDate: number
  budget: number | null
  variance: VarianceResult | null
}

export interface ActivitiesSection {
  title: string
  rows: ActivitiesRow[]
  total: {
    currentPeriod: number
    yearToDate: number
    budget: number | null
  }
}

export interface ActivitiesData {
  startDate: string
  endDate: string
  revenueSections: ActivitiesSection[]
  totalRevenue: { currentPeriod: number; yearToDate: number; budget: number | null }
  expenseSections: ActivitiesSection[]
  totalExpenses: { currentPeriod: number; yearToDate: number; budget: number | null }
  netAssetReleases: { currentPeriod: number; yearToDate: number }
  changeInNetAssets: { currentPeriod: number; yearToDate: number; budget: number | null }
  fundName: string | null
}

export interface ActivitiesFilters {
  startDate: string
  endDate: string
  fundId?: number | null
  periodType?: 'monthly' | 'quarterly' | 'ytd' | 'annual'
}

// ---------------------------------------------------------------------------
// Multi-period types
// ---------------------------------------------------------------------------

export interface PeriodColumn {
  label: string    // "Jan 2026", "Q1 2026", "2026"
  startDate: string
  endDate: string
}

export interface MultiPeriodRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  /** One value per period column, in the same order as periodColumns */
  periodValues: number[]
  total: number
  budget: number | null
  variance: VarianceResult | null
}

export interface MultiPeriodSection {
  title: string
  rows: MultiPeriodRow[]
  total: { periodValues: number[]; total: number; budget: number | null }
}

export interface MultiPeriodActivitiesData {
  periodColumns: PeriodColumn[]
  revenueSections: MultiPeriodSection[]
  totalRevenue: { periodValues: number[]; total: number; budget: number | null }
  expenseSections: MultiPeriodSection[]
  totalExpenses: { periodValues: number[]; total: number; budget: number | null }
  netAssetReleases: { periodValues: number[]; total: number }
  changeInNetAssets: { periodValues: number[]; total: number; budget: number | null }
  fundName: string | null
}

// ---------------------------------------------------------------------------
// Sub-type → section title mappings
// ---------------------------------------------------------------------------

const REVENUE_SECTION_ORDER = [
  'Operating Revenue',
  'Restricted Revenue',
  'Contributions',
  'Adjustment',
  'Other',
] as const

const REVENUE_SECTION_TITLES: Record<string, string> = {
  'Operating Revenue': 'Operating Revenue',
  'Restricted Revenue': 'Restricted Revenue',
  Contributions: 'Contributions',
  Adjustment: 'Rent Adjustments',
  Other: 'Other Revenue',
}

const EXPENSE_SECTION_ORDER = [
  'Payroll',
  'Property Ops',
  'Financial',
  'Non-Cash',
  'Operating',
  'Other',
] as const

const EXPENSE_SECTION_TITLES: Record<string, string> = {
  Payroll: 'Payroll & Benefits',
  'Property Ops': 'Property Operations',
  Financial: 'Financial Expenses',
  'Non-Cash': 'Non-Cash Expenses',
  Operating: 'Operating Expenses',
  Other: 'Other Expenses',
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve the YTD start date (Jan 1 of the endDate year). */
function ytdStartDate(endDate: string): string {
  const year = endDate.slice(0, 4)
  return `${year}-01-01`
}

/** Determine start and end month indices (0-based) covered by a date range. */
function monthRange(startDate: string, endDate: string): { startMonth: number; endMonth: number } {
  return {
    startMonth: parseInt(startDate.slice(5, 7), 10) - 1,
    endMonth: parseInt(endDate.slice(5, 7), 10) - 1,
  }
}

/** Sum budget monthlyAmounts for a given month range (0-based, inclusive). */
function sumBudgetMonths(monthlyAmounts: number[], startMonth: number, endMonth: number): number {
  let total = 0
  for (let m = startMonth; m <= endMonth; m++) {
    total += monthlyAmounts[m] ?? 0
  }
  return total
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getActivitiesData(filters: ActivitiesFilters): Promise<ActivitiesData> {
  const { startDate, endDate, fundId } = filters
  const ytdStart = ytdStartDate(endDate)
  const year = parseInt(endDate.slice(0, 4), 10)

  // ---- Fund name lookup ---------------------------------------------------
  let fundName: string | null = null
  if (fundId) {
    const [fund] = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, fundId))
      .limit(1)
    fundName = fund?.name ?? null
  }

  // ---- Approved budget for the fiscal year --------------------------------
  const [approvedBudget] = await db
    .select()
    .from(budgets)
    .where(and(eq(budgets.fiscalYear, year), eq(budgets.status, 'APPROVED')))
    .limit(1)

  // ---- Budget lines (keyed by accountId) ----------------------------------
  const budgetLookup = new Map<number, number[]>()

  if (approvedBudget) {
    const budgetConditions = [eq(budgetLines.budgetId, approvedBudget.id)]
    if (fundId) budgetConditions.push(eq(budgetLines.fundId, fundId))

    const lines = await db
      .select({
        accountId: budgetLines.accountId,
        monthlyAmounts: budgetLines.monthlyAmounts,
      })
      .from(budgetLines)
      .where(and(...budgetConditions))

    for (const line of lines) {
      const monthly = line.monthlyAmounts as number[]
      const existing = budgetLookup.get(line.accountId)
      if (existing) {
        // Multiple fund lines for same account — sum element-wise
        for (let m = 0; m < 12; m++) {
          existing[m] = (existing[m] ?? 0) + (monthly[m] ?? 0)
        }
      } else {
        budgetLookup.set(line.accountId, [...monthly])
      }
    }
  }

  // ---- Actuals: current period & YTD in one pass --------------------------
  // We query both ranges with a CASE expression to avoid two round trips.

  const fundCondition = fundId ? eq(transactionLines.fundId, fundId) : undefined

  const baseConditions = [
    eq(transactions.isVoided, false),
    ...(fundCondition ? [fundCondition] : []),
  ]

  const rows = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
      cpDebit: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.date} >= ${startDate} AND ${transactions.date} <= ${endDate} THEN ${transactionLines.debit} ELSE 0 END), 0)`,
      cpCredit: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.date} >= ${startDate} AND ${transactions.date} <= ${endDate} THEN ${transactionLines.credit} ELSE 0 END), 0)`,
      ytdDebit: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.date} >= ${ytdStart} AND ${transactions.date} <= ${endDate} THEN ${transactionLines.debit} ELSE 0 END), 0)`,
      ytdCredit: sql<string>`COALESCE(SUM(CASE WHEN ${transactions.date} >= ${ytdStart} AND ${transactions.date} <= ${endDate} THEN ${transactionLines.credit} ELSE 0 END), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        ...baseConditions,
        // Only REVENUE and EXPENSE accounts
        sql`${accounts.type} IN ('REVENUE', 'EXPENSE')`,
        // At least one of the ranges must contain the transaction
        gte(transactions.date, ytdStart),
        lte(transactions.date, endDate),
        // Exclude year-end closing entries — they debit revenue and credit
        // expense accounts, which would distort the P&L if included.
        ne(transactions.sourceType, 'YEAR_END_CLOSE'),
      )
    )
    .groupBy(
      accounts.id,
      accounts.code,
      accounts.name,
      accounts.type,
      accounts.subType,
      accounts.normalBalance,
    )
    .orderBy(accounts.code)

  // ---- Net Asset Releases (SYSTEM entries with 'release' in memo) ----------
  const releaseConditions = [
    eq(transactions.isVoided, false),
    eq(transactions.sourceType, 'SYSTEM'),
    ilike(transactions.memo, '%release%'),
    ...(fundCondition ? [fundCondition] : []),
  ]

  const [releaseResult] = await db
    .select({
      cpAmount: sql<string>`COALESCE(SUM(
        CASE WHEN ${transactions.date} >= ${startDate} AND ${transactions.date} <= ${endDate}
             THEN COALESCE(${transactionLines.credit}, 0) - COALESCE(${transactionLines.debit}, 0)
             ELSE 0 END
      ), 0)`,
      ytdAmount: sql<string>`COALESCE(SUM(
        CASE WHEN ${transactions.date} >= ${ytdStart} AND ${transactions.date} <= ${endDate}
             THEN COALESCE(${transactionLines.credit}, 0) - COALESCE(${transactionLines.debit}, 0)
             ELSE 0 END
      ), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        ...releaseConditions,
        eq(accounts.type, 'NET_ASSET'),
        gte(transactions.date, ytdStart),
        lte(transactions.date, endDate),
      )
    )

  const netAssetReleases = {
    currentPeriod: Number(releaseResult?.cpAmount ?? 0),
    yearToDate: Number(releaseResult?.ytdAmount ?? 0),
  }

  // ---- Build rows with budget/variance ------------------------------------
  const { startMonth: cpStartMonth, endMonth: cpEndMonth } = monthRange(startDate, endDate)
  const { startMonth: ytdStartMonth, endMonth: ytdEndMonth } = monthRange(ytdStart, endDate)

  const revenueRows: ActivitiesRow[] = []
  const expenseRows: ActivitiesRow[] = []

  for (const row of rows) {
    const cpDebits = Number(row.cpDebit)
    const cpCredits = Number(row.cpCredit)
    const ytdDebits = Number(row.ytdDebit)
    const ytdCredits = Number(row.ytdCredit)

    let currentPeriod: number
    let yearToDate: number

    if (row.normalBalance === 'CREDIT') {
      // Revenue: credits - debits
      currentPeriod = cpCredits - cpDebits
      yearToDate = ytdCredits - ytdDebits
    } else {
      // Expense: debits - credits
      currentPeriod = cpDebits - cpCredits
      yearToDate = ytdDebits - ytdCredits
    }

    // Budget: sum the monthly amounts for the YTD range
    let budget: number | null = null
    let variance: VarianceResult | null = null
    const monthlyAmounts = budgetLookup.get(row.accountId)
    if (monthlyAmounts) {
      budget = sumBudgetMonths(monthlyAmounts, ytdStartMonth, ytdEndMonth)
      variance = calculateVariance(yearToDate, budget)
    }

    const actRow: ActivitiesRow = {
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      subType: row.subType,
      currentPeriod,
      yearToDate,
      budget,
      variance,
    }

    if (row.accountType === 'REVENUE') {
      revenueRows.push(actRow)
    } else {
      expenseRows.push(actRow)
    }
  }

  // ---- Also include zero-balance accounts that have a budget line ----------
  // This ensures budget-only accounts still appear on the statement.
  if (approvedBudget) {
    const existingRevIds = new Set(revenueRows.map((r) => r.accountId))
    const existingExpIds = new Set(expenseRows.map((r) => r.accountId))

    const budgetOnlyConditions = [eq(budgetLines.budgetId, approvedBudget.id)]
    if (fundId) budgetOnlyConditions.push(eq(budgetLines.fundId, fundId))

    const budgetAccounts = await db
      .select({
        accountId: accounts.id,
        accountCode: accounts.code,
        accountName: accounts.name,
        accountType: accounts.type,
        subType: accounts.subType,
      })
      .from(budgetLines)
      .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
      .where(
        and(
          ...budgetOnlyConditions,
          sql`${accounts.type} IN ('REVENUE', 'EXPENSE')`,
        )
      )
      .groupBy(accounts.id, accounts.code, accounts.name, accounts.type, accounts.subType)

    for (const ba of budgetAccounts) {
      const inSet = ba.accountType === 'REVENUE' ? existingRevIds : existingExpIds
      if (inSet.has(ba.accountId)) continue

      const monthlyAmounts = budgetLookup.get(ba.accountId)
      const budget = monthlyAmounts ? sumBudgetMonths(monthlyAmounts, ytdStartMonth, ytdEndMonth) : 0
      const variance = calculateVariance(0, budget)

      const zeroRow: ActivitiesRow = {
        accountId: ba.accountId,
        accountCode: ba.accountCode,
        accountName: ba.accountName,
        subType: ba.subType,
        currentPeriod: 0,
        yearToDate: 0,
        budget,
        variance,
      }

      if (ba.accountType === 'REVENUE') revenueRows.push(zeroRow)
      else expenseRows.push(zeroRow)
    }

    // Re-sort after adding budget-only accounts
    revenueRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
    expenseRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode))
  }

  // ---- Group into sections ------------------------------------------------
  const revenueSections = buildSections(
    revenueRows,
    REVENUE_SECTION_ORDER as readonly string[],
    REVENUE_SECTION_TITLES,
  )
  const expenseSections = buildSections(
    expenseRows,
    EXPENSE_SECTION_ORDER as readonly string[],
    EXPENSE_SECTION_TITLES,
  )

  // ---- Totals -------------------------------------------------------------
  const totalRevenue = sumSections(revenueSections)
  const totalExpenses = sumSections(expenseSections)

  const changeInNetAssets = {
    currentPeriod: totalRevenue.currentPeriod - totalExpenses.currentPeriod + netAssetReleases.currentPeriod,
    yearToDate: totalRevenue.yearToDate - totalExpenses.yearToDate + netAssetReleases.yearToDate,
    budget:
      totalRevenue.budget != null && totalExpenses.budget != null
        ? totalRevenue.budget - totalExpenses.budget
        : null,
  }

  return {
    startDate,
    endDate,
    revenueSections,
    totalRevenue,
    expenseSections,
    totalExpenses,
    netAssetReleases,
    changeInNetAssets,
    fundName,
  }
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildSections(
  rows: ActivitiesRow[],
  order: readonly string[],
  titles: Record<string, string>,
): ActivitiesSection[] {
  const grouped = new Map<string, ActivitiesRow[]>()

  for (const row of rows) {
    const key = order.includes(row.subType ?? '') ? (row.subType as string) : 'Other'
    const existing = grouped.get(key) ?? []
    existing.push(row)
    grouped.set(key, existing)
  }

  const sections: ActivitiesSection[] = []

  for (const key of order) {
    const sectionRows = grouped.get(key)
    if (!sectionRows || sectionRows.length === 0) continue

    const total = {
      currentPeriod: sectionRows.reduce((s, r) => s + r.currentPeriod, 0),
      yearToDate: sectionRows.reduce((s, r) => s + r.yearToDate, 0),
      budget: sectionRows.every((r) => r.budget != null)
        ? sectionRows.reduce((s, r) => s + (r.budget ?? 0), 0)
        : sectionRows.some((r) => r.budget != null)
          ? sectionRows.reduce((s, r) => s + (r.budget ?? 0), 0)
          : null,
    }

    sections.push({
      title: titles[key] ?? key,
      rows: sectionRows,
      total,
    })
  }

  return sections
}

function sumSections(sections: ActivitiesSection[]): {
  currentPeriod: number
  yearToDate: number
  budget: number | null
} {
  let currentPeriod = 0
  let yearToDate = 0
  let budget: number | null = null
  let hasBudget = false

  for (const section of sections) {
    currentPeriod += section.total.currentPeriod
    yearToDate += section.total.yearToDate
    if (section.total.budget != null) {
      hasBudget = true
      budget = (budget ?? 0) + section.total.budget
    }
  }

  return { currentPeriod, yearToDate, budget: hasBudget ? budget : null }
}

// ---------------------------------------------------------------------------
// Multi-period query (monthly / quarterly / annual)
// ---------------------------------------------------------------------------

/**
 * Generate period columns from a date range and period type.
 */
export function generatePeriodColumns(
  startDate: string,
  endDate: string,
  periodType: 'monthly' | 'quarterly' | 'annual'
): PeriodColumn[] {
  const columns: PeriodColumn[] = []
  const startYear = parseInt(startDate.slice(0, 4), 10)
  const startMonth = parseInt(startDate.slice(5, 7), 10)
  const endYear = parseInt(endDate.slice(0, 4), 10)
  const endMonth = parseInt(endDate.slice(5, 7), 10)

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

  if (periodType === 'monthly') {
    let y = startYear
    let m = startMonth
    while (y < endYear || (y === endYear && m <= endMonth)) {
      const lastDay = new Date(y, m, 0).getDate()
      columns.push({
        label: `${monthNames[m - 1]} ${y}`,
        startDate: `${y}-${String(m).padStart(2, '0')}-01`,
        endDate: `${y}-${String(m).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      })
      m++
      if (m > 12) { m = 1; y++ }
    }
  } else if (periodType === 'quarterly') {
    const startQ = Math.ceil(startMonth / 3)
    const endQ = Math.ceil(endMonth / 3)
    let y = startYear
    let q = startQ
    while (y < endYear || (y === endYear && q <= endQ)) {
      const qStart = (q - 1) * 3 + 1
      const qEnd = q * 3
      const lastDay = new Date(y, qEnd, 0).getDate()
      columns.push({
        label: `Q${q} ${y}`,
        startDate: `${y}-${String(qStart).padStart(2, '0')}-01`,
        endDate: `${y}-${String(qEnd).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
      })
      q++
      if (q > 4) { q = 1; y++ }
    }
  } else {
    // annual
    for (let y = startYear; y <= endYear; y++) {
      columns.push({
        label: `${y}`,
        startDate: `${y}-01-01`,
        endDate: `${y}-12-31`,
      })
    }
  }

  return columns
}

/**
 * Get multi-period activities data. Runs one query per period column,
 * then assembles results into a columnar structure.
 */
export async function getMultiPeriodActivitiesData(
  filters: ActivitiesFilters
): Promise<MultiPeriodActivitiesData> {
  const { startDate, endDate, fundId, periodType = 'monthly' } = filters

  const periodColumns = generatePeriodColumns(startDate, endDate, periodType as 'monthly' | 'quarterly' | 'annual')

  // Run the existing query for each period
  const periodResults = await Promise.all(
    periodColumns.map((col) =>
      getActivitiesData({ startDate: col.startDate, endDate: col.endDate, fundId })
    )
  )

  const fundName = periodResults[0]?.fundName ?? null

  // Build a map: accountId → array of period values
  // Process revenue and expense separately

  type AccountKey = number
  type AccountMeta = { code: string; name: string; subType: string | null }

  function buildMultiPeriodSections(
    getSections: (data: ActivitiesData) => ActivitiesSection[],
    getTotal: (data: ActivitiesData) => { currentPeriod: number; yearToDate: number; budget: number | null },
    sectionOrder: readonly string[],
    sectionTitles: Record<string, string>,
  ): { sections: MultiPeriodSection[]; grandTotal: { periodValues: number[]; total: number; budget: number | null } } {
    // Collect per-account values across periods
    const accountValues = new Map<AccountKey, { meta: AccountMeta; values: number[]; section: string }>()

    for (let p = 0; p < periodResults.length; p++) {
      const sections = getSections(periodResults[p])
      for (const section of sections) {
        for (const row of section.rows) {
          let entry = accountValues.get(row.accountId)
          if (!entry) {
            entry = {
              meta: { code: row.accountCode, name: row.accountName, subType: row.subType },
              values: new Array(periodColumns.length).fill(0),
              section: sectionOrder.includes(row.subType ?? '') ? (row.subType as string) : 'Other',
            }
            accountValues.set(row.accountId, entry)
          }
          entry.values[p] = row.currentPeriod
        }
      }
    }

    // Get budget from the first (or last) period result that has one
    const budgetMap = new Map<AccountKey, number | null>()
    // Use the full-range query for budgets — sum across all periods
    for (const result of periodResults) {
      for (const section of getSections(result)) {
        for (const row of section.rows) {
          if (row.budget != null && !budgetMap.has(row.accountId)) {
            budgetMap.set(row.accountId, row.budget)
          }
        }
      }
    }
    // Actually budget should be the YTD budget from a full-range query
    // For simplicity, sum individual period budgets
    const budgetSums = new Map<AccountKey, number>()
    for (const result of periodResults) {
      for (const section of getSections(result)) {
        for (const row of section.rows) {
          if (row.budget != null) {
            budgetSums.set(row.accountId, (budgetSums.get(row.accountId) ?? 0) + row.budget)
          }
        }
      }
    }

    // Group into sections
    const grouped = new Map<string, MultiPeriodRow[]>()
    for (const [accountId, entry] of accountValues) {
      const key = entry.section
      const total = entry.values.reduce((s, v) => s + v, 0)
      const budget = budgetSums.get(accountId) ?? null
      const variance = budget != null ? calculateVariance(total, budget) : null

      const row: MultiPeriodRow = {
        accountId,
        accountCode: entry.meta.code,
        accountName: entry.meta.name,
        subType: entry.meta.subType,
        periodValues: entry.values,
        total,
        budget,
        variance,
      }

      const existing = grouped.get(key) ?? []
      existing.push(row)
      grouped.set(key, existing)
    }

    const sections: MultiPeriodSection[] = []
    const grandTotalValues = new Array(periodColumns.length).fill(0)
    let grandTotal = 0
    let grandBudget: number | null = null
    let hasBudget = false

    for (const key of sectionOrder) {
      const sectionRows = grouped.get(key)
      if (!sectionRows || sectionRows.length === 0) continue

      sectionRows.sort((a, b) => a.accountCode.localeCompare(b.accountCode))

      const totalValues = new Array(periodColumns.length).fill(0)
      let sectionTotal = 0
      let sectionBudget: number | null = null
      let sectionHasBudget = false

      for (const row of sectionRows) {
        for (let p = 0; p < periodColumns.length; p++) {
          totalValues[p] += row.periodValues[p]
          grandTotalValues[p] += row.periodValues[p]
        }
        sectionTotal += row.total
        grandTotal += row.total
        if (row.budget != null) {
          sectionHasBudget = true
          hasBudget = true
          sectionBudget = (sectionBudget ?? 0) + row.budget
          grandBudget = (grandBudget ?? 0) + row.budget
        }
      }

      sections.push({
        title: sectionTitles[key] ?? key,
        rows: sectionRows,
        total: {
          periodValues: totalValues,
          total: sectionTotal,
          budget: sectionHasBudget ? sectionBudget : null,
        },
      })
    }

    return {
      sections,
      grandTotal: {
        periodValues: grandTotalValues,
        total: grandTotal,
        budget: hasBudget ? grandBudget : null,
      },
    }
  }

  const revenue = buildMultiPeriodSections(
    (d) => d.revenueSections,
    (d) => d.totalRevenue,
    REVENUE_SECTION_ORDER as readonly string[],
    REVENUE_SECTION_TITLES,
  )

  const expenses = buildMultiPeriodSections(
    (d) => d.expenseSections,
    (d) => d.totalExpenses,
    EXPENSE_SECTION_ORDER as readonly string[],
    EXPENSE_SECTION_TITLES,
  )

  // Net asset releases per period
  const releaseValues = periodResults.map((r) => r.netAssetReleases.currentPeriod)
  const releaseTotal = releaseValues.reduce((s, v) => s + v, 0)

  // Change in net assets
  const changeValues = periodColumns.map((_, p) =>
    revenue.grandTotal.periodValues[p] - expenses.grandTotal.periodValues[p] + releaseValues[p]
  )
  const changeTotal = revenue.grandTotal.total - expenses.grandTotal.total + releaseTotal
  const changeBudget = revenue.grandTotal.budget != null && expenses.grandTotal.budget != null
    ? revenue.grandTotal.budget - expenses.grandTotal.budget
    : null

  return {
    periodColumns,
    revenueSections: revenue.sections,
    totalRevenue: revenue.grandTotal,
    expenseSections: expenses.sections,
    totalExpenses: expenses.grandTotal,
    netAssetReleases: { periodValues: releaseValues, total: releaseTotal },
    changeInNetAssets: { periodValues: changeValues, total: changeTotal, budget: changeBudget },
    fundName,
  }
}
