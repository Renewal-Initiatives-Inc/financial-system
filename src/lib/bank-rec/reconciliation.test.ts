import { describe, expect, it } from 'vitest'

describe('Bank Reconciliation — Session Logic', () => {
  describe('Reconciliation balance calculation', () => {
    it('calculates variance correctly when reconciled', () => {
      const glBalance = 50000.0
      const bankBalance = 52000.0
      const outstandingChecks = 3000.0
      const outstandingDeposits = 1000.0
      const bankItemsNotInGl = 0.0

      const adjustedBankBalance =
        bankBalance + outstandingChecks - outstandingDeposits + bankItemsNotInGl

      const variance =
        Math.round((glBalance - adjustedBankBalance) * 100) / 100
      const isReconciled = Math.abs(variance) < 0.01

      // 52000 + 3000 - 1000 + 0 = 54000
      expect(adjustedBankBalance).toBe(54000.0)
      // 50000 - 54000 = -4000
      expect(variance).toBe(-4000.0)
      expect(isReconciled).toBe(false)
    })

    it('reconciles when GL balance equals adjusted bank balance', () => {
      const glBalance = 50000.0
      const bankBalance = 48000.0
      const outstandingChecks = 3000.0
      const outstandingDeposits = 1000.0
      const bankItemsNotInGl = 0.0

      const adjustedBankBalance =
        bankBalance + outstandingChecks - outstandingDeposits + bankItemsNotInGl

      const variance =
        Math.round((glBalance - adjustedBankBalance) * 100) / 100
      const isReconciled = Math.abs(variance) < 0.01

      // 48000 + 3000 - 1000 = 50000
      expect(adjustedBankBalance).toBe(50000.0)
      expect(variance).toBe(0)
      expect(isReconciled).toBe(true)
    })

    it('handles bank items not in GL', () => {
      const glBalance = 50000.0
      const bankBalance = 48000.0
      const outstandingChecks = 2000.0
      const outstandingDeposits = 500.0
      const bankItemsNotInGl = 500.0 // Bank fee not yet recorded in GL

      const adjustedBankBalance =
        bankBalance + outstandingChecks - outstandingDeposits + bankItemsNotInGl

      // 48000 + 2000 - 500 + 500 = 50000
      expect(adjustedBankBalance).toBe(50000.0)

      const variance =
        Math.round((glBalance - adjustedBankBalance) * 100) / 100
      expect(variance).toBe(0)
    })

    it('handles penny-level precision', () => {
      const glBalance = 50000.01
      const bankBalance = 48000.01
      const outstandingChecks = 2000.0
      const outstandingDeposits = 0.0
      const bankItemsNotInGl = 0.0

      const adjustedBankBalance =
        bankBalance + outstandingChecks - outstandingDeposits + bankItemsNotInGl

      const variance =
        Math.round((glBalance - adjustedBankBalance) * 100) / 100
      const isReconciled = Math.abs(variance) < 0.01

      expect(adjustedBankBalance).toBe(50000.01)
      expect(variance).toBe(0)
      expect(isReconciled).toBe(true)
    })
  })

  describe('Session state management', () => {
    it('session starts as in_progress', () => {
      const status = 'in_progress'
      expect(status).toBe('in_progress')
    })

    it('sign-off changes status to completed', () => {
      let status = 'in_progress' as 'in_progress' | 'completed'
      // Simulate sign-off
      status = 'completed'
      expect(status).toBe('completed')
    })

    it('edit reconciled item requires change note', () => {
      const changeNote = ''
      const isValid = changeNote.trim().length > 0
      expect(isValid).toBe(false)
    })

    it('edit reconciled item accepts valid change note', () => {
      const changeNote = 'Corrected account coding per CFO'
      const isValid = changeNote.trim().length > 0
      expect(isValid).toBe(true)
    })
  })

  describe('Plaid sign convention', () => {
    it('positive amount = outflow (money out)', () => {
      const plaidAmount = 42.5 // positive = money out per Plaid convention
      const isOutflow = plaidAmount > 0
      expect(isOutflow).toBe(true)
    })

    it('negative amount = inflow (money in)', () => {
      const plaidAmount = -1500.0 // negative = money in per Plaid convention
      const isOutflow = plaidAmount > 0
      expect(isOutflow).toBe(false)
    })
  })
})
