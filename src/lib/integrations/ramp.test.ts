import { describe, it, expect } from 'vitest'
import { mapRampTransaction, type RampApiTransaction } from './ramp'

function makeRampTxn(overrides?: Partial<RampApiTransaction>): RampApiTransaction {
  return {
    id: 'txn_abc123',
    user_transaction_time: '2026-02-10T15:30:00Z',
    accounting_date: '2026-02-10T00:00:00Z',
    amount: -247.5,
    merchant_name: 'Home Depot',
    memo: 'Building supplies',
    card_holder: { first_name: 'Jeff', last_name: 'Takle' },
    state: 'CLEARED',
    ...overrides,
  }
}

describe('mapRampTransaction', () => {
  it('maps basic Ramp transaction correctly', () => {
    const result = mapRampTransaction(makeRampTxn())
    expect(result).toEqual({
      rampId: 'txn_abc123',
      date: '2026-02-10',
      amount: 247.5,
      merchantName: 'Home Depot',
      description: 'Building supplies',
      cardholder: 'Jeff Takle',
    })
  })

  it('takes Math.abs of negative amount (charges)', () => {
    const result = mapRampTransaction(makeRampTxn({ amount: -500.0 }))
    expect(result.amount).toBe(500.0)
  })

  it('handles positive amount (refunds already positive)', () => {
    const result = mapRampTransaction(makeRampTxn({ amount: 100.0 }))
    expect(result.amount).toBe(100.0)
  })

  it('prefers user_transaction_time over accounting_date', () => {
    const result = mapRampTransaction(
      makeRampTxn({
        user_transaction_time: '2026-02-10T15:30:00Z',
        accounting_date: '2026-02-11T00:00:00Z',
      })
    )
    expect(result.date).toBe('2026-02-10')
  })

  it('falls back to accounting_date when user_transaction_time is missing', () => {
    const result = mapRampTransaction(
      makeRampTxn({
        user_transaction_time: undefined,
        accounting_date: '2026-02-11T00:00:00Z',
      })
    )
    expect(result.date).toBe('2026-02-11')
  })

  it('handles null memo', () => {
    const result = mapRampTransaction(makeRampTxn({ memo: null }))
    expect(result.description).toBeNull()
  })

  it('handles missing card_holder', () => {
    const result = mapRampTransaction(
      makeRampTxn({ card_holder: undefined })
    )
    expect(result.cardholder).toBe('Unknown')
  })

  it('concatenates cardholder first + last name', () => {
    const result = mapRampTransaction(
      makeRampTxn({
        card_holder: { first_name: 'Jane', last_name: 'Doe' },
      })
    )
    expect(result.cardholder).toBe('Jane Doe')
  })

  it('extracts YYYY-MM-DD from ISO datetime', () => {
    const result = mapRampTransaction(
      makeRampTxn({
        user_transaction_time: '2026-01-15T23:59:59.999Z',
      })
    )
    expect(result.date).toBe('2026-01-15')
  })
})
