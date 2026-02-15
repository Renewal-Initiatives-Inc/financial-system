import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the database module.
// The activities report makes multiple sequential db.select() calls:
//   0 — fund name lookup (only when fundId provided)
//   1 — approved budget lookup
//   2 — budget lines (only if approved budget found)
//   3 — actuals: revenue/expense rows with CP and YTD
//   4 — net asset releases
//   5 — budget-only accounts (only if approved budget found)
//
// We track calls and return the correct data for each invocation.
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

// Mock the calculateVariance function since it's imported from budget/variance
vi.mock('@/lib/budget/variance', () => ({
  calculateVariance: (actual: number, budget: number) => {
    const dollarVariance = actual - budget
    const percentVariance = budget !== 0 ? (dollarVariance / budget) * 100 : null
    let severity: 'normal' | 'warning' | 'critical' = 'normal'
    if (percentVariance !== null) {
      const absPercent = Math.abs(percentVariance)
      if (absPercent > 25) severity = 'critical'
      else if (absPercent > 10) severity = 'warning'
    }
    return { dollarVariance, percentVariance, severity }
  },
}))

// Import the function under test after mocks
import { getActivitiesData } from './activities'
import type { ActivitiesData } from './activities'

// ---------------------------------------------------------------------------
// Mock row shapes matching what the DB queries return
// ---------------------------------------------------------------------------

interface MockActualsRow {
  accountId: number
  accountCode: string
  accountName: string
  accountType: string
  subType: string | null
  normalBalance: string
  cpDebit: string
  cpCredit: string
  ytdDebit: string
  ytdCredit: string
}

function makeActualsRow(overrides: Partial<MockActualsRow> = {}): MockActualsRow {
  return {
    accountId: 1,
    accountCode: '4000',
    accountName: 'Rental Income',
    accountType: 'REVENUE',
    subType: 'Operating Revenue',
    normalBalance: 'CREDIT',
    cpDebit: '0',
    cpCredit: '0',
    ytdDebit: '0',
    ytdCredit: '0',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('getActivitiesData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    selectResults = []
  })

  /**
   * Configure db results for the standard case (no fundId, no approved budget).
   * Call order without fundId and no approved budget:
   *   0 — approved budget lookup → []: no budget
   *   1 — actuals rows
   *   2 — net asset releases
   */
  function setDbResultsNoBudget(
    actualsRows: MockActualsRow[],
    releaseResult: unknown[] = [{ cpAmount: '0', ytdAmount: '0' }]
  ) {
    selectResults = [
      // 0: approved budget lookup → empty (destructured as [approvedBudget])
      [],
      // 1: actuals query
      actualsRows,
      // 2: net asset releases
      releaseResult,
    ]
  }

  /**
   * Configure for a case with fundId (adds a fund lookup call at index 0).
   */
  function setDbResultsWithFund(
    fundName: string | null,
    actualsRows: MockActualsRow[],
    releaseResult: unknown[] = [{ cpAmount: '0', ytdAmount: '0' }]
  ) {
    selectResults = [
      // 0: fund name lookup
      fundName ? [{ name: fundName }] : [],
      // 1: approved budget lookup
      [],
      // 2: actuals
      actualsRows,
      // 3: net asset releases
      releaseResult,
    ]
  }

  // ---- Structure tests ---------------------------------------------------

  it('returns correct top-level structure', async () => {
    setDbResultsNoBudget([])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result).toHaveProperty('startDate', '2026-01-01')
    expect(result).toHaveProperty('endDate', '2026-01-31')
    expect(result).toHaveProperty('revenueSections')
    expect(result).toHaveProperty('totalRevenue')
    expect(result).toHaveProperty('expenseSections')
    expect(result).toHaveProperty('totalExpenses')
    expect(result).toHaveProperty('netAssetReleases')
    expect(result).toHaveProperty('changeInNetAssets')
    expect(result).toHaveProperty('fundName')
    expect(Array.isArray(result.revenueSections)).toBe(true)
    expect(Array.isArray(result.expenseSections)).toBe(true)
  })

  it('returns revenue and expense sections', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountName: 'Rental Income',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '10000',
        ytdCredit: '10000',
      }),
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountName: 'Salaries',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '6000',
        ytdDebit: '6000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.revenueSections.length).toBeGreaterThan(0)
    expect(result.expenseSections.length).toBeGreaterThan(0)
  })

  // ---- Balance calculation tests -----------------------------------------

  it('revenue (credit-normal): balance = credits - debits', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpDebit: '500',
        cpCredit: '12000',
        ytdDebit: '1000',
        ytdCredit: '24000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const revenueRow = result.revenueSections[0]?.rows[0]
    expect(revenueRow).toBeDefined()
    // currentPeriod: 12000 - 500 = 11500
    expect(revenueRow!.currentPeriod).toBe(11500)
    // yearToDate: 24000 - 1000 = 23000
    expect(revenueRow!.yearToDate).toBe(23000)
  })

  it('expense (debit-normal): balance = debits - credits', async () => {
    const rows = [
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '8000',
        cpCredit: '200',
        ytdDebit: '16000',
        ytdCredit: '400',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const expenseRow = result.expenseSections[0]?.rows[0]
    expect(expenseRow).toBeDefined()
    // currentPeriod: 8000 - 200 = 7800
    expect(expenseRow!.currentPeriod).toBe(7800)
    // yearToDate: 16000 - 400 = 15600
    expect(expenseRow!.yearToDate).toBe(15600)
  })

  // ---- Change in net assets -----------------------------------------------

  it('change in net assets = total revenue - total expenses + net asset releases', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '50000',
        ytdCredit: '50000',
      }),
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '30000',
        ytdDebit: '30000',
      }),
    ]
    setDbResultsNoBudget(rows, [{ cpAmount: '2000', ytdAmount: '2000' }])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // Revenue: 50000, Expense: 30000, Releases: 2000
    // Change = 50000 - 30000 + 2000 = 22000
    expect(result.changeInNetAssets.currentPeriod).toBe(22000)
    expect(result.changeInNetAssets.yearToDate).toBe(22000)
  })

  it('change in net assets with zero releases', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '20000',
        ytdCredit: '20000',
      }),
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '15000',
        ytdDebit: '15000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // Change = 20000 - 15000 + 0 = 5000
    expect(result.changeInNetAssets.currentPeriod).toBe(5000)
  })

  // ---- Section grouping by subType -----------------------------------------

  it('groups revenue rows by subType sections', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '10000',
        ytdCredit: '10000',
      }),
      makeActualsRow({
        accountId: 2,
        accountCode: '4100',
        accountName: 'Grant Revenue',
        accountType: 'REVENUE',
        subType: 'Restricted Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '5000',
        ytdCredit: '5000',
      }),
      makeActualsRow({
        accountId: 3,
        accountCode: '4200',
        accountName: 'Donation Income',
        accountType: 'REVENUE',
        subType: 'Contributions',
        normalBalance: 'CREDIT',
        cpCredit: '2000',
        ytdCredit: '2000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.revenueSections).toHaveLength(3)

    const sectionTitles = result.revenueSections.map((s) => s.title)
    expect(sectionTitles).toContain('Operating Revenue')
    expect(sectionTitles).toContain('Restricted Revenue')
    expect(sectionTitles).toContain('Contributions')
  })

  it('groups expense rows by subType sections', async () => {
    const rows = [
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '8000',
        ytdDebit: '8000',
      }),
      makeActualsRow({
        accountId: 11,
        accountCode: '5100',
        accountName: 'Maintenance',
        accountType: 'EXPENSE',
        subType: 'Property Ops',
        normalBalance: 'DEBIT',
        cpDebit: '3000',
        ytdDebit: '3000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.expenseSections).toHaveLength(2)

    const sectionTitles = result.expenseSections.map((s) => s.title)
    expect(sectionTitles).toContain('Payroll & Benefits')
    expect(sectionTitles).toContain('Property Operations')
  })

  it('puts unrecognized subTypes into "Other" section', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4500',
        accountName: 'Miscellaneous Revenue',
        accountType: 'REVENUE',
        subType: 'SomeUnknownType',
        normalBalance: 'CREDIT',
        cpCredit: '1000',
        ytdCredit: '1000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.revenueSections).toHaveLength(1)
    expect(result.revenueSections[0].title).toBe('Other Revenue')
  })

  // ---- Fund filter -------------------------------------------------------

  it('looks up fund name when fundId is provided', async () => {
    setDbResultsWithFund('Housing Fund', [])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      fundId: 2,
    })

    expect(result.fundName).toBe('Housing Fund')
  })

  it('returns null fundName when no fundId', async () => {
    setDbResultsNoBudget([])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.fundName).toBeNull()
  })

  // ---- Empty data --------------------------------------------------------

  it('returns zeros for empty data', async () => {
    setDbResultsNoBudget([])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.totalRevenue.currentPeriod).toBe(0)
    expect(result.totalRevenue.yearToDate).toBe(0)
    expect(result.totalExpenses.currentPeriod).toBe(0)
    expect(result.totalExpenses.yearToDate).toBe(0)
    expect(result.changeInNetAssets.currentPeriod).toBe(0)
    expect(result.changeInNetAssets.yearToDate).toBe(0)
    expect(result.revenueSections).toHaveLength(0)
    expect(result.expenseSections).toHaveLength(0)
  })

  // ---- Section totals aggregate row balances --------------------------------

  it('section totals sum the row amounts correctly', async () => {
    const rows = [
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountName: 'Salaries',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '8000',
        cpCredit: '0',
        ytdDebit: '16000',
        ytdCredit: '0',
      }),
      makeActualsRow({
        accountId: 11,
        accountCode: '5010',
        accountName: 'Benefits',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '2000',
        cpCredit: '0',
        ytdDebit: '4000',
        ytdCredit: '0',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    // One section: Payroll & Benefits
    expect(result.expenseSections).toHaveLength(1)
    const payrollSection = result.expenseSections[0]
    expect(payrollSection.total.currentPeriod).toBe(10000) // 8000 + 2000
    expect(payrollSection.total.yearToDate).toBe(20000)    // 16000 + 4000
    expect(payrollSection.rows).toHaveLength(2)
  })

  // ---- Total revenue / total expenses aggregation -------------------------

  it('totalRevenue and totalExpenses aggregate across sections', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '10000',
        ytdCredit: '20000',
      }),
      makeActualsRow({
        accountId: 2,
        accountCode: '4100',
        accountType: 'REVENUE',
        subType: 'Contributions',
        normalBalance: 'CREDIT',
        cpCredit: '5000',
        ytdCredit: '8000',
      }),
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '6000',
        ytdDebit: '12000',
      }),
      makeActualsRow({
        accountId: 11,
        accountCode: '5100',
        accountType: 'EXPENSE',
        subType: 'Property Ops',
        normalBalance: 'DEBIT',
        cpDebit: '3000',
        ytdDebit: '6000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.totalRevenue.currentPeriod).toBe(15000)  // 10000 + 5000
    expect(result.totalRevenue.yearToDate).toBe(28000)     // 20000 + 8000
    expect(result.totalExpenses.currentPeriod).toBe(9000)  // 6000 + 3000
    expect(result.totalExpenses.yearToDate).toBe(18000)    // 12000 + 6000
  })

  // ---- Revenue/expense with mixed debits and credits ---------------------

  it('handles revenue with both debits and credits (returns/adjustments)', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpDebit: '2000',   // returns
        cpCredit: '15000',
        ytdDebit: '3000',
        ytdCredit: '30000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    const row = result.revenueSections[0]?.rows[0]
    // CP: 15000 - 2000 = 13000
    expect(row!.currentPeriod).toBe(13000)
    // YTD: 30000 - 3000 = 27000
    expect(row!.yearToDate).toBe(27000)
  })

  // ---- Budget is null when no approved budget found -----------------------

  it('sets budget to null when no approved budget exists', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '10000',
        ytdCredit: '10000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.totalRevenue.budget).toBeNull()
    expect(result.totalExpenses.budget).toBeNull()
    expect(result.changeInNetAssets.budget).toBeNull()
    // Individual row should have null budget/variance
    const row = result.revenueSections[0]?.rows[0]
    expect(row!.budget).toBeNull()
    expect(row!.variance).toBeNull()
  })

  // ---- Net asset releases are included in change calculation ---------------

  it('includes net asset releases in changeInNetAssets', async () => {
    const rows = [
      makeActualsRow({
        accountId: 1,
        accountCode: '4000',
        accountType: 'REVENUE',
        subType: 'Operating Revenue',
        normalBalance: 'CREDIT',
        cpCredit: '10000',
        ytdCredit: '30000',
      }),
      makeActualsRow({
        accountId: 10,
        accountCode: '5000',
        accountType: 'EXPENSE',
        subType: 'Payroll',
        normalBalance: 'DEBIT',
        cpDebit: '7000',
        ytdDebit: '20000',
      }),
    ]

    setDbResultsNoBudget(rows, [{ cpAmount: '5000', ytdAmount: '12000' }])

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.netAssetReleases.currentPeriod).toBe(5000)
    expect(result.netAssetReleases.yearToDate).toBe(12000)
    // Change = (10000 - 7000 + 5000) = 8000 CP, (30000 - 20000 + 12000) = 22000 YTD
    expect(result.changeInNetAssets.currentPeriod).toBe(8000)
    expect(result.changeInNetAssets.yearToDate).toBe(22000)
  })

  // ---- Dates pass through correctly ----------------------------------------

  it('passes start and end dates through to the result', async () => {
    setDbResultsNoBudget([])

    const result = await getActivitiesData({
      startDate: '2025-07-01',
      endDate: '2025-12-31',
    })

    expect(result.startDate).toBe('2025-07-01')
    expect(result.endDate).toBe('2025-12-31')
  })

  // ---- Section title mapping -----------------------------------------------

  it('maps subType "Adjustment" to "Rent Adjustments"', async () => {
    const rows = [
      makeActualsRow({
        accountId: 5,
        accountCode: '4300',
        accountName: 'Rent Concessions',
        accountType: 'REVENUE',
        subType: 'Adjustment',
        normalBalance: 'CREDIT',
        cpCredit: '1000',
        ytdCredit: '1000',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.revenueSections[0].title).toBe('Rent Adjustments')
  })

  it('maps expense subType "Financial" to "Financial Expenses"', async () => {
    const rows = [
      makeActualsRow({
        accountId: 15,
        accountCode: '5500',
        accountName: 'Interest Expense',
        accountType: 'EXPENSE',
        subType: 'Financial',
        normalBalance: 'DEBIT',
        cpDebit: '500',
        ytdDebit: '500',
      }),
    ]
    setDbResultsNoBudget(rows)

    const result = await getActivitiesData({
      startDate: '2026-01-01',
      endDate: '2026-01-31',
    })

    expect(result.expenseSections[0].title).toBe('Financial Expenses')
  })
})
