import { describe, it, expect, vi } from 'vitest'
import {
  calculateAhpInterest,
  type AccrualAdjustmentOptions,
  type AhpInterestConfig,
} from '../accrual-adjustments'
import type { AccountLookup, FundLookup } from '../account-mapping'

// Mock account and fund lookups
const accountLookup: AccountLookup = new Map([
  ['1100', 3],  // Accounts Receivable
  ['1200', 4],  // Prepaid Expenses
  ['1550', 7],  // CIP - Construction Interest
  ['2010', 9],  // Reimbursements Payable
  ['2520', 10], // Accrued Interest Payable
  ['4000', 13], // Rental Income
  ['5410', 18], // Property Insurance
  ['5600', 20], // Admin Operating Costs
])

const fundLookup: FundLookup = new Map([
  ['General Fund', 1],
  ['CPA Fund', 3],
])

describe('calculateAhpInterest', () => {
  it('calculates interest: rate × principal × days/365', () => {
    const config: AhpInterestConfig = {
      annualRate: 0.02,
      drawnAmount: 100000,
      daysSinceLastPayment: 30,
    }

    const interest = calculateAhpInterest(config)
    // 0.02 * 100000 * 30 / 365 = 164.38...
    expect(interest).toBeCloseTo(164.38, 2)
  })

  it('handles zero days', () => {
    expect(calculateAhpInterest({
      annualRate: 0.02,
      drawnAmount: 100000,
      daysSinceLastPayment: 0,
    })).toBe(0)
  })

  it('handles larger amounts', () => {
    const config: AhpInterestConfig = {
      annualRate: 0.03,
      drawnAmount: 500000,
      daysSinceLastPayment: 90,
    }

    const interest = calculateAhpInterest(config)
    // 0.03 * 500000 * 90 / 365 = 3698.63...
    expect(interest).toBeCloseTo(3698.63, 2)
  })

  it('rounds to 2 decimal places', () => {
    const interest = calculateAhpInterest({
      annualRate: 0.025,
      drawnAmount: 333333,
      daysSinceLastPayment: 17,
    })

    // Should be a number with at most 2 decimal places
    const decimalPart = String(interest).split('.')[1] ?? ''
    expect(decimalPart.length).toBeLessThanOrEqual(2)
  })
})

describe('generateAccrualAdjustments', () => {
  const baseOptions: AccrualAdjustmentOptions = {
    accountLookup,
    fundLookup,
    adjustmentDate: '2025-12-31',
    prepaidInsuranceAmount: 501,
    reimbursementAmount: 4472,
    reimbursementExpenseAccountCode: '5600',
    reimbursementFundName: 'General Fund',
    rentArAmount: 0,
    createdBy: 'system:fy25-import',
    dryRun: true,
  }

  it('generates prepaid insurance adjustment with correct accounts/amounts', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      reimbursementAmount: 0,
    })

    expect(result.errors).toHaveLength(0)
    const prepaid = result.adjustments.find((a) => a.name === 'Prepaid Insurance')
    expect(prepaid).toBeDefined()
    expect(prepaid!.amount).toBe(501)
    expect(prepaid!.glInput.sourceType).toBe('FY25_IMPORT')
    expect(prepaid!.glInput.sourceReferenceId).toBe('accrual-adj:prepaid-insurance')
    expect(prepaid!.glInput.lines).toHaveLength(2)

    // DR Prepaid Expenses
    const debitLine = prepaid!.glInput.lines.find((l) => l.debit)
    expect(debitLine!.accountId).toBe(4) // Prepaid Expenses (1200)
    expect(debitLine!.debit).toBe(501)

    // CR Property Insurance
    const creditLine = prepaid!.glInput.lines.find((l) => l.credit)
    expect(creditLine!.accountId).toBe(18) // Property Insurance (5410)
    expect(creditLine!.credit).toBe(501)
  })

  it('generates reimbursement adjustment with correct accounts/amounts', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      prepaidInsuranceAmount: 0,
    })

    const reimb = result.adjustments.find((a) => a.name === 'Accrued Reimbursements')
    expect(reimb).toBeDefined()
    expect(reimb!.amount).toBe(4472)
    expect(reimb!.glInput.sourceType).toBe('FY25_IMPORT')
    expect(reimb!.glInput.sourceReferenceId).toBe('accrual-adj:accrued-reimbursement')

    // DR Expense account
    const debitLine = reimb!.glInput.lines.find((l) => l.debit)
    expect(debitLine!.accountId).toBe(20) // Admin Operating Costs (5600)
    expect(debitLine!.debit).toBe(4472)

    // CR Reimbursements Payable
    const creditLine = reimb!.glInput.lines.find((l) => l.credit)
    expect(creditLine!.accountId).toBe(9) // Reimbursements Payable (2010)
    expect(creditLine!.credit).toBe(4472)
  })

  it('generates rent AR adjustment with parameterized amount', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      prepaidInsuranceAmount: 0,
      reimbursementAmount: 0,
      rentArAmount: 2400,
    })

    const rentAr = result.adjustments.find((a) => a.name === 'December Rent AR')
    expect(rentAr).toBeDefined()
    expect(rentAr!.amount).toBe(2400)

    // DR Accounts Receivable
    const debitLine = rentAr!.glInput.lines.find((l) => l.debit)
    expect(debitLine!.accountId).toBe(3) // Accounts Receivable (1100)
    expect(debitLine!.debit).toBe(2400)

    // CR Rental Income
    const creditLine = rentAr!.glInput.lines.find((l) => l.credit)
    expect(creditLine!.accountId).toBe(13) // Rental Income (4000)
    expect(creditLine!.credit).toBe(2400)
  })

  it('generates AHP interest adjustment with calculated amount', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      prepaidInsuranceAmount: 0,
      reimbursementAmount: 0,
      ahpInterest: {
        annualRate: 0.02,
        drawnAmount: 100000,
        daysSinceLastPayment: 30,
      },
    })

    const ahp = result.adjustments.find((a) => a.name === 'AHP Interest Accrual')
    expect(ahp).toBeDefined()
    expect(ahp!.amount).toBeCloseTo(164.38, 2)

    // DR CIP - Construction Interest (General Fund — AHP proceeds unrestricted)
    const debitLine = ahp!.glInput.lines.find((l) => l.debit)
    expect(debitLine!.accountId).toBe(7) // CIP - Construction Interest (1550)
    expect(debitLine!.fundId).toBe(1) // General Fund

    // CR Accrued Interest Payable (General Fund)
    const creditLine = ahp!.glInput.lines.find((l) => l.credit)
    expect(creditLine!.accountId).toBe(10) // Accrued Interest Payable (2520)
    expect(creditLine!.fundId).toBe(1) // General Fund
  })

  it('all adjustments use FY25_IMPORT source type', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      rentArAmount: 1000,
      ahpInterest: {
        annualRate: 0.02,
        drawnAmount: 100000,
        daysSinceLastPayment: 30,
      },
    })

    for (const adj of result.adjustments) {
      expect(adj.glInput.sourceType).toBe('FY25_IMPORT')
    }
  })

  it('skips adjustments with zero amounts', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      prepaidInsuranceAmount: 0,
      reimbursementAmount: 0,
      rentArAmount: 0,
    })

    expect(result.adjustments).toHaveLength(0)
    expect(result.errors).toHaveLength(0)
  })

  it('reports errors for missing accounts', async () => {
    const { generateAccrualAdjustments } = await import('../accrual-adjustments')

    const emptyLookup: AccountLookup = new Map()

    const result = await generateAccrualAdjustments({
      ...baseOptions,
      accountLookup: emptyLookup,
    })

    expect(result.errors.length).toBeGreaterThan(0)
  })
})
