import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mock the database module before importing the module under test.
// We build a chainable query builder that captures the calls and resolves
// with whatever `mockResolvedValueOnce` was set up.
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
  // The final thenable — Drizzle queries are awaitable
  chain.then = (resolve: (v: unknown) => void) => resolve(resolvedValue)
  return chain
}

// Keep track of successive select() results so each `await db.select()...`
// in the implementation resolves to the correct dataset.
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

// Now import the function under test — it will receive the mocked db.
import { getBalanceSheetData } from './balance-sheet'
import type { BalanceSheetData } from './balance-sheet'

// ---------------------------------------------------------------------------
// Helpers to build realistic mock row shapes
// ---------------------------------------------------------------------------

interface MockBalanceRow {
  accountId: number
  accountCode: string
  accountName: string
  accountType: string
  subType: string | null
  normalBalance: string
  totalDebit: string
  totalCredit: string
}

interface MockNetAssetRow {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  normalBalance: string
  restrictionType: string
  totalDebit: string
  totalCredit: string
}

interface MockRevenueExpenseRow {
  accountType: string
  normalBalance: string
  restrictionType: string
  totalDebit: string
  totalCredit: string
}

function makeBalanceRow(overrides: Partial<MockBalanceRow> = {}): MockBalanceRow {
  return {
    accountId: 1,
    accountCode: '1000',
    accountName: 'Cash',
    accountType: 'ASSET',
    subType: 'Cash',
    normalBalance: 'DEBIT',
    totalDebit: '0',
    totalCredit: '0',
    ...overrides,
  }
}

function makeNetAssetRow(overrides: Partial<MockNetAssetRow> = {}): MockNetAssetRow {
  return {
    accountId: 100,
    accountCode: '3000',
    accountName: 'Unrestricted Net Assets',
    subType: null,
    normalBalance: 'CREDIT',
    restrictionType: 'UNRESTRICTED',
    totalDebit: '0',
    totalCredit: '0',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('getBalanceSheetData', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    selectCallIndex = 0
    selectResults = []
  })

  /**
   * Helper: configure the sequential db.select() calls the function makes:
   *   0 — balanceRows (ASSET / LIABILITY aggregation)
   *   1 — netAssetRows (NET_ASSET by restriction)
   *   2 — revenueExpenseRows (REVENUE / EXPENSE roll-up)
   *   3 — fund name lookup (only when fundId provided)
   */
  function setDbResults(
    balanceRows: MockBalanceRow[],
    netAssetRows: MockNetAssetRow[],
    revenueExpenseRows: MockRevenueExpenseRow[],
    fundRows: unknown[] = []
  ) {
    selectResults = [balanceRows, netAssetRows, revenueExpenseRows, fundRows]
  }

  // ---- Structure tests ---------------------------------------------------

  it('returns correct structure with all sections', async () => {
    setDbResults([], [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result).toMatchObject({
      asOfDate: '2026-01-31',
      currentAssets: { title: 'Current Assets', rows: [], total: 0 },
      noncurrentAssets: { title: 'Noncurrent Assets', rows: [], total: 0 },
      totalAssets: 0,
      currentLiabilities: { title: 'Current Liabilities', rows: [], total: 0 },
      longTermLiabilities: { title: 'Long-Term Liabilities', rows: [], total: 0 },
      totalLiabilities: 0,
      netAssetsUnrestricted: { title: 'Without Donor Restrictions', rows: [], total: 0 },
      netAssetsRestricted: { title: 'With Donor Restrictions', rows: [], total: 0 },
      totalNetAssets: 0,
      totalLiabilitiesAndNetAssets: 0,
      fundName: null,
    })
  })

  // ---- Classification tests ----------------------------------------------

  it('classifies Cash subType as current asset', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 1,
        accountCode: '1000',
        accountName: 'Cash – Operating',
        accountType: 'ASSET',
        subType: 'Cash',
        normalBalance: 'DEBIT',
        totalDebit: '15000',
        totalCredit: '5000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentAssets.rows).toHaveLength(1)
    expect(result.currentAssets.rows[0].accountName).toBe('Cash – Operating')
    expect(result.noncurrentAssets.rows).toHaveLength(0)
  })

  it('classifies Fixed Asset subType as noncurrent asset', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 2,
        accountCode: '1500',
        accountName: 'Building',
        accountType: 'ASSET',
        subType: 'Fixed Asset',
        normalBalance: 'DEBIT',
        totalDebit: '500000',
        totalCredit: '0',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.noncurrentAssets.rows).toHaveLength(1)
    expect(result.noncurrentAssets.rows[0].accountName).toBe('Building')
    expect(result.currentAssets.rows).toHaveLength(0)
  })

  it('classifies Accounts Payable subType as current liability', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 10,
        accountCode: '2000',
        accountName: 'Accounts Payable',
        accountType: 'LIABILITY',
        subType: 'Accounts Payable',
        normalBalance: 'CREDIT',
        totalDebit: '1000',
        totalCredit: '5000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentLiabilities.rows).toHaveLength(1)
    expect(result.longTermLiabilities.rows).toHaveLength(0)
  })

  it('classifies Long-Term subType as long-term liability', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 11,
        accountCode: '2500',
        accountName: 'Loans Payable',
        accountType: 'LIABILITY',
        subType: 'Long-Term',
        normalBalance: 'CREDIT',
        totalDebit: '0',
        totalCredit: '200000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.longTermLiabilities.rows).toHaveLength(1)
    expect(result.longTermLiabilities.rows[0].balance).toBe(200000)
    expect(result.currentLiabilities.rows).toHaveLength(0)
  })

  it('classifies null-subType liability as current by default', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 12,
        accountCode: '2100',
        accountName: 'Misc Liability',
        accountType: 'LIABILITY',
        subType: null,
        normalBalance: 'CREDIT',
        totalDebit: '0',
        totalCredit: '3000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentLiabilities.rows).toHaveLength(1)
    expect(result.longTermLiabilities.rows).toHaveLength(0)
  })

  it('classifies null-subType asset by account code prefix', async () => {
    // Account code starting with "10" → current asset
    const currentRow = makeBalanceRow({
      accountId: 3,
      accountCode: '1010',
      accountName: 'Cash Equivalent',
      accountType: 'ASSET',
      subType: null,
      normalBalance: 'DEBIT',
      totalDebit: '8000',
      totalCredit: '0',
    })
    // Account code starting with "15" → noncurrent asset
    const noncurrentRow = makeBalanceRow({
      accountId: 4,
      accountCode: '1500',
      accountName: 'Other Asset',
      accountType: 'ASSET',
      subType: null,
      normalBalance: 'DEBIT',
      totalDebit: '5000',
      totalCredit: '0',
    })
    setDbResults([currentRow, noncurrentRow], [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentAssets.rows).toHaveLength(1)
    expect(result.currentAssets.rows[0].accountCode).toBe('1010')
    expect(result.noncurrentAssets.rows).toHaveLength(1)
    expect(result.noncurrentAssets.rows[0].accountCode).toBe('1500')
  })

  // ---- Balance calculation tests -----------------------------------------

  it('calculates debit-normal balance (debits - credits) for assets', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 1,
        accountType: 'ASSET',
        subType: 'Cash',
        normalBalance: 'DEBIT',
        totalDebit: '25000',
        totalCredit: '5000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentAssets.rows[0].balance).toBe(20000) // 25000 - 5000
  })

  it('calculates credit-normal balance (credits - debits) for liabilities', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 10,
        accountCode: '2000',
        accountType: 'LIABILITY',
        subType: 'Accounts Payable',
        normalBalance: 'CREDIT',
        totalDebit: '2000',
        totalCredit: '8000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentLiabilities.rows[0].balance).toBe(6000) // 8000 - 2000
  })

  // ---- Accounting equation -----------------------------------------------

  it('total assets = total liabilities + total net assets', async () => {
    // Assets: Cash 10000, Building 200000
    const balanceRows = [
      makeBalanceRow({
        accountId: 1,
        accountCode: '1000',
        accountType: 'ASSET',
        subType: 'Cash',
        normalBalance: 'DEBIT',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 2,
        accountCode: '1500',
        accountType: 'ASSET',
        subType: 'Fixed Asset',
        normalBalance: 'DEBIT',
        totalDebit: '200000',
        totalCredit: '0',
      }),
      // Liability: AP 5000
      makeBalanceRow({
        accountId: 10,
        accountCode: '2000',
        accountType: 'LIABILITY',
        subType: 'Accounts Payable',
        normalBalance: 'CREDIT',
        totalDebit: '0',
        totalCredit: '5000',
      }),
    ]

    // Net assets: unrestricted 205000 (= 210000 assets - 5000 liabilities)
    const netAssetRows = [
      makeNetAssetRow({
        accountId: 100,
        accountCode: '3000',
        normalBalance: 'CREDIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '0',
        totalCredit: '180000',
      }),
    ]

    // Revenue/Expense net effect: revenue 30000 - expense 5000 = 25000
    const revenueExpenseRows: MockRevenueExpenseRow[] = [
      {
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '0',
        totalCredit: '30000',
      },
      {
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '5000',
        totalCredit: '0',
      },
    ]

    setDbResults(balanceRows, netAssetRows, revenueExpenseRows)

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // Total assets = 10000 + 200000 = 210000
    expect(result.totalAssets).toBe(210000)
    // Total liabilities = 5000
    expect(result.totalLiabilities).toBe(5000)
    // Net assets: 180000 (base) + 25000 (change) = 205000
    expect(result.totalNetAssets).toBe(205000)
    // Accounting equation: 210000 = 5000 + 205000
    expect(result.totalLiabilitiesAndNetAssets).toBe(
      result.totalLiabilities + result.totalNetAssets
    )
    expect(result.totalAssets).toBe(result.totalLiabilitiesAndNetAssets)
  })

  // ---- Net asset restriction classification --------------------------------

  it('splits net assets into unrestricted and restricted', async () => {
    const netAssetRows = [
      makeNetAssetRow({
        accountId: 100,
        accountCode: '3000',
        accountName: 'Unrestricted Net Assets',
        normalBalance: 'CREDIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '0',
        totalCredit: '50000',
      }),
      makeNetAssetRow({
        accountId: 101,
        accountCode: '3100',
        accountName: 'Temp Restricted Net Assets',
        normalBalance: 'CREDIT',
        restrictionType: 'TEMPORARILY_RESTRICTED',
        totalDebit: '0',
        totalCredit: '15000',
      }),
    ]
    setDbResults([], netAssetRows, [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.netAssetsUnrestricted.rows).toHaveLength(1)
    expect(result.netAssetsUnrestricted.total).toBe(50000)
    expect(result.netAssetsRestricted.rows).toHaveLength(1)
    expect(result.netAssetsRestricted.total).toBe(15000)
    expect(result.totalNetAssets).toBe(65000)
  })

  // ---- Revenue/Expense roll-up to net assets --------------------------------

  it('rolls revenue and expense into net assets as Change in Net Assets', async () => {
    const revenueExpenseRows: MockRevenueExpenseRow[] = [
      {
        accountType: 'REVENUE',
        normalBalance: 'CREDIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '0',
        totalCredit: '100000',
      },
      {
        accountType: 'EXPENSE',
        normalBalance: 'DEBIT',
        restrictionType: 'UNRESTRICTED',
        totalDebit: '75000',
        totalCredit: '0',
      },
    ]
    setDbResults([], [], revenueExpenseRows)

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // Change in net assets = revenue (100000) - expense (75000) = 25000
    const changeRow = result.netAssetsUnrestricted.rows.find(
      (r) => r.accountName === 'Change in Retained Earnings'
    )
    expect(changeRow).toBeDefined()
    expect(changeRow!.balance).toBe(25000)
  })

  // ---- Fund filter -------------------------------------------------------

  it('passes fundId to WHERE conditions and looks up fund name', async () => {
    setDbResults([], [], [], [{ name: 'Operating Fund' }])

    const result = await getBalanceSheetData({
      endDate: '2026-01-31',
      fundId: 1,
    })

    expect(result.fundName).toBe('Operating Fund')
    // Verify db.select was called (4 calls: balanceRows, netAssets, revExp, fund)
    expect(mockSelect).toHaveBeenCalledTimes(4)
  })

  it('does not look up fund name when fundId is not provided', async () => {
    setDbResults([], [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.fundName).toBeNull()
    // Only 3 calls: balanceRows, netAssets, revExp — no fund lookup
    expect(mockSelect).toHaveBeenCalledTimes(3)
  })

  // ---- Empty database ----------------------------------------------------

  it('returns zeros when database has no data', async () => {
    setDbResults([], [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.totalAssets).toBe(0)
    expect(result.totalLiabilities).toBe(0)
    expect(result.totalNetAssets).toBe(0)
    expect(result.totalLiabilitiesAndNetAssets).toBe(0)
    expect(result.currentAssets.rows).toHaveLength(0)
    expect(result.noncurrentAssets.rows).toHaveLength(0)
    expect(result.currentLiabilities.rows).toHaveLength(0)
    expect(result.longTermLiabilities.rows).toHaveLength(0)
    expect(result.netAssetsUnrestricted.rows).toHaveLength(0)
    expect(result.netAssetsRestricted.rows).toHaveLength(0)
  })

  // ---- Zero-balance rows excluded ----------------------------------------

  it('excludes rows with zero balance', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 1,
        accountType: 'ASSET',
        subType: 'Cash',
        normalBalance: 'DEBIT',
        totalDebit: '5000',
        totalCredit: '5000', // zero net
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    expect(result.currentAssets.rows).toHaveLength(0)
    expect(result.totalAssets).toBe(0)
  })

  // ---- Section totals aggregate correctly --------------------------------

  it('sums multiple rows within a section correctly', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 1,
        accountCode: '1000',
        accountType: 'ASSET',
        subType: 'Cash',
        normalBalance: 'DEBIT',
        totalDebit: '10000',
        totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 2,
        accountCode: '1100',
        accountName: 'Accounts Receivable',
        accountType: 'ASSET',
        subType: 'Accounts Receivable',
        normalBalance: 'DEBIT',
        totalDebit: '3000',
        totalCredit: '500',
      }),
      makeBalanceRow({
        accountId: 3,
        accountCode: '1200',
        accountName: 'Prepaid Insurance',
        accountType: 'ASSET',
        subType: 'Prepaid',
        normalBalance: 'DEBIT',
        totalDebit: '1200',
        totalCredit: '0',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // Cash: 10000, AR: 2500, Prepaid: 1200 = 13700
    expect(result.currentAssets.total).toBe(13700)
    expect(result.currentAssets.rows).toHaveLength(3)
  })

  // ---- Passes asOfDate through correctly ---------------------------------

  it('sets asOfDate from the endDate parameter', async () => {
    setDbResults([], [], [])

    const result = await getBalanceSheetData({ endDate: '2025-12-31' })

    expect(result.asOfDate).toBe('2025-12-31')
  })

  // ---- Negative balances -------------------------------------------------

  it('handles assets with contra (credit-heavy) balances', async () => {
    // Accumulated Depreciation is DEBIT-normal but expected to be credit-heavy
    const rows = [
      makeBalanceRow({
        accountId: 5,
        accountCode: '1550',
        accountName: 'Accum. Depreciation',
        accountType: 'ASSET',
        subType: 'Accumulated Depreciation',
        normalBalance: 'DEBIT',
        totalDebit: '0',
        totalCredit: '30000',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // balance = 0 - 30000 = -30000
    expect(result.noncurrentAssets.rows).toHaveLength(1)
    expect(result.noncurrentAssets.rows[0].balance).toBe(-30000)
    expect(result.noncurrentAssets.total).toBe(-30000)
  })

  // ---- Multiple current & noncurrent asset sub-types -----------------------

  it('classifies all recognized subTypes into correct sections', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 1, accountCode: '1000', accountType: 'ASSET',
        subType: 'Cash', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 2, accountCode: '1100', accountType: 'ASSET',
        subType: 'Accounts Receivable', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 3, accountCode: '1200', accountType: 'ASSET',
        subType: 'Prepaid', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 4, accountCode: '1300', accountType: 'ASSET',
        subType: 'Short-Term Investment', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 5, accountCode: '1500', accountType: 'ASSET',
        subType: 'Fixed Asset', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 6, accountCode: '1550', accountType: 'ASSET',
        subType: 'CIP', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
      makeBalanceRow({
        accountId: 7, accountCode: '1600', accountType: 'ASSET',
        subType: 'Long-Term Investment', normalBalance: 'DEBIT', totalDebit: '100', totalCredit: '0',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // Current: Cash, AR, Prepaid, Short-Term Investment = 4
    expect(result.currentAssets.rows).toHaveLength(4)
    // Noncurrent: Fixed Asset, CIP, Long-Term Investment = 3
    expect(result.noncurrentAssets.rows).toHaveLength(3)
  })

  // ---- Multiple liability sub-types ----------------------------------------

  it('classifies all recognized liability subTypes into correct sections', async () => {
    const rows = [
      makeBalanceRow({
        accountId: 20, accountCode: '2000', accountType: 'LIABILITY',
        subType: 'Accounts Payable', normalBalance: 'CREDIT', totalDebit: '0', totalCredit: '100',
      }),
      makeBalanceRow({
        accountId: 21, accountCode: '2010', accountType: 'LIABILITY',
        subType: 'Accrued', normalBalance: 'CREDIT', totalDebit: '0', totalCredit: '100',
      }),
      makeBalanceRow({
        accountId: 22, accountCode: '2020', accountType: 'LIABILITY',
        subType: 'Payroll Payable', normalBalance: 'CREDIT', totalDebit: '0', totalCredit: '100',
      }),
      makeBalanceRow({
        accountId: 23, accountCode: '2500', accountType: 'LIABILITY',
        subType: 'Long-Term', normalBalance: 'CREDIT', totalDebit: '0', totalCredit: '100',
      }),
      makeBalanceRow({
        accountId: 24, accountCode: '2510', accountType: 'LIABILITY',
        subType: 'Deferred', normalBalance: 'CREDIT', totalDebit: '0', totalCredit: '100',
      }),
    ]
    setDbResults(rows, [], [])

    const result = await getBalanceSheetData({ endDate: '2026-01-31' })

    // Current: AP, Accrued, Payroll Payable = 3
    expect(result.currentLiabilities.rows).toHaveLength(3)
    // Long-term: Long-Term, Deferred = 2
    expect(result.longTermLiabilities.rows).toHaveLength(2)
  })
})
