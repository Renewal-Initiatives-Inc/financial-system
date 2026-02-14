import { describe, it, expect } from 'vitest'
import { getContextForPage, getRegisteredPageIds } from './index'

describe('Context packages', () => {
  it('has 16 registered page IDs', () => {
    const ids = getRegisteredPageIds()
    expect(ids.length).toBe(16)
    expect(ids).toContain('dashboard')
    expect(ids).toContain('accounts')
    expect(ids).toContain('funds')
    expect(ids).toContain('transactions')
    expect(ids).toContain('compliance')
  })

  it('each context returns valid CopilotContextPackage shape', () => {
    const ids = getRegisteredPageIds()
    for (const id of ids) {
      const ctx = getContextForPage(id)
      expect(ctx.pageId).toBe(id)
      expect(ctx.pageDescription).toBeTruthy()
      expect(ctx.data).toBeDefined()
      expect(Array.isArray(ctx.tools)).toBe(true)
      expect(Array.isArray(ctx.knowledge)).toBe(true)
      expect(ctx.knowledge.length).toBeGreaterThan(0)
    }
  })

  it('returns fallback for unknown page', () => {
    const ctx = getContextForPage('unknown-page')
    expect(ctx.pageId).toBe('unknown-page')
    expect(ctx.tools).toEqual([])
  })

  it('accounts context has correct tools', () => {
    const ctx = getContextForPage('accounts')
    const toolNames = ctx.tools.map((t) => t.name)
    expect(toolNames).toContain('searchAccounts')
    expect(toolNames).toContain('getAccountBalance')
    expect(toolNames).toContain('taxLawSearch')
  })

  it('compliance context has benchmark tools', () => {
    const ctx = getContextForPage('compliance')
    const toolNames = ctx.tools.map((t) => t.name)
    expect(toolNames).toContain('nonprofitExplorerLookup')
    expect(toolNames).toContain('taxLawSearch')
  })

  it('accepts optional data parameter', () => {
    const ctx = getContextForPage('accounts', { selectedId: 42 })
    expect(ctx.data).toEqual({ selectedId: 42 })
  })
})
