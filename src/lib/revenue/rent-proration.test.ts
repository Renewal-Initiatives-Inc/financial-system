import { describe, expect, it } from 'vitest'
import { calculateProratedRent } from './rent-proration'

describe('calculateProratedRent', () => {
  it('30-day month (June): move-in on 15th → 16 days', () => {
    const result = calculateProratedRent(1500, 2026, 6, new Date(2026, 5, 15), true)
    // dailyRate = 1500/30 = 50, days = 30 - 15 + 1 = 16, amount = 800
    expect(result.daysOccupied).toBe(16)
    expect(result.dailyRate).toBe(50)
    expect(result.amount).toBe(800)
  })

  it('31-day month (January): move-in on 1st → full month', () => {
    const result = calculateProratedRent(1550, 2026, 1, new Date(2026, 0, 1), true)
    // dailyRate = 1550/31 = 50, days = 31 - 1 + 1 = 31, amount = 1550
    expect(result.daysOccupied).toBe(31)
    expect(result.amount).toBe(1550)
  })

  it('28-day month (February non-leap): move-out on 14th → 14 days', () => {
    // 2027 is not a leap year
    const result = calculateProratedRent(1400, 2027, 2, new Date(2027, 1, 14), false)
    // dailyRate = 1400/28 = 50, days = 14, amount = 700
    expect(result.daysOccupied).toBe(14)
    expect(result.dailyRate).toBe(50)
    expect(result.amount).toBe(700)
  })

  it('29-day month (February leap year): full month move-in on 1st', () => {
    // 2028 is a leap year
    const result = calculateProratedRent(1450, 2028, 2, new Date(2028, 1, 1), true)
    // dailyRate = 1450/29 = 50, days = 29 - 1 + 1 = 29, amount = 1450
    expect(result.daysOccupied).toBe(29)
    expect(result.amount).toBe(1450)
  })

  it('edge case: move-in on last day of month → 1 day', () => {
    const result = calculateProratedRent(1500, 2026, 6, new Date(2026, 5, 30), true)
    // days = 30 - 30 + 1 = 1
    expect(result.daysOccupied).toBe(1)
    expect(result.amount).toBe(50)
  })

  it('edge case: move-out on 1st of month → 1 day', () => {
    const result = calculateProratedRent(1500, 2026, 6, new Date(2026, 5, 1), false)
    // move-out: days = moveDay = 1
    expect(result.daysOccupied).toBe(1)
    expect(result.amount).toBe(50)
  })

  it('rounds to 2 decimal places', () => {
    // 31-day month, $1000 rent, move-in on 10th → 22 days
    // dailyRate = 1000/31 = 32.258064..., amount = 32.258064 * 22 = 709.677...
    const result = calculateProratedRent(1000, 2026, 1, new Date(2026, 0, 10), true)
    expect(result.daysOccupied).toBe(22)
    expect(result.dailyRate).toBe(32.26)
    expect(result.amount).toBe(709.68)
  })
})
