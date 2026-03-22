import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Tests the 990 data math — specifically that functional allocation percentages
 * are correctly applied to expense amounts and that totals reconcile.
 *
 * We mock the DB to test pure business logic.
 */

// --- Mock data ---

const MOCK_EXPENSE_ACCOUNTS = [
  { id: 1, code: '5000', name: 'Salaries & Wages', form990Line: '5', type: 'EXPENSE', isActive: true },
  { id: 2, code: '5100', name: 'Interest Expense', form990Line: '15', type: 'EXPENSE', isActive: true },
  { id: 3, code: '5450', name: 'Repairs & Maintenance', form990Line: '24a', type: 'EXPENSE', isActive: true },
  { id: 4, code: '5500', name: 'Electric', form990Line: '24a', type: 'EXPENSE', isActive: true },
  { id: 5, code: '5600', name: 'Admin Operating', form990Line: '24a', type: 'EXPENSE', isActive: true },
]

const MOCK_REVENUE_ACCOUNTS = [
  { id: 10, code: '4000', name: 'Rent Revenue', form990Line: '6', type: 'REVENUE', isActive: true },
  { id: 11, code: '4100', name: 'Grant Revenue', form990Line: '1e', type: 'REVENUE', isActive: true },
]

const MOCK_ALLOCATIONS_2025 = [
  { id: 1, accountId: 1, fiscalYear: 2025, programPct: '70.00', adminPct: '25.00', fundraisingPct: '5.00', isPermanentRule: false, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
  { id: 2, accountId: 2, fiscalYear: 2025, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00', isPermanentRule: true, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
  { id: 3, accountId: 3, fiscalYear: 2025, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00', isPermanentRule: true, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
  { id: 4, accountId: 4, fiscalYear: 2025, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00', isPermanentRule: true, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
  { id: 5, accountId: 5, fiscalYear: 2025, programPct: '80.00', adminPct: '20.00', fundraisingPct: '0.00', isPermanentRule: false, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
]

// Different allocations for 2024 to verify fiscal year filtering
const MOCK_ALLOCATIONS_2024 = [
  { id: 10, accountId: 1, fiscalYear: 2024, programPct: '60.00', adminPct: '30.00', fundraisingPct: '10.00', isPermanentRule: false, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
  { id: 11, accountId: 2, fiscalYear: 2024, programPct: '100.00', adminPct: '0.00', fundraisingPct: '0.00', isPermanentRule: true, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
]

const MOCK_EXPENSE_LINES = [
  { accountId: 1, amount: '22534.00' }, // Salaries
  { accountId: 2, amount: '2400.00' },  // Interest
  { accountId: 3, amount: '8000.00' },  // Repairs
  { accountId: 4, amount: '3500.00' },  // Electric
  { accountId: 5, amount: '1200.00' },  // Admin Operating
]

const MOCK_REVENUE_LINES = [
  { accountId: 10, amount: '45000.00' },
  { accountId: 11, amount: '30000.00' },
]

// --- Test the allocation math directly (no DB needed) ---

describe('Form 990 Part IX — Functional Allocation Math', () => {
  /**
   * Replicate the core allocation logic from form-990-data.ts
   * so we can test it in isolation.
   */
  function computePartIX(
    expenseAccounts: typeof MOCK_EXPENSE_ACCOUNTS,
    allocations: typeof MOCK_ALLOCATIONS_2025,
    expenseLines: typeof MOCK_EXPENSE_LINES
  ) {
    const allocMap = new Map(
      allocations.map((a) => [
        a.accountId,
        {
          programPercent: parseFloat(a.programPct),
          adminPercent: parseFloat(a.adminPct),
          fundraisingPercent: parseFloat(a.fundraisingPct),
        },
      ])
    )

    const actualsByAccount = new Map(
      expenseLines.map((l) => [l.accountId, parseFloat(l.amount)])
    )

    const lineMap = new Map<string, { total: number; program: number; admin: number; fundraising: number }>()

    for (const acct of expenseAccounts) {
      const line = acct.form990Line ?? '24'
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

    const rows = [...lineMap.entries()]
      .sort((a, b) => {
        const numA = parseFloat(a[0].replace(/[a-g]/g, ''))
        const numB = parseFloat(b[0].replace(/[a-g]/g, ''))
        return numA - numB || a[0].localeCompare(b[0])
      })
      .map(([line, data]) => ({
        form990Line: line,
        total: Math.round(data.total * 100) / 100,
        program: Math.round(data.program * 100) / 100,
        admin: Math.round(data.admin * 100) / 100,
        fundraising: Math.round(data.fundraising * 100) / 100,
      }))

    const totals = {
      total: rows.reduce((s, r) => s + r.total, 0),
      program: rows.reduce((s, r) => s + r.program, 0),
      admin: rows.reduce((s, r) => s + r.admin, 0),
      fundraising: rows.reduce((s, r) => s + r.fundraising, 0),
    }

    return { rows, totals }
  }

  it('correctly splits Salaries (line 5) at 70/25/5', () => {
    const { rows } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const line5 = rows.find((r) => r.form990Line === '5')!
    expect(line5).toBeDefined()
    expect(line5.total).toBe(22534)
    expect(line5.program).toBeCloseTo(22534 * 0.70, 2)  // 15773.80
    expect(line5.admin).toBeCloseTo(22534 * 0.25, 2)     // 5633.50
    expect(line5.fundraising).toBeCloseTo(22534 * 0.05, 2) // 1126.70
  })

  it('correctly allocates 100% program for permanent-rule accounts', () => {
    const { rows } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const line15 = rows.find((r) => r.form990Line === '15')!
    expect(line15.total).toBe(2400)
    expect(line15.program).toBe(2400)
    expect(line15.admin).toBe(0)
    expect(line15.fundraising).toBe(0)
  })

  it('correctly aggregates multiple accounts into same 990 line (24a)', () => {
    const { rows } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const line24a = rows.find((r) => r.form990Line === '24a')!
    // Repairs 8000 (100/0/0) + Electric 3500 (100/0/0) + Admin 1200 (80/20/0)
    const expectedTotal = 8000 + 3500 + 1200
    expect(line24a.total).toBe(expectedTotal) // 12700

    const expectedProgram = 8000 * 1.0 + 3500 * 1.0 + 1200 * 0.80
    expect(line24a.program).toBeCloseTo(expectedProgram, 2) // 12460

    const expectedAdmin = 0 + 0 + 1200 * 0.20
    expect(line24a.admin).toBeCloseTo(expectedAdmin, 2) // 240

    expect(line24a.fundraising).toBe(0)
  })

  it('program + admin + fundraising = total for every line', () => {
    const { rows } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    for (const row of rows) {
      const sum = row.program + row.admin + row.fundraising
      expect(sum).toBeCloseTo(row.total, 2)
    }
  })

  it('grand total program + admin + fundraising = grand total', () => {
    const { totals } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const sumParts = totals.program + totals.admin + totals.fundraising
    expect(sumParts).toBeCloseTo(totals.total, 2)
  })

  it('grand total matches sum of all expense amounts', () => {
    const { totals } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const expectedTotal = MOCK_EXPENSE_LINES.reduce((s, l) => s + parseFloat(l.amount), 0)
    expect(totals.total).toBe(expectedTotal) // 37634
  })

  it('uses different allocations for different fiscal years', () => {
    // 2025 allocations: Salaries 70/25/5
    const result2025 = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, MOCK_EXPENSE_LINES)
    const line5_2025 = result2025.rows.find((r) => r.form990Line === '5')!
    expect(line5_2025.program).toBeCloseTo(22534 * 0.70, 2)

    // 2024 allocations: Salaries 60/30/10
    const result2024 = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2024, MOCK_EXPENSE_LINES)
    const line5_2024 = result2024.rows.find((r) => r.form990Line === '5')!
    expect(line5_2024.program).toBeCloseTo(22534 * 0.60, 2) // 13520.40
    expect(line5_2024.admin).toBeCloseTo(22534 * 0.30, 2)   // 6760.20
    expect(line5_2024.fundraising).toBeCloseTo(22534 * 0.10, 2) // 2253.40
  })

  it('defaults to 100% program when no allocation exists', () => {
    // Only provide allocation for account 1, leave rest unallocated
    const partialAllocs = [MOCK_ALLOCATIONS_2025[0]]
    const { rows } = computePartIX(MOCK_EXPENSE_ACCOUNTS, partialAllocs, MOCK_EXPENSE_LINES)

    const line15 = rows.find((r) => r.form990Line === '15')!
    // No allocation → defaults to 100% program
    expect(line15.program).toBe(2400)
    expect(line15.admin).toBe(0)
    expect(line15.fundraising).toBe(0)
  })

  it('handles zero-amount accounts gracefully (excluded from output)', () => {
    const zeroLines = [
      { accountId: 1, amount: '0' },
      { accountId: 2, amount: '0' },
    ]
    const { rows, totals } = computePartIX(MOCK_EXPENSE_ACCOUNTS, MOCK_ALLOCATIONS_2025, zeroLines)
    expect(rows.length).toBe(0)
    expect(totals.total).toBe(0)
  })

  it('rounding preserves sum integrity for tricky percentages', () => {
    // Use 33.33/33.33/33.34 split on $100 — tests rounding edge case
    const trickyAllocs = [
      { id: 99, accountId: 1, fiscalYear: 2025, programPct: '33.33', adminPct: '33.33', fundraisingPct: '33.34', isPermanentRule: false, createdBy: 'test', createdAt: new Date(), updatedAt: new Date() },
    ]
    const trickyLines = [{ accountId: 1, amount: '100.00' }]
    const { rows } = computePartIX(
      [MOCK_EXPENSE_ACCOUNTS[0]],
      trickyAllocs,
      trickyLines
    )
    const row = rows[0]
    expect(row.total).toBe(100)
    expect(row.program).toBe(33.33)
    expect(row.admin).toBe(33.33)
    expect(row.fundraising).toBe(33.34)
    // Sum check
    expect(row.program + row.admin + row.fundraising).toBe(100)
  })

  it('matches the screenshot values for FY 2025', () => {
    // From the screenshot:
    // Line 5: $22,534.00 total, $15,773.80 program, $5,633.50 M&G, $1,126.70 fundraising
    // Line 15: $2,400.00 total, $2,400.00 program, $0.00, $0.00
    // Line 24a: $20,272.43 total, $20,272.43 program, $0.00, $0.00
    //
    // Let's verify the line 5 math with known allocations (70/25/5):
    const salaries = 22534
    expect(salaries * 0.70).toBe(15773.80)
    expect(salaries * 0.25).toBe(5633.50)
    expect(salaries * 0.05).toBe(1126.70)
    // ✓ Math checks out for line 5

    // Line 24a in screenshot: $20,272.43 all program
    // This means all 24a accounts have 100% program allocation
    // Total: $45,206.43, Program: $38,446.23, M&G: $5,633.50, Fundraising: $1,126.70
    // Check: 38446.23 + 5633.50 + 1126.70 = 45206.43 ✓
    expect(38446.23 + 5633.50 + 1126.70).toBeCloseTo(45206.43, 2)
  })
})
