import { describe, it, expect } from 'vitest'
import { calculatePeriodInterest } from './interest-accrual'

describe('calculatePeriodInterest', () => {
  it('standard 31-day month: 3500000 * 0.05 * 31/365 = 14,863.01', () => {
    // January has 31 days: 2025-01-01 to 2025-02-01
    const result = calculatePeriodInterest(3500000, 0.05, '2025-01-01', '2025-02-01')
    const expected = Math.round(3500000 * 0.05 * (31 / 365) * 100) / 100
    expect(result).toBe(expected)
    expect(result).toBe(14863.01)
  })

  it('28-day month (February non-leap): 3500000 * 0.05 * 28/365', () => {
    // February 2025 has 28 days: 2025-02-01 to 2025-03-01
    const result = calculatePeriodInterest(3500000, 0.05, '2025-02-01', '2025-03-01')
    const expected = Math.round(3500000 * 0.05 * (28 / 365) * 100) / 100
    expect(result).toBe(expected)
  })

  it('29-day month (February leap year): 3500000 * 0.05 * 29/365', () => {
    // February 2024 has 29 days: 2024-02-01 to 2024-03-01
    const result = calculatePeriodInterest(3500000, 0.05, '2024-02-01', '2024-03-01')
    const expected = Math.round(3500000 * 0.05 * (29 / 365) * 100) / 100
    expect(result).toBe(expected)
  })

  it('30-day month: 3500000 * 0.05 * 30/365', () => {
    // April has 30 days: 2025-04-01 to 2025-05-01
    const result = calculatePeriodInterest(3500000, 0.05, '2025-04-01', '2025-05-01')
    const expected = Math.round(3500000 * 0.05 * (30 / 365) * 100) / 100
    expect(result).toBe(expected)
  })

  it('returns 0 for zero principal (drawnAmount)', () => {
    const result = calculatePeriodInterest(0, 0.05, '2025-01-01', '2025-02-01')
    expect(result).toBe(0)
  })

  it('returns 0 for negative principal', () => {
    const result = calculatePeriodInterest(-100000, 0.05, '2025-01-01', '2025-02-01')
    expect(result).toBe(0)
  })

  it('returns 0 for zero interest rate', () => {
    const result = calculatePeriodInterest(3500000, 0, '2025-01-01', '2025-02-01')
    expect(result).toBe(0)
  })

  it('returns 0 for negative interest rate', () => {
    const result = calculatePeriodInterest(3500000, -0.05, '2025-01-01', '2025-02-01')
    expect(result).toBe(0)
  })

  it('one-day period: 3500000 * 0.05 * 1/365', () => {
    const result = calculatePeriodInterest(3500000, 0.05, '2025-06-15', '2025-06-16')
    const expected = Math.round(3500000 * 0.05 * (1 / 365) * 100) / 100
    expect(result).toBe(expected)
    expect(result).toBe(479.45)
  })

  it('returns 0 when end date equals start date (zero days)', () => {
    const result = calculatePeriodInterest(3500000, 0.05, '2025-06-15', '2025-06-15')
    expect(result).toBe(0)
  })

  it('returns 0 when end date is before start date (negative days)', () => {
    const result = calculatePeriodInterest(3500000, 0.05, '2025-06-15', '2025-06-01')
    expect(result).toBe(0)
  })

  it('full year: 3500000 * 0.05 * 365/365 = 175000', () => {
    const result = calculatePeriodInterest(3500000, 0.05, '2025-01-01', '2026-01-01')
    expect(result).toBe(175000)
  })

  it('full leap year: 3500000 * 0.05 * 366/365', () => {
    // 2024 is a leap year: Jan 1 2024 to Jan 1 2025 = 366 days
    const result = calculatePeriodInterest(3500000, 0.05, '2024-01-01', '2025-01-01')
    const expected = Math.round(3500000 * 0.05 * (366 / 365) * 100) / 100
    expect(result).toBe(expected)
  })

  it('small principal: 1000 * 0.03 * 31/365', () => {
    const result = calculatePeriodInterest(1000, 0.03, '2025-01-01', '2025-02-01')
    const expected = Math.round(1000 * 0.03 * (31 / 365) * 100) / 100
    expect(result).toBe(expected)
  })

  it('high rate: 3500000 * 0.12 * 31/365', () => {
    const result = calculatePeriodInterest(3500000, 0.12, '2025-01-01', '2025-02-01')
    const expected = Math.round(3500000 * 0.12 * (31 / 365) * 100) / 100
    expect(result).toBe(expected)
  })
})
