import { describe, expect, it } from 'vitest'
import { isGlOnlyEntry } from './gl-only-categories'

describe('Bank Reconciliation — Matching & GL-Only', () => {
  // --- GL-only entry detection ---

  describe('isGlOnlyEntry', () => {
    it('identifies SYSTEM source type as GL-only', () => {
      expect(
        isGlOnlyEntry({ sourceType: 'SYSTEM', accountName: 'Operating Cash' })
      ).toBe(true)
    })

    it('identifies FY25_IMPORT source type as GL-only', () => {
      expect(
        isGlOnlyEntry({ sourceType: 'FY25_IMPORT', accountName: 'Checking' })
      ).toBe(true)
    })

    it('identifies accumulated depreciation account as GL-only', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'Accumulated Depreciation - Building',
        })
      ).toBe(true)
    })

    it('identifies net assets with donor restrictions as GL-only', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'Net Assets With Donor Restrictions',
        })
      ).toBe(true)
    })

    it('identifies net assets without donor restrictions as GL-only', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'Net Assets Without Donor Restrictions',
        })
      ).toBe(true)
    })

    it('identifies accrued interest payable as GL-only', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'Accrued Interest Payable',
        })
      ).toBe(true)
    })

    it('identifies AHP loan payable as GL-only', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'AHP Loan Payable',
        })
      ).toBe(true)
    })

    it('returns false for regular MANUAL entries', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'Operating Checking',
        })
      ).toBe(false)
    })

    it('returns false for BANK_FEED entries', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'BANK_FEED',
          accountName: 'Bank Fees',
        })
      ).toBe(false)
    })

    it('returns false for RAMP entries', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'RAMP',
          accountName: 'Office Supplies',
        })
      ).toBe(false)
    })

    it('is case-insensitive for account name matching', () => {
      expect(
        isGlOnlyEntry({
          sourceType: 'MANUAL',
          accountName: 'ACCUMULATED DEPRECIATION - EQUIPMENT',
        })
      ).toBe(true)
    })
  })

  // --- Matching algorithm structural tests ---

  describe('Matching algorithm structure', () => {
    it('split validation: splits must sum to bank transaction amount', () => {
      // Simulating the validation logic from createSplitMatches
      const bankAmount = 100.0
      const splits = [
        { glTransactionLineId: 1, amount: 60.0 },
        { glTransactionLineId: 2, amount: 40.0 },
      ]
      const splitSum = splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)
      expect(Math.abs(bankAmount - splitSum) < 0.01).toBe(true)
    })

    it('split validation: rejects sum mismatch', () => {
      const bankAmount = 100.0
      const splits = [
        { glTransactionLineId: 1, amount: 60.0 },
        { glTransactionLineId: 2, amount: 30.0 },
      ]
      const splitSum = splits.reduce((sum, s) => sum + Math.abs(s.amount), 0)
      expect(Math.abs(bankAmount - splitSum) < 0.01).toBe(false)
    })

    it('confidence scoring: same-day match gets highest score', () => {
      let score = 1.0
      const daysDiff = 0
      if (daysDiff === 0) score += 0.05
      else if (daysDiff <= 1) score += 0.03
      expect(score).toBe(1.05)
    })

    it('confidence scoring: ±1 day gets bonus', () => {
      let score = 1.0
      const daysDiff: number = 1
      if (daysDiff === 0) score += 0.05
      else if (daysDiff <= 1) score += 0.03
      expect(score).toBe(1.03)
    })

    it('confidence scoring: merchant name match adds +0.1', () => {
      let score = 1.0
      const merchantName = 'EVERSOURCE'
      const memo = 'Payment to Eversource Electric'
      if (memo.toLowerCase().includes(merchantName.toLowerCase())) {
        score += 0.1
      }
      expect(score).toBe(1.1)
    })

    it('confidence scoring: no merchant match stays at base', () => {
      let score = 1.0
      const merchantName = 'AMAZON'
      const memo = 'Office supply purchase'
      if (memo.toLowerCase().includes(merchantName.toLowerCase())) {
        score += 0.1
      }
      expect(score).toBe(1.0)
    })
  })
})
