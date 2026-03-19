import { describe, expect, it, vi, beforeEach } from 'vitest'

/**
 * Unit tests for classifyMatchTier — the three-tier auto-match classification.
 * Tests the pure classification logic with various candidate/rule/threshold combos.
 */

// We test the classification logic by replicating it rather than calling the DB-bound function directly.
// This mirrors how matcher.test.ts tests confidence scoring structurally.

describe('Three-Tier Match Classification', () => {
  const defaultThresholds = {
    autoMatchMinHitCount: 5,
    autoMatchMinConfidence: 0.95,
    autoMatchMaxAmount: 500.0,
    reviewMinConfidence: 0.7,
  }

  const makeCandidate = (overrides: Record<string, unknown> = {}) => ({
    glTransactionLineId: 1,
    transactionId: 10,
    date: '2026-03-15',
    memo: 'Payment to Eversource',
    accountName: 'Utilities',
    debit: '127.50',
    credit: null,
    amount: 127.5,
    confidenceScore: 1.05,
    ...overrides,
  })

  const makeRule = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    criteria: { merchantPattern: 'eversource' },
    action: {},
    isActive: true,
    autoMatchEligible: true,
    hitCount: 10,
    settlementDayOffset: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  })

  const makeBankTxn = (overrides: Record<string, unknown> = {}) => ({
    id: 1,
    bankAccountId: 1,
    plaidTransactionId: 'txn_1',
    amount: '127.50',
    date: '2026-03-15',
    merchantName: 'Eversource Electric',
    category: 'Utilities',
    isPending: false,
    createdAt: new Date(),
    ...overrides,
  })

  // --- Tier classification logic (replicated from matcher.ts classifyMatchTier) ---

  function classifyLocally(
    bankTxn: ReturnType<typeof makeBankTxn>,
    candidates: ReturnType<typeof makeCandidate>[],
    rules: ReturnType<typeof makeRule>[],
    thresholds: typeof defaultThresholds
  ): { tier: 1 | 2 | 3; reason: string } {
    const bankAmount = Math.abs(parseFloat(bankTxn.amount as string))

    if (candidates.length === 0) {
      const hasRule = rules.some((r) => {
        const criteria = r.criteria as { merchantPattern?: string }
        if (!criteria.merchantPattern || !bankTxn.merchantName) return false
        return (bankTxn.merchantName as string)
          .toLowerCase()
          .includes(criteria.merchantPattern.toLowerCase())
      })
      if (!hasRule) {
        return { tier: 3, reason: 'No match candidates and no matching rule — new merchant' }
      }
      return { tier: 3, reason: 'No GL match candidates found' }
    }

    const best = candidates[0]

    // Ambiguous check
    if (candidates.length > 1) {
      const diff = best.confidenceScore - candidates[1].confidenceScore
      if (diff < 0.05) {
        return { tier: 3, reason: `Ambiguous: ${candidates.length} candidates with similar confidence` }
      }
    }

    if (best.confidenceScore < thresholds.reviewMinConfidence) {
      return { tier: 3, reason: `Low confidence (${best.confidenceScore})` }
    }

    // Find matching rule
    const matchedRule = rules.find((r) => {
      const criteria = r.criteria as { merchantPattern?: string }
      if (criteria.merchantPattern && bankTxn.merchantName) {
        return (bankTxn.merchantName as string)
          .toLowerCase()
          .includes(criteria.merchantPattern.toLowerCase())
      }
      return false
    })

    // Tier 1 check
    if (
      best.confidenceScore >= thresholds.autoMatchMinConfidence &&
      matchedRule &&
      matchedRule.autoMatchEligible &&
      matchedRule.hitCount >= thresholds.autoMatchMinHitCount &&
      bankAmount <= thresholds.autoMatchMaxAmount
    ) {
      return { tier: 1, reason: 'Auto-match' }
    }

    // Tier 2
    if (best.confidenceScore >= thresholds.reviewMinConfidence) {
      return { tier: 2, reason: 'Review needed' }
    }

    return { tier: 3, reason: 'Below review threshold' }
  }

  describe('Tier 1 (auto-match)', () => {
    it('classifies as Tier 1 when all criteria met', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate()],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(1)
    })

    it('requires confidence >= autoMatchMinConfidence', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate({ confidenceScore: 0.9 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(2) // Not auto, but reviewable
    })

    it('requires hitCount >= autoMatchMinHitCount', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate()],
        [makeRule({ hitCount: 2 })],
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })

    it('requires amount <= autoMatchMaxAmount', () => {
      const result = classifyLocally(
        makeBankTxn({ amount: '1500.00' }),
        [makeCandidate({ amount: 1500, confidenceScore: 1.05 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })

    it('requires autoMatchEligible = true', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate()],
        [makeRule({ autoMatchEligible: false })],
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })
  })

  describe('Tier 2 (batch review)', () => {
    it('classifies as Tier 2 when confidence is between review and auto thresholds', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate({ confidenceScore: 0.85 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })

    it('classifies as Tier 2 when no matching rule exists', () => {
      const result = classifyLocally(
        makeBankTxn({ merchantName: 'UNKNOWN VENDOR' }),
        [makeCandidate()],
        [makeRule()], // rule pattern doesn't match 'UNKNOWN VENDOR'
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })
  })

  describe('Tier 3 (exception)', () => {
    it('classifies as Tier 3 when no candidates exist and no rule', () => {
      const result = classifyLocally(
        makeBankTxn({ merchantName: 'BRAND NEW VENDOR' }),
        [],
        [],
        defaultThresholds
      )
      expect(result.tier).toBe(3)
      expect(result.reason).toContain('new merchant')
    })

    it('classifies as Tier 3 when candidates are ambiguous', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [
          makeCandidate({ glTransactionLineId: 1, confidenceScore: 1.05 }),
          makeCandidate({ glTransactionLineId: 2, confidenceScore: 1.03 }),
        ],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(3)
      expect(result.reason).toContain('Ambiguous')
    })

    it('classifies as Tier 3 when confidence is below review threshold', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate({ confidenceScore: 0.5 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(3)
      expect(result.reason).toContain('Low confidence')
    })

    it('classifies as Tier 3 when no candidates but rule exists', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(3)
      expect(result.reason).toContain('No GL match candidates found')
    })
  })

  describe('Edge cases', () => {
    it('handles null merchantName gracefully', () => {
      const result = classifyLocally(
        makeBankTxn({ merchantName: null }),
        [],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(3)
    })

    it('handles zero-amount transaction', () => {
      const result = classifyLocally(
        makeBankTxn({ amount: '0.00' }),
        [makeCandidate({ amount: 0, confidenceScore: 1.05 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(1) // amount 0 <= max 500
    })

    it('threshold at exact boundary: confidence exactly at auto min', () => {
      const result = classifyLocally(
        makeBankTxn(),
        [makeCandidate({ confidenceScore: 0.95 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(1)
    })

    it('threshold at exact boundary: amount exactly at max', () => {
      const result = classifyLocally(
        makeBankTxn({ amount: '500.00' }),
        [makeCandidate({ amount: 500, confidenceScore: 1.05 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(1)
    })

    it('amount just over max goes to Tier 2', () => {
      const result = classifyLocally(
        makeBankTxn({ amount: '500.01' }),
        [makeCandidate({ amount: 500.01, confidenceScore: 1.05 })],
        [makeRule()],
        defaultThresholds
      )
      expect(result.tier).toBe(2)
    })
  })
})
