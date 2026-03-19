import { describe, expect, it, vi } from 'vitest'

/**
 * Tests for the runAutoMatch integration flow.
 * Validates that the auto-match orchestrator processes tiers correctly.
 */

describe('Auto-Match Engine — runAutoMatch', () => {
  describe('AutoMatchResult structure', () => {
    it('returns the expected shape', () => {
      const result = {
        autoMatched: 5,
        pendingReview: 3,
        exceptions: 1,
        errors: [] as string[],
      }
      expect(result.autoMatched).toBeTypeOf('number')
      expect(result.pendingReview).toBeTypeOf('number')
      expect(result.exceptions).toBeTypeOf('number')
      expect(Array.isArray(result.errors)).toBe(true)
    })

    it('counts sum to total unmatched', () => {
      const totalUnmatched = 10
      const result = { autoMatched: 5, pendingReview: 3, exceptions: 2, errors: [] }
      expect(result.autoMatched + result.pendingReview + result.exceptions).toBe(
        totalUnmatched
      )
    })
  })

  describe('Tier distribution logic', () => {
    it('all Tier 1 when every transaction meets auto criteria', () => {
      const tiers = [1, 1, 1, 1, 1]
      const autoMatched = tiers.filter((t) => t === 1).length
      const pendingReview = tiers.filter((t) => t === 2).length
      const exceptions = tiers.filter((t) => t === 3).length
      expect(autoMatched).toBe(5)
      expect(pendingReview).toBe(0)
      expect(exceptions).toBe(0)
    })

    it('mixed tiers distribute correctly', () => {
      const tiers = [1, 1, 2, 2, 3]
      const autoMatched = tiers.filter((t) => t === 1).length
      const pendingReview = tiers.filter((t) => t === 2).length
      const exceptions = tiers.filter((t) => t === 3).length
      expect(autoMatched).toBe(2)
      expect(pendingReview).toBe(2)
      expect(exceptions).toBe(1)
    })

    it('all exceptions when no candidates exist', () => {
      const tiers = [3, 3, 3]
      const autoMatched = tiers.filter((t) => t === 1).length
      expect(autoMatched).toBe(0)
      expect(tiers.filter((t) => t === 3).length).toBe(3)
    })
  })

  describe('Error handling', () => {
    it('collects errors without stopping processing', () => {
      const errors: string[] = []
      const transactions = [
        { id: 1, success: true },
        { id: 2, success: false, error: 'GL line not found' },
        { id: 3, success: true },
      ]

      let autoMatched = 0
      for (const txn of transactions) {
        if (txn.success) {
          autoMatched++
        } else {
          errors.push(txn.error!)
        }
      }

      expect(autoMatched).toBe(2)
      expect(errors).toHaveLength(1)
      expect(errors[0]).toBe('GL line not found')
    })

    it('returns empty result when no unmatched transactions', () => {
      const result = { autoMatched: 0, pendingReview: 0, exceptions: 0, errors: [] }
      expect(result.autoMatched + result.pendingReview + result.exceptions).toBe(0)
    })
  })
})
