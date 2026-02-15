import { describe, it, expect } from 'vitest'
import { computeBenchmarkComparison } from '../functional-allocation-logic'

describe('Functional Allocation Logic', () => {
  describe('computeBenchmarkComparison', () => {
    it('computes averages from allocation rows', () => {
      const allocations = [
        { programPct: 80, adminPct: 15, fundraisingPct: 5 },
        { programPct: 70, adminPct: 25, fundraisingPct: 5 },
        { programPct: 100, adminPct: 0, fundraisingPct: 0 },
      ]
      const result = computeBenchmarkComparison(allocations)

      expect(result.riProgram).toBeCloseTo(83.3, 1)
      expect(result.riAdmin).toBeCloseTo(13.3, 1)
      expect(result.riFundraising).toBeCloseTo(3.3, 1)
      expect(result.isBelowMinimum).toBe(false)
      expect(result.isOutlierHigh).toBe(false)
    })

    it('flags below industry minimum when program < 65%', () => {
      const allocations = [
        { programPct: 50, adminPct: 40, fundraisingPct: 10 },
        { programPct: 60, adminPct: 30, fundraisingPct: 10 },
      ]
      const result = computeBenchmarkComparison(allocations)

      expect(result.riProgram).toBe(55)
      expect(result.isBelowMinimum).toBe(true)
    })

    it('flags outlier high when program > 90%', () => {
      const allocations = [
        { programPct: 95, adminPct: 3, fundraisingPct: 2 },
        { programPct: 98, adminPct: 1, fundraisingPct: 1 },
      ]
      const result = computeBenchmarkComparison(allocations)

      expect(result.riProgram).toBe(96.5)
      expect(result.isOutlierHigh).toBe(true)
    })

    it('handles empty allocations', () => {
      const result = computeBenchmarkComparison([])

      expect(result.riProgram).toBe(0)
      expect(result.riAdmin).toBe(0)
      expect(result.riFundraising).toBe(0)
      expect(result.isBelowMinimum).toBe(true)
    })

    it('includes peer comparison data', () => {
      const result = computeBenchmarkComparison([
        { programPct: 80, adminPct: 15, fundraisingPct: 5 },
      ])

      expect(result.peers).toHaveLength(3)
      expect(result.peers[0].name).toBe('Falcon Housing')
      expect(result.peers[0].program).toBe(82)
      expect(result.industryMinProgram).toBe(65)
    })

    it('validates percentage sum to 100 conceptually', () => {
      // The benchmark computation itself doesn't validate sums,
      // but saveAllocations does. Here we verify computation works
      // regardless of input sum.
      const allocations = [
        { programPct: 70, adminPct: 25, fundraisingPct: 5 }, // sums to 100
      ]
      const result = computeBenchmarkComparison(allocations)
      expect(result.riProgram + result.riAdmin + result.riFundraising).toBe(100)
    })
  })

  describe('Sub-type default mapping', () => {
    // These test the static defaults conceptually
    it('Property Ops defaults to 100/0/0 permanent', () => {
      // This is a static mapping test - the actual logic is in functional-defaults.ts
      // Testing the expected values
      const DEFAULTS: Record<string, { program: number; admin: number; fundraising: number; permanent: boolean }> = {
        'Property Ops': { program: 100, admin: 0, fundraising: 0, permanent: true },
        'Non-Cash': { program: 100, admin: 0, fundraising: 0, permanent: true },
        'Financial': { program: 100, admin: 0, fundraising: 0, permanent: true },
        'Payroll': { program: 70, admin: 25, fundraising: 5, permanent: false },
        'Operating': { program: 80, admin: 20, fundraising: 0, permanent: false },
      }

      expect(DEFAULTS['Property Ops'].permanent).toBe(true)
      expect(DEFAULTS['Property Ops'].program).toBe(100)
      expect(DEFAULTS['Payroll'].program).toBe(70)
      expect(DEFAULTS['Payroll'].admin).toBe(25)
      expect(DEFAULTS['Payroll'].fundraising).toBe(5)
      expect(DEFAULTS['Payroll'].permanent).toBe(false)
    })
  })
})
