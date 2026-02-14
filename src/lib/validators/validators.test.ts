import { describe, expect, it } from 'vitest'
import {
  insertAccountSchema,
  insertFundSchema,
  insertCipCostCodeSchema,
  insertAuditLogSchema,
  transactionLineSchema,
  insertTransactionSchema,
} from '.'

describe('Account validation', () => {
  it('valid account insert passes', () => {
    const result = insertAccountSchema.safeParse({
      code: '1000',
      name: 'Checking',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for isActive and isSystemLocked', () => {
    const result = insertAccountSchema.parse({
      code: '1000',
      name: 'Checking',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    })
    expect(result.isActive).toBe(true)
    expect(result.isSystemLocked).toBe(false)
  })

  it('rejects empty code', () => {
    const result = insertAccountSchema.safeParse({
      code: '',
      name: 'Test',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = insertAccountSchema.safeParse({
      code: '1000',
      name: '',
      type: 'ASSET',
      normalBalance: 'DEBIT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid account type', () => {
    const result = insertAccountSchema.safeParse({
      code: '1000',
      name: 'Test',
      type: 'INVALID',
      normalBalance: 'DEBIT',
    })
    expect(result.success).toBe(false)
  })
})

describe('Fund validation', () => {
  it('valid fund insert passes', () => {
    const result = insertFundSchema.safeParse({
      name: 'Test Fund',
      restrictionType: 'RESTRICTED',
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid restriction type', () => {
    const result = insertFundSchema.safeParse({
      name: 'Test',
      restrictionType: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = insertFundSchema.safeParse({
      name: '',
      restrictionType: 'UNRESTRICTED',
    })
    expect(result.success).toBe(false)
  })
})

describe('Transaction line validation', () => {
  it('valid line with debit only passes', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
      debit: 100.0,
    })
    expect(result.success).toBe(true)
  })

  it('valid line with credit only passes', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
      credit: 50.25,
    })
    expect(result.success).toBe(true)
  })

  it('rejects line with both debit and credit', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
      debit: 100.0,
      credit: 50.0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects line with neither debit nor credit', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
    })
    expect(result.success).toBe(false)
  })

  it('rejects line with zero debit', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
      debit: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects line with negative amount', () => {
    const result = transactionLineSchema.safeParse({
      accountId: 1,
      fundId: 1,
      credit: -50.0,
    })
    expect(result.success).toBe(false)
  })
})

describe('Transaction validation', () => {
  it('balanced entry passes', () => {
    const result = insertTransactionSchema.safeParse({
      date: '2026-01-15',
      memo: 'Test entry',
      sourceType: 'MANUAL',
      createdBy: 'user-1',
      lines: [
        { accountId: 1, fundId: 1, debit: 100.0 },
        { accountId: 2, fundId: 1, credit: 100.0 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('unbalanced entry fails', () => {
    const result = insertTransactionSchema.safeParse({
      date: '2026-01-15',
      memo: 'Unbalanced',
      sourceType: 'MANUAL',
      createdBy: 'user-1',
      lines: [
        { accountId: 1, fundId: 1, debit: 100.0 },
        { accountId: 2, fundId: 1, credit: 50.0 },
      ],
    })
    expect(result.success).toBe(false)
  })

  it('entry with fewer than 2 lines fails', () => {
    const result = insertTransactionSchema.safeParse({
      date: '2026-01-15',
      memo: 'Single line',
      sourceType: 'MANUAL',
      createdBy: 'user-1',
      lines: [{ accountId: 1, fundId: 1, debit: 100.0 }],
    })
    expect(result.success).toBe(false)
  })

  it('multi-fund balanced entry passes', () => {
    const result = insertTransactionSchema.safeParse({
      date: '2026-01-15',
      memo: 'Multi-fund split',
      sourceType: 'MANUAL',
      createdBy: 'user-1',
      lines: [
        { accountId: 1, fundId: 1, debit: 60.0 },
        { accountId: 1, fundId: 2, debit: 40.0 },
        { accountId: 2, fundId: 1, credit: 100.0 },
      ],
    })
    expect(result.success).toBe(true)
  })

  it('applies defaults for isSystemGenerated', () => {
    const result = insertTransactionSchema.parse({
      date: '2026-01-15',
      memo: 'Test',
      sourceType: 'MANUAL',
      createdBy: 'user-1',
      lines: [
        { accountId: 1, fundId: 1, debit: 100.0 },
        { accountId: 2, fundId: 1, credit: 100.0 },
      ],
    })
    expect(result.isSystemGenerated).toBe(false)
  })
})

describe('CIP cost code validation', () => {
  it('valid cost code passes', () => {
    const result = insertCipCostCodeSchema.safeParse({
      code: '03',
      name: 'Concrete',
      category: 'HARD_COST',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty code', () => {
    const result = insertCipCostCodeSchema.safeParse({
      code: '',
      name: 'Test',
      category: 'SOFT_COST',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid category', () => {
    const result = insertCipCostCodeSchema.safeParse({
      code: '99',
      name: 'Test',
      category: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})

describe('Audit log validation', () => {
  it('valid audit log entry passes', () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 'user-1',
      action: 'created',
      entityType: 'transaction',
      entityId: 1,
      afterState: { id: 1, memo: 'Test' },
    })
    expect(result.success).toBe(true)
  })

  it('allows null beforeState for creation events', () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 'user-1',
      action: 'created',
      entityType: 'account',
      entityId: 1,
      beforeState: null,
      afterState: { code: '1000' },
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid action', () => {
    const result = insertAuditLogSchema.safeParse({
      userId: 'user-1',
      action: 'deleted',
      entityType: 'account',
      entityId: 1,
      afterState: {},
    })
    expect(result.success).toBe(false)
  })
})
