import { describe, it, expect } from 'vitest'
import { calculateDepositInterest } from './interest'

describe('calculateDepositInterest', () => {
  it('calculates full year interest: $1,000 × 3.5% × 365 days = $35.00', () => {
    const result = calculateDepositInterest(1000, 0.035, '2025-01-01', '2026-01-01')
    expect(result).toBe(35.0)
  })

  it('caps rate at 5%: $1,500 × 6% (capped to 5%) × 365 days = $75.00', () => {
    const result = calculateDepositInterest(1500, 0.06, '2025-01-01', '2026-01-01')
    expect(result).toBe(75.0)
  })

  it('calculates partial year: $1,000 × 3.5% × 180/365 = $17.26', () => {
    // 180 days: 2025-01-01 to 2025-06-30
    const result = calculateDepositInterest(1000, 0.035, '2025-01-01', '2025-06-30')
    // 180 days
    const expected = 1000 * 0.035 * (180 / 365)
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('returns $0 for zero deposit', () => {
    const result = calculateDepositInterest(0, 0.035, '2025-01-01', '2026-01-01')
    expect(result).toBe(0)
  })

  it('returns $0 for zero rate', () => {
    const result = calculateDepositInterest(1000, 0, '2025-01-01', '2026-01-01')
    expect(result).toBe(0)
  })

  it('returns $0 for negative deposit', () => {
    const result = calculateDepositInterest(-500, 0.035, '2025-01-01', '2026-01-01')
    expect(result).toBe(0)
  })

  it('returns $0 when period end is before period start', () => {
    const result = calculateDepositInterest(1000, 0.035, '2026-01-01', '2025-01-01')
    expect(result).toBe(0)
  })

  it('handles leap year correctly: 366 days', () => {
    // 2024 is a leap year
    const result = calculateDepositInterest(1000, 0.05, '2024-01-01', '2025-01-01')
    // 366 days in 2024
    const expected = 1000 * 0.05 * (366 / 365)
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('rate exactly at 5% cap works correctly', () => {
    const result = calculateDepositInterest(1000, 0.05, '2025-01-01', '2026-01-01')
    expect(result).toBe(50.0)
  })

  it('rate below cap uses actual rate', () => {
    const result = calculateDepositInterest(1000, 0.02, '2025-01-01', '2026-01-01')
    expect(result).toBe(20.0)
  })

  it('returns $0 when start equals end (0 days)', () => {
    const result = calculateDepositInterest(1000, 0.035, '2025-06-15', '2025-06-15')
    expect(result).toBe(0)
  })
})
