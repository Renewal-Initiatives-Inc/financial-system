import { describe, it, expect } from 'vitest'
import { calculateVariance } from './variance'

describe('calculateVariance', () => {
  it('expense over budget 20% → warning', () => {
    const result = calculateVariance(1200, 1000)
    expect(result.dollarVariance).toBe(200)
    expect(result.percentVariance).toBeCloseTo(20, 1)
    expect(result.severity).toBe('warning')
  })

  it('expense over budget 30% → critical', () => {
    const result = calculateVariance(1300, 1000)
    expect(result.dollarVariance).toBe(300)
    expect(result.percentVariance).toBeCloseTo(30, 1)
    expect(result.severity).toBe('critical')
  })

  it('expense under budget -10% → normal', () => {
    const result = calculateVariance(900, 1000)
    expect(result.dollarVariance).toBe(-100)
    expect(result.percentVariance).toBeCloseTo(-10, 1)
    expect(result.severity).toBe('normal')
  })

  it('revenue under target -20% → warning', () => {
    const result = calculateVariance(4000, 5000)
    expect(result.dollarVariance).toBe(-1000)
    expect(result.percentVariance).toBeCloseTo(-20, 1)
    expect(result.severity).toBe('warning')
  })

  it('budget = $0 → percent is null, normal severity', () => {
    const result = calculateVariance(500, 0)
    expect(result.dollarVariance).toBe(500)
    expect(result.percentVariance).toBeNull()
    expect(result.severity).toBe('normal')
  })

  it('exact match → 0% variance, normal', () => {
    const result = calculateVariance(1000, 1000)
    expect(result.dollarVariance).toBe(0)
    expect(result.percentVariance).toBeCloseTo(0, 1)
    expect(result.severity).toBe('normal')
  })

  it('exactly 10% → normal (boundary, not above)', () => {
    const result = calculateVariance(1100, 1000)
    expect(result.percentVariance).toBeCloseTo(10, 1)
    expect(result.severity).toBe('normal')
  })

  it('exactly 25% → warning (boundary, not above)', () => {
    const result = calculateVariance(1250, 1000)
    expect(result.percentVariance).toBeCloseTo(25, 1)
    expect(result.severity).toBe('warning')
  })

  it('10.01% → warning', () => {
    const result = calculateVariance(1100.1, 1000)
    expect(result.severity).toBe('warning')
  })

  it('25.01% → critical', () => {
    const result = calculateVariance(1250.1, 1000)
    expect(result.severity).toBe('critical')
  })
})
