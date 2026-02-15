import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the database module.
// The functional expenses report makes these sequential db.select() calls:
//   0 — expenseRows (accounts with debit/credit totals)
//   1 — allocations (functional allocation percentages)
//   2 — fund name lookup (only when fundId provided)
// ---------------------------------------------------------------------------

function createQueryChain(resolvedValue: unknown = []) {
  const chain: Record<string, unknown> = {}
  const methods = [
    'select',
    'from',
    'innerJoin',
    'leftJoin',
    'where',
    'groupBy',
    'orderBy',
    'limit',
  ]
  for (const m of methods) {
    chain[m] = vi.fn().mockReturnValue(chain)
  }
  chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
  return chain
}

let selectCallIndex: number
let selectResults: unknown[][]

const mockSelect = vi.fn().mockImplementation(() => {
  const idx = selectCallIndex++
  const data = selectResults[idx] ?? []
  return createQueryChain(data)
})

vi.mock('@/lib/db', () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}))

// Import the function under test after mocks
import { getFunctionalExpensesData } from './functional-expenses'
import type { FunctionalExpensesData, FunctionalExpenseRow } from './functional-expenses'

// ---------------------------------------------------------------------------
// Mock row shapes
// ---------------------------------------------------------------------------

interface MockExpenseRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  form990Line: string | null
  totalDebit: string
  totalCredit: string
}

interface MockAllocation {
  accountId: number
  programPct: string
  adminPct: string
  fundraisingPct: string
}

function makeExpenseRow(overrides: Partial<MockExpenseRow> = {}): MockExpenseRow {
  return {
    accountId: 1,
    accountCode: '5000',
    accountName: 'Salaries',
    subType: 'Payroll',
    form990Line: '7',
    totalDebit: '0',
    totalCredit: '0',
    ...overrides,
  }
}

function makeAllocation(overrides: Partial<MockAllocation> = {}): MockAllocation {
  return {
    accountId: 1,
    programPct: '70.00',
    adminPct: '20.00',
    fundraisingPct: '10.00',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('getFunctionalExpensesData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    selectResults = []
  })

  /**
   * Configure the 2 or 3 sequential db.select() calls:
   *   0 — expenseRows
   *   1 — allocations
   *   2 — fund name lookup (only when fundId provided)
   */
  function setDbResults(
    expenseRows: MockExpenseRow[],
    allocations: MockAllocation[],
    fundRows: unknown[] = []
  ) {
    selectResults = [expenseRows, allocations, fundRows]
  }

  // ---- Structure tests ---------------------------------------------------

  it('returns correct top-level structure', async () => {
    setDbResults([], [])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result).toMatchObject({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: 'gaap',
      rows: [],
      totals: {
        total: 0,
        program: 0,
        admin: 0,
        fundraising: 0,
        unallocated: 0,
      },
      hasUnallocated: false,
      fundName: null,
    })
  })

  // ---- GAAP format: group by natural classification (subType) ---------------

  it('GAAP format groups by natural classification (subType)', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5200',
        accountName: 'Maintenance',
        subType: 'Property Ops',
        totalDebit: '3000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 3,
        accountCode: '5300',
        accountName: 'Depreciation',
        subType: 'Non-Cash',
        totalDebit: '5000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '80.00', adminPct: '15.00', fundraisingPct: '5.00' }),
      makeAllocation({ accountId: 2, programPct: '90.00', adminPct: '10.00', fundraisingPct: '0.00' }),
      makeAllocation({ accountId: 3, programPct: '75.00', adminPct: '25.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: 'gaap',
    })

    // Should have 3 groups: Payroll, Property Ops, Non-Cash
    // Each group has: header + account rows + total row
    const headerRows = result.rows.filter((r) => r.isGroupHeader)
    const totalRows = result.rows.filter((r) => r.isTotal)
    expect(headerRows).toHaveLength(3)
    expect(totalRows).toHaveLength(3)

    const groupLabels = headerRows.map((r) => r.label)
    expect(groupLabels).toContain('Payroll')
    expect(groupLabels).toContain('Property Ops')
    expect(groupLabels).toContain('Non-Cash')
  })

  it('GAAP format classifies subTypes correctly via keyword matching', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 10,
        accountCode: '5400',
        accountName: 'Office Supplies',
        subType: 'Office Supplies',
        totalDebit: '1000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 11,
        accountCode: '5500',
        accountName: 'Interest Expense',
        subType: 'Interest',
        totalDebit: '2000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 12,
        accountCode: '5600',
        accountName: 'Insurance',
        subType: 'Insurance',
        totalDebit: '3000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 10, programPct: '50.00', adminPct: '50.00', fundraisingPct: '0.00' }),
      makeAllocation({ accountId: 11, programPct: '0.00', adminPct: '100.00', fundraisingPct: '0.00' }),
      makeAllocation({ accountId: 12, programPct: '90.00', adminPct: '10.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: 'gaap',
    })

    const headerLabels = result.rows.filter((r) => r.isGroupHeader).map((r) => r.label)
    // "Office Supplies" → Operating, "Interest" → Financial, "Insurance" → Property Ops
    expect(headerLabels).toContain('Operating')
    expect(headerLabels).toContain('Financial')
    expect(headerLabels).toContain('Property Ops')
  })

  // ---- 990 format: group by form990Line -------------------------------------

  it('990 format groups by form990Line', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        form990Line: '7',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5100',
        accountName: 'Benefits',
        subType: 'Payroll',
        form990Line: '9',
        totalDebit: '3000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 3,
        accountCode: '5500',
        accountName: 'Occupancy',
        subType: 'Property Ops',
        form990Line: '16a',
        totalDebit: '5000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '70.00', adminPct: '20.00', fundraisingPct: '10.00' }),
      makeAllocation({ accountId: 2, programPct: '70.00', adminPct: '20.00', fundraisingPct: '10.00' }),
      makeAllocation({ accountId: 3, programPct: '80.00', adminPct: '20.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: '990',
    })

    expect(result.format).toBe('990')

    const headerLabels = result.rows.filter((r) => r.isGroupHeader).map((r) => r.label)
    expect(headerLabels).toHaveLength(3)
    // Line 7, Line 9, Line 16a
    expect(headerLabels.some((l) => l.includes('Line 7'))).toBe(true)
    expect(headerLabels.some((l) => l.includes('Line 9'))).toBe(true)
    expect(headerLabels.some((l) => l.includes('Line 16a'))).toBe(true)
  })

  it('990 format puts unmapped accounts into "Other Expenses (Not Mapped)"', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5900',
        accountName: 'Misc Expense',
        subType: 'Other',
        form990Line: null,
        totalDebit: '500',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: '990',
    })

    const headerLabels = result.rows.filter((r) => r.isGroupHeader).map((r) => r.label)
    expect(headerLabels).toContain('Other Expenses (Not Mapped)')
  })

  // ---- Allocation splits ---------------------------------------------------

  it('splits expense total into program/admin/fundraising using allocation percentages', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        totalDebit: '10000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({
        accountId: 1,
        programPct: '70.00',
        adminPct: '20.00',
        fundraisingPct: '10.00',
      }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // Find the account row (not header, not total)
    const accountRow = result.rows.find(
      (r) => !r.isGroupHeader && !r.isTotal && r.accountId === 1
    )
    expect(accountRow).toBeDefined()
    expect(accountRow!.total).toBe(10000)
    expect(accountRow!.program).toBe(7000)      // 10000 * 70%
    expect(accountRow!.admin).toBe(2000)         // 10000 * 20%
    expect(accountRow!.fundraising).toBe(1000)   // 10000 * 10%
    expect(accountRow!.unallocated).toBe(0)
  })

  it('allocation percentages summing to 100% distribute the full total', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 5,
        accountCode: '5050',
        accountName: 'Test Expense',
        totalDebit: '12000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({
        accountId: 5,
        programPct: '60.00',
        adminPct: '30.00',
        fundraisingPct: '10.00',
      }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const accountRow = result.rows.find((r) => r.accountId === 5)
    expect(accountRow).toBeDefined()
    // program + admin + fundraising should equal total
    const sum = accountRow!.program + accountRow!.admin + accountRow!.fundraising
    expect(sum).toBeCloseTo(accountRow!.total, 2)
    expect(accountRow!.unallocated).toBe(0)
  })

  // ---- Unallocated expenses ------------------------------------------------

  it('flags unallocated when no allocation defined for an account', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 99,
        accountCode: '5999',
        accountName: 'New Expense',
        totalDebit: '2500',
        totalCredit: '0',
      }),
    ]
    // No allocations for accountId 99
    setDbResults(expenses, [])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.hasUnallocated).toBe(true)
    expect(result.totals.unallocated).toBe(2500)

    const accountRow = result.rows.find((r) => r.accountId === 99)
    expect(accountRow).toBeDefined()
    expect(accountRow!.program).toBe(0)
    expect(accountRow!.admin).toBe(0)
    expect(accountRow!.fundraising).toBe(0)
    expect(accountRow!.unallocated).toBe(2500)
  })

  it('hasUnallocated is false when all expenses are allocated', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        totalDebit: '5000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1 }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.hasUnallocated).toBe(false)
    expect(result.totals.unallocated).toBe(0)
  })

  // ---- Grand totals --------------------------------------------------------

  it('totals match sum of individual account rows', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5200',
        accountName: 'Maintenance',
        subType: 'Property Ops',
        totalDebit: '3000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 3,
        accountCode: '5900',
        accountName: 'Unallocated Misc',
        subType: 'Other',
        totalDebit: '500',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '70.00', adminPct: '20.00', fundraisingPct: '10.00' }),
      makeAllocation({ accountId: 2, programPct: '90.00', adminPct: '10.00', fundraisingPct: '0.00' }),
      // No allocation for accountId 3 — will be unallocated
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // Total: 10000 + 3000 + 500 = 13500
    expect(result.totals.total).toBe(13500)

    // Program: (10000*70%) + (3000*90%) + 0 = 7000 + 2700 = 9700
    expect(result.totals.program).toBe(9700)

    // Admin: (10000*20%) + (3000*10%) + 0 = 2000 + 300 = 2300
    expect(result.totals.admin).toBe(2300)

    // Fundraising: (10000*10%) + 0 + 0 = 1000
    expect(result.totals.fundraising).toBe(1000)

    // Unallocated: 500
    expect(result.totals.unallocated).toBe(500)

    // Verify: program + admin + fundraising + unallocated = total
    const sum =
      result.totals.program +
      result.totals.admin +
      result.totals.fundraising +
      result.totals.unallocated
    expect(sum).toBeCloseTo(result.totals.total, 2)
  })

  // ---- Expense balance calculation -----------------------------------------

  it('calculates expense total as debits - credits (debit-normal)', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        totalDebit: '8000',
        totalCredit: '500', // refunds/adjustments
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // total = 8000 - 500 = 7500
    expect(result.totals.total).toBe(7500)
    expect(result.totals.program).toBe(7500)
  })

  // ---- Zero balance rows excluded ------------------------------------------

  it('excludes rows with zero net balance', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Reversed Expense',
        totalDebit: '3000',
        totalCredit: '3000', // fully reversed
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5100',
        accountName: 'Real Expense',
        totalDebit: '5000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1 }),
      makeAllocation({ accountId: 2 }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const accountRows = result.rows.filter(
      (r) => !r.isGroupHeader && !r.isTotal && r.accountId
    )
    expect(accountRows).toHaveLength(1)
    expect(accountRows[0].accountId).toBe(2)
    expect(result.totals.total).toBe(5000)
  })

  // ---- Empty data ----------------------------------------------------------

  it('returns zeros and empty rows for empty data', async () => {
    setDbResults([], [])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.rows).toHaveLength(0)
    expect(result.totals.total).toBe(0)
    expect(result.totals.program).toBe(0)
    expect(result.totals.admin).toBe(0)
    expect(result.totals.fundraising).toBe(0)
    expect(result.totals.unallocated).toBe(0)
    expect(result.hasUnallocated).toBe(false)
  })

  // ---- Fund filter ---------------------------------------------------------

  it('returns fund name when fundId is provided', async () => {
    setDbResults([], [], [{ name: 'Housing Fund' }])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      fundId: 1,
    })

    expect(result.fundName).toBe('Housing Fund')
  })

  it('returns null fundName when no fundId', async () => {
    setDbResults([], [])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.fundName).toBeNull()
  })

  // ---- Default format is GAAP -----------------------------------------------

  it('defaults to GAAP format when format not specified', async () => {
    setDbResults([], [])

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.format).toBe('gaap')
  })

  // ---- GAAP group structure: header → account rows → total -----------------

  it('GAAP groups have header, account rows, and total in correct order', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        totalDebit: '8000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5010',
        accountName: 'Benefits',
        subType: 'Payroll',
        totalDebit: '2000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '80.00', adminPct: '15.00', fundraisingPct: '5.00' }),
      makeAllocation({ accountId: 2, programPct: '80.00', adminPct: '15.00', fundraisingPct: '5.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: 'gaap',
    })

    // Should be: header, row1, row2, total = 4 rows total
    expect(result.rows).toHaveLength(4)
    expect(result.rows[0].isGroupHeader).toBe(true)
    expect(result.rows[0].label).toBe('Payroll')
    expect(result.rows[1].accountId).toBe(1)
    expect(result.rows[2].accountId).toBe(2)
    expect(result.rows[3].isTotal).toBe(true)
    expect(result.rows[3].label).toBe('Total Payroll')

    // Group total should sum the account rows
    expect(result.rows[3].total).toBe(10000)    // 8000 + 2000
    expect(result.rows[3].program).toBe(8000)   // 10000 * 80%
    expect(result.rows[3].admin).toBe(1500)      // 10000 * 15%
    expect(result.rows[3].fundraising).toBe(500) // 10000 * 5%
  })

  // ---- Multiple groups sorted by GAAP_GROUP_ORDER ---------------------------

  it('GAAP groups appear in the standard natural classification order', async () => {
    // Provide expenses in reverse order to verify sorting
    const expenses = [
      makeExpenseRow({
        accountId: 3,
        accountCode: '5800',
        accountName: 'Misc',
        subType: 'Weird Category',
        totalDebit: '100',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5300',
        accountName: 'Depreciation Expense',
        subType: 'Depreciation',
        totalDebit: '200',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Wages',
        subType: 'Wages',
        totalDebit: '300',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00' }),
      makeAllocation({ accountId: 2, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00' }),
      makeAllocation({ accountId: 3, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      format: 'gaap',
    })

    const headerLabels = result.rows
      .filter((r) => r.isGroupHeader)
      .map((r) => r.label)

    // Expected order: Payroll → Non-Cash → Other
    // "Wages" → Payroll, "Depreciation" → Non-Cash, "Weird Category" → Other
    expect(headerLabels).toEqual(['Payroll', 'Non-Cash', 'Other'])
  })

  // ---- Row labels include account code --------------------------------------

  it('row labels include account code and name', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        totalDebit: '1000',
        totalCredit: '0',
      }),
    ]
    const allocs = [
      makeAllocation({ accountId: 1 }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const accountRow = result.rows.find((r) => r.accountId === 1)
    expect(accountRow).toBeDefined()
    expect(accountRow!.label).toContain('5000')
    expect(accountRow!.label).toContain('Salaries')
    // Label format: "5000 — Salaries"
    expect(accountRow!.label).toBe('5000 — Salaries')
  })

  // ---- Dates pass through ---------------------------------------------------

  it('passes dates through to the result', async () => {
    setDbResults([], [])

    const result = await getFunctionalExpensesData({
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    })

    expect(result.startDate).toBe('2025-07-01')
    expect(result.endDate).toBe('2025-12-31')
  })

  // ---- Mixed allocated and unallocated rows --------------------------------

  it('handles mix of allocated and unallocated accounts', async () => {
    const expenses = [
      makeExpenseRow({
        accountId: 1,
        accountCode: '5000',
        accountName: 'Salaries',
        subType: 'Payroll',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeExpenseRow({
        accountId: 2,
        accountCode: '5100',
        accountName: 'New Account',
        subType: 'Payroll',
        totalDebit: '2000',
        totalCredit: '0',
      }),
    ]
    // Only accountId 1 has an allocation
    const allocs = [
      makeAllocation({ accountId: 1, programPct: '60.00', adminPct: '30.00', fundraisingPct: '10.00' }),
    ]
    setDbResults(expenses, allocs)

    const result = await getFunctionalExpensesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.hasUnallocated).toBe(true)
    expect(result.totals.total).toBe(12000)
    expect(result.totals.unallocated).toBe(2000) // accountId 2 unallocated
    // accountId 1: program=6000, admin=3000, fundraising=1000
    expect(result.totals.program).toBe(6000)
    expect(result.totals.admin).toBe(3000)
    expect(result.totals.fundraising).toBe(1000)
  })
})
