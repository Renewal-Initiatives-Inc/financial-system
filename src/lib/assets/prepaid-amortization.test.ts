import { describe, it, expect } from 'vitest'
import { calculateMonthlyAmortization } from './prepaid-amortization'

describe('calculateMonthlyAmortization', () => {
  it('even division: 12000 / 12 = 1000', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '12000',
      startDate: '2025-01-01',
      endDate: '2026-01-01',
    })
    expect(result).toBe(1000)
  })

  it('uneven division rounds to 2 decimals: 10000 / 3 = 3333.33', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '10000',
      startDate: '2025-01-01',
      endDate: '2025-04-01',
    })
    expect(result).toBe(3333.33)
  })

  it('single month: 5000 / 1 = 5000', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '5000',
      startDate: '2025-06-01',
      endDate: '2025-07-01',
    })
    expect(result).toBe(5000)
  })

  it('returns 0 when start equals end (zero months)', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '12000',
      startDate: '2025-06-01',
      endDate: '2025-06-01',
    })
    expect(result).toBe(0)
  })

  it('returns 0 when end is before start (negative months)', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '12000',
      startDate: '2025-06-01',
      endDate: '2025-01-01',
    })
    expect(result).toBe(0)
  })

  it('24-month schedule: 24000 / 24 = 1000', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '24000',
      startDate: '2025-01-01',
      endDate: '2027-01-01',
    })
    expect(result).toBe(1000)
  })

  it('non-round amount: 7500 / 6 = 1250', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '7500',
      startDate: '2025-01-01',
      endDate: '2025-07-01',
    })
    expect(result).toBe(1250)
  })

  it('handles repeating decimal: 1000 / 7 = 142.86', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '1000',
      startDate: '2025-01-01',
      endDate: '2025-08-01',
    })
    expect(result).toBe(142.86)
  })

  it('large prepaid: 120000 / 12 = 10000', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '120000',
      startDate: '2025-07-01',
      endDate: '2026-07-01',
    })
    expect(result).toBe(10000)
  })

  it('small prepaid: 100 / 12 = 8.33', () => {
    const result = calculateMonthlyAmortization({
      totalAmount: '100',
      startDate: '2025-01-01',
      endDate: '2026-01-01',
    })
    expect(result).toBe(8.33)
  })
})
