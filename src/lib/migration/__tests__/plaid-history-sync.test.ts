import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the plaid integration before importing the module
vi.mock('@/lib/integrations/plaid', () => ({
  syncTransactions: vi.fn(),
}))

describe('syncBankHistory', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches all pages using cursor pagination', async () => {
    const { syncTransactions } = await import('@/lib/integrations/plaid')
    const syncMock = vi.mocked(syncTransactions)

    // Page 1: has more
    syncMock.mockResolvedValueOnce({
      added: [
        { plaidTransactionId: 'txn1', plaidAccountId: 'acct1', amount: -100, date: '2025-01-15', merchantName: 'Tenant A', category: 'INCOME', isPending: false, paymentChannel: 'other', rawData: {} },
        { plaidTransactionId: 'txn2', plaidAccountId: 'acct1', amount: 50, date: '2025-01-20', merchantName: 'Utility Co', category: 'UTILITIES', isPending: false, paymentChannel: 'other', rawData: {} },
      ],
      modified: [],
      removed: [],
      nextCursor: 'cursor-page-2',
      hasMore: true,
    })

    // Page 2: no more
    syncMock.mockResolvedValueOnce({
      added: [
        { plaidTransactionId: 'txn3', plaidAccountId: 'acct1', amount: -200, date: '2025-02-01', merchantName: 'Tenant B', category: 'INCOME', isPending: false, paymentChannel: 'other', rawData: {} },
      ],
      modified: [],
      removed: [],
      nextCursor: 'cursor-final',
      hasMore: false,
    })

    const mockDb = createMockDb()

    const { syncBankHistory } = await import('../plaid-history-sync')
    const result = await syncBankHistory(mockDb as any, 1)

    // Should have called syncTransactions twice (two pages)
    expect(syncMock).toHaveBeenCalledTimes(2)
    expect(syncMock).toHaveBeenCalledWith('test-access-token', null, undefined) // first call with null cursor
    expect(syncMock).toHaveBeenCalledWith('test-access-token', 'cursor-page-2', undefined) // second call with cursor

    expect(result.transactionsSynced).toBe(3)
    expect(result.cursorSaved).toBe('cursor-final')
  })

  it('stores all transactions in bank_transactions', async () => {
    const { syncTransactions } = await import('@/lib/integrations/plaid')
    const syncMock = vi.mocked(syncTransactions)

    syncMock.mockResolvedValueOnce({
      added: [
        { plaidTransactionId: 'txn1', plaidAccountId: 'acct1', amount: -500, date: '2025-03-01', merchantName: 'Test', category: null, isPending: false, paymentChannel: null, rawData: {} },
      ],
      modified: [],
      removed: [],
      nextCursor: 'cursor-1',
      hasMore: false,
    })

    const mockDb = createMockDb()

    const { syncBankHistory } = await import('../plaid-history-sync')
    await syncBankHistory(mockDb as any, 1)

    // Should have called db.execute to insert the transaction
    expect(mockDb.execute).toHaveBeenCalled()
  })

  it('saves cursor after sync completes', async () => {
    const { syncTransactions } = await import('@/lib/integrations/plaid')
    const syncMock = vi.mocked(syncTransactions)

    syncMock.mockResolvedValueOnce({
      added: [],
      modified: [],
      removed: [],
      nextCursor: 'final-cursor',
      hasMore: false,
    })

    const mockDb = createMockDb()

    const { syncBankHistory } = await import('../plaid-history-sync')
    const result = await syncBankHistory(mockDb as any, 1)

    expect(result.cursorSaved).toBe('final-cursor')
    // Verify cursor was saved via db.update
    expect(mockDb.update).toHaveBeenCalled()
  })

  it('throws when bank account not found', async () => {
    const mockDb = createMockDb({ accountExists: false })

    const { syncBankHistory } = await import('../plaid-history-sync')

    await expect(syncBankHistory(mockDb as any, 999)).rejects.toThrow(
      'Bank account 999 not found'
    )
  })
})

describe('getHistorySyncSummary', () => {
  it('returns correct summary shape', async () => {
    const mockDb = createMockDb()
    mockDb.execute
      .mockResolvedValueOnce({
        rows: [{ total_count: '50', earliest_date: '2024-01-15', latest_date: '2025-12-31' }],
      })
      .mockResolvedValueOnce({
        rows: [
          { month: '2024-01', count: '10' },
          { month: '2024-02', count: '15' },
          { month: '2024-03', count: '25' },
        ],
      })

    const { getHistorySyncSummary } = await import('../plaid-history-sync')
    const summary = await getHistorySyncSummary(mockDb as any, 1)

    expect(summary.bankAccountId).toBe(1)
    expect(summary.totalTransactions).toBe(50)
    expect(summary.dateRange).toEqual({ earliest: '2024-01-15', latest: '2025-12-31' })
    expect(summary.monthlyBreakdown).toHaveLength(3)
    expect(summary.monthlyBreakdown[0]).toEqual({ month: '2024-01', count: 10 })
  })
})

// --- Helpers ---

function createMockDb(options: { accountExists?: boolean } = {}) {
  const accountExists = options.accountExists !== false

  const mockDb = {
    select: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnValue(
      accountExists
        ? [{ id: 1, name: 'Checking', plaidAccessToken: 'test-access-token', plaidCursor: null }]
        : []
    ),
    execute: vi.fn().mockResolvedValue({ rows: [] }),
    update: vi.fn().mockReturnValue({
      set: vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  }

  // Make select().from() chainable with where()
  mockDb.select.mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(
        accountExists
          ? [{ id: 1, name: 'Checking', plaidAccessToken: 'test-access-token', plaidCursor: null }]
          : []
      ),
    }),
  })

  return mockDb
}
