import { describe, it, expect } from 'vitest'
import { getHelpTerm, helpTerms } from './terms'

describe('helpTerms', () => {
  it('has at least 20 terms', () => {
    expect(Object.keys(helpTerms).length).toBeGreaterThanOrEqual(20)
  })

  it('returns correct text for known terms', () => {
    const fund = getHelpTerm('fund')
    expect(fund).toBeDefined()
    expect(fund).toContain('ASC 958')

    const normalBalance = getHelpTerm('normal-balance')
    expect(normalBalance).toBeDefined()
    expect(normalBalance).toContain('Debit')
    expect(normalBalance).toContain('Credit')
  })

  it('returns undefined for unknown terms', () => {
    expect(getHelpTerm('nonexistent')).toBeUndefined()
    expect(getHelpTerm('')).toBeUndefined()
  })

  it('all terms have non-empty string values', () => {
    for (const [key, value] of Object.entries(helpTerms)) {
      expect(value, `Term "${key}" should be a non-empty string`).toBeTruthy()
      expect(typeof value).toBe('string')
      expect(value.length).toBeGreaterThan(10)
    }
  })

  it('includes key required terms', () => {
    const requiredTerms = [
      'fund',
      'restriction-type',
      'normal-balance',
      'account-type',
      'system-locked',
      'form-990-line',
      'cip',
      'fund-balance',
      'chart-of-accounts',
      'deactivation',
      'double-entry',
      'audit-trail',
    ]

    for (const term of requiredTerms) {
      expect(getHelpTerm(term), `Missing required term: ${term}`).toBeDefined()
    }
  })
})
