import { describe, it, expect } from 'vitest'
import { jaroWinklerSimilarity, normalizeMerchantName } from './string-similarity'

describe('jaroWinklerSimilarity', () => {
  it('returns 1.0 for identical strings', () => {
    expect(jaroWinklerSimilarity('ABC', 'ABC')).toBe(1.0)
  })

  it('returns 0.0 for empty vs non-empty', () => {
    expect(jaroWinklerSimilarity('', 'ABC')).toBe(0.0)
    expect(jaroWinklerSimilarity('ABC', '')).toBe(0.0)
  })

  it('returns 1.0 for both empty', () => {
    expect(jaroWinklerSimilarity('', '')).toBe(1.0)
  })

  // Wikipedia reference values
  it('MARTHA vs MARHTA ≈ 0.961', () => {
    const score = jaroWinklerSimilarity('MARTHA', 'MARHTA')
    expect(score).toBeCloseTo(0.961, 2)
  })

  it('DWAYNE vs DUANE ≈ 0.84', () => {
    const score = jaroWinklerSimilarity('DWAYNE', 'DUANE')
    expect(score).toBeCloseTo(0.84, 2)
  })

  it('DIXON vs DICKSONX ≈ 0.81', () => {
    const score = jaroWinklerSimilarity('DIXON', 'DICKSONX')
    expect(score).toBeCloseTo(0.81, 1)
  })

  it('completely different strings score low', () => {
    const score = jaroWinklerSimilarity('ABCDEF', 'ZYXWVU')
    expect(score).toBeLessThan(0.5)
  })

  it('handles case-sensitive comparison', () => {
    // Jaro-Winkler is case-sensitive by design
    const score = jaroWinklerSimilarity('abc', 'ABC')
    expect(score).toBeLessThan(1.0)
  })
})

describe('normalizeMerchantName', () => {
  it('strips Square prefix', () => {
    expect(normalizeMerchantName('SQ *STARBUCKS')).toBe('STARBUCKS')
  })

  it('strips Toast prefix', () => {
    expect(normalizeMerchantName('TST* Thai Kitchen')).toBe('THAI KITCHEN')
  })

  it('strips Stripe prefix', () => {
    expect(normalizeMerchantName('STRIPE* Notion')).toBe('NOTION')
  })

  it('strips PayPal prefix', () => {
    expect(normalizeMerchantName('PAYPAL *ADOBE')).toBe('ADOBE')
  })

  it('strips trailing state+zip', () => {
    expect(normalizeMerchantName('STARBUCKS CA 94105')).toBe('STARBUCKS')
  })

  it('strips corp suffixes', () => {
    expect(normalizeMerchantName('Amazon Inc.')).toBe('AMAZON')
  })

  it('collapses whitespace', () => {
    expect(normalizeMerchantName('  HOME   DEPOT  ')).toBe('HOME DEPOT')
  })

  it('handles already-clean names', () => {
    expect(normalizeMerchantName('Starbucks')).toBe('STARBUCKS')
  })
})
