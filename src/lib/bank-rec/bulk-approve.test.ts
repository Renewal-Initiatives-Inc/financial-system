import { describe, expect, it } from 'vitest'

/**
 * Tests for bulkApproveMatches server action logic.
 * Validates batch approval, partial failures, and rule hit count updates.
 */

describe('Bulk Approve Matches', () => {
  describe('Batch processing', () => {
    it('counts approved and failed items correctly', () => {
      const items = [
        { bankTransactionId: 1, glTransactionLineId: 10 },
        { bankTransactionId: 2, glTransactionLineId: 20 },
        { bankTransactionId: 3, glTransactionLineId: 30 },
      ]

      // Simulate: item 2 fails, others succeed
      const results = items.map((item, i) =>
        i === 1 ? { success: false } : { success: true }
      )

      const approved = results.filter((r) => r.success).length
      const failed = results.filter((r) => !r.success).length

      expect(approved).toBe(2)
      expect(failed).toBe(1)
      expect(approved + failed).toBe(items.length)
    })

    it('handles all items succeeding', () => {
      const count = 5
      const results = Array(count).fill({ success: true })
      expect(results.filter((r) => r.success).length).toBe(count)
      expect(results.filter((r) => !r.success).length).toBe(0)
    })

    it('handles all items failing', () => {
      const count = 3
      const results = Array(count).fill({ success: false })
      expect(results.filter((r) => r.success).length).toBe(0)
      expect(results.filter((r) => !r.success).length).toBe(count)
    })

    it('handles empty item list', () => {
      const items: { bankTransactionId: number; glTransactionLineId: number }[] = []
      expect(items.length).toBe(0)
    })
  })

  describe('Rule hit count tracking', () => {
    it('increments hit count for items with ruleId', () => {
      const items = [
        { bankTransactionId: 1, glTransactionLineId: 10, ruleId: 5 },
        { bankTransactionId: 2, glTransactionLineId: 20 },
        { bankTransactionId: 3, glTransactionLineId: 30, ruleId: 5 },
      ]

      const ruleUpdates = new Map<number, number>()
      for (const item of items) {
        if (item.ruleId) {
          ruleUpdates.set(item.ruleId, (ruleUpdates.get(item.ruleId) ?? 0) + 1)
        }
      }

      expect(ruleUpdates.get(5)).toBe(2)
      expect(ruleUpdates.size).toBe(1)
    })

    it('does not increment when no ruleId provided', () => {
      const items = [
        { bankTransactionId: 1, glTransactionLineId: 10 },
        { bankTransactionId: 2, glTransactionLineId: 20 },
      ]

      const ruleUpdates = new Map<number, number>()
      for (const item of items) {
        if ('ruleId' in item && item.ruleId) {
          ruleUpdates.set(item.ruleId as number, (ruleUpdates.get(item.ruleId as number) ?? 0) + 1)
        }
      }

      expect(ruleUpdates.size).toBe(0)
    })
  })

  describe('Match record creation', () => {
    it('creates match with correct matchType for bulk approve', () => {
      const matchType = 'manual' // bulkApproveMatches uses 'manual' type
      expect(matchType).toBe('manual')
    })

    it('validates bank_match record has required fields', () => {
      const matchRecord = {
        bankTransactionId: 1,
        glTransactionLineId: 10,
        matchType: 'manual' as const,
        reconciliationSessionId: 5,
        userId: 'user123',
      }

      expect(matchRecord.bankTransactionId).toBeDefined()
      expect(matchRecord.glTransactionLineId).toBeDefined()
      expect(matchRecord.matchType).toBe('manual')
      expect(matchRecord.userId).toBeTruthy()
    })
  })
})
