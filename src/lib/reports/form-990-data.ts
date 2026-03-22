import { eq, and, sql, gte, lte, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  functionalAllocations,
  payrollRuns,
  payrollEntries,
  fixedAssets,
  funds,
  vendors,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Form990ExpenseRow {
  form990Line: string
  lineLabel: string
  total: number
  program: number
  admin: number
  fundraising: number
}

export interface Form990RevenueRow {
  form990Line: string
  lineLabel: string
  amount: number
}

export interface Form990RevenueSourceRow {
  fundId: number
  fundName: string
  funderName: string | null
  fundingCategory: string | null
  revenueClassification: string | null
  classificationRationale: string | null
  form990Line: string
  form990LineLabel: string
  accountCode: string
  accountName: string
  amount: number
}

export interface Form990OfficerRow {
  employeeId: string
  employeeName: string
  totalCompensation: number
  /** True if this person is an officer, director, trustee, or key employee */
  isOfficer: boolean
}

export interface Form990ScheduleData {
  fixedAssetCount: number
  fixedAssetTotal: number
  cipBalance: number
}

export interface Form990Filters {
  fiscalYear: number
}

export interface Form990Data {
  partIXExpenses: Form990ExpenseRow[]
  partIXTotal: { total: number; program: number; admin: number; fundraising: number }
  revenue: Form990RevenueRow[]
  revenueBySource: Form990RevenueSourceRow[]
  totalRevenue: number
  officers: Form990OfficerRow[]
  scheduleData: Form990ScheduleData
  fiscalYear: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// 990 line labels
// ---------------------------------------------------------------------------

const LINE_LABELS: Record<string, string> = {
  '1': 'Grants and other assistance to domestic organizations',
  '2': 'Grants and other assistance to domestic individuals',
  '3': 'Grants and other assistance to foreign organizations',
  '4': 'Benefits paid to or for members',
  '5': 'Compensation of current officers, directors, trustees',
  '6': 'Compensation not included above',
  '7': 'Other salaries and wages',
  '8': 'Pension plan accruals and contributions',
  '9': 'Other employee benefits',
  '10': 'Payroll taxes',
  '11a': 'Management fees',
  '11b': 'Legal fees',
  '11c': 'Accounting fees',
  '11d': 'Lobbying fees',
  '11e': 'Professional fundraising services fees',
  '11f': 'Investment management fees',
  '11g': 'Other fees',
  '12': 'Advertising and promotion',
  '13': 'Office expenses',
  '14': 'Information technology',
  '15': 'Royalties',
  '16': 'Occupancy',
  '17': 'Travel',
  '18': 'Payments of travel or entertainment for officials',
  '19': 'Conferences, conventions, and meetings',
  '20': 'Interest',
  '21': 'Payments to affiliates',
  '22': 'Depreciation, depletion, and amortization',
  '23': 'Insurance',
  '24': 'Other expenses',
}

const REVENUE_LINE_LABELS: Record<string, string> = {
  '1a': 'Federated campaigns',
  '1b': 'Membership dues',
  '1c': 'Fundraising events',
  '1d': 'Related organizations',
  '1e': 'Government grants (contributions)',
  '1f': 'All other contributions, gifts, grants',
  '1g': 'Noncash contributions',
  '2': 'Program service revenue',
  '3': 'Investment income',
  '4': 'Income from investment of tax-exempt bond proceeds',
  '5': 'Royalties',
  '6': 'Net rental income',
  '7': 'Net gain from sales of assets',
  '8': 'Net income from fundraising events',
  '9': 'Net income from gaming activities',
  '10': 'Net income from sales of inventory',
  '11': 'Other revenue',
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getForm990Data(
  filters: Form990Filters
): Promise<Form990Data> {
  const now = new Date().toISOString()
  const { fiscalYear } = filters
  const startDate = `${fiscalYear}-01-01`
  const endDate = `${fiscalYear}-12-31`

  // 1. Part IX — Functional Expenses by 990 line
  // Get expense accounts with form990Line mapping
  const expenseAccounts = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      form990Line: accounts.form990Line,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.type, 'EXPENSE'),
        eq(accounts.isActive, true)
      )
    )

  // Get functional allocations for the requested fiscal year
  const allocations = await db
    .select()
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, fiscalYear))

  const allocMap = new Map(
    allocations.map((a) => [
      a.accountId,
      {
        programPercent: parseFloat(String(a.programPct)),
        adminPercent: parseFloat(String(a.adminPct)),
        fundraisingPercent: parseFloat(String(a.fundraisingPct)),
      },
    ])
  )

  // Get expense actuals
  const expenseAccountIds = expenseAccounts.map((a) => a.id)
  let expenseLines: { accountId: number; amount: string }[] = []

  if (expenseAccountIds.length > 0) {
    expenseLines = await db
      .select({
        accountId: transactionLines.accountId,
        amount: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric) - COALESCE(CAST(${transactionLines.credit} AS numeric), 0)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(expenseAccountIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(transactions.isVoided, false),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          ne(transactions.sourceType, 'YEAR_END_CLOSE'),
        )
      )
      .groupBy(transactionLines.accountId)
  }

  const actualsByAccount = new Map(
    expenseLines.map((l) => [l.accountId, parseFloat(l.amount)])
  )

  // Group by 990 line
  const lineMap = new Map<string, { total: number; program: number; admin: number; fundraising: number }>()

  for (const acct of expenseAccounts) {
    const line = acct.form990Line ?? '24' // default to "Other expenses"
    const amount = actualsByAccount.get(acct.id) ?? 0
    if (amount === 0) continue

    const alloc = allocMap.get(acct.id) ?? {
      programPercent: 100,
      adminPercent: 0,
      fundraisingPercent: 0,
    }

    const entry = lineMap.get(line) ?? { total: 0, program: 0, admin: 0, fundraising: 0 }
    entry.total += amount
    entry.program += amount * (alloc.programPercent / 100)
    entry.admin += amount * (alloc.adminPercent / 100)
    entry.fundraising += amount * (alloc.fundraisingPercent / 100)
    lineMap.set(line, entry)
  }

  const partIXExpenses: Form990ExpenseRow[] = [...lineMap.entries()]
    .sort((a, b) => {
      const numA = parseFloat(a[0].replace(/[a-g]/g, ''))
      const numB = parseFloat(b[0].replace(/[a-g]/g, ''))
      return numA - numB || a[0].localeCompare(b[0])
    })
    .map(([line, data]) => ({
      form990Line: line,
      lineLabel: LINE_LABELS[line] ?? `Line ${line}`,
      total: Math.round(data.total * 100) / 100,
      program: Math.round(data.program * 100) / 100,
      admin: Math.round(data.admin * 100) / 100,
      fundraising: Math.round(data.fundraising * 100) / 100,
    }))

  const partIXTotal = {
    total: partIXExpenses.reduce((s, r) => s + r.total, 0),
    program: partIXExpenses.reduce((s, r) => s + r.program, 0),
    admin: partIXExpenses.reduce((s, r) => s + r.admin, 0),
    fundraising: partIXExpenses.reduce((s, r) => s + r.fundraising, 0),
  }

  // 2. Revenue by 990 line
  const revenueAccounts = await db
    .select({
      id: accounts.id,
      form990Line: accounts.form990Line,
      name: accounts.name,
    })
    .from(accounts)
    .where(and(eq(accounts.type, 'REVENUE'), eq(accounts.isActive, true)))

  const revenueAccountIds = revenueAccounts.map((a) => a.id)
  let revenueActuals: { accountId: number; amount: string }[] = []

  if (revenueAccountIds.length > 0) {
    revenueActuals = await db
      .select({
        accountId: transactionLines.accountId,
        amount: sql<string>`COALESCE(SUM(COALESCE(CAST(${transactionLines.credit} AS numeric), 0) - COALESCE(CAST(${transactionLines.debit} AS numeric), 0)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(revenueAccountIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(transactions.isVoided, false),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          ne(transactions.sourceType, 'YEAR_END_CLOSE'),
        )
      )
      .groupBy(transactionLines.accountId)
  }

  const revMap = new Map(revenueActuals.map((r) => [r.accountId, parseFloat(r.amount)]))

  const revByLine = new Map<string, number>()
  for (const acct of revenueAccounts) {
    const line = acct.form990Line ?? 'other'
    const amount = revMap.get(acct.id) ?? 0
    if (amount === 0) continue
    revByLine.set(line, (revByLine.get(line) ?? 0) + amount)
  }

  const revenue: Form990RevenueRow[] = [...revByLine.entries()].map(([line, amount]) => ({
    form990Line: line,
    lineLabel: REVENUE_LINE_LABELS[line] ?? `Revenue Line ${line}`,
    amount: Math.round(amount * 100) / 100,
  }))
  const totalRevenue = revenue.reduce((s, r) => s + r.amount, 0)

  // 2b. Revenue by funding source — classification schedule
  let revenueSourceRows: {
    fundId: number
    fundName: string
    funderName: string | null
    fundingCategory: string | null
    revenueClassification: string | null
    classificationRationale: string | null
    form990Line: string | null
    accountCode: string
    accountName: string
    amount: string
  }[] = []

  if (revenueAccountIds.length > 0) {
    revenueSourceRows = await db
      .select({
        fundId: funds.id,
        fundName: funds.name,
        funderName: vendors.name,
        fundingCategory: funds.fundingCategory,
        revenueClassification: funds.revenueClassification,
        classificationRationale: funds.classificationRationale,
        form990Line: accounts.form990Line,
        accountCode: accounts.code,
        accountName: accounts.name,
        amount: sql<string>`COALESCE(SUM(COALESCE(CAST(${transactionLines.credit} AS numeric), 0) - COALESCE(CAST(${transactionLines.debit} AS numeric), 0)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
      .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
      .innerJoin(funds, eq(transactionLines.fundId, funds.id))
      .leftJoin(vendors, eq(funds.funderId, vendors.id))
      .where(
        and(
          sql`${transactionLines.accountId} IN (${sql.join(revenueAccountIds.map((id) => sql`${id}`), sql`, `)})`,
          eq(transactions.isVoided, false),
          gte(transactions.date, startDate),
          lte(transactions.date, endDate),
          ne(transactions.sourceType, 'YEAR_END_CLOSE'),
        )
      )
      .groupBy(
        funds.id,
        funds.name,
        vendors.name,
        funds.fundingCategory,
        funds.revenueClassification,
        funds.classificationRationale,
        accounts.form990Line,
        accounts.code,
        accounts.name
      )
  }

  const revenueBySource: Form990RevenueSourceRow[] = revenueSourceRows
    .map((r) => ({
      fundId: r.fundId,
      fundName: r.fundName,
      funderName: r.funderName,
      fundingCategory: r.fundingCategory,
      revenueClassification: r.revenueClassification,
      classificationRationale: r.classificationRationale,
      form990Line: r.form990Line ?? 'other',
      form990LineLabel: REVENUE_LINE_LABELS[r.form990Line ?? 'other'] ?? `Line ${r.form990Line ?? 'other'}`,
      accountCode: r.accountCode,
      accountName: r.accountName,
      amount: Math.round(parseFloat(r.amount) * 100) / 100,
    }))
    .filter((r) => r.amount !== 0)
    .sort((a, b) => {
      const numA = parseFloat(a.form990Line.replace(/[a-g]/g, ''))
      const numB = parseFloat(b.form990Line.replace(/[a-g]/g, ''))
      const lineSort = numA - numB || a.form990Line.localeCompare(b.form990Line)
      if (lineSort !== 0) return lineSort
      return a.fundName.localeCompare(b.fundName)
    })

  // 3. Officer compensation — cross-reference payroll with app-portal flags
  const officers: Form990OfficerRow[] = []
  const payrollData = await db
    .select({
      employeeId: payrollEntries.employeeId,
      employeeName: payrollEntries.employeeName,
      totalComp: sql<string>`SUM(CAST(${payrollEntries.grossPay} AS numeric))`,
    })
    .from(payrollEntries)
    .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollRuns.status, 'POSTED'),
        gte(payrollRuns.payPeriodStart, startDate),
        lte(payrollRuns.payPeriodEnd, endDate)
      )
    )
    .groupBy(payrollEntries.employeeId, payrollEntries.employeeName)
    .orderBy(payrollEntries.employeeName)

  // Build officer/board member lookup from app-portal
  const { getActiveEmployees } = await import('@/lib/integrations/people')
  const employees = await getActiveEmployees()
  const officerIds = new Set(
    employees
      .filter((e) => e.isOfficer || e.isBoardMember)
      .map((e) => e.id)
  )

  for (const p of payrollData) {
    officers.push({
      employeeId: p.employeeId,
      employeeName: p.employeeName,
      totalCompensation: Math.round(parseFloat(p.totalComp ?? '0') * 100) / 100,
      isOfficer: officerIds.has(p.employeeId),
    })
  }

  // 4. Schedule data — fixed assets + CIP
  const assetData = await db
    .select({
      count: sql<string>`COUNT(*)`,
      totalCost: sql<string>`COALESCE(SUM(CAST(${fixedAssets.cost} AS numeric)), 0)`,
    })
    .from(fixedAssets)
    .where(eq(fixedAssets.isActive, true))

  const scheduleData: Form990ScheduleData = {
    fixedAssetCount: parseInt(assetData[0]?.count ?? '0'),
    fixedAssetTotal: Math.round(parseFloat(assetData[0]?.totalCost ?? '0') * 100) / 100,
    cipBalance: 0, // Would be computed from CIP account balances
  }

  return {
    partIXExpenses,
    partIXTotal,
    revenue,
    revenueBySource,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    officers,
    scheduleData,
    fiscalYear,
    generatedAt: now,
  }
}
