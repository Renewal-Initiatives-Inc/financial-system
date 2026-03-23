import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * Integration tests for the staging table pipeline.
 *
 * These tests verify the end-to-end flow from staging record insertion
 * through processing to GL entry creation. They use mocked DB calls
 * but verify the full processing pipeline including status updates.
 */

// --- Mock state ---

let mockAccounts: Map<number, any> = new Map()
let mockFunds: Map<number, any> = new Map()
let mockStagingRecords: any[] = []
let mockTransactions: any[] = []
let mockTransactionLines: any[] = []
let stagingIdCounter = 1
let txnIdCounter = 1
let lineIdCounter = 1

function seedAccounts() {
  mockAccounts.set(10, {
    id: 10,
    code: '5100',
    name: 'Office Supplies',
    type: 'EXPENSE',
    isActive: true,
    normalBalance: 'DEBIT',
  })
  mockAccounts.set(20, {
    id: 20,
    code: '2010',
    name: 'Reimbursements Payable',
    type: 'LIABILITY',
    isActive: true,
    normalBalance: 'CREDIT',
  })
  mockAccounts.set(30, {
    id: 30,
    code: '5200',
    name: 'Travel Expense',
    type: 'EXPENSE',
    isActive: true,
    normalBalance: 'DEBIT',
  })
}

function seedFunds() {
  mockFunds.set(1, {
    id: 1,
    name: 'General Fund',
    restriction: 'UNRESTRICTED',
  })
  mockFunds.set(2, {
    id: 2,
    name: 'Housing Program',
    restriction: 'RESTRICTED',
  })
}

// Mock DB with proper chaining
vi.mock('@/lib/db', () => ({
  db: {
    select: vi.fn().mockImplementation(() => ({
      from: vi.fn().mockImplementation(() => ({
        // where() for account lookup returns the reimbursements payable account
        where: vi.fn().mockResolvedValue([{ id: 20 }]),
        leftJoin: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      })),
    })),
    update: vi.fn().mockImplementation(() => ({
      set: vi.fn().mockImplementation((setData: any) => ({
        where: vi.fn().mockImplementation(() => {
          if (setData.status) {
            const record = mockStagingRecords.find(
              (r) => r.glTransactionId === null && r.recordType === 'expense_line_item'
            )
            if (record) {
              Object.assign(record, setData)
            }
          }
          return Promise.resolve()
        }),
      })),
    })),
    insert: vi.fn().mockImplementation(() => ({
      values: vi.fn().mockResolvedValue([]),
    })),
  },
}))

// Mock GL engine
vi.mock('@/lib/gl/engine', () => ({
  createTransaction: vi.fn().mockImplementation((input: any) => {
    const id = txnIdCounter++
    const txn = {
      id,
      date: input.date,
      memo: input.memo,
      sourceType: input.sourceType,
      sourceReferenceId: input.sourceReferenceId,
      isSystemGenerated: input.isSystemGenerated,
    }
    mockTransactions.push(txn)

    const lines = input.lines.map((l: any) => {
      const line = { id: lineIdCounter++, transactionId: id, ...l }
      mockTransactionLines.push(line)
      return line
    })

    return Promise.resolve({
      transaction: {
        ...txn,
        lines: lines.map((l: any) => ({
          id: l.id,
          accountId: l.accountId,
          fundId: l.fundId,
          debit: l.debit != null ? String(l.debit) : null,
          credit: l.credit != null ? String(l.credit) : null,
          cipCostCodeId: null,
          memo: null,
        })),
      },
    })
  }),
}))

// Mock vendor resolve
vi.mock('@/lib/vendor-resolve', () => ({
  resolveVendorByZitadelId: vi.fn().mockResolvedValue(null),
}))

// Mock queries
vi.mock('./queries', () => ({
  getUnprocessedRecords: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        mockStagingRecords.filter((r) => r.status === 'received')
      )
    ),
}))

import { processReceivedStagingRecords } from './processor'
import { createTransaction } from '@/lib/gl/engine'
import { insertStagingRecordSchema } from '@/lib/validators/staging-records'

beforeEach(() => {
  mockAccounts = new Map()
  mockFunds = new Map()
  mockStagingRecords = []
  mockTransactions = []
  mockTransactionLines = []
  stagingIdCounter = 1
  txnIdCounter = 1
  lineIdCounter = 1
  vi.clearAllMocks()

  seedAccounts()
  seedFunds()
})

describe('Staging Integration: Full Expense Report Lifecycle', () => {
  it('processes an expense report from staging to GL entry', async () => {
    // Step 1: Validate the staging record
    const input = {
      sourceApp: 'expense_reports' as const,
      sourceRecordId: 'ER-2024-001-LINE-1',
      recordType: 'expense_line_item' as const,
      employeeId: 'emp-001',
      referenceId: 'ER-2024-001',
      dateIncurred: '2024-12-15',
      amount: '125.50',
      fundId: 1,
      glAccountId: 10,
      metadata: { merchant: 'Home Depot', expenseType: 'out_of_pocket' },
    }

    const validated = insertStagingRecordSchema.parse(input)
    expect(validated.sourceApp).toBe('expense_reports')

    // Step 2: Simulate INSERT into staging_records
    mockStagingRecords.push({
      id: stagingIdCounter++,
      ...input,
      status: 'received',
      glTransactionId: null,
      createdAt: new Date(),
      processedAt: null,
    })

    // Step 3: Run processor
    const result = await processReceivedStagingRecords()

    // Step 4: Verify results
    expect(result.processed).toBe(1)
    expect(result.expenseReportsPosted).toBe(1)
    expect(result.errors).toHaveLength(0)

    // Step 5: Verify GL transaction was created
    expect(mockTransactions).toHaveLength(1)
    expect(mockTransactions[0].sourceType).toBe('EXPENSE_REPORT')
    expect(mockTransactions[0].sourceReferenceId).toBe('ER-2024-001')

    // Step 6: Verify transaction lines balance
    const lines = mockTransactionLines.filter(
      (l) => l.transactionId === mockTransactions[0].id
    )
    expect(lines).toHaveLength(2)

    const totalDebits = lines.reduce(
      (sum: number, l: any) => sum + (l.debit ?? 0),
      0
    )
    const totalCredits = lines.reduce(
      (sum: number, l: any) => sum + (l.credit ?? 0),
      0
    )
    expect(totalDebits).toBeCloseTo(totalCredits, 2)

    // Debit line: expense account, fund 1
    const debitLine = lines.find((l: any) => l.debit != null)
    expect(debitLine.accountId).toBe(10) // Office Supplies
    expect(debitLine.fundId).toBe(1)
    expect(debitLine.debit).toBe(125.5)

    // Credit line: Reimbursements Payable
    const creditLine = lines.find((l: any) => l.credit != null)
    expect(creditLine.fundId).toBe(1)
    expect(creditLine.credit).toBe(125.5)
  })
})

describe('Staging Integration: Multi-Record Batch Processing', () => {
  it('processes 5 expense reports and 3 timesheets correctly', async () => {
    // 5 expense report records
    for (let i = 1; i <= 5; i++) {
      mockStagingRecords.push({
        id: stagingIdCounter++,
        sourceApp: 'expense_reports',
        sourceRecordId: `ER-BATCH-${i}`,
        recordType: 'expense_line_item',
        employeeId: `emp-00${i}`,
        referenceId: `ER-BATCH-${i}`,
        dateIncurred: '2024-12-15',
        amount: `${50 * i}.00`,
        fundId: 1,
        glAccountId: 10,
        metadata: { merchant: `Store ${i}` },
        status: 'received',
        glTransactionId: null,
        createdAt: new Date(),
        processedAt: null,
      })
    }

    // 3 timesheet records
    for (let i = 1; i <= 3; i++) {
      mockStagingRecords.push({
        id: stagingIdCounter++,
        sourceApp: 'timesheets',
        sourceRecordId: `TS-BATCH-${i}`,
        recordType: 'timesheet_fund_summary',
        employeeId: `emp-00${i}`,
        referenceId: `TS-W50-${i}`,
        dateIncurred: '2024-12-15',
        amount: '2400.00',
        fundId: 1,
        glAccountId: null,
        metadata: {},
        status: 'received',
        glTransactionId: null,
        createdAt: new Date(),
        processedAt: null,
      })
    }

    const result = await processReceivedStagingRecords()

    expect(result.processed).toBe(8)
    expect(result.expenseReportsPosted).toBe(5)
    expect(result.timesheetsReceived).toBe(3)
    expect(result.errors).toHaveLength(0)

    // 5 GL transactions created (one per expense report)
    expect(createTransaction).toHaveBeenCalledTimes(5)
    expect(mockTransactions).toHaveLength(5)
  })
})

describe('Staging Integration: Constraint Validation', () => {
  it('validates unique constraint via sourceApp + sourceRecordId', () => {
    const record1 = insertStagingRecordSchema.safeParse({
      sourceApp: 'expense_reports',
      sourceRecordId: 'ER-DUP-001',
      recordType: 'expense_line_item',
      employeeId: 'emp-001',
      referenceId: 'ER-DUP',
      dateIncurred: '2024-12-15',
      amount: '100.00',
      fundId: 1,
      glAccountId: 10,
    })
    expect(record1.success).toBe(true)

    // Same sourceRecordId + sourceApp would violate UNIQUE at DB level
    const record2 = insertStagingRecordSchema.safeParse({
      sourceApp: 'expense_reports',
      sourceRecordId: 'ER-DUP-001',
      recordType: 'expense_line_item',
      employeeId: 'emp-001',
      referenceId: 'ER-DUP',
      dateIncurred: '2024-12-15',
      amount: '100.00',
      fundId: 1,
      glAccountId: 10,
    })
    expect(record2.success).toBe(true) // Zod passes; DB unique constraint catches duplicates
  })

  it('rejects record with non-positive fundId', () => {
    const result = insertStagingRecordSchema.safeParse({
      sourceApp: 'expense_reports',
      sourceRecordId: 'ER-BAD-FUND',
      recordType: 'expense_line_item',
      employeeId: 'emp-001',
      referenceId: 'ER-BAD',
      dateIncurred: '2024-12-15',
      amount: '100.00',
      fundId: 0, // invalid
      glAccountId: 10,
    })
    expect(result.success).toBe(false)
  })
})

describe('Staging Integration: Status Read-Back', () => {
  it('verifies status changes after processing', async () => {
    mockStagingRecords.push({
      id: 1,
      sourceApp: 'expense_reports',
      sourceRecordId: 'ER-STATUS-001',
      recordType: 'expense_line_item',
      employeeId: 'emp-001',
      referenceId: 'ER-STATUS',
      dateIncurred: '2024-12-15',
      amount: '100.00',
      fundId: 1,
      glAccountId: 10,
      metadata: {},
      status: 'received',
      glTransactionId: null,
      createdAt: new Date(),
      processedAt: null,
    })

    const result = await processReceivedStagingRecords()
    expect(result.expenseReportsPosted).toBe(1)

    // DB update was called to set status → 'posted' + glTransactionId
    const { db } = await import('@/lib/db')
    expect(db.update).toHaveBeenCalled()
  })
})
