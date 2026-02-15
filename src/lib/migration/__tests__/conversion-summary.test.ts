import { describe, it, expect } from 'vitest'
import {
  formatConversionSummary,
  toJson,
  type ConversionSummaryData,
} from '../conversion-summary'

const mockSummaryData: ConversionSummaryData = {
  importStats: {
    totalTransactions: 150,
    totalDebits: 250000,
    totalCredits: 250000,
    dateRange: { earliest: '2025-01-01', latest: '2025-12-31' },
  },
  accountBalances: [
    { code: '1000', name: 'Checking', type: 'ASSET', debitBalance: 50000, creditBalance: 30000, netBalance: 20000 },
    { code: '1010', name: 'Savings', type: 'ASSET', debitBalance: 10000, creditBalance: 0, netBalance: 10000 },
    { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', debitBalance: 5000, creditBalance: 8000, netBalance: -3000 },
    { code: '4000', name: 'Rental Income', type: 'REVENUE', debitBalance: 0, creditBalance: 36000, netBalance: -36000 },
    { code: '5410', name: 'Property Insurance', type: 'EXPENSE', debitBalance: 5000, creditBalance: 0, netBalance: 5000 },
  ],
  fundBalances: [
    { name: 'General Fund', restrictionType: 'UNRESTRICTED', totalDebits: 200000, totalCredits: 200000, netActivity: 0 },
    { name: 'AHP Fund', restrictionType: 'RESTRICTED', totalDebits: 50000, totalCredits: 50000, netActivity: 0 },
  ],
  accrualAdjustments: [
    { name: 'Prepaid Insurance', description: 'DR Prepaid Expenses $501 / CR Property Insurance $501', amount: 501 },
    { name: 'Accrued Reimbursements', description: 'DR Other Costs $4472 / CR Reimbursements Payable $4472', amount: 4472 },
  ],
  verification: {
    passed: true,
    checks: [
      { name: 'Total Balance', passed: true, expected: 'debits = credits', actual: '$250000.00 each', message: 'Balanced at $250000.00' },
      { name: 'Fund-Level Balance', passed: true, expected: 'all balanced', actual: 'all balanced', message: 'All funds pass INV-010' },
      { name: 'Audit Trail', passed: true, expected: 'all entries present', actual: 'all present', message: 'Audit trail complete' },
    ],
  },
}

describe('formatConversionSummary', () => {
  it('includes all sections', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('Import Statistics')
    expect(output).toContain('Account Balance Summary')
    expect(output).toContain('Fund Balance Summary')
    expect(output).toContain('Accrual Adjustments')
    expect(output).toContain('Verification Checks')
  })

  it('displays import statistics', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('150')
    expect(output).toContain('$250000.00')
    expect(output).toContain('2025-01-01')
    expect(output).toContain('2025-12-31')
  })

  it('groups accounts by type', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('ASSET')
    expect(output).toContain('LIABILITY')
    expect(output).toContain('REVENUE')
    expect(output).toContain('EXPENSE')
  })

  it('shows fund balances with restriction type', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('General Fund')
    expect(output).toContain('UNRESTRICTED')
    expect(output).toContain('AHP Fund')
    expect(output).toContain('RESTRICTED')
  })

  it('shows accrual adjustments', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('Prepaid Insurance')
    expect(output).toContain('$501.00')
    expect(output).toContain('Accrued Reimbursements')
    expect(output).toContain('$4472.00')
  })

  it('shows verification checks with pass/fail icons', () => {
    const output = formatConversionSummary(mockSummaryData)

    expect(output).toContain('[PASS]')
    expect(output).toContain('ALL CHECKS PASSED')
  })

  it('shows FAIL status when checks fail', () => {
    const failedData: ConversionSummaryData = {
      ...mockSummaryData,
      verification: {
        passed: false,
        checks: [
          { name: 'Total Balance', passed: false, expected: 'balanced', actual: 'imbalanced', message: 'IMBALANCE: $100.00' },
        ],
      },
    }

    const output = formatConversionSummary(failedData)
    expect(output).toContain('[FAIL]')
    expect(output).toContain('SOME CHECKS FAILED')
  })
})

describe('toJson', () => {
  it('returns valid JSON', () => {
    const json = toJson(mockSummaryData)
    const parsed = JSON.parse(json)

    expect(parsed.importStats.totalTransactions).toBe(150)
    expect(parsed.accountBalances).toHaveLength(5)
    expect(parsed.fundBalances).toHaveLength(2)
    expect(parsed.verification.passed).toBe(true)
  })

  it('is formatted with indentation', () => {
    const json = toJson(mockSummaryData)
    expect(json).toContain('\n')
    expect(json).toContain('  ')
  })
})
