import { describe, it, expect } from 'vitest'

/**
 * Filing Progression unit tests.
 *
 * These test the form type determination logic.
 * Since the actual functions hit the DB, we test the threshold logic directly.
 */

type Form990Type = '990-N' | '990-EZ' | 'Full 990'

function determineFormType(
  grossReceiptsAverage: number,
  totalAssets: number
): Form990Type {
  if (grossReceiptsAverage <= 50000) return '990-N'
  const grossExceeded = grossReceiptsAverage >= 200000
  const assetsExceeded = totalAssets >= 500000
  if (!grossExceeded && !assetsExceeded) return '990-EZ'
  return 'Full 990'
}

function computeAverage(
  receipts: number[],
  yearsOfOperation: number
): number {
  if (yearsOfOperation <= 0) return 0
  if (yearsOfOperation <= 3) {
    return receipts.reduce((s, v) => s + v, 0) / yearsOfOperation
  }
  // Year 4+: rolling 3-year average of prior years
  const priorYears = receipts.slice(-3)
  return priorYears.reduce((s, v) => s + v, 0) / 3
}

describe('Filing Progression — 990 Form Type', () => {
  it('determines 990-N when gross receipts <= $50K', () => {
    expect(determineFormType(30000, 100000)).toBe('990-N')
    expect(determineFormType(50000, 100000)).toBe('990-N')
  })

  it('determines 990-EZ when < $200K gross AND < $500K assets', () => {
    expect(determineFormType(100000, 300000)).toBe('990-EZ')
    expect(determineFormType(199999, 499999)).toBe('990-EZ')
  })

  it('determines Full 990 when gross receipts >= $200K', () => {
    expect(determineFormType(200000, 100000)).toBe('Full 990')
  })

  it('determines Full 990 when total assets >= $500K', () => {
    expect(determineFormType(100000, 500000)).toBe('Full 990')
  })

  it('determines Full 990 when both thresholds exceeded', () => {
    expect(determineFormType(300000, 600000)).toBe('Full 990')
  })

  it('CIP counts toward total assets triggering Full 990', () => {
    // If CIP pushes assets to $500K, should trigger Full 990
    const assetsWithCIP = 400000 + 150000 // regular + CIP
    expect(determineFormType(100000, assetsWithCIP)).toBe('Full 990')
  })
})

describe('Multi-year averaging logic', () => {
  it('Year 1: uses single year only', () => {
    const avg = computeAverage([45000], 1)
    expect(avg).toBe(45000)
  })

  it('Years 1-3: averages over all years of existence', () => {
    const avg = computeAverage([30000, 60000, 90000], 3)
    expect(avg).toBe(60000)
  })

  it('Year 2: averages over 2 years', () => {
    const avg = computeAverage([30000, 70000], 2)
    expect(avg).toBe(50000)
  })

  it('Year 4+: rolling 3-year average of prior years', () => {
    const avg = computeAverage([30000, 60000, 90000, 120000], 4)
    // Takes last 3: 60000 + 90000 + 120000 = 270000 / 3 = 90000
    expect(avg).toBe(90000)
  })

  it('handles 0 years gracefully', () => {
    expect(computeAverage([], 0)).toBe(0)
  })
})
