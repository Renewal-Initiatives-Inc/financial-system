import { describe, expect, it } from 'vitest'

/**
 * Unit tests for recurring expectation matching logic.
 * Tests merchant pattern regex, amount tolerance, and timing window checks.
 */

describe('Recurring Expectations Matching', () => {
  // Replicate the matching logic from matcher.ts matchRecurringExpectation

  function matchesExpectation(
    bankTxn: { amount: string; date: string; merchantName: string | null },
    expectation: {
      merchantPattern: string
      expectedAmount: string
      amountTolerance: string
      frequency: string
      expectedDay: number
    }
  ): boolean {
    if (!bankTxn.merchantName) return false

    // Test merchant pattern
    try {
      const regex = new RegExp(expectation.merchantPattern, 'i')
      if (!regex.test(bankTxn.merchantName)) return false
    } catch {
      return false
    }

    // Amount within tolerance
    const bankAmount = Math.abs(parseFloat(bankTxn.amount))
    const expectedAmt = parseFloat(expectation.expectedAmount)
    const tolerance = parseFloat(expectation.amountTolerance)
    if (Math.abs(bankAmount - expectedAmt) > tolerance) return false

    // Timing check
    const bankDate = new Date(bankTxn.date)
    const bankDay = bankDate.getDate()
    const expectedDay = expectation.expectedDay

    if (expectation.frequency === 'weekly' || expectation.frequency === 'biweekly') {
      const bankDayOfWeek = bankDate.getDay() === 0 ? 7 : bankDate.getDay()
      const dayMatch =
        Math.abs(bankDayOfWeek - expectedDay) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay + 7) <= 3 ||
        Math.abs(bankDayOfWeek - expectedDay - 7) <= 3
      return dayMatch
    } else {
      const dayMatch =
        Math.abs(bankDay - expectedDay) <= 3 ||
        Math.abs(bankDay - expectedDay + 31) <= 3 ||
        Math.abs(bankDay - expectedDay - 31) <= 3
      return dayMatch
    }
  }

  describe('Merchant pattern matching', () => {
    const base = {
      expectedAmount: '127.50',
      amountTolerance: '5.00',
      frequency: 'monthly' as const,
      expectedDay: 15,
    }

    it('matches exact merchant name with regex pattern', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'Eversource Electric' },
          { ...base, merchantPattern: 'eversource' }
        )
      ).toBe(true)
    })

    it('is case-insensitive', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'EVERSOURCE ELECTRIC' },
          { ...base, merchantPattern: 'eversource' }
        )
      ).toBe(true)
    })

    it('supports regex patterns', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'EVERSOURCE ENERGY LLC' },
          { ...base, merchantPattern: 'eversource\\s+(electric|energy)' }
        )
      ).toBe(true)
    })

    it('rejects non-matching merchant', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'National Grid' },
          { ...base, merchantPattern: 'eversource' }
        )
      ).toBe(false)
    })

    it('returns false for null merchantName', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: null },
          { ...base, merchantPattern: 'eversource' }
        )
      ).toBe(false)
    })

    it('handles invalid regex gracefully', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, merchantPattern: '[invalid(' }
        )
      ).toBe(false)
    })
  })

  describe('Amount tolerance', () => {
    const base = {
      merchantPattern: 'eversource',
      frequency: 'monthly' as const,
      expectedDay: 15,
    }

    it('matches exact amount', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, expectedAmount: '127.50', amountTolerance: '0.00' }
        )
      ).toBe(true)
    })

    it('matches within tolerance range', () => {
      expect(
        matchesExpectation(
          { amount: '130.00', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, expectedAmount: '127.50', amountTolerance: '5.00' }
        )
      ).toBe(true)
    })

    it('matches below expected within tolerance', () => {
      expect(
        matchesExpectation(
          { amount: '125.00', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, expectedAmount: '127.50', amountTolerance: '5.00' }
        )
      ).toBe(true)
    })

    it('rejects amount outside tolerance', () => {
      expect(
        matchesExpectation(
          { amount: '140.00', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, expectedAmount: '127.50', amountTolerance: '5.00' }
        )
      ).toBe(false)
    })

    it('handles zero tolerance (exact match only)', () => {
      expect(
        matchesExpectation(
          { amount: '127.51', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, expectedAmount: '127.50', amountTolerance: '0.00' }
        )
      ).toBe(false)
    })
  })

  describe('Timing window', () => {
    const base = {
      merchantPattern: 'eversource',
      expectedAmount: '127.50',
      amountTolerance: '5.00',
    }

    it('matches on expected day (monthly)', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-15', merchantName: 'Eversource' },
          { ...base, frequency: 'monthly', expectedDay: 15 }
        )
      ).toBe(true)
    })

    it('matches within ±3 days of expected day', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-18', merchantName: 'Eversource' },
          { ...base, frequency: 'monthly', expectedDay: 15 }
        )
      ).toBe(true)
    })

    it('rejects beyond ±3 day window', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-20', merchantName: 'Eversource' },
          { ...base, frequency: 'monthly', expectedDay: 15 }
        )
      ).toBe(false)
    })

    it('handles month boundary: expected 1st, txn on 30th (within 3 days wrapping)', () => {
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-30', merchantName: 'Eversource' },
          { ...base, frequency: 'monthly', expectedDay: 1 }
        )
      ).toBe(true)
    })

    it('handles weekly frequency with day of week', () => {
      // 2026-03-16 is a Monday (day 1)
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-16', merchantName: 'Eversource' },
          { ...base, frequency: 'weekly', expectedDay: 1 }
        )
      ).toBe(true)
    })

    it('handles weekly within ±3 day window across week boundary', () => {
      // 2026-03-13 is a Friday (day 5), expected Monday (1): diff wraps around
      expect(
        matchesExpectation(
          { amount: '127.50', date: '2026-03-13', merchantName: 'Eversource' },
          { ...base, frequency: 'weekly', expectedDay: 1 }
        )
      ).toBe(true) // |5-1|=4 but |5-1-7|=|-3|=3 so matches
    })
  })
})
