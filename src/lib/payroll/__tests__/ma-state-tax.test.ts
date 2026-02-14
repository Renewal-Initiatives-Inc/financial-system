import { describe, it, expect } from 'vitest'
import { calculateMAWithholding } from '../ma-state-tax'

const defaultRates = {
  stateRate: 0.05,
  surtaxRate: 0.04,
  surtaxThreshold: 1107750,
}

const defaults = {
  additionalWithholding: 0,
  taxYear: 2026,
  rates: defaultRates,
  isHeadOfHousehold: false,
  isBlind: false,
  spouseIsBlind: false,
}

describe('calculateMAWithholding', () => {
  it('calculates for single allowance at $4,000/month (5% rate)', () => {
    const result = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
    })
    // Monthly exemption: $4,400/12 = $366.67
    // Adjusted monthly: $4,000 - $366.67 = $3,633.33
    // Annualized: $43,600
    // Tax: $43,600 × 0.05 = $2,180
    // Monthly: $2,180 / 12 = $181.67
    expect(result).toBeCloseTo(181.67, 0)
  })

  it('calculates with two allowances (correct exemption formula)', () => {
    const result = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 2,
    })
    // Exemption: ($1,000 × 2 + $3,400) = $5,400/year = $450/month
    // Adjusted: $4,000 - $450 = $3,550
    // Annual: $42,600 × 0.05 = $2,130
    // Monthly: $177.50
    expect(result).toBeCloseTo(177.50, 0)
  })

  it('returns $0 (or additional only) with zero allowances', () => {
    const result = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 0,
    })
    // No exemption
    // Annual: $48,000 × 0.05 = $2,400
    // Monthly: $200
    expect(result).toBeCloseTo(200, 0)
  })

  it('applies head of household credit', () => {
    const base = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
    })
    const withHoH = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
      isHeadOfHousehold: true,
    })
    expect(withHoH).toBeCloseTo(base - 10, 0) // $10/month credit
  })

  it('applies blindness credit (employee)', () => {
    const base = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
    })
    const withBlind = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
      isBlind: true,
    })
    expect(withBlind).toBeCloseTo(base - 9.17, 0) // $9.17/month credit
  })

  it('applies both employee and spouse blindness credits', () => {
    const base = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
    })
    const withBoth = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
      isBlind: true,
      spouseIsBlind: true,
    })
    expect(withBoth).toBeCloseTo(base - 18.34, 0) // 2 × $9.17
  })

  it('applies surtax for high income above threshold', () => {
    // Use a low threshold to test surtax
    const result = calculateMAWithholding({
      ...defaults,
      monthlyGross: 100000, // $1.2M annualized
      allowances: 0,
      rates: {
        stateRate: 0.05,
        surtaxRate: 0.04,
        surtaxThreshold: 1000000,
      },
    })
    // Annual: $1,200,000
    // Base: $1,200,000 × 0.05 = $60,000
    // Surtax: ($1,200,000 - $1,000,000) × 0.04 = $8,000
    // Total annual: $68,000
    // Monthly: $5,666.67
    expect(result).toBeCloseTo(5666.67, 0)
  })

  it('adds additional withholding', () => {
    const base = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
    })
    const withExtra = calculateMAWithholding({
      ...defaults,
      monthlyGross: 4000,
      allowances: 1,
      additionalWithholding: 50,
    })
    expect(withExtra).toBeCloseTo(base + 50, 0)
  })

  it('result never goes below $0', () => {
    const result = calculateMAWithholding({
      ...defaults,
      monthlyGross: 100,
      allowances: 5, // Large exemption relative to income
    })
    expect(result).toBeGreaterThanOrEqual(0)
  })
})
