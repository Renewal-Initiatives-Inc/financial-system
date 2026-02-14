import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  funds,
  functionalAllocations,
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
