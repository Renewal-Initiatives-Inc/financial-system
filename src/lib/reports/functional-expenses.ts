import { eq, and, sql, gte, lte, ne, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  funds,
  functionalAllocations,
  payrollEntries,
  payrollRuns,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type FunctionalExpenseFormat = 'gaap' | '990'

export interface FunctionalExpenseRow {
  label: string
  accountId?: number
  total: number
  program: number
  admin: number
  fundraising: number
  unallocated: number
  isGroupHeader?: boolean
  isTotal?: boolean
}

export interface FunctionalExpensesData {
  startDate: string
  endDate: string
  format: FunctionalExpenseFormat
  rows: FunctionalExpenseRow[]
  totals: {
    total: number
    program: number
    admin: number
    fundraising: number
    unallocated: number
  }
  hasUnallocated: boolean
  fundName: string | null
}

export interface FunctionalExpensesFilters {
  startDate: string
  endDate: string
  fundId?: number | null
  format?: FunctionalExpenseFormat
}

// ---------------------------------------------------------------------------
// GAAP subType grouping — natural classification
// ---------------------------------------------------------------------------

const GAAP_GROUP_ORDER: string[] = [
  'Payroll',
  'Property Ops',
  'Financial',
  'Non-Cash',
  'Operating',
  'Other',
]

function gaapGroup(subType: string | null): string {
  if (!subType) return 'Other'

  const normalized = subType.toLowerCase()

  if (
    normalized.includes('payroll') ||
    normalized.includes('salary') ||
    normalized.includes('wages') ||
    normalized.includes('benefits') ||
    normalized.includes('compensation')
  )
    return 'Payroll'

  if (
    normalized.includes('property') ||
    normalized.includes('maintenance') ||
    normalized.includes('repair') ||
    normalized.includes('utility') ||
    normalized.includes('insurance') ||
    normalized.includes('rent')
  )
    return 'Property Ops'

  if (
    normalized.includes('interest') ||
    normalized.includes('financial') ||
    normalized.includes('bank') ||
    normalized.includes('loan')
  )
    return 'Financial'

  if (
    normalized.includes('depreciation') ||
    normalized.includes('amortization') ||
    normalized.includes('non-cash')
  )
    return 'Non-Cash'

  if (
    normalized.includes('office') ||
    normalized.includes('travel') ||
    normalized.includes('supply') ||
    normalized.includes('supplies') ||
    normalized.includes('professional') ||
    normalized.includes('consulting') ||
    normalized.includes('technology') ||
    normalized.includes('telephone') ||
    normalized.includes('postage')
  )
    return 'Operating'

  return 'Other'
}

// ---------------------------------------------------------------------------
// 990 line grouping
// ---------------------------------------------------------------------------

const LINE_990_LABELS: Record<string, string> = {
  '5': 'Line 5 — Compensation of Current Officers, Directors, etc.',
  '6': 'Line 6 — Compensation Not Included Above',
  '7': 'Line 7 — Other Salaries and Wages',
  '8': 'Line 8 — Pension Plan Accruals and Contributions',
  '9': 'Line 9 — Other Employee Benefits',
  '10': 'Line 10 — Payroll Taxes',
  '11a': 'Line 11a — Management Fees',
  '11b': 'Line 11b — Legal Fees',
  '11c': 'Line 11c — Accounting Fees',
  '11d': 'Line 11d — Lobbying Fees',
  '11e': 'Line 11e — Professional Fundraising Fees',
  '11f': 'Line 11f — Investment Management Fees',
  '11g': 'Line 11g — Other Professional Fees',
  '12': 'Line 12 — Advertising and Promotion',
  '13': 'Line 13 — Office Expenses',
  '14': 'Line 14 — Information Technology',
  '15': 'Line 15 — Royalties',
  '16a': 'Line 16a — Occupancy',
  '16b': 'Line 16b — Rental and Lease Payments (Other)',
  '17': 'Line 17 — Travel',
  '18': 'Line 18 — Payments of Travel for Officials',
  '19': 'Line 19 — Conferences, Conventions, and Meetings',
  '20': 'Line 20 — Interest',
  '21': 'Line 21 — Payments to Affiliates',
  '22': 'Line 22 — Depreciation, Depletion, and Amortization',
  '23': 'Line 23 — Insurance',
  '24a': 'Line 24a — Other Expenses (a)',
  '24b': 'Line 24b — Other Expenses (b)',
  '24c': 'Line 24c — Other Expenses (c)',
  '24d': 'Line 24d — Other Expenses (d)',
  '24e': 'Line 24e — Other Expenses (e)',
}

function get990Label(form990Line: string | null): string {
  if (!form990Line) return 'Other Expenses (Not Mapped)'
  return LINE_990_LABELS[form990Line] ?? `Line ${form990Line}`
}

function get990SortKey(form990Line: string | null): string {
  if (!form990Line) return 'zz'
  // Pad numeric part for correct sorting: "5" → "05", "11a" → "11a"
  const match = form990Line.match(/^(\d+)(.*)$/)
  if (!match) return form990Line
  return match[1].padStart(3, '0') + (match[2] || '')
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getFunctionalExpensesData(
  filters: FunctionalExpensesFilters
): Promise<FunctionalExpensesData> {
  const { startDate, endDate, fundId, format = 'gaap' } = filters

  // Derive fiscal year from the endDate for allocation lookup
  const fiscalYear = parseInt(endDate.substring(0, 4), 10)

  // Build WHERE conditions
  const conditions = [
    eq(transactions.isVoided, false),
    gte(transactions.date, startDate),
    lte(transactions.date, endDate),
    eq(accounts.type, 'EXPENSE'),
    ne(transactions.sourceType, 'YEAR_END_CLOSE'),
  ]
  if (fundId) {
    conditions.push(eq(transactionLines.fundId, fundId))
  }

  // Query expense actuals grouped by account
  const expenseRows = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      subType: accounts.subType,
      form990Line: accounts.form990Line,
      totalDebit: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CAST(${transactionLines.credit} AS numeric)), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(and(...conditions))
    .groupBy(
      accounts.id,
      accounts.code,
      accounts.name,
      accounts.subType,
      accounts.form990Line
    )
    .orderBy(accounts.code)

  // Fetch all functional allocations for this fiscal year
  const allocations = await db
    .select({
      accountId: functionalAllocations.accountId,
      programPct: functionalAllocations.programPct,
      adminPct: functionalAllocations.adminPct,
      fundraisingPct: functionalAllocations.fundraisingPct,
    })
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, fiscalYear))

  // Build allocation lookup map
  const allocationMap = new Map<
    number,
    { programPct: number; adminPct: number; fundraisingPct: number }
  >()
  for (const alloc of allocations) {
    allocationMap.set(alloc.accountId, {
      programPct: parseFloat(alloc.programPct),
      adminPct: parseFloat(alloc.adminPct),
      fundraisingPct: parseFloat(alloc.fundraisingPct),
    })
  }

  // Build per-account rows with allocation splits
  interface AccountRow {
    accountId: number
    accountCode: string
    accountName: string
    subType: string | null
    form990Line: string | null
    total: number
    program: number
    admin: number
    fundraising: number
    unallocated: number
  }

  const accountRows: AccountRow[] = []

  for (const row of expenseRows) {
    const debit = parseFloat(row.totalDebit) || 0
    const credit = parseFloat(row.totalCredit) || 0
    // EXPENSE accounts (DEBIT normal): actual = debits - credits
    const total = debit - credit

    if (total === 0) continue

    const alloc = allocationMap.get(row.accountId)
    let program = 0
    let admin = 0
    let fundraising = 0
    let unallocated = 0

    if (alloc) {
      program = (total * alloc.programPct) / 100
      admin = (total * alloc.adminPct) / 100
      fundraising = (total * alloc.fundraisingPct) / 100
    } else {
      unallocated = total
    }

    accountRows.push({
      accountId: row.accountId,
      accountCode: row.accountCode,
      accountName: row.accountName,
      subType: row.subType,
      form990Line: row.form990Line,
      total,
      program,
      admin,
      fundraising,
      unallocated,
    })
  }

  // ---------------------------------------------------------------------------
  // For 990 format: reclassify officer/board member compensation to Line 5
  // IRS Form 990 requires ALL compensation to officers, directors, trustees,
  // and key employees to appear on Line 5, regardless of which GL account it
  // hits (5000 Salaries & Wages, 5420 Management Fees, etc.)
  // ---------------------------------------------------------------------------
  if (format === '990') {
    const { getActiveEmployees } = await import('@/lib/integrations/people')
    const employees = await getActiveEmployees()
    const officerIds = employees
      .filter((e) => e.isOfficer || e.isBoardMember)
      .map((e) => e.id)

    if (officerIds.length > 0) {
      // Query officer/board member payroll amounts per expense account
      const officerComp = await db
        .select({
          accountId: transactionLines.accountId,
          amount: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
        })
        .from(payrollEntries)
        .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
        .innerJoin(transactions, eq(payrollEntries.glTransactionId, transactions.id))
        .innerJoin(transactionLines, eq(transactionLines.transactionId, transactions.id))
        .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
        .where(
          and(
            eq(payrollRuns.status, 'POSTED'),
            gte(payrollRuns.payPeriodStart, startDate),
            lte(payrollRuns.payPeriodEnd, endDate),
            eq(accounts.type, 'EXPENSE'),
            eq(transactions.isVoided, false),
            sql`${payrollEntries.employeeId} IN (${sql.join(officerIds.map((id) => sql`${id}`), sql`, `)})`,
            ...(fundId ? [eq(transactionLines.fundId, fundId)] : []),
          )
        )
        .groupBy(transactionLines.accountId)

      const officerCompByAccount = new Map(
        officerComp.map((r) => [r.accountId, parseFloat(r.amount)])
      )

      // Reclassify: for accounts not already on Line 5, split officer
      // compensation out and move it to Line 5
      for (const row of accountRows) {
        const officerAmount = officerCompByAccount.get(row.accountId) ?? 0
        if (officerAmount > 0 && row.form990Line !== '5') {
          row.form990Line = row.total === officerAmount ? '5' : row.form990Line
          // If only part of the account is officer comp, split into two rows
          if (row.total !== officerAmount) {
            const origTotal = row.total
            const origProgram = row.program
            const origAdmin = row.admin
            const origFundraising = row.fundraising
            const origUnallocated = row.unallocated

            const officerRatio = officerAmount / origTotal
            const nonOfficerRatio = 1 - officerRatio

            // Create a new row for the officer portion on Line 5
            accountRows.push({
              accountId: row.accountId,
              accountCode: row.accountCode,
              accountName: `${row.accountName} (Officer/Director)`,
              subType: row.subType,
              form990Line: '5',
              total: officerAmount,
              program: origProgram * officerRatio,
              admin: origAdmin * officerRatio,
              fundraising: origFundraising * officerRatio,
              unallocated: origUnallocated * officerRatio,
            })

            // Reduce the original row to non-officer portion
            row.total = origTotal * nonOfficerRatio
            row.program = origProgram * nonOfficerRatio
            row.admin = origAdmin * nonOfficerRatio
            row.fundraising = origFundraising * nonOfficerRatio
            row.unallocated = origUnallocated * nonOfficerRatio
          }
        }
      }
    }
  }

  // Build grouped rows based on format
  const rows: FunctionalExpenseRow[] = []

  if (format === 'gaap') {
    // Group by GAAP natural classification (subType)
    const groups = new Map<string, AccountRow[]>()
    for (const acct of accountRows) {
      const group = gaapGroup(acct.subType)
      const existing = groups.get(group)
      if (existing) {
        existing.push(acct)
      } else {
        groups.set(group, [acct])
      }
    }

    // Emit rows in defined group order
    for (const groupName of GAAP_GROUP_ORDER) {
      const groupAccounts = groups.get(groupName)
      if (!groupAccounts || groupAccounts.length === 0) continue

      // Group header
      rows.push({
        label: groupName,
        total: 0,
        program: 0,
        admin: 0,
        fundraising: 0,
        unallocated: 0,
        isGroupHeader: true,
      })

      // Individual account rows
      let groupTotal = 0
      let groupProgram = 0
      let groupAdmin = 0
      let groupFundraising = 0
      let groupUnallocated = 0

      for (const acct of groupAccounts) {
        rows.push({
          label: `${acct.accountCode} — ${acct.accountName}`,
          accountId: acct.accountId,
          total: acct.total,
          program: acct.program,
          admin: acct.admin,
          fundraising: acct.fundraising,
          unallocated: acct.unallocated,
        })
        groupTotal += acct.total
        groupProgram += acct.program
        groupAdmin += acct.admin
        groupFundraising += acct.fundraising
        groupUnallocated += acct.unallocated
      }

      // Group total row
      rows.push({
        label: `Total ${groupName}`,
        total: groupTotal,
        program: groupProgram,
        admin: groupAdmin,
        fundraising: groupFundraising,
        unallocated: groupUnallocated,
        isTotal: true,
      })
    }
  } else {
    // 990 format: group by form990Line
    const groups = new Map<string, AccountRow[]>()
    for (const acct of accountRows) {
      const key = acct.form990Line ?? '__other__'
      const existing = groups.get(key)
      if (existing) {
        existing.push(acct)
      } else {
        groups.set(key, [acct])
      }
    }

    // Sort groups by 990 line sort key
    const sortedKeys = [...groups.keys()].sort((a, b) => {
      const ka = a === '__other__' ? 'zz' : get990SortKey(a)
      const kb = b === '__other__' ? 'zz' : get990SortKey(b)
      return ka.localeCompare(kb)
    })

    for (const key of sortedKeys) {
      const groupAccounts = groups.get(key)!
      const lineLabel =
        key === '__other__' ? 'Other Expenses (Not Mapped)' : get990Label(key)

      // Group header
      rows.push({
        label: lineLabel,
        total: 0,
        program: 0,
        admin: 0,
        fundraising: 0,
        unallocated: 0,
        isGroupHeader: true,
      })

      let groupTotal = 0
      let groupProgram = 0
      let groupAdmin = 0
      let groupFundraising = 0
      let groupUnallocated = 0

      for (const acct of groupAccounts) {
        rows.push({
          label: `${acct.accountCode} — ${acct.accountName}`,
          accountId: acct.accountId,
          total: acct.total,
          program: acct.program,
          admin: acct.admin,
          fundraising: acct.fundraising,
          unallocated: acct.unallocated,
        })
        groupTotal += acct.total
        groupProgram += acct.program
        groupAdmin += acct.admin
        groupFundraising += acct.fundraising
        groupUnallocated += acct.unallocated
      }

      // Group total row
      rows.push({
        label: `Total ${lineLabel}`,
        total: groupTotal,
        program: groupProgram,
        admin: groupAdmin,
        fundraising: groupFundraising,
        unallocated: groupUnallocated,
        isTotal: true,
      })
    }
  }

  // Grand totals
  const totals = {
    total: accountRows.reduce((s, r) => s + r.total, 0),
    program: accountRows.reduce((s, r) => s + r.program, 0),
    admin: accountRows.reduce((s, r) => s + r.admin, 0),
    fundraising: accountRows.reduce((s, r) => s + r.fundraising, 0),
    unallocated: accountRows.reduce((s, r) => s + r.unallocated, 0),
  }

  const hasUnallocated = totals.unallocated !== 0

  // Fund name lookup
  let fundName: string | null = null
  if (fundId) {
    const fundRows = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, fundId))
      .limit(1)
    if (fundRows.length > 0) {
      fundName = fundRows[0].name
    }
  }

  return {
    startDate,
    endDate,
    format,
    rows,
    totals,
    hasUnallocated,
    fundName,
  }
}

// ---------------------------------------------------------------------------
// Multi-period functional expenses
// ---------------------------------------------------------------------------

import { generatePeriodColumns, type PeriodColumn } from './activities'

export interface MultiPeriodFunctionalExpenseRow {
  label: string
  accountId?: number
  /** Per-period totals (sum of program+admin+fundraising+unallocated) */
  periodValues: number[]
  total: number
  /** Per-period program amounts */
  programValues: number[]
  programTotal: number
  adminValues: number[]
  adminTotal: number
  fundraisingValues: number[]
  fundraisingTotal: number
  unallocatedValues: number[]
  unallocatedTotal: number
  isGroupHeader?: boolean
  isTotal?: boolean
}

export interface MultiPeriodFunctionalExpensesData {
  periodColumns: PeriodColumn[]
  format: FunctionalExpenseFormat
  rows: MultiPeriodFunctionalExpenseRow[]
  totals: {
    periodValues: number[]
    total: number
    programValues: number[]
    programTotal: number
    adminValues: number[]
    adminTotal: number
    fundraisingValues: number[]
    fundraisingTotal: number
    unallocatedValues: number[]
    unallocatedTotal: number
  }
  hasUnallocated: boolean
  fundName: string | null
}

export async function getMultiPeriodFunctionalExpenses(
  filters: FunctionalExpensesFilters & { periodType: 'monthly' | 'quarterly' | 'annual' }
): Promise<MultiPeriodFunctionalExpensesData> {
  const { startDate, endDate, fundId, format = 'gaap', periodType } = filters
  const periodColumns = generatePeriodColumns(startDate, endDate, periodType)

  const periodResults = await Promise.all(
    periodColumns.map((col) =>
      getFunctionalExpensesData({ startDate: col.startDate, endDate: col.endDate, fundId, format })
    )
  )

  const fundName = periodResults[0]?.fundName ?? null
  const hasUnallocated = periodResults.some((r) => r.hasUnallocated)

  // Build unified row list (preserving group headers and order from first period)
  const labelOrder: { label: string; accountId?: number; isGroupHeader?: boolean; isTotal?: boolean }[] = []
  const labelSet = new Set<string>()

  for (const result of periodResults) {
    for (const row of result.rows) {
      const key = row.isGroupHeader ? `__group__${row.label}` : row.label
      if (!labelSet.has(key)) {
        labelSet.add(key)
        labelOrder.push({ label: row.label, accountId: row.accountId, isGroupHeader: row.isGroupHeader, isTotal: row.isTotal })
      }
    }
  }

  const rows: MultiPeriodFunctionalExpenseRow[] = labelOrder.map((meta) => {
    if (meta.isGroupHeader) {
      return {
        label: meta.label,
        isGroupHeader: true,
        periodValues: [],
        total: 0,
        programValues: [],
        programTotal: 0,
        adminValues: [],
        adminTotal: 0,
        fundraisingValues: [],
        fundraisingTotal: 0,
        unallocatedValues: [],
        unallocatedTotal: 0,
      }
    }

    const periodValues = periodResults.map((r) => {
      const match = r.rows.find((row) => row.label === meta.label && !row.isGroupHeader)
      return match?.total ?? 0
    })
    const programValues = periodResults.map((r) => r.rows.find((row) => row.label === meta.label && !row.isGroupHeader)?.program ?? 0)
    const adminValues = periodResults.map((r) => r.rows.find((row) => row.label === meta.label && !row.isGroupHeader)?.admin ?? 0)
    const fundraisingValues = periodResults.map((r) => r.rows.find((row) => row.label === meta.label && !row.isGroupHeader)?.fundraising ?? 0)
    const unallocatedValues = periodResults.map((r) => r.rows.find((row) => row.label === meta.label && !row.isGroupHeader)?.unallocated ?? 0)

    return {
      label: meta.label,
      accountId: meta.accountId,
      isTotal: meta.isTotal,
      periodValues,
      total: periodValues.reduce((s, v) => s + v, 0),
      programValues,
      programTotal: programValues.reduce((s, v) => s + v, 0),
      adminValues,
      adminTotal: adminValues.reduce((s, v) => s + v, 0),
      fundraisingValues,
      fundraisingTotal: fundraisingValues.reduce((s, v) => s + v, 0),
      unallocatedValues,
      unallocatedTotal: unallocatedValues.reduce((s, v) => s + v, 0),
    }
  })

  const totals = {
    periodValues: periodResults.map((r) => r.totals.total),
    total: periodResults.reduce((s, r) => s + r.totals.total, 0),
    programValues: periodResults.map((r) => r.totals.program),
    programTotal: periodResults.reduce((s, r) => s + r.totals.program, 0),
    adminValues: periodResults.map((r) => r.totals.admin),
    adminTotal: periodResults.reduce((s, r) => s + r.totals.admin, 0),
    fundraisingValues: periodResults.map((r) => r.totals.fundraising),
    fundraisingTotal: periodResults.reduce((s, r) => s + r.totals.fundraising, 0),
    unallocatedValues: periodResults.map((r) => r.totals.unallocated),
    unallocatedTotal: periodResults.reduce((s, r) => s + r.totals.unallocated, 0),
  }

  return { periodColumns, format: format as FunctionalExpenseFormat, rows, totals, hasUnallocated, fundName }
}
