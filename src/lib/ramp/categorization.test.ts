import { describe, it, expect } from 'vitest'
import { matchRule } from './categorization'

// Helper to create test rules
function makeRule(overrides: {
  id: number
  criteria: { merchantPattern?: string; descriptionKeywords?: string[] }
  glAccountId?: number
  fundId?: number
  autoApply?: boolean
  hitCount?: number
}) {
  return {
    glAccountId: 10,
    fundId: 1,
    autoApply: true,
    hitCount: 0,
    ...overrides,
  }
}

describe('matchRule', () => {
  it('returns null when no rules exist', () => {
    const result = matchRule(
      { merchantName: 'Home Depot', description: null },
      []
    )
    expect(result).toBeNull()
  })

  it('matches on merchant pattern (case-insensitive)', () => {
    const rules = [
      makeRule({ id: 1, criteria: { merchantPattern: 'home depot' } }),
    ]
    const result = matchRule(
      { merchantName: 'THE HOME DEPOT #1234', description: null },
      rules
    )
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })

  it('matches on description keywords', () => {
    const rules = [
      makeRule({ id: 1, criteria: { descriptionKeywords: ['lumber', 'plywood'] } }),
    ]
    const result = matchRule(
      { merchantName: 'Lowes', description: 'Purchase of lumber and screws' },
      rules
    )
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })

  it('prefers highest hitCount when multiple rules match', () => {
    const rules = [
      makeRule({
        id: 1,
        criteria: { merchantPattern: 'home depot' },
        hitCount: 5,
      }),
      makeRule({
        id: 2,
        criteria: { merchantPattern: 'home' },
        hitCount: 20,
      }),
    ]
    const result = matchRule(
      { merchantName: 'Home Depot', description: null },
      rules
    )
    expect(result).not.toBeNull()
    expect(result!.id).toBe(2)
  })

  it('ignores rules with autoApply = false', () => {
    const rules = [
      makeRule({
        id: 1,
        criteria: { merchantPattern: 'home depot' },
        autoApply: false,
      }),
    ]
    const result = matchRule(
      { merchantName: 'Home Depot', description: null },
      rules
    )
    expect(result).toBeNull()
  })

  it('handles empty description gracefully', () => {
    const rules = [
      makeRule({ id: 1, criteria: { descriptionKeywords: ['lumber'] } }),
    ]
    const result = matchRule(
      { merchantName: 'Home Depot', description: null },
      rules
    )
    expect(result).toBeNull()
  })

  it('matches with partial merchant name (substring)', () => {
    const rules = [
      makeRule({ id: 1, criteria: { merchantPattern: 'depot' } }),
    ]
    const result = matchRule(
      { merchantName: 'The Home Depot Store #4567', description: null },
      rules
    )
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })

  it('does not match when no criteria hit', () => {
    const rules = [
      makeRule({ id: 1, criteria: { merchantPattern: 'walmart' } }),
      makeRule({ id: 2, criteria: { descriptionKeywords: ['grocery'] } }),
    ]
    const result = matchRule(
      { merchantName: 'Home Depot', description: 'Construction supplies' },
      rules
    )
    expect(result).toBeNull()
  })

  it('matches description keywords case-insensitively', () => {
    const rules = [
      makeRule({ id: 1, criteria: { descriptionKeywords: ['LUMBER'] } }),
    ]
    const result = matchRule(
      { merchantName: 'Lowes', description: 'lumber and nails' },
      rules
    )
    expect(result).not.toBeNull()
    expect(result!.id).toBe(1)
  })
})
