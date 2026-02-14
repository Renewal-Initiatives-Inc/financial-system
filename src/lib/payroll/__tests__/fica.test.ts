import { describe, it, expect } from 'vitest'
import { calculateFICA } from '../fica'

const defaultRates = {
  ssRate: 0.062,
  medicareRate: 0.0145,
  ssWageBase: 184500,
}

const defaults = {
  taxYear: 2026,
  rates: defaultRates,
}

describe('calculateFICA', () => {
  it('calculates normal wages (6.2% SS + 1.45% Medicare)', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 5000,
      ytdWages: 0,
    })
    expect(result.socialSecurityEmployee).toBeCloseTo(310, 2) // 5000 × 0.062
    expect(result.socialSecurityEmployer).toBeCloseTo(310, 2)
    expect(result.medicareEmployee).toBeCloseTo(72.5, 2) // 5000 × 0.0145
    expect(result.medicareEmployer).toBeCloseTo(72.5, 2)
  })

  it('caps SS at wage base when YTD near limit', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 5000,
      ytdWages: 182000, // Only $2,500 remaining before cap
    })
    // Remaining: $184,500 - $182,000 = $2,500
    expect(result.socialSecurityEmployee).toBeCloseTo(155, 2) // 2500 × 0.062
    expect(result.socialSecurityEmployer).toBeCloseTo(155, 2)
    // Medicare still on full amount
    expect(result.medicareEmployee).toBeCloseTo(72.5, 2)
    expect(result.medicareEmployer).toBeCloseTo(72.5, 2)
  })

  it('returns $0 SS when YTD exceeds wage base', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 5000,
      ytdWages: 190000, // Over $184,500
    })
    expect(result.socialSecurityEmployee).toBe(0)
    expect(result.socialSecurityEmployer).toBe(0)
    // Medicare still applies
    expect(result.medicareEmployee).toBeCloseTo(72.5, 2)
    expect(result.medicareEmployer).toBeCloseTo(72.5, 2)
  })

  it('returns $0 SS when YTD is exactly at wage base', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 5000,
      ytdWages: 184500,
    })
    expect(result.socialSecurityEmployee).toBe(0)
    expect(result.socialSecurityEmployer).toBe(0)
  })

  it('calculates first payroll of year (YTD = 0)', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 10000,
      ytdWages: 0,
    })
    expect(result.socialSecurityEmployee).toBeCloseTo(620, 2) // 10000 × 0.062
    expect(result.socialSecurityEmployer).toBeCloseTo(620, 2)
    expect(result.medicareEmployee).toBeCloseTo(145, 2) // 10000 × 0.0145
    expect(result.medicareEmployer).toBeCloseTo(145, 2)
  })

  it('caps SS correctly when gross would cross wage base mid-period', () => {
    const result = calculateFICA({
      ...defaults,
      monthlyGross: 10000,
      ytdWages: 180000, // Only $4,500 remaining
    })
    // SS on min(10000, 4500) = 4500
    expect(result.socialSecurityEmployee).toBeCloseTo(279, 2) // 4500 × 0.062
    expect(result.socialSecurityEmployer).toBeCloseTo(279, 2)
    // Medicare on full 10000
    expect(result.medicareEmployee).toBeCloseTo(145, 2)
  })
})
