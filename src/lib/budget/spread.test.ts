import { describe, it, expect } from 'vitest'
import {
  calculateEvenSpread,
  calculateSeasonalSpread,
  calculateOneTimeSpread,
  validateCustomSpread,
  recalculateSpread,
} from './spread'

describe('calculateEvenSpread', () => {
  it('divides $12,000 into 12 × $1,000', () => {
    const result = calculateEvenSpread(12000)
    expect(result).toHaveLength(12)
    result.forEach((m) => expect(m).toBe(1000))
  })

  it('handles rounding for $10,000 — sum equals annual amount', () => {
    const result = calculateEvenSpread(10000)
    expect(result).toHaveLength(12)
    const sum = result.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 10000)).toBeLessThan(0.01)
    // First 11 months should be $833.33
    for (let i = 0; i < 11; i++) {
      expect(result[i]).toBe(833.33)
    }
    // Last month absorbs remainder
    expect(result[11]).toBeCloseTo(833.37, 2)
  })

  it('handles $0 annual amount', () => {
    const result = calculateEvenSpread(0)
    expect(result).toHaveLength(12)
    result.forEach((m) => expect(m).toBe(0))
  })

  it('handles negative amount (contra-revenue)', () => {
    const result = calculateEvenSpread(-12000)
    expect(result).toHaveLength(12)
    result.forEach((m) => expect(m).toBe(-1000))
  })
})

describe('calculateSeasonalSpread', () => {
  it('distributes $12,000 with weights [2,1,1,1,1,1,1,1,1,1,1,1]', () => {
    const weights = [2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const result = calculateSeasonalSpread(12000, weights)
    expect(result).toHaveLength(12)
    // Total weight = 13, Jan = 2/13 * 12000 ≈ 1846.15
    expect(result[0]).toBeCloseTo(1846.15, 2)
    // Feb-Nov should each be ≈ 923.08
    for (let i = 1; i < 11; i++) {
      expect(result[i]).toBeCloseTo(923.08, 2)
    }
    // Sum must equal annual
    const sum = result.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 12000)).toBeLessThan(0.01)
  })

  it('rejects if weights length !== 12', () => {
    expect(() => calculateSeasonalSpread(12000, [1, 2, 3])).toThrow(
      'Weights must have exactly 12 elements'
    )
  })

  it('rejects negative weights', () => {
    const weights = [-1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    expect(() => calculateSeasonalSpread(12000, weights)).toThrow(
      'Weights must be non-negative'
    )
  })

  it('sum always matches annual amount exactly', () => {
    const weights = [3, 2, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const result = calculateSeasonalSpread(10000, weights)
    const sum = result.reduce((a, b) => a + b, 0)
    expect(Math.abs(sum - 10000)).toBeLessThan(0.01)
  })
})

describe('calculateOneTimeSpread', () => {
  it('places $5,000 in month 6', () => {
    const result = calculateOneTimeSpread(5000, 6)
    expect(result).toHaveLength(12)
    expect(result[5]).toBe(5000)
    result.forEach((m, i) => {
      if (i !== 5) expect(m).toBe(0)
    })
  })

  it('rejects month 0', () => {
    expect(() => calculateOneTimeSpread(5000, 0)).toThrow(
      'Target month must be between 1 and 12'
    )
  })

  it('rejects month 13', () => {
    expect(() => calculateOneTimeSpread(5000, 13)).toThrow(
      'Target month must be between 1 and 12'
    )
  })
})

describe('validateCustomSpread', () => {
  it('accepts valid custom spread', () => {
    const months = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000]
    expect(validateCustomSpread(months, 12000)).toBe(true)
  })

  it('rejects when sum does not equal annual', () => {
    const months = [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 500]
    expect(validateCustomSpread(months, 12000)).toBe(false)
  })

  it('rejects wrong array length', () => {
    expect(validateCustomSpread([1000, 2000], 3000)).toBe(false)
  })
})

describe('recalculateSpread', () => {
  it('dispatches EVEN correctly', () => {
    const result = recalculateSpread('EVEN', 12000)
    expect(result).toHaveLength(12)
    expect(result[0]).toBe(1000)
  })

  it('dispatches SEASONAL correctly', () => {
    const weights = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
    const result = recalculateSpread('SEASONAL', 12000, { weights })
    expect(result).toHaveLength(12)
    result.forEach((m) => expect(m).toBe(1000))
  })

  it('dispatches ONE_TIME correctly', () => {
    const result = recalculateSpread('ONE_TIME', 5000, { targetMonth: 3 })
    expect(result[2]).toBe(5000)
  })

  it('throws for CUSTOM (must be provided directly)', () => {
    expect(() => recalculateSpread('CUSTOM', 12000)).toThrow(
      'Custom spread amounts must be provided directly'
    )
  })

  it('throws for SEASONAL without weights', () => {
    expect(() => recalculateSpread('SEASONAL', 12000)).toThrow(
      'Weights are required'
    )
  })

  it('throws for ONE_TIME without targetMonth', () => {
    expect(() => recalculateSpread('ONE_TIME', 5000)).toThrow(
      'Target month is required'
    )
  })
})
