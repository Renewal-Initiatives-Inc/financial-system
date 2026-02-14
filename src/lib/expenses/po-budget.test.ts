import { describe, expect, it } from 'vitest'
import {
  calculateBudgetStatus,
  wouldExceedBudget,
} from './po-budget'

describe('PO budget capacity', () => {
  describe('calculateBudgetStatus', () => {
    it('calculates remaining budget correctly', () => {
      const result = calculateBudgetStatus(10000, 3000)
      expect(result.remaining).toBe(7000)
      expect(result.percentUsed).toBeCloseTo(0.3)
      expect(result.isWarning).toBe(false)
      expect(result.isOverBudget).toBe(false)
    })

    it('shows warning at 90% capacity', () => {
      const result = calculateBudgetStatus(10000, 9000)
      expect(result.remaining).toBe(1000)
      expect(result.percentUsed).toBeCloseTo(0.9)
      expect(result.isWarning).toBe(true)
      expect(result.isOverBudget).toBe(false)
    })

    it('shows warning at 95% capacity', () => {
      const result = calculateBudgetStatus(10000, 9500)
      expect(result.remaining).toBe(500)
      expect(result.percentUsed).toBeCloseTo(0.95)
      expect(result.isWarning).toBe(true)
      expect(result.isOverBudget).toBe(false)
    })

    it('shows over-budget when invoices exceed PO total', () => {
      const result = calculateBudgetStatus(10000, 12000)
      expect(result.remaining).toBe(-2000)
      expect(result.isWarning).toBe(false)
      expect(result.isOverBudget).toBe(true)
    })

    it('exactly at budget is not warning and not over', () => {
      const result = calculateBudgetStatus(10000, 10000)
      expect(result.remaining).toBe(0)
      expect(result.percentUsed).toBeCloseTo(1.0)
      // At 100% — isWarning is false because percentUsed >= 1
      expect(result.isWarning).toBe(false)
      expect(result.isOverBudget).toBe(false)
    })

    it('handles zero total amount', () => {
      const result = calculateBudgetStatus(0, 0)
      expect(result.remaining).toBe(0)
      expect(result.percentUsed).toBe(0)
      expect(result.isOverBudget).toBe(false)
    })

    it('handles fractional amounts', () => {
      const result = calculateBudgetStatus(1000.5, 500.25)
      expect(result.remaining).toBeCloseTo(500.25)
      expect(result.percentUsed).toBeCloseTo(0.5)
    })

    it('no invoices yet shows 0% used', () => {
      const result = calculateBudgetStatus(5000, 0)
      expect(result.remaining).toBe(5000)
      expect(result.percentUsed).toBe(0)
      expect(result.isWarning).toBe(false)
      expect(result.isOverBudget).toBe(false)
    })
  })

  describe('wouldExceedBudget', () => {
    it('returns false when new invoice fits within budget', () => {
      expect(wouldExceedBudget(10000, 5000, 3000)).toBe(false)
    })

    it('returns true when new invoice exceeds remaining budget', () => {
      expect(wouldExceedBudget(10000, 8000, 3000)).toBe(true)
    })

    it('returns false when new invoice exactly fills budget', () => {
      expect(wouldExceedBudget(10000, 5000, 5000)).toBe(false)
    })

    it('returns true when already over budget', () => {
      expect(wouldExceedBudget(10000, 10001, 1)).toBe(true)
    })

    it('handles small penny amounts', () => {
      expect(wouldExceedBudget(100.0, 99.99, 0.02)).toBe(true)
      expect(wouldExceedBudget(100.0, 99.99, 0.01)).toBe(false)
    })
  })
})
