import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { QboParsedTransaction } from '../qbo-csv-parser'
import { buildGlTransaction, type ImportOptions } from '../import-engine'
import type { AccountLookup, FundLookup } from '../account-mapping'

// Mock lookups
const accountLookup: AccountLookup = new Map([
  ['1000', 1],  // Checking
  ['1010', 2],  // Savings
  ['1100', 3],  // Accounts Receivable
  ['1200', 4],  // Prepaid Expenses
  ['2000', 5],  // Accounts Payable
  ['4000', 6],  // Rental Income
  ['4100', 7],  // Grant Revenue
  ['5410', 8],  // Property Insurance
  ['5500', 9],  // Utilities - Electric
  ['5600', 10], // Admin Operating Costs
])

const fundLookup: FundLookup = new Map([
  ['General Fund', 1],
  ['CPA Fund', 2],
])

describe('buildGlTransaction', () => {
  it('converts a balanced QBO transaction to GL format', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1001',
      date: '2025-01-15',
      transactionType: 'Journal Entry',
      memo: 'Rent received',
      lines: [
        { accountName: 'Checking', name: 'Tenant A', class: 'General', debit: 1000, credit: 0 },
        { accountName: 'Rental Income', name: 'Tenant A', class: 'General', debit: 0, credit: 1000 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')

    expect(result.date).toBe('2025-01-15')
    expect(result.memo).toBe('Rent received')
    expect(result.sourceType).toBe('FY25_IMPORT')
    expect(result.sourceReferenceId).toBe('qbo:1001')
    expect(result.isSystemGenerated).toBe(false)
    expect(result.createdBy).toBe('system:fy25-import')
    expect(result.lines).toHaveLength(2)
    expect(result.lines[0]).toEqual({
      accountId: 1, // Checking
      fundId: 1,    // General Fund
      debit: 1000,
      credit: null,
    })
    expect(result.lines[1]).toEqual({
      accountId: 6, // Rental Income
      fundId: 1,    // General Fund
      debit: null,
      credit: 1000,
    })
  })

  it('sourceType is always FY25_IMPORT', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1002',
      date: '2025-02-01',
      transactionType: 'Check',
      memo: 'Insurance payment',
      lines: [
        { accountName: 'Property Insurance', name: '', class: '', debit: 500, credit: 0 },
        { accountName: 'Checking', name: '', class: '', debit: 0, credit: 500 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.sourceType).toBe('FY25_IMPORT')
  })

  it('sourceReferenceId preserves QBO transaction number', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: 'JE-2025-0042',
      date: '2025-03-15',
      transactionType: 'Journal Entry',
      memo: 'Test',
      lines: [
        { accountName: 'Checking', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Savings', name: '', class: '', debit: 0, credit: 100 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.sourceReferenceId).toBe('qbo:JE-2025-0042')
  })

  it('defaults empty class to General Fund', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1003',
      date: '2025-01-15',
      transactionType: 'Journal Entry',
      memo: 'No class specified',
      lines: [
        { accountName: 'Checking', name: '', class: '', debit: 200, credit: 0 },
        { accountName: 'Savings', name: '', class: '', debit: 0, credit: 200 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.lines[0].fundId).toBe(1) // General Fund
    expect(result.lines[1].fundId).toBe(1) // General Fund
  })

  it('filters out zero-amount lines', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1004',
      date: '2025-01-15',
      transactionType: 'Journal Entry',
      memo: 'With zero line',
      lines: [
        { accountName: 'Checking', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Savings', name: '', class: '', debit: 0, credit: 0 }, // zero amount
        { accountName: 'Other Operating Costs', name: '', class: '', debit: 0, credit: 100 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.lines).toHaveLength(2)
  })

  it('uses fallback memo when QBO memo is empty', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1005',
      date: '2025-01-15',
      transactionType: 'Journal Entry',
      memo: '',
      lines: [
        { accountName: 'Checking', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Savings', name: '', class: '', debit: 0, credit: 100 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.memo).toContain('QBO Import')
    expect(result.memo).toContain('1005')
  })

  it('throws on unmapped account', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1006',
      date: '2025-01-15',
      transactionType: 'Journal Entry',
      memo: 'Bad account',
      lines: [
        { accountName: 'Nonexistent Account', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Checking', name: '', class: '', debit: 0, credit: 100 },
      ],
    }

    expect(() =>
      buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    ).toThrow(/No mapping found/)
  })

  it('handles multi-fund transaction lines', () => {
    const qboTxn: QboParsedTransaction = {
      transactionNo: '1007',
      date: '2025-06-01',
      transactionType: 'Journal Entry',
      memo: 'Multi-fund grant',
      lines: [
        { accountName: 'Checking', name: '', class: 'General', debit: 5000, credit: 0 },
        { accountName: 'Grant Revenue', name: '', class: 'AHP', debit: 0, credit: 3000 },
        { accountName: 'Grant Revenue', name: '', class: 'CPA', debit: 0, credit: 2000 },
      ],
    }

    const result = buildGlTransaction(qboTxn, accountLookup, fundLookup, 'system:fy25-import')
    expect(result.lines[0].fundId).toBe(1) // General
    expect(result.lines[1].fundId).toBe(1) // AHP → General Fund (unrestricted)
    expect(result.lines[2].fundId).toBe(2) // CPA
  })
})

describe('importFY25Transactions (integration-style with mocks)', () => {
  it('returns correct ImportResult shape', async () => {
    // Test the importFY25Transactions function with mocked dependencies
    const { importFY25Transactions } = await import('../import-engine')

    // Mock DB that returns account and fund lookups
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockImplementation((table: any) => {
        // Return account data or fund data based on table
        if (table?.name === 'accounts' || String(table) === 'accounts') {
          return [
            { id: 1, code: '1000' },
            { id: 2, code: '1010' },
            { id: 6, code: '4000' },
          ]
        }
        return [
          { id: 1, name: 'General Fund' },
        ]
      }),
    }

    const txns: QboParsedTransaction[] = [{
      transactionNo: '1001',
      date: '2025-01-15',
      transactionType: 'JE',
      memo: 'Test',
      lines: [
        { accountName: 'Checking', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Rental Income', name: '', class: '', debit: 0, credit: 100 },
      ],
    }]

    const result = await importFY25Transactions(txns, mockDb, {
      dryRun: true,
      createdBy: 'system:fy25-import',
    })

    expect(result).toHaveProperty('totalTransactions')
    expect(result).toHaveProperty('imported')
    expect(result).toHaveProperty('errors')
    expect(result).toHaveProperty('dryRun')
    expect(result.dryRun).toBe(true)
    expect(result.totalTransactions).toBe(1)
  })

  it('catches unmapped accounts in pre-flight', async () => {
    const { importFY25Transactions } = await import('../import-engine')

    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnValue([
        { id: 1, code: '1000' },
      ]),
    }

    const txns: QboParsedTransaction[] = [{
      transactionNo: '1001',
      date: '2025-01-15',
      transactionType: 'JE',
      memo: 'Test',
      lines: [
        { accountName: 'Totally Unknown Account', name: '', class: '', debit: 100, credit: 0 },
        { accountName: 'Checking', name: '', class: '', debit: 0, credit: 100 },
      ],
    }]

    const result = await importFY25Transactions(txns, mockDb, {
      dryRun: true,
      createdBy: 'system:fy25-import',
    })

    expect(result.imported).toBe(0)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].transactionNo).toBe('PRE-FLIGHT')
    expect(result.errors[0].message).toContain('Unmapped QBO accounts')
  })
})
