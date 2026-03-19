import { describe, expect, it } from 'vitest'

/**
 * Tests for cash threshold alert logic.
 * Validates warning and critical triggers at correct unrestricted balance levels.
 */

describe('Cash Threshold Alerts', () => {
  interface ThresholdSettings {
    warning: number
    critical: number
  }

  function checkThresholds(
    unrestrictedBalance: number,
    thresholds: ThresholdSettings
  ) {
    return {
      isWarning:
        unrestrictedBalance < thresholds.warning &&
        unrestrictedBalance >= thresholds.critical,
      isCritical: unrestrictedBalance < thresholds.critical,
    }
  }

  const defaults: ThresholdSettings = { warning: 20000, critical: 10000 }

  describe('Warning threshold', () => {
    it('triggers warning when below warning but above critical', () => {
      const result = checkThresholds(15000, defaults)
      expect(result.isWarning).toBe(true)
      expect(result.isCritical).toBe(false)
    })

    it('does not trigger warning when above warning threshold', () => {
      const result = checkThresholds(25000, defaults)
      expect(result.isWarning).toBe(false)
      expect(result.isCritical).toBe(false)
    })

    it('triggers at exactly $19,999.99', () => {
      const result = checkThresholds(19999.99, defaults)
      expect(result.isWarning).toBe(true)
    })

    it('does not trigger at exactly $20,000', () => {
      const result = checkThresholds(20000, defaults)
      expect(result.isWarning).toBe(false)
    })
  })

  describe('Critical threshold', () => {
    it('triggers critical when below critical threshold', () => {
      const result = checkThresholds(5000, defaults)
      expect(result.isCritical).toBe(true)
      expect(result.isWarning).toBe(false) // critical overrides warning
    })

    it('triggers critical at $0', () => {
      const result = checkThresholds(0, defaults)
      expect(result.isCritical).toBe(true)
    })

    it('triggers critical at negative balance', () => {
      const result = checkThresholds(-5000, defaults)
      expect(result.isCritical).toBe(true)
    })

    it('does not trigger critical at exactly $10,000', () => {
      const result = checkThresholds(10000, defaults)
      expect(result.isCritical).toBe(false)
      expect(result.isWarning).toBe(true) // warning triggers instead
    })

    it('triggers critical at $9,999.99', () => {
      const result = checkThresholds(9999.99, defaults)
      expect(result.isCritical).toBe(true)
    })
  })

  describe('No alerts', () => {
    it('no alerts when comfortably above warning', () => {
      const result = checkThresholds(50000, defaults)
      expect(result.isWarning).toBe(false)
      expect(result.isCritical).toBe(false)
    })

    it('no alerts when exactly at warning threshold', () => {
      const result = checkThresholds(20000, defaults)
      expect(result.isWarning).toBe(false)
      expect(result.isCritical).toBe(false)
    })
  })

  describe('Custom thresholds', () => {
    it('respects custom warning threshold', () => {
      const custom: ThresholdSettings = { warning: 50000, critical: 25000 }
      const result = checkThresholds(30000, custom)
      expect(result.isWarning).toBe(true)
      expect(result.isCritical).toBe(false)
    })

    it('respects custom critical threshold', () => {
      const custom: ThresholdSettings = { warning: 50000, critical: 25000 }
      const result = checkThresholds(20000, custom)
      expect(result.isCritical).toBe(true)
    })

    it('handles very low thresholds', () => {
      const custom: ThresholdSettings = { warning: 1000, critical: 500 }
      const result = checkThresholds(800, custom)
      expect(result.isWarning).toBe(true)
      expect(result.isCritical).toBe(false)
    })
  })

  describe('Week-level alert propagation', () => {
    it('identifies which weeks breach thresholds', () => {
      const weeklyBalances = [32000, 28000, 22000, 18000, 15000, 12000, 9000, 7000]
      const alerts = weeklyBalances.map((bal) => checkThresholds(bal, defaults))

      // First 3 weeks: no alert
      expect(alerts[0].isWarning).toBe(false)
      expect(alerts[1].isWarning).toBe(false)
      expect(alerts[2].isWarning).toBe(false)

      // Weeks 4-6: warning
      expect(alerts[3].isWarning).toBe(true)
      expect(alerts[4].isWarning).toBe(true)
      expect(alerts[5].isWarning).toBe(true)

      // Weeks 7-8: critical
      expect(alerts[6].isCritical).toBe(true)
      expect(alerts[7].isCritical).toBe(true)
    })
  })
})
