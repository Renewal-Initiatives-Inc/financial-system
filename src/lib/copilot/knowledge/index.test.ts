import { describe, it, expect } from 'vitest'
import { loadKnowledge, getTopicKeys, searchKnowledge } from './index'

describe('Knowledge corpus', () => {
  it('getTopicKeys returns all 7 topic categories', () => {
    const keys = getTopicKeys()
    expect(keys).toContain('exempt-org')
    expect(keys).toContain('fund-accounting')
    expect(keys).toContain('depreciation')
    expect(keys).toContain('payroll-tax')
    expect(keys).toContain('ma-compliance')
    expect(keys).toContain('reporting')
    expect(keys).toContain('construction')
    expect(keys).toHaveLength(7)
  })

  it('loadKnowledge returns content for valid topics', () => {
    const content = loadKnowledge(['fund-accounting'])
    expect(content).toBeTruthy()
    expect(content).toContain('ASC 958')
    expect(content).toContain('fund-accounting/')
  })

  it('loadKnowledge returns content for multiple topics', () => {
    const content = loadKnowledge(['exempt-org', 'depreciation'])
    expect(content).toContain('501(c)(3)')
    expect(content).toContain('MACRS')
  })

  it('loadKnowledge returns empty string for unknown topic', () => {
    const content = loadKnowledge(['nonexistent'])
    expect(content).toBe('')
  })

  it('searchKnowledge finds relevant results', () => {
    const results = searchKnowledge('security deposit')
    expect(results.length).toBeGreaterThan(0)
    // Should find results — "security deposit" appears in MA compliance files
    const sources = results.map((r) => r.source)
    expect(sources.some((s) => s.includes('ma-compliance'))).toBe(true)
  })

  it('searchKnowledge respects topic filter', () => {
    const results = searchKnowledge('501(c)(3)', ['exempt-org'])
    expect(results.length).toBeGreaterThan(0)
    for (const r of results) {
      expect(r.source).toContain('exempt-org')
    }
  })

  it('searchKnowledge returns at most 5 results', () => {
    // A very common term should match many files but be capped
    const results = searchKnowledge('the')
    expect(results.length).toBeLessThanOrEqual(5)
  })
})
