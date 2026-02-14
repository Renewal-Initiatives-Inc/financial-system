import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  insertStagingRecordSchema,
  timesheetMetadataSchema,
  expenseMetadataSchema,
} from '@/lib/validators/staging-records'

// --- Mock setup ---

let mockStagingRecords: any[] = []
let mockUpdates: { id: number; set: any }[] = []
let mockGLTransactions: any[] = []
let glTransactionIdCounter = 100

// Mock the DB module with proper chaining for account lookups
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
      set: vi.fn().mockImplementation((setData) => ({
        where: vi.fn().mockImplementation(() => {
          mockUpdates.push({ id: 0, set: setData })
          return Promise.resolve()
        }),
      })),
    })),
  },
}))

// Mock the GL engine
vi.mock('@/lib/gl/engine', () => ({
  createTransaction: vi.fn().mockImplementation((input) => {
    const id = glTransactionIdCounter++
    const txn = {
      transaction: {
        id,
        date: input.date,
        memo: input.memo,
        sourceType: input.sourceType,
        isSystemGenerated: input.isSystemGenerated,
        lines: input.lines.map((l: any, i: number) => ({
          id: i + 1,
          ...l,
        })),
      },
    }
    mockGLTransactions.push(txn)
    return Promise.resolve(txn)
  }),
}))

// Mock queries module to return our mock data
vi.mock('./queries', () => ({
  getUnprocessedRecords: vi
    .fn()
    .mockImplementation(() =>
      Promise.resolve(
        mockStagingRecords.filter((r) => r.status === 'received')
      )
    ),
}))

// Import after mocks
import { processReceivedStagingRecords } from './processor'
import { createTransaction } from '@/lib/gl/engine'

beforeEach(() => {
  mockStagingRecords = []
  mockUpdates = []
  mockGLTransactions = []
  glTransactionIdCounter = 100
  vi.clearAllMocks()
})

// --- Validator Tests ---

describe('Staging Record Validators', () => {
  const validExpenseRecord = {
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

  const validTimesheetRecord = {
    sourceApp: 'timesheets' as const,
    sourceRecordId: 'TS-2024-W50-FUND1',
    recordType: 'timesheet_fund_summary' as const,
    employeeId: 'emp-001',
    referenceId: 'TS-2024-W50',
    dateIncurred: '2024-12-15',
    amount: '2400.00',
    fundId: 1,
    metadata: {
      regularHours: 40,
      overtimeHours: 0,
      regularEarnings: 2400,
      overtimeEarnings: 0,
    },
  }

  it('validates a valid expense line item', () => {
    const result = insertStagingRecordSchema.safeParse(validExpenseRecord)
    expect(result.success).toBe(true)
  })

  it('validates a valid timesheet fund summary', () => {
    const result = insertStagingRecordSchema.safeParse(validTimesheetRecord)
    expect(result.success).toBe(true)
  })

  it('rejects expense_line_item without glAccountId', () => {
    const { glAccountId, ...noAccount } = validExpenseRecord
    const result = insertStagingRecordSchema.safeParse(noAccount)
    expect(result.success).toBe(false)
  })

  it('rejects timesheet_fund_summary with glAccountId', () => {
    const result = insertStagingRecordSchema.safeParse({
      ...validTimesheetRecord,
      glAccountId: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched sourceApp and recordType (timesheets + expense_line_item)', () => {
    const result = insertStagingRecordSchema.safeParse({
      ...validTimesheetRecord,
      recordType: 'expense_line_item',
      glAccountId: 10,
    })
    expect(result.success).toBe(false)
  })

  it('rejects mismatched sourceApp and recordType (expense_reports + timesheet_fund_summary)', () => {
    const result = insertStagingRecordSchema.safeParse({
      ...validExpenseRecord,
      recordType: 'timesheet_fund_summary',
      glAccountId: null,
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid amount format', () => {
    const result = insertStagingRecordSchema.safeParse({
      ...validExpenseRecord,
      amount: 'not-a-number',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty sourceRecordId', () => {
    const result = insertStagingRecordSchema.safeParse({
      ...validExpenseRecord,
      sourceRecordId: '',
    })
    expect(result.success).toBe(false)
  })

  it('validates timesheet metadata schema', () => {
    const result = timesheetMetadataSchema.safeParse({
      regularHours: 40,
      overtimeHours: 5,
      regularEarnings: 2400,
      overtimeEarnings: 450,
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative hours in timesheet metadata', () => {
    const result = timesheetMetadataSchema.safeParse({
      regularHours: -5,
      overtimeHours: 0,
      regularEarnings: 0,
      overtimeEarnings: 0,
    })
    expect(result.success).toBe(false)
  })

  it('validates expense metadata with out_of_pocket type', () => {
    const result = expenseMetadataSchema.safeParse({
      merchant: 'Home Depot',
      expenseType: 'out_of_pocket',
    })
    expect(result.success).toBe(true)
  })

  it('validates expense metadata with mileage type and details', () => {
    const result = expenseMetadataSchema.safeParse({
      merchant: 'Mileage Reimbursement',
      expenseType: 'mileage',
      mileageDetails: { miles: 45.2, rate: 0.67 },
    })
    expect(result.success).toBe(true)
  })

  it('rejects expense metadata with empty merchant', () => {
    const result = expenseMetadataSchema.safeParse({
      merchant: '',
      expenseType: 'out_of_pocket',
    })
    expect(result.success).toBe(false)
  })
})

// --- Processor Tests ---

describe('Staging Processor', () => {
  it('processes expense report records into GL entries', async () => {
    mockStagingRecords = [
      {
        id: 1,
        sourceApp: 'expense_reports',
        sourceRecordId: 'ER-001-L1',
        recordType: 'expense_line_item',
        employeeId: 'emp-001',
        referenceId: 'ER-001',
        dateIncurred: '2024-12-15',
        amount: '125.50',
        fundId: 1,
        glAccountId: 10,
        metadata: { merchant: 'Home Depot', memo: 'Supplies' },
        status: 'received',
        glTransactionId: null,
        createdAt: new Date(),
        processedAt: null,
      },
    ]

    const result = await processReceivedStagingRecords()

    expect(result.processed).toBe(1)
    expect(result.expenseReportsPosted).toBe(1)
    expect(result.timesheetsReceived).toBe(0)
    expect(result.errors).toHaveLength(0)

    // Verify GL engine was called with correct parameters
    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2024-12-15',
        sourceType: 'EXPENSE_REPORT',
        sourceReferenceId: 'ER-001',
        isSystemGenerated: true,
        createdBy: 'system:staging-processor',
        lines: expect.arrayContaining([
          expect.objectContaining({
            accountId: 10,
            fundId: 1,
            debit: 125.5,
            credit: null,
          }),
        ]),
      })
    )
  })

  it('leaves timesheet records in received status', async () => {
    mockStagingRecords = [
      {
        id: 2,
        sourceApp: 'timesheets',
        sourceRecordId: 'TS-W50-F1',
        recordType: 'timesheet_fund_summary',
        employeeId: 'emp-001',
        referenceId: 'TS-W50',
        dateIncurred: '2024-12-15',
        amount: '2400.00',
        fundId: 1,
        glAccountId: null,
        metadata: {},
        status: 'received',
        glTransactionId: null,
        createdAt: new Date(),
        processedAt: null,
      },
    ]

    const result = await processReceivedStagingRecords()

    expect(result.processed).toBe(1)
    expect(result.timesheetsReceived).toBe(1)
    expect(result.expenseReportsPosted).toBe(0)

    // GL engine should NOT be called for timesheets
    expect(createTransaction).not.toHaveBeenCalled()
  })

  it('handles mixed batch of timesheets and expense reports', async () => {
    mockStagingRecords = [
      {
        id: 1,
        recordType: 'expense_line_item',
        amount: '100.00',
        fundId: 1,
        glAccountId: 10,
        referenceId: 'ER-001',
        dateIncurred: '2024-12-15',
        metadata: { merchant: 'Store' },
        status: 'received',
        glTransactionId: null,
      },
      {
        id: 2,
        recordType: 'timesheet_fund_summary',
        amount: '2400.00',
        fundId: 1,
        glAccountId: null,
        referenceId: 'TS-001',
        dateIncurred: '2024-12-15',
        metadata: {},
        status: 'received',
        glTransactionId: null,
      },
      {
        id: 3,
        recordType: 'expense_line_item',
        amount: '50.00',
        fundId: 2,
        glAccountId: 11,
        referenceId: 'ER-002',
        dateIncurred: '2024-12-15',
        metadata: { merchant: 'Amazon' },
        status: 'received',
        glTransactionId: null,
      },
    ]

    const result = await processReceivedStagingRecords()

    expect(result.processed).toBe(3)
    expect(result.expenseReportsPosted).toBe(2)
    expect(result.timesheetsReceived).toBe(1)
    expect(result.errors).toHaveLength(0)

    // GL engine should be called twice (once per expense report)
    expect(createTransaction).toHaveBeenCalledTimes(2)
  })

  it('returns zero processed when no unprocessed records exist', async () => {
    mockStagingRecords = []

    const result = await processReceivedStagingRecords()

    expect(result.processed).toBe(0)
    expect(result.expenseReportsPosted).toBe(0)
    expect(result.timesheetsReceived).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('handles individual record failures gracefully', async () => {
    // Make GL engine fail on the first call
    const mockCreateTransaction = vi.mocked(createTransaction)
    mockCreateTransaction
      .mockRejectedValueOnce(new Error('Account ID 999 does not exist'))
      .mockResolvedValueOnce({
        transaction: {
          id: 101,
          date: '2024-12-15',
          memo: 'test',
          sourceType: 'EXPENSE_REPORT',
          isSystemGenerated: true,
          lines: [],
        },
      })

    mockStagingRecords = [
      {
        id: 1,
        recordType: 'expense_line_item',
        amount: '100.00',
        fundId: 1,
        glAccountId: 999, // invalid
        referenceId: 'ER-FAIL',
        dateIncurred: '2024-12-15',
        metadata: {},
        status: 'received',
        glTransactionId: null,
      },
      {
        id: 2,
        recordType: 'expense_line_item',
        amount: '50.00',
        fundId: 1,
        glAccountId: 10,
        referenceId: 'ER-OK',
        dateIncurred: '2024-12-15',
        metadata: { merchant: 'Store' },
        status: 'received',
        glTransactionId: null,
      },
    ]

    const result = await processReceivedStagingRecords()

    // First fails, second succeeds
    expect(result.processed).toBe(1)
    expect(result.expenseReportsPosted).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].recordId).toBe(1)
    expect(result.errors[0].error).toContain('Account ID 999')
  })

  it('builds memo from metadata merchant and memo', async () => {
    mockStagingRecords = [
      {
        id: 1,
        recordType: 'expense_line_item',
        amount: '75.00',
        fundId: 1,
        glAccountId: 10,
        referenceId: 'ER-MEMO',
        dateIncurred: '2024-12-15',
        metadata: { merchant: 'Staples', memo: 'Office supplies for March' },
        status: 'received',
        glTransactionId: null,
      },
    ]

    await processReceivedStagingRecords()

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        memo: 'Expense report: Staples — Office supplies for March',
      })
    )
  })

  it('uses referenceId as memo fallback when no metadata', async () => {
    mockStagingRecords = [
      {
        id: 1,
        recordType: 'expense_line_item',
        amount: '75.00',
        fundId: 1,
        glAccountId: 10,
        referenceId: 'ER-2024-042',
        dateIncurred: '2024-12-15',
        metadata: null,
        status: 'received',
        glTransactionId: null,
      },
    ]

    await processReceivedStagingRecords()

    expect(createTransaction).toHaveBeenCalledWith(
      expect.objectContaining({
        memo: 'Expense report: ER-2024-042',
      })
    )
  })
})
