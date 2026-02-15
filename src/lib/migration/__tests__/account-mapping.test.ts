import { describe, it, expect } from 'vitest'
import {
  resolveAccountId,
  resolveFundId,
  getUnmappedAccounts,
  getUnmappedClasses,
  QBO_ACCOUNT_MAPPING,
  QBO_FUND_MAPPING,
  AccountMappingError,
  FundMappingError,
  type AccountLookup,
  type FundLookup,
} from '../account-mapping'

// Mock lookups that simulate the database
const mockAccountLookup: AccountLookup = new Map([
  ['1000', 1], // Checking
  ['1010', 2], // Savings
  ['1100', 3], // Accounts Receivable
  ['1200', 4], // Prepaid Expenses
  ['1500', 5], // Construction in Progress
  ['1510', 6], // CIP - Hard Costs
  ['1550', 7], // CIP - Construction Interest
  ['2000', 8], // Accounts Payable
  ['2010', 9], // Reimbursements Payable
  ['2520', 10], // Accrued Interest Payable
  ['3000', 11], // Net Assets Without Donor Restrictions
  ['3100', 12], // Net Assets With Donor Restrictions
  ['4000', 13], // Rental Income
  ['4100', 14], // Grant Revenue
  ['4200', 15], // Donation Income
  ['5000', 16], // Salaries & Wages
  ['5100', 17], // Interest Expense
  ['5410', 18], // Property Insurance
  ['5500', 19], // Utilities - Electric
  ['5600', 20], // Other Operating Costs
])

const mockFundLookup: FundLookup = new Map([
  ['General Fund', 1],
  ['AHP Fund', 2],
  ['CPA Fund', 3],
  ['MassDev Fund', 4],
  ['HTC Equity Fund', 5],
  ['MassSave Fund', 6],
])

describe('resolveAccountId', () => {
  it('resolves known QBO account names to correct account IDs', () => {
    expect(resolveAccountId('Business Checking', mockAccountLookup)).toBe(1)
    expect(resolveAccountId('Checking', mockAccountLookup)).toBe(1)
    expect(resolveAccountId('Savings', mockAccountLookup)).toBe(2)
    expect(resolveAccountId('Accounts Receivable', mockAccountLookup)).toBe(3)
    expect(resolveAccountId('Rental Income', mockAccountLookup)).toBe(13)
  })

  it('handles case-insensitive matching', () => {
    expect(resolveAccountId('business checking', mockAccountLookup)).toBe(1)
    expect(resolveAccountId('SAVINGS', mockAccountLookup)).toBe(2)
    expect(resolveAccountId('rental income', mockAccountLookup)).toBe(13)
  })

  it('maps QBO aliases to correct codes', () => {
    // Insurance variants
    expect(resolveAccountId('Insurance Expense', mockAccountLookup)).toBe(18)
    expect(resolveAccountId('Insurance', mockAccountLookup)).toBe(18)
    expect(resolveAccountId('Property Insurance', mockAccountLookup)).toBe(18)

    // AP variants
    expect(resolveAccountId('Accounts Payable', mockAccountLookup)).toBe(8)
    expect(resolveAccountId('Accounts Payable (A/P)', mockAccountLookup)).toBe(8)
  })

  it('throws on unknown account name', () => {
    expect(() => resolveAccountId('Nonexistent Account', mockAccountLookup))
      .toThrow(AccountMappingError)
    expect(() => resolveAccountId('Nonexistent Account', mockAccountLookup))
      .toThrow(/No mapping found/)
  })

  it('throws when mapped code is not in lookup', () => {
    const emptyLookup: AccountLookup = new Map()
    expect(() => resolveAccountId('Checking', emptyLookup))
      .toThrow(AccountMappingError)
    expect(() => resolveAccountId('Checking', emptyLookup))
      .toThrow(/not found in database/)
  })
})

describe('resolveFundId', () => {
  it('resolves known class names to fund IDs', () => {
    expect(resolveFundId('General', mockFundLookup)).toBe(1)
    expect(resolveFundId('AHP', mockFundLookup)).toBe(2)
    expect(resolveFundId('CPA', mockFundLookup)).toBe(3)
    expect(resolveFundId('MassDev', mockFundLookup)).toBe(4)
    expect(resolveFundId('HTC Equity', mockFundLookup)).toBe(5)
    expect(resolveFundId('MassSave', mockFundLookup)).toBe(6)
  })

  it('defaults to General Fund when class is empty (D-024)', () => {
    expect(resolveFundId('', mockFundLookup)).toBe(1)
    expect(resolveFundId('  ', mockFundLookup)).toBe(1)
  })

  it('resolves full fund names', () => {
    expect(resolveFundId('General Fund', mockFundLookup)).toBe(1)
    expect(resolveFundId('AHP Fund', mockFundLookup)).toBe(2)
    expect(resolveFundId('HTC Equity Fund', mockFundLookup)).toBe(5)
  })

  it('throws on unknown class name', () => {
    expect(() => resolveFundId('Unknown Class', mockFundLookup))
      .toThrow(FundMappingError)
    expect(() => resolveFundId('Unknown Class', mockFundLookup))
      .toThrow(/No mapping found/)
  })
})

describe('getUnmappedAccounts', () => {
  it('returns empty array when all accounts are mapped', () => {
    const names = ['Checking', 'Savings', 'Rental Income']
    expect(getUnmappedAccounts(names)).toEqual([])
  })

  it('catches missing mappings', () => {
    const names = ['Checking', 'Unknown Account', 'Another Missing']
    const unmapped = getUnmappedAccounts(names)
    expect(unmapped).toEqual(['Unknown Account', 'Another Missing'])
  })

  it('deduplicates account names', () => {
    const names = ['Unknown Account', 'Unknown Account', 'Unknown Account']
    const unmapped = getUnmappedAccounts(names)
    expect(unmapped).toEqual(['Unknown Account'])
  })
})

describe('getUnmappedClasses', () => {
  it('returns empty array when all classes are mapped', () => {
    const classes = ['General', 'AHP', 'CPA']
    expect(getUnmappedClasses(classes)).toEqual([])
  })

  it('ignores empty class names (they default to General Fund)', () => {
    const classes = ['', '  ', 'General']
    expect(getUnmappedClasses(classes)).toEqual([])
  })

  it('catches unmapped class names', () => {
    const classes = ['General', 'Unknown Program']
    expect(getUnmappedClasses(classes)).toEqual(['Unknown Program'])
  })
})

describe('QBO_ACCOUNT_MAPPING completeness', () => {
  it('has mappings for all critical account types', () => {
    // Cash
    expect(QBO_ACCOUNT_MAPPING['Business Checking']).toBe('1000')
    expect(QBO_ACCOUNT_MAPPING['Savings']).toBe('1010')

    // Key liabilities
    expect(QBO_ACCOUNT_MAPPING['Accounts Payable']).toBe('2000')
    expect(QBO_ACCOUNT_MAPPING['AHP Loan Payable']).toBe('2500')

    // Revenue
    expect(QBO_ACCOUNT_MAPPING['Rental Income']).toBe('4000')
    expect(QBO_ACCOUNT_MAPPING['Grant Revenue']).toBe('4100')

    // Expenses
    expect(QBO_ACCOUNT_MAPPING['Salaries & Wages']).toBe('5000')
    expect(QBO_ACCOUNT_MAPPING['Property Insurance']).toBe('5410')
  })
})

describe('QBO_FUND_MAPPING completeness', () => {
  it('maps all 6 funds', () => {
    const uniqueFundNames = new Set(Object.values(QBO_FUND_MAPPING))
    expect(uniqueFundNames.size).toBe(6)
    expect(uniqueFundNames).toContain('General Fund')
    expect(uniqueFundNames).toContain('AHP Fund')
    expect(uniqueFundNames).toContain('CPA Fund')
    expect(uniqueFundNames).toContain('MassDev Fund')
    expect(uniqueFundNames).toContain('HTC Equity Fund')
    expect(uniqueFundNames).toContain('MassSave Fund')
  })
})
