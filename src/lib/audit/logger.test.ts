import { describe, it, expect, vi, beforeEach } from 'vitest'
import { logAudit } from './logger'

// Mock the audit_log table insert
const mockInsert = vi.fn().mockReturnValue({
  values: vi.fn().mockResolvedValue(undefined),
})

// Create a mock tx that mimics Drizzle's insert API
const mockTx = {
  insert: mockInsert,
} as any

// We need to mock the schema import so insert() recognizes the table
vi.mock('@/lib/db/schema', () => ({
  auditLog: { _: 'auditLog' },
}))

describe('logAudit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockInsert.mockReturnValue({
      values: vi.fn().mockResolvedValue(undefined),
    })
  })

  it('inserts a valid audit entry with all fields', async () => {
    await logAudit(mockTx, {
      userId: 'user-1',
      action: 'created',
      entityType: 'transaction',
      entityId: 42,
      beforeState: null,
      afterState: { id: 42, memo: 'Test' },
      metadata: { source: 'manual' },
    })

    expect(mockInsert).toHaveBeenCalledTimes(1)
    const valuesCall = mockInsert.mock.results[0].value.values
    expect(valuesCall).toHaveBeenCalledWith({
      userId: 'user-1',
      action: 'created',
      entityType: 'transaction',
      entityId: 42,
      beforeState: null,
      afterState: { id: 42, memo: 'Test' },
      metadata: { source: 'manual' },
    })
  })

  it('allows null beforeState for creation events', async () => {
    await logAudit(mockTx, {
      userId: 'user-1',
      action: 'created',
      entityType: 'transaction',
      entityId: 1,
      afterState: { id: 1 },
    })

    const valuesCall = mockInsert.mock.results[0].value.values
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ beforeState: null })
    )
  })

  it('accepts beforeState for update events', async () => {
    await logAudit(mockTx, {
      userId: 'user-1',
      action: 'updated',
      entityType: 'transaction',
      entityId: 1,
      beforeState: { memo: 'old' },
      afterState: { memo: 'new' },
    })

    const valuesCall = mockInsert.mock.results[0].value.values
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({
        beforeState: { memo: 'old' },
        afterState: { memo: 'new' },
      })
    )
  })

  it('accepts all valid action types', async () => {
    const actions = [
      'created',
      'updated',
      'voided',
      'reversed',
      'deactivated',
      'signed_off',
      'imported',
      'posted',
    ] as const

    for (const action of actions) {
      vi.clearAllMocks()
      mockInsert.mockReturnValue({
        values: vi.fn().mockResolvedValue(undefined),
      })

      await logAudit(mockTx, {
        userId: 'user-1',
        action,
        entityType: 'transaction',
        entityId: 1,
        afterState: { id: 1 },
      })

      expect(mockInsert).toHaveBeenCalledTimes(1)
    }
  })

  it('allows metadata to be omitted', async () => {
    await logAudit(mockTx, {
      userId: 'user-1',
      action: 'created',
      entityType: 'account',
      entityId: 5,
      afterState: { id: 5, name: 'Test' },
    })

    const valuesCall = mockInsert.mock.results[0].value.values
    expect(valuesCall).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: null })
    )
  })

  it('rejects invalid action types', async () => {
    await expect(
      logAudit(mockTx, {
        userId: 'user-1',
        action: 'deleted' as any,
        entityType: 'transaction',
        entityId: 1,
        afterState: { id: 1 },
      })
    ).rejects.toThrow()
  })

  it('rejects missing userId', async () => {
    await expect(
      logAudit(mockTx, {
        userId: '',
        action: 'created',
        entityType: 'transaction',
        entityId: 1,
        afterState: { id: 1 },
      })
    ).rejects.toThrow()
  })

  it('rejects negative entityId', async () => {
    await expect(
      logAudit(mockTx, {
        userId: 'user-1',
        action: 'created',
        entityType: 'transaction',
        entityId: -1,
        afterState: { id: 1 },
      })
    ).rejects.toThrow()
  })
})
