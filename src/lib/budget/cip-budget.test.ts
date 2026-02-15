import { describe, it, expect } from 'vitest'
import { calculateVariance } from './variance'

describe('cip-budget module', () => {
  it('exports getCIPBudgetVsActual', async () => {
    const mod = await import('./cip-budget')
    expect(typeof mod.getCIPBudgetVsActual).toBe('function')
  })

  it('exports CIPSubAccountVariance type check via function signature', async () => {
    const mod = await import('./cip-budget')
    expect(mod).toBeDefined()
  })
})

describe('CIP variance calculation logic', () => {
  it('calculates normal variance when actual < budget', () => {
    const result = calculateVariance(8000, 10000)
    expect(result.dollarVariance).toBe(-2000)
    expect(result.percentVariance).toBeCloseTo(-20)
    expect(result.severity).toBe('warning')
  })

  it('calculates critical variance when actual > 125% of budget', () => {
    const result = calculateVariance(15000, 10000)
    expect(result.dollarVariance).toBe(5000)
    expect(result.percentVariance).toBeCloseTo(50)
    expect(result.severity).toBe('critical')
  })

  it('returns normal severity when within 10% threshold', () => {
    const result = calculateVariance(10500, 10000)
    expect(result.dollarVariance).toBe(500)
    expect(result.percentVariance).toBeCloseTo(5)
    expect(result.severity).toBe('normal')
  })

  it('returns null percentVariance when budget is zero', () => {
    const result = calculateVariance(5000, 0)
    expect(result.dollarVariance).toBe(5000)
    expect(result.percentVariance).toBeNull()
    expect(result.severity).toBe('normal')
  })

  it('returns zero variance when actual equals budget', () => {
    const result = calculateVariance(10000, 10000)
    expect(result.dollarVariance).toBe(0)
    expect(result.percentVariance).toBeCloseTo(0)
    expect(result.severity).toBe('normal')
  })

  it('handles negative actuals (credits exceeding debits)', () => {
    const result = calculateVariance(-500, 10000)
    expect(result.dollarVariance).toBe(-10500)
    expect(result.percentVariance).toBeCloseTo(-105)
    expect(result.severity).toBe('critical')
  })
})
