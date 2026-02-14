import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, transactionLines, transactions } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

const UTILITY_TYPES = [
  'Electric',
  'Gas',
  'Water/Sewer',
  'Internet',
  'Security & Fire Monitoring',
  'Trash',
] as const

export type UtilityType = (typeof UTILITY_TYPES)[number]

export { UTILITY_TYPES }

export interface UtilityMonthData {
  month: string // YYYY-MM
  values: Record<UtilityType, number>
  total: number
}

export interface UtilityTrendsData {
  months: UtilityMonthData[]
  utilityTypes: UtilityType[]
  yearOverYear: {
    currentYear: number
    priorYear: number
    change: number
    changePercent: number
  } | null
}

export interface UtilityTrendsFilters {
  endDate?: string
  months?: number // default 12
  fundId?: number | null
}

// ---------------------------------------------------------------------------
// Utility type matching: map account name to utility type
// ---------------------------------------------------------------------------

const UTILITY_PATTERNS: { pattern: RegExp; type: UtilityType }[] = [
  { pattern: /electric/i, type: 'Electric' },
  { pattern: /\bgas\b/i, type: 'Gas' },
  { pattern: /water|sewer/i, type: 'Water/Sewer' },
  { pattern: /internet|telecom/i, type: 'Internet' },
  { pattern: /security|fire\s*monitor/i, type: 'Security & Fire Monitoring' },
  { pattern: /trash|waste|refuse/i, type: 'Trash' },
]

function mapAccountToUtility(accountName: string): UtilityType | null {
  for (const { pattern, type } of UTILITY_PATTERNS) {
    if (pattern.test(accountName)) return type
  }
  return null
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getUtilityTrendsData(
  filters?: UtilityTrendsFilters
): Promise<UtilityTrendsData> {
  const endDate = filters?.endDate ?? new Date().toISOString().split('T')[0]
  const numMonths = filters?.months ?? 12
  const fundId = filters?.fundId

  // Calculate the start date for the rolling window
  const endDateObj = new Date(endDate + 'T00:00:00')
  const startDateObj = new Date(endDateObj)
  startDateObj.setMonth(startDateObj.getMonth() - numMonths + 1)
  startDateObj.setDate(1) // start of that month
  const startDate = startDateObj.toISOString().split('T')[0]

  // ---- Find utility accounts (EXPENSE with Property Ops subType) ----
  const allExpenseAccounts = await db
    .select({
      id: accounts.id,
      name: accounts.name,
      subType: accounts.subType,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.type, 'EXPENSE'),
        eq(accounts.subType, 'Property Ops'),
        eq(accounts.isActive, true)
      )
    )

  // Map accounts to utility types
  const accountUtilityMap = new Map<number, UtilityType>()
  for (const acct of allExpenseAccounts) {
    const utilityType = mapAccountToUtility(acct.name)
    if (utilityType) {
      accountUtilityMap.set(acct.id, utilityType)
    }
  }

  const utilityAccountIds = Array.from(accountUtilityMap.keys())

  if (utilityAccountIds.length === 0) {
    // No utility accounts found -- return empty data
    return {
      months: buildEmptyMonths(startDate, endDate),
      utilityTypes: [...UTILITY_TYPES],
      yearOverYear: null,
    }
  }

  // ---- Query monthly totals per utility account ----
  const conditions = [
    eq(transactions.isVoided, false),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    eq(accounts.type, 'EXPENSE'),
    eq(accounts.subType, 'Property Ops'),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  const rows = await db
    .select({
      accountId: accounts.id,
      accountName: accounts.name,
      month: sql<string>`TO_CHAR(${transactions.date}::date, 'YYYY-MM')`,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(accounts.id, accounts.name, sql`TO_CHAR(${transactions.date}::date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${transactions.date}::date, 'YYYY-MM')`)

  // ---- Aggregate by month and utility type ----
  const monthMap = new Map<string, Record<UtilityType, number>>()

  // Initialize all months in range
  const cursor = new Date(startDateObj)
  while (cursor <= endDateObj) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const values: Record<UtilityType, number> = {} as Record<UtilityType, number>
    for (const ut of UTILITY_TYPES) {
      values[ut] = 0
    }
    monthMap.set(key, values)
    cursor.setMonth(cursor.getMonth() + 1)
  }

  for (const row of rows) {
    const utilityType = accountUtilityMap.get(row.accountId)
    if (!utilityType) continue
    const monthKey = row.month
    const monthValues = monthMap.get(monthKey)
    if (!monthValues) continue

    const debits = Number(row.totalDebit)
    const credits = Number(row.totalCredit)
    // Expense: debit normal balance
    const actual = debits - credits
    monthValues[utilityType] += actual
  }

  // ---- Build month data ----
  const months: UtilityMonthData[] = []
  const sortedKeys = Array.from(monthMap.keys()).sort()

  for (const key of sortedKeys) {
    const values = monthMap.get(key)!
    const total = UTILITY_TYPES.reduce((sum, ut) => sum + values[ut], 0)
    months.push({ month: key, values, total })
  }

  // ---- Year-over-year comparison ----
  let yearOverYear: UtilityTrendsData['yearOverYear'] = null

  if (numMonths >= 12) {
    // Check if we have prior year data
    const priorStartDateObj = new Date(startDateObj)
    priorStartDateObj.setFullYear(priorStartDateObj.getFullYear() - 1)
    const priorStartDate = priorStartDateObj.toISOString().split('T')[0]

    const priorEndDateObj = new Date(startDateObj)
    priorEndDateObj.setDate(priorEndDateObj.getDate() - 1) // day before current window start
    const priorEndDate = priorEndDateObj.toISOString().split('T')[0]

    const priorConditions = [
      eq(transactions.isVoided, false),
      gte(transactions.date, priorStartDate),
      lte(transactions.date, priorEndDate),
      eq(accounts.type, 'EXPENSE'),
      eq(accounts.subType, 'Property Ops'),
    ]
    if (fundId) {
      priorConditions.push(eq(transactionLines.fundId, fundId))
    }

    const [priorResult] = await db
      .select({
        totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
        totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .where(and(...priorConditions))

    if (priorResult) {
      const priorTotal =
        Number(priorResult.totalDebit) - Number(priorResult.totalCredit)

      // Only filter to utility accounts for the prior year total
      const priorUtilityConditions = [...priorConditions]

      const [priorUtilityResult] = await db
        .select({
          totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
          totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
        })
        .from(transactionLines)
        .innerJoin(
          transactions,
          eq(transactionLines.transactionId, transactions.id)
        )
        .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
        .where(
          and(
            ...priorUtilityConditions,
            sql`${accounts.id} IN (${sql.join(
              utilityAccountIds.map((id) => sql`${id}`),
              sql`, `
            )})`
          )
        )

      if (priorUtilityResult) {
        const priorYear =
          Number(priorUtilityResult.totalDebit) -
          Number(priorUtilityResult.totalCredit)
        const currentYear = months.reduce((sum, m) => sum + m.total, 0)

        if (priorYear !== 0) {
          const change = currentYear - priorYear
          const changePercent = (change / priorYear) * 100

          yearOverYear = {
            currentYear,
            priorYear,
            change,
            changePercent,
          }
        }
      }
    }
  }

  return {
    months,
    utilityTypes: [...UTILITY_TYPES],
    yearOverYear,
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildEmptyMonths(
  startDate: string,
  endDate: string
): UtilityMonthData[] {
  const months: UtilityMonthData[] = []
  const cursor = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')

  while (cursor <= end) {
    const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
    const values: Record<UtilityType, number> = {} as Record<UtilityType, number>
    for (const ut of UTILITY_TYPES) {
      values[ut] = 0
    }
    months.push({ month: key, values, total: 0 })
    cursor.setMonth(cursor.getMonth() + 1)
  }

  return months
}
