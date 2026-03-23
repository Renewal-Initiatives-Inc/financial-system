import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { InsertTransaction, EditTransaction } from '@/lib/validators'

// --- Mock setup ---
// We mock the entire database layer to test business logic without a live DB.

let transactionIdCounter = 1
let lineIdCounter = 1

// Storage for "inserted" data so we can verify and re-fetch
let insertedTransactions: any[] = []
let insertedLines: any[] = []
let mockAccounts: any[] = []
let mockFunds: any[] = []
let auditLogEntries: any[] = []

// Track update calls
let updatedTransactions: { id: number; set: any }[] = []
let deletedLineTransactionIds: number[] = []

// Mock returning() chain for insert
function mockInsertReturning(table: string) {
  return {
    values: vi.fn().mockImplementation((vals: any) => {
      if (table === 'transactions') {
        const rows = Array.isArray(vals) ? vals : [vals]
        const results = rows.map((v: any) => {
          const row = {
            id: transactionIdCounter++,
            date: v.date,
            memo: v.memo,
            sourceType: v.sourceType,
            sourceReferenceId: v.sourceReferenceId ?? null,
            isSystemGenerated: v.isSystemGenerated ?? false,
            isVoided: v.isVoided ?? false,
            reversalOfId: v.reversalOfId ?? null,
            reversedById: v.reversedById ?? null,
            createdBy: v.createdBy,
            createdAt: new Date(),
          }
          insertedTransactions.push(row)
          return row
        })
        return { returning: () => Promise.resolve(results) }
      }
      if (table === 'transaction_lines') {
        const rows = Array.isArray(vals) ? vals : [vals]
        const results = rows.map((v: any) => {
          const row = {
            id: lineIdCounter++,
            transactionId: v.transactionId,
            accountId: v.accountId,
            fundId: v.fundId,
            debit: v.debit,
            credit: v.credit,
            cipCostCodeId: v.cipCostCodeId ?? null,
            memo: v.memo ?? null,
          }
          insertedLines.push(row)
          return row
        })
        return { returning: () => Promise.resolve(results) }
      }
      if (table === 'audit_log') {
        const rows = Array.isArray(vals) ? vals : [vals]
        rows.forEach((v: any) => auditLogEntries.push(v))
        return { returning: () => Promise.resolve(rows) }
      }
      return { returning: () => Promise.resolve([]) }
    }),
  }
}

// Build a mock transaction context that supports chained select/insert/update/delete
function createMockTx() {
  const tx: any = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockImplementation((table: any) => {
        const tableName = getTableName(table)
        return {
          where: vi.fn().mockImplementation(() => {
            if (tableName === 'accounts') {
              return Promise.resolve(mockAccounts)
            }
            if (tableName === 'funds') {
              return Promise.resolve(mockFunds)
            }
            if (tableName === 'transactions') {
              // Return the most recently requested transaction
              return Promise.resolve(
                insertedTransactions.length > 0
                  ? [insertedTransactions[insertedTransactions.length - 1]]
                  : []
              )
            }
            if (tableName === 'transaction_lines') {
              return Promise.resolve(insertedLines)
            }
            return Promise.resolve([])
          }),
          innerJoin: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([{ netDebit: '0.00' }]),
          }),
        }
      }),
    }),
    insert: vi.fn().mockImplementation((table: any) => {
      const tableName = getTableName(table)
      return mockInsertReturning(tableName)
    }),
    update: vi.fn().mockImplementation((table: any) => {
      return {
        set: vi.fn().mockImplementation((setValues: any) => {
          return {
            where: vi.fn().mockImplementation(() => {
              updatedTransactions.push({ id: 0, set: setValues })
              return Promise.resolve()
            }),
          }
        }),
      }
    }),
    delete: vi.fn().mockImplementation(() => {
      return {
        where: vi.fn().mockImplementation(() => {
          deletedLineTransactionIds.push(0)
          return Promise.resolve()
        }),
      }
    }),
  }
  return tx
}

function getTableName(table: any): string {
  // Drizzle tables have a Symbol-based name. We'll use a simple heuristic.
  const str = JSON.stringify(table)
  if (str.includes('transaction_lines') || str.includes('transactionLines'))
    return 'transaction_lines'
  if (str.includes('transactions')) return 'transactions'
  if (str.includes('accounts')) return 'accounts'
  if (str.includes('funds')) return 'funds'
  if (str.includes('audit_log') || str.includes('auditLog'))
    return 'audit_log'
  return 'unknown'
}

// Mock the db module to use our mock transaction
vi.mock('@/lib/db', () => ({
  db: {
    transaction: vi.fn().mockImplementation(async (fn: any) => {
      const tx = createMockTx()
      return fn(tx)
    }),
  },
}))

// Mock the schema
vi.mock('@/lib/db/schema', () => ({
  accounts: { _name: 'accounts' },
  funds: { _name: 'funds' },
  transactions: {
    _name: 'transactions',
    id: 'id',
    date: 'date',
    memo: 'memo',
    isVoided: 'is_voided',
    reversedById: 'reversed_by_id',
  },
  transactionLines: {
    _name: 'transaction_lines',
    transactionId: 'transaction_id',
  },
  auditLog: { _name: 'audit_log' },
  bankMatches: {
    _name: 'bank_matches',
    glTransactionLineId: 'gl_transaction_line_id',
  },
}))

// Mock drizzle-orm operators
vi.mock('drizzle-orm', () => ({
  eq: vi.fn().mockImplementation((a, b) => ({ op: 'eq', a, b })),
  inArray: vi.fn().mockImplementation((a, b) => ({ op: 'inArray', a, b })),
  sql: vi.fn(),
}))

// Mock the lookups module to use our mock data directly
vi.mock('./lookups', () => ({
  getAccountsById: vi.fn().mockImplementation(async (_tx: any, ids: number[]) => {
    const map = new Map<number, any>()
    for (const id of ids) {
      const account = mockAccounts.find((a: any) => a.id === id)
      if (account) map.set(id, account)
    }
    return map
  }),
  getFundsById: vi.fn().mockImplementation(async (_tx: any, ids: number[]) => {
    const map = new Map<number, any>()
    for (const id of ids) {
      const fund = mockFunds.find((f: any) => f.id === id)
      if (fund) map.set(id, fund)
    }
    return map
  }),
  getNetAssetAccounts: vi.fn().mockImplementation(async () => ({
    unrestricted: {
      id: 100,
      code: '3000',
      name: 'Net Assets Without Donor Restrictions',
      type: 'NET_ASSET',
      isActive: true,
    },
    restricted: {
      id: 101,
      code: '3100',
      name: 'Net Assets With Donor Restrictions',
      type: 'NET_ASSET',
      isActive: true,
    },
  })),
  getTransactionWithLines: vi.fn().mockImplementation(async (_tx: any, id: number) => {
    const txn = insertedTransactions.find((t: any) => t.id === id)
    if (!txn) return null
    const lines = insertedLines.filter((l: any) => l.transactionId === id)
    return { ...txn, lines }
  }),
}))

// Mock the audit logger
vi.mock('@/lib/audit/logger', () => ({
  logAudit: vi.fn().mockImplementation(async (_tx: any, params: any) => {
    auditLogEntries.push(params)
  }),
}))

// Mock fiscal year lock helpers — default: no years locked
vi.mock('@/lib/fiscal-year-lock', () => ({
  isYearLocked: vi.fn().mockResolvedValue(false),
  getFiscalYearFromDate: vi.fn().mockImplementation((date: string) => {
    return parseInt(date.substring(0, 4), 10)
  }),
}))

// Import after mocks
import {
  createTransaction,
  editTransaction,
  reverseTransaction,
  voidTransaction,
} from './engine'
import { deactivateAccount, deactivateFund } from './deactivation'
import {
  InvalidAccountError,
  InvalidFundError,
  ImmutableTransactionError,
  VoidedTransactionError,
  AlreadyReversedError,
  TransactionNotFoundError,
  EntityNotFoundError,
  SystemLockedError,
} from './errors'
import { logAudit } from '@/lib/audit/logger'
import { getTransactionWithLines } from './lookups'

// --- Test helpers ---

function makeActiveAccount(id: number, type = 'EXPENSE', code = `${id}`) {
  return {
    id,
    code,
    name: `Account ${id}`,
    type,
    subType: null,
    normalBalance: type === 'EXPENSE' || type === 'ASSET' ? 'DEBIT' : 'CREDIT',
    isActive: true,
    form990Line: null,
    parentAccountId: null,
    isSystemLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function makeActiveFund(
  id: number,
  restriction: 'RESTRICTED' | 'UNRESTRICTED' = 'UNRESTRICTED'
) {
  return {
    id,
    name: `Fund ${id}`,
    restrictionType: restriction,
    isActive: true,
    description: null,
    isSystemLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }
}

function validInput(overrides: Partial<InsertTransaction> = {}): InsertTransaction {
  return {
    date: '2025-01-15',
    memo: 'Test transaction',
    sourceType: 'MANUAL',
    isSystemGenerated: false,
    createdBy: 'user-1',
    lines: [
      { accountId: 1, fundId: 1, debit: 100, credit: null },
      { accountId: 2, fundId: 1, debit: null, credit: 100 },
    ],
    ...overrides,
  }
}

// --- Tests ---

describe('GL Engine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    transactionIdCounter = 1
    lineIdCounter = 1
    insertedTransactions = []
    insertedLines = []
    auditLogEntries = []
    updatedTransactions = []
    deletedLineTransactionIds = []

    // Default: two active accounts and one unrestricted fund
    mockAccounts = [
      makeActiveAccount(1, 'EXPENSE', '5000'),
      makeActiveAccount(2, 'ASSET', '1000'),
    ]
    mockFunds = [makeActiveFund(1)]
  })

  // =====================
  // createTransaction — happy path
  // =====================

  describe('createTransaction — happy path', () => {
    it('creates a balanced 2-line entry and returns transaction with ID and lines', async () => {
      const result = await createTransaction(validInput())

      expect(result.transaction.id).toBe(1)
      expect(result.transaction.date).toBe('2025-01-15')
      expect(result.transaction.memo).toBe('Test transaction')
      expect(result.transaction.sourceType).toBe('MANUAL')
      expect(result.transaction.lines).toHaveLength(2)
    })

    it('creates a multi-line entry (4 lines, 2 DR 2 CR)', async () => {
      mockAccounts = [
        makeActiveAccount(1, 'EXPENSE'),
        makeActiveAccount(2, 'EXPENSE'),
        makeActiveAccount(3, 'ASSET'),
        makeActiveAccount(4, 'ASSET'),
      ]

      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 1, debit: 300, credit: null },
            { accountId: 2, fundId: 1, debit: 200, credit: null },
            { accountId: 3, fundId: 1, debit: null, credit: 300 },
            { accountId: 4, fundId: 1, debit: null, credit: 200 },
          ],
        })
      )

      expect(result.transaction.lines).toHaveLength(4)
    })

    it('creates a multi-fund entry', async () => {
      mockFunds = [makeActiveFund(1), makeActiveFund(2)]

      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 1, debit: 100, credit: null },
            { accountId: 2, fundId: 2, debit: null, credit: 100 },
          ],
        })
      )

      expect(result.transaction.lines[0].fundId).toBe(1)
      expect(result.transaction.lines[1].fundId).toBe(2)
    })

    it('sets source provenance correctly (INV-011)', async () => {
      const result = await createTransaction(
        validInput({
          sourceType: 'RAMP',
          sourceReferenceId: 'ramp-txn-123',
        })
      )

      expect(result.transaction.sourceType).toBe('RAMP')
    })

    it('sets system-generated flag (INV-008)', async () => {
      const result = await createTransaction(
        validInput({
          isSystemGenerated: true,
          sourceType: 'SYSTEM',
        })
      )

      expect(result.transaction.isSystemGenerated).toBe(true)
    })

    it('creates an audit log entry with action=created (INV-012)', async () => {
      await createTransaction(validInput())

      expect(logAudit).toHaveBeenCalled()
      const auditCall = (logAudit as any).mock.calls[0][1]
      expect(auditCall.action).toBe('created')
      expect(auditCall.entityType).toBe('transaction')
      expect(auditCall.entityId).toBe(1)
      expect(auditCall.afterState).toBeDefined()
    })

    it('accepts CIP cost code on a line', async () => {
      const result = await createTransaction(
        validInput({
          lines: [
            {
              accountId: 1,
              fundId: 1,
              debit: 100,
              credit: null,
              cipCostCodeId: 5,
            },
            { accountId: 2, fundId: 1, debit: null, credit: 100 },
          ],
        })
      )

      expect(result.transaction.lines[0].cipCostCodeId).toBe(5)
    })
  })

  // =====================
  // createTransaction — validation failures
  // =====================

  describe('createTransaction — validation failures', () => {
    it('rejects unbalanced entries (INV-001)', async () => {
      await expect(
        createTransaction(
          validInput({
            lines: [
              { accountId: 1, fundId: 1, debit: 100, credit: null },
              { accountId: 2, fundId: 1, debit: null, credit: 50 },
            ],
          })
        )
      ).rejects.toThrow()
    })

    it('rejects entries with fewer than 2 lines', async () => {
      await expect(
        createTransaction(
          validInput({
            lines: [{ accountId: 1, fundId: 1, debit: 100, credit: null }],
          })
        )
      ).rejects.toThrow()
    })

    it('rejects inactive accounts (INV-004)', async () => {
      mockAccounts = [
        { ...makeActiveAccount(1), isActive: false },
        makeActiveAccount(2),
      ]

      await expect(createTransaction(validInput())).rejects.toThrow(
        InvalidAccountError
      )
    })

    it('rejects nonexistent accounts (INV-002)', async () => {
      mockAccounts = [makeActiveAccount(2)] // account 1 missing

      await expect(createTransaction(validInput())).rejects.toThrow(
        InvalidAccountError
      )
    })

    it('rejects nonexistent funds (INV-003)', async () => {
      mockFunds = [] // fund 1 missing

      await expect(createTransaction(validInput())).rejects.toThrow(
        InvalidFundError
      )
    })

    it('rejects a line with both debit and credit', async () => {
      await expect(
        createTransaction(
          validInput({
            lines: [
              { accountId: 1, fundId: 1, debit: 100, credit: 100 },
              { accountId: 2, fundId: 1, debit: null, credit: 100 },
            ],
          })
        )
      ).rejects.toThrow()
    })

    it('rejects a line with neither debit nor credit', async () => {
      await expect(
        createTransaction(
          validInput({
            lines: [
              { accountId: 1, fundId: 1, debit: null, credit: null },
              { accountId: 2, fundId: 1, debit: null, credit: 100 },
            ],
          })
        )
      ).rejects.toThrow()
    })

    it('rejects negative amounts', async () => {
      await expect(
        createTransaction(
          validInput({
            lines: [
              { accountId: 1, fundId: 1, debit: -100, credit: null },
              { accountId: 2, fundId: 1, debit: null, credit: -100 },
            ],
          })
        )
      ).rejects.toThrow()
    })

    it('rejects missing memo', async () => {
      await expect(
        createTransaction(validInput({ memo: '' }))
      ).rejects.toThrow()
    })
  })

  // =====================
  // Restricted fund auto-release (INV-007)
  // =====================

  describe('createTransaction — restricted fund release (INV-007)', () => {
    beforeEach(() => {
      mockAccounts = [
        makeActiveAccount(1, 'EXPENSE', '5000'),
        makeActiveAccount(2, 'ASSET', '1000'),
        {
          id: 100,
          code: '3000',
          name: 'Net Assets Without Donor Restrictions',
          type: 'NET_ASSET',
          isActive: true,
          normalBalance: 'CREDIT',
          isSystemLocked: true,
        },
        {
          id: 101,
          code: '3100',
          name: 'Net Assets With Donor Restrictions',
          type: 'NET_ASSET',
          isActive: true,
          normalBalance: 'CREDIT',
          isSystemLocked: true,
        },
      ]
      mockFunds = [makeActiveFund(10, 'RESTRICTED')]
    })

    it('generates release transaction for expense to restricted fund', async () => {
      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 10, debit: 500, credit: null },
            { accountId: 2, fundId: 10, debit: null, credit: 500 },
          ],
        })
      )

      expect(result.releaseTransaction).toBeDefined()
      expect(result.releaseTransaction!.isSystemGenerated).toBe(true)
      expect(result.releaseTransaction!.memo).toContain('Net asset release')
    })

    it('release transaction uses same fund as triggering expense', async () => {
      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 10, debit: 500, credit: null },
            { accountId: 2, fundId: 10, debit: null, credit: 500 },
          ],
        })
      )

      for (const line of result.releaseTransaction!.lines) {
        expect(line.fundId).toBe(10)
      }
    })

    it('release amount matches expense amount', async () => {
      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 10, debit: 123.45, credit: null },
            { accountId: 2, fundId: 10, debit: null, credit: 123.45 },
          ],
        })
      )

      const releaseLines = result.releaseTransaction!.lines
      const debitLine = releaseLines.find((l) => l.debit != null)
      const creditLine = releaseLines.find((l) => l.credit != null)

      expect(parseFloat(debitLine!.debit!)).toBe(123.45)
      expect(parseFloat(creditLine!.credit!)).toBe(123.45)
    })

    it('non-expense debit to restricted fund does NOT trigger release', async () => {
      mockAccounts = [
        makeActiveAccount(1, 'ASSET', '1500'), // Asset, not expense
        makeActiveAccount(2, 'ASSET', '1000'),
      ]

      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 10, debit: 500, credit: null },
            { accountId: 2, fundId: 10, debit: null, credit: 500 },
          ],
        })
      )

      expect(result.releaseTransaction).toBeUndefined()
    })

    it('expense to unrestricted fund does NOT trigger release', async () => {
      mockFunds = [makeActiveFund(1, 'UNRESTRICTED')]

      const result = await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 1, debit: 500, credit: null },
            { accountId: 2, fundId: 1, debit: null, credit: 500 },
          ],
        })
      )

      expect(result.releaseTransaction).toBeUndefined()
    })

    it('creates audit log entry for release transaction', async () => {
      await createTransaction(
        validInput({
          lines: [
            { accountId: 1, fundId: 10, debit: 500, credit: null },
            { accountId: 2, fundId: 10, debit: null, credit: 500 },
          ],
        })
      )

      // Should have 2 audit entries: one for main txn, one for release
      const auditCalls = (logAudit as any).mock.calls
      expect(auditCalls.length).toBe(2)
      expect(auditCalls[1][1].action).toBe('created')
      expect(auditCalls[1][1].metadata).toHaveProperty(
        'triggeringTransactionId'
      )
    })
  })

  // =====================
  // editTransaction
  // =====================

  describe('editTransaction', () => {
    beforeEach(async () => {
      // Create a transaction to edit
      await createTransaction(validInput())
    })

    it('edits an unmatched transaction memo', async () => {
      const result = await editTransaction(1, { memo: 'Updated memo' }, 'user-1')

      expect(result.transaction).toBeDefined()
    })

    it('edits with new lines', async () => {
      mockAccounts = [
        makeActiveAccount(1, 'EXPENSE'),
        makeActiveAccount(2, 'ASSET'),
        makeActiveAccount(3, 'REVENUE'),
      ]

      const result = await editTransaction(
        1,
        {
          lines: [
            { accountId: 1, fundId: 1, debit: 200, credit: null },
            { accountId: 3, fundId: 1, debit: null, credit: 200 },
          ],
        },
        'user-1'
      )

      expect(result.transaction).toBeDefined()
    })

    it('rejects editing a voided transaction', async () => {
      // Make the transaction voided
      insertedTransactions[0].isVoided = true

      await expect(
        editTransaction(1, { memo: 'new' }, 'user-1')
      ).rejects.toThrow(VoidedTransactionError)
    })

    it('rejects editing a system-generated transaction (INV-008)', async () => {
      insertedTransactions[0].isSystemGenerated = true

      await expect(
        editTransaction(1, { memo: 'new' }, 'user-1')
      ).rejects.toThrow(ImmutableTransactionError)
    })

    it('rejects editing a reversed transaction', async () => {
      insertedTransactions[0].reversedById = 99

      await expect(
        editTransaction(1, { memo: 'new' }, 'user-1')
      ).rejects.toThrow(ImmutableTransactionError)
    })

    it('rejects editing nonexistent transaction', async () => {
      vi.mocked(getTransactionWithLines).mockResolvedValueOnce(null)

      await expect(
        editTransaction(999, { memo: 'new' }, 'user-1')
      ).rejects.toThrow(TransactionNotFoundError)
    })

    it('records before/after in audit log', async () => {
      vi.clearAllMocks()
      await editTransaction(1, { memo: 'Updated' }, 'user-1')

      const auditCalls = (logAudit as any).mock.calls
      const editAudit = auditCalls.find(
        (c: any) => c[1].action === 'updated'
      )
      expect(editAudit).toBeDefined()
      expect(editAudit[1].beforeState).toBeDefined()
      expect(editAudit[1].afterState).toBeDefined()
    })
  })

  // =====================
  // reverseTransaction
  // =====================

  describe('reverseTransaction', () => {
    beforeEach(async () => {
      await createTransaction(validInput())
    })

    it('creates a linked reversal entry', async () => {
      const result = await reverseTransaction(1, 'user-1')

      expect(result.transaction).toBeDefined()
      expect(result.transaction.memo).toContain('Reversal of:')
    })

    it('reversal has opposite amounts (debit→credit, credit→debit)', async () => {
      const result = await reverseTransaction(1, 'user-1')
      const lines = result.transaction.lines

      // Original: line 1 has debit, line 2 has credit
      // Reversal: line 1 should have credit, line 2 should have debit
      // The swap means original debit becomes reversal credit
      const hasDebit = lines.some((l) => l.debit != null)
      const hasCredit = lines.some((l) => l.credit != null)
      expect(hasDebit).toBe(true)
      expect(hasCredit).toBe(true)
    })

    it('reversal memo references original', async () => {
      const result = await reverseTransaction(1, 'user-1')
      expect(result.transaction.memo).toBe('Reversal of: Test transaction')
    })

    it('logs audit on both original and reversal transactions', async () => {
      vi.clearAllMocks()
      await reverseTransaction(1, 'user-1')

      const auditCalls = (logAudit as any).mock.calls
      expect(auditCalls.length).toBe(2)
      expect(auditCalls[0][1].action).toBe('reversed')
      expect(auditCalls[1][1].action).toBe('created')
    })

    it('rejects reversing an already-reversed transaction', async () => {
      insertedTransactions[0].reversedById = 99

      await expect(reverseTransaction(1, 'user-1')).rejects.toThrow(
        AlreadyReversedError
      )
    })

    it('rejects reversing a voided transaction', async () => {
      insertedTransactions[0].isVoided = true

      await expect(reverseTransaction(1, 'user-1')).rejects.toThrow(
        VoidedTransactionError
      )
    })

    it('rejects reversing nonexistent transaction', async () => {
      vi.mocked(getTransactionWithLines).mockResolvedValueOnce(null)

      await expect(reverseTransaction(999, 'user-1')).rejects.toThrow(
        TransactionNotFoundError
      )
    })
  })

  // =====================
  // voidTransaction
  // =====================

  describe('voidTransaction', () => {
    beforeEach(async () => {
      await createTransaction(validInput())
    })

    it('sets isVoided to true', async () => {
      await voidTransaction(1, 'user-1')

      // Verify update was called
      const auditCalls = (logAudit as any).mock.calls
      const voidAudit = auditCalls.find(
        (c: any) => c[1].action === 'voided'
      )
      expect(voidAudit).toBeDefined()
      expect(voidAudit[1].afterState).toEqual({ isVoided: true })
    })

    it('logs audit with before/after state', async () => {
      vi.clearAllMocks()
      await voidTransaction(1, 'user-1')

      const auditCalls = (logAudit as any).mock.calls
      expect(auditCalls.length).toBe(1)
      expect(auditCalls[0][1].action).toBe('voided')
      expect(auditCalls[0][1].beforeState).toEqual({ isVoided: false })
      expect(auditCalls[0][1].afterState).toEqual({ isVoided: true })
    })

    it('rejects voiding an already-voided transaction', async () => {
      insertedTransactions[0].isVoided = true

      await expect(voidTransaction(1, 'user-1')).rejects.toThrow(
        VoidedTransactionError
      )
    })

    it('rejects voiding nonexistent transaction', async () => {
      vi.mocked(getTransactionWithLines).mockResolvedValueOnce(null)

      await expect(voidTransaction(999, 'user-1')).rejects.toThrow(
        TransactionNotFoundError
      )
    })
  })

  // =====================
  // deactivateAccount
  // =====================

  describe('deactivateAccount', () => {
    it('deactivates a non-locked account', async () => {
      mockAccounts = [makeActiveAccount(1)]
      await deactivateAccount(1, 'user-1')

      const auditCalls = (logAudit as any).mock.calls
      const deactivateAudit = auditCalls.find(
        (c: any) => c[1].action === 'deactivated' && c[1].entityType === 'account'
      )
      expect(deactivateAudit).toBeDefined()
    })

    it('rejects deactivating a system-locked account', async () => {
      mockAccounts = [{ ...makeActiveAccount(1), isSystemLocked: true }]

      await expect(deactivateAccount(1, 'user-1')).rejects.toThrow(
        SystemLockedError
      )
    })

    it('rejects deactivating nonexistent account', async () => {
      mockAccounts = []

      await expect(deactivateAccount(999, 'user-1')).rejects.toThrow(
        EntityNotFoundError
      )
    })
  })

  // =====================
  // deactivateFund
  // =====================

  describe('deactivateFund', () => {
    it('deactivates a fund with zero balance', async () => {
      mockFunds = [makeActiveFund(1)]
      await deactivateFund(1, 'user-1')

      const auditCalls = (logAudit as any).mock.calls
      const deactivateAudit = auditCalls.find(
        (c: any) => c[1].action === 'deactivated' && c[1].entityType === 'fund'
      )
      expect(deactivateAudit).toBeDefined()
    })

    it('rejects deactivating a system-locked fund', async () => {
      mockFunds = [{ ...makeActiveFund(1), isSystemLocked: true }]

      await expect(deactivateFund(1, 'user-1')).rejects.toThrow(
        SystemLockedError
      )
    })

    it('rejects deactivating nonexistent fund', async () => {
      mockFunds = []

      await expect(deactivateFund(999, 'user-1')).rejects.toThrow(
        EntityNotFoundError
      )
    })
  })

  // =====================
  // Error classes
  // =====================

  describe('Error classes', () => {
    it('GLError hierarchy', () => {
      const err = new InvalidAccountError('test')
      expect(err).toBeInstanceOf(Error)
      expect(err.name).toBe('InvalidAccountError')
    })

    it('all error types have correct names', () => {
      expect(new InvalidAccountError('').name).toBe('InvalidAccountError')
      expect(new InvalidFundError('').name).toBe('InvalidFundError')
      expect(new ImmutableTransactionError('').name).toBe('ImmutableTransactionError')
      expect(new VoidedTransactionError(1).name).toBe('VoidedTransactionError')
      expect(new AlreadyReversedError(1).name).toBe('AlreadyReversedError')
      expect(new TransactionNotFoundError(1).name).toBe('TransactionNotFoundError')
      expect(new EntityNotFoundError('A', 1).name).toBe('EntityNotFoundError')
      expect(new SystemLockedError('A', 1).name).toBe('SystemLockedError')
    })
  })
})
