import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { VerificationCheck } from '../verification'

// We test the verification logic by mocking db.execute()
// since these are SQL-heavy functions

function createMockDb(results: Record<string, { rows: any[] }>) {
  let callCount = 0
  const keys = Object.keys(results)
  return {
    execute: vi.fn().mockImplementation(() => {
      const key = keys[callCount % keys.length]
      callCount++
      return Promise.resolve(results[key])
    }),
  }
}

describe('verifyTotalBalance', () => {
  it('passes when debits equal credits', async () => {
    const { verifyTotalBalance } = await import('../verification')
    const db = createMockDb({
      balance: { rows: [{ total_debits: '5000.00', total_credits: '5000.00' }] },
    })

    const result = await verifyTotalBalance(db as any)
    expect(result.passed).toBe(true)
    expect(result.name).toBe('Total Balance')
    expect(result.message).toContain('Balanced')
  })

  it('fails when debits do not equal credits', async () => {
    const { verifyTotalBalance } = await import('../verification')
    const db = createMockDb({
      balance: { rows: [{ total_debits: '5000.00', total_credits: '4999.00' }] },
    })

    const result = await verifyTotalBalance(db as any)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('IMBALANCE')
  })
})

describe('verifyFundBalance', () => {
  it('passes when all funds are balanced', async () => {
    const { verifyFundBalance } = await import('../verification')
    const db = createMockDb({
      funds: { rows: [] }, // empty = no imbalanced funds
    })

    const result = await verifyFundBalance(db as any)
    expect(result.passed).toBe(true)
    expect(result.name).toContain('Fund-Level')
  })

  it('fails when a fund is imbalanced', async () => {
    const { verifyFundBalance } = await import('../verification')
    const db = createMockDb({
      funds: {
        rows: [{
          fund_name: 'AHP Fund',
          total_debits: '1000.00',
          total_credits: '900.00',
          difference: '100.00',
        }],
      },
    })

    const result = await verifyFundBalance(db as any)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('AHP Fund')
  })
})

describe('verifyTransactionCount', () => {
  it('passes when count matches expected', async () => {
    const { verifyTransactionCount } = await import('../verification')
    const db = createMockDb({
      count: { rows: [{ count: '150' }] },
    })

    const result = await verifyTransactionCount(db as any, 150)
    expect(result.passed).toBe(true)
  })

  it('fails when count does not match', async () => {
    const { verifyTransactionCount } = await import('../verification')
    const db = createMockDb({
      count: { rows: [{ count: '145' }] },
    })

    const result = await verifyTransactionCount(db as any, 150)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('expected 150')
    expect(result.message).toContain('found 145')
  })
})

describe('verifyAccountBalances', () => {
  it('passes when all balances match', async () => {
    const { verifyAccountBalances } = await import('../verification')
    const db = createMockDb({
      balances: {
        rows: [
          { account_code: '1000', account_name: 'Checking', net_balance: '5000.00' },
          { account_code: '4000', account_name: 'Rental Income', net_balance: '-3000.00' },
        ],
      },
    })

    const result = await verifyAccountBalances(db as any, {
      '1000': 5000,
      '4000': -3000,
    })
    expect(result.passed).toBe(true)
  })

  it('fails when an account balance is wrong', async () => {
    const { verifyAccountBalances } = await import('../verification')
    const db = createMockDb({
      balances: {
        rows: [
          { account_code: '1000', account_name: 'Checking', net_balance: '4500.00' },
        ],
      },
    })

    const result = await verifyAccountBalances(db as any, {
      '1000': 5000,
    })
    expect(result.passed).toBe(false)
    expect(result.message).toContain('1000')
    expect(result.message).toContain('expected')
  })
})

describe('verifyAuditTrail', () => {
  it('passes when all transactions have audit entries', async () => {
    const { verifyAuditTrail } = await import('../verification')
    const db = createMockDb({
      audit: { rows: [] }, // empty = no missing audit entries
    })

    const result = await verifyAuditTrail(db as any)
    expect(result.passed).toBe(true)
    expect(result.message).toContain('complete')
  })

  it('fails when transactions are missing audit entries', async () => {
    const { verifyAuditTrail } = await import('../verification')
    const db = createMockDb({
      audit: { rows: [{ id: 42 }, { id: 99 }] },
    })

    const result = await verifyAuditTrail(db as any)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('42')
    expect(result.message).toContain('99')
  })
})

describe('verifyRestrictedFundReleases', () => {
  it('passes when all restricted expenses have releases', async () => {
    const { verifyRestrictedFundReleases } = await import('../verification')
    const db = createMockDb({
      releases: { rows: [] }, // empty = no missing releases
    })

    const result = await verifyRestrictedFundReleases(db as any)
    expect(result.passed).toBe(true)
  })

  it('fails when restricted expenses are missing releases', async () => {
    const { verifyRestrictedFundReleases } = await import('../verification')
    const db = createMockDb({
      releases: {
        rows: [{ txn_id: 10, fund_name: 'AHP Fund', amount: '500.00' }],
      },
    })

    const result = await verifyRestrictedFundReleases(db as any)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('AHP Fund')
  })
})
