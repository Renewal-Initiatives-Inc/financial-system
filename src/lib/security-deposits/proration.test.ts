import { describe, it, expect } from 'vitest'
import { calculateProratedRent, calculateDailyRate } from './proration'

describe('calculateDailyRate', () => {
  it('30-day month: $1,500 / 30 = $50.00', () => {
    const rate = calculateDailyRate(1500, 2025, 4) // April = 30 days
    expect(rate).toBeCloseTo(50.0, 2)
  })

  it('31-day month: $1,500 / 31', () => {
    const rate = calculateDailyRate(1500, 2025, 1) // January = 31 days
    expect(rate).toBeCloseTo(1500 / 31, 2)
  })

  it('February 28 days: $1,400 / 28 = $50.00', () => {
    const rate = calculateDailyRate(1400, 2025, 2) // Feb 2025 = 28 days
    expect(rate).toBe(50.0)
  })

  it('February leap year 29 days: $1,450 / 29', () => {
    const rate = calculateDailyRate(1450, 2024, 2) // Feb 2024 = 29 days
    expect(rate).toBe(50.0)
  })
})

describe('calculateProratedRent', () => {
  it('full month (move-in day 1): returns full rent', () => {
    const result = calculateProratedRent(1500, '2025-04-01')
    expect(result).toBe(1500)
  })

  it('move-in day 15 of 30-day month: 16/30 × $1,500', () => {
    // April has 30 days, move in on 15th = 16 days occupied
    const result = calculateProratedRent(1500, '2025-04-15')
    const expected = (1500 / 30) * 16
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('move-in day 15 of 31-day month: 17/31 × $1,500', () => {
    // January has 31 days, move in on 15th = 17 days occupied
    const result = calculateProratedRent(1500, '2025-01-15')
    const expected = (1500 / 31) * 17
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('February 28 days: move-in day 20 = 9/28 × rent', () => {
    const result = calculateProratedRent(1400, '2025-02-20')
    const expected = (1400 / 28) * 9
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('February leap year 29 days: move-in day 20 = 10/29 × rent', () => {
    const result = calculateProratedRent(1450, '2024-02-20')
    const expected = (1450 / 29) * 10
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('last day of month: 1 day occupied', () => {
    const result = calculateProratedRent(1500, '2025-04-30')
    const expected = (1500 / 30) * 1
    expect(result).toBe(Math.round(expected * 100) / 100)
  })

  it('move-in day 2: almost full month', () => {
    // April 30 days, day 2 = 29 days occupied
    const result = calculateProratedRent(1500, '2025-04-02')
    const expected = (1500 / 30) * 29
    expect(result).toBe(Math.round(expected * 100) / 100)
  })
})
