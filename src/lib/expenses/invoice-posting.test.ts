import { describe, expect, it } from 'vitest'
import {
  buildInvoiceGlLines,
  isBalancedEntry,
  isValidPoTransition,
  isValidInvoiceTransition,
  getAgingBucket,
} from './invoice-posting'

describe('Invoice GL posting', () => {
  describe('buildInvoiceGlLines — CIP cost code inheritance', () => {
    it('invoice against PO with CIP destination carries cipCostCodeId', () => {
      const lines = buildInvoiceGlLines({
        destinationAccountId: 20, // CIP sub-account
        apAccountId: 50, // Accounts Payable
        fundId: 1,
        amount: 5000,
        cipCostCodeId: 3, // from the PO
      })

      expect(lines).toHaveLength(2)

      // Debit line — destination with CIP cost code inherited
      expect(lines[0].accountId).toBe(20)
      expect(lines[0].debit).toBe(5000)
      expect(lines[0].credit).toBeNull()
      expect(lines[0].cipCostCodeId).toBe(3)

      // Credit line — AP
      expect(lines[1].accountId).toBe(50)
      expect(lines[1].debit).toBeNull()
      expect(lines[1].credit).toBe(5000)
    })

    it('invoice against PO with non-CIP destination has null cipCostCodeId', () => {
      const lines = buildInvoiceGlLines({
        destinationAccountId: 30, // Regular expense account
        apAccountId: 50,
        fundId: 1,
        amount: 2500,
        cipCostCodeId: null,
      })

      expect(lines).toHaveLength(2)
      expect(lines[0].cipCostCodeId).toBeNull()
      expect(lines[0].debit).toBe(2500)
      expect(lines[1].credit).toBe(2500)
    })

    it('both lines share the same fundId from the PO', () => {
      const lines = buildInvoiceGlLines({
        destinationAccountId: 20,
        apAccountId: 50,
        fundId: 7,
        amount: 1000,
        cipCostCodeId: null,
      })

      expect(lines[0].fundId).toBe(7)
      expect(lines[1].fundId).toBe(7)
    })
  })

  describe('isBalancedEntry', () => {
    it('balanced entry returns true', () => {
      const lines = buildInvoiceGlLines({
        destinationAccountId: 20,
        apAccountId: 50,
        fundId: 1,
        amount: 5000,
        cipCostCodeId: null,
      })
      expect(isBalancedEntry(lines)).toBe(true)
    })

    it('unbalanced entry returns false', () => {
      expect(
        isBalancedEntry([
          { accountId: 1, fundId: 1, debit: 5000, credit: null },
          { accountId: 2, fundId: 1, debit: null, credit: 4000 },
        ])
      ).toBe(false)
    })

    it('multi-line balanced entry returns true', () => {
      expect(
        isBalancedEntry([
          { accountId: 1, fundId: 1, debit: 3000, credit: null },
          { accountId: 2, fundId: 2, debit: 2000, credit: null },
          { accountId: 3, fundId: 1, debit: null, credit: 5000 },
        ])
      ).toBe(true)
    })

    it('handles floating point precision', () => {
      expect(
        isBalancedEntry([
          { accountId: 1, fundId: 1, debit: 33.33, credit: null },
          { accountId: 2, fundId: 1, debit: 33.33, credit: null },
          { accountId: 3, fundId: 1, debit: 33.34, credit: null },
          { accountId: 4, fundId: 1, debit: null, credit: 100.0 },
        ])
      ).toBe(true)
    })

    it('every invoice posting produces a balanced entry', () => {
      // Property-based style: any amount should produce balanced lines
      const amounts = [1, 100, 999.99, 50000, 0.01]
      for (const amount of amounts) {
        const lines = buildInvoiceGlLines({
          destinationAccountId: 10,
          apAccountId: 20,
          fundId: 1,
          amount,
          cipCostCodeId: null,
        })
        expect(isBalancedEntry(lines)).toBe(true)
      }
    })
  })
})

describe('Payment status transitions', () => {
  describe('PO status transitions', () => {
    it('DRAFT → ACTIVE is valid', () => {
      expect(isValidPoTransition('DRAFT', 'ACTIVE')).toBe(true)
    })

    it('ACTIVE → COMPLETED is valid', () => {
      expect(isValidPoTransition('ACTIVE', 'COMPLETED')).toBe(true)
    })

    it('ACTIVE → CANCELLED is valid', () => {
      expect(isValidPoTransition('ACTIVE', 'CANCELLED')).toBe(true)
    })

    it('DRAFT → COMPLETED is invalid (must activate first)', () => {
      expect(isValidPoTransition('DRAFT', 'COMPLETED')).toBe(false)
    })

    it('DRAFT → CANCELLED is invalid', () => {
      expect(isValidPoTransition('DRAFT', 'CANCELLED')).toBe(false)
    })

    it('COMPLETED → ACTIVE is invalid (terminal state)', () => {
      expect(isValidPoTransition('COMPLETED', 'ACTIVE')).toBe(false)
    })

    it('CANCELLED → ACTIVE is invalid (terminal state)', () => {
      expect(isValidPoTransition('CANCELLED', 'ACTIVE')).toBe(false)
    })
  })

  describe('Invoice payment status transitions (simplified: POSTED → PAID)', () => {
    it('POSTED → PAID is valid', () => {
      expect(isValidInvoiceTransition('POSTED', 'PAID')).toBe(true)
    })

    it('PAID → POSTED is invalid (terminal state)', () => {
      expect(isValidInvoiceTransition('PAID', 'POSTED')).toBe(false)
    })
  })
})

describe('Aging buckets', () => {
  const asOfDate = '2026-02-14'

  it('invoice from today is CURRENT', () => {
    expect(getAgingBucket('2026-02-14', asOfDate)).toBe('CURRENT')
  })

  it('invoice from 15 days ago is CURRENT', () => {
    expect(getAgingBucket('2026-01-30', asOfDate)).toBe('CURRENT')
  })

  it('invoice from 30 days ago is CURRENT', () => {
    expect(getAgingBucket('2026-01-15', asOfDate)).toBe('CURRENT')
  })

  it('invoice from 31 days ago is 30_DAYS', () => {
    expect(getAgingBucket('2026-01-14', asOfDate)).toBe('30_DAYS')
  })

  it('invoice from 60 days ago is 30_DAYS', () => {
    expect(getAgingBucket('2025-12-16', asOfDate)).toBe('30_DAYS')
  })

  it('invoice from 61 days ago is 60_DAYS', () => {
    expect(getAgingBucket('2025-12-15', asOfDate)).toBe('60_DAYS')
  })

  it('invoice from 90 days ago is 60_DAYS', () => {
    expect(getAgingBucket('2025-11-16', asOfDate)).toBe('60_DAYS')
  })

  it('invoice from 91 days ago is 90_PLUS', () => {
    expect(getAgingBucket('2025-11-15', asOfDate)).toBe('90_PLUS')
  })

  it('invoice from 180 days ago is 90_PLUS', () => {
    expect(getAgingBucket('2025-08-18', asOfDate)).toBe('90_PLUS')
  })
})
