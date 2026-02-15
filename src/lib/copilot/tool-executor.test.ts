import { describe, it, expect } from 'vitest'
import { getRegisteredTools, executeTool } from './tool-executor'

describe('Tool executor', () => {
  it('has all 9 tools registered', () => {
    const tools = getRegisteredTools()
    expect(tools).toContain('taxLawSearch')
    expect(tools).toContain('regulationLookup')
    expect(tools).toContain('nonprofitExplorerLookup')
    expect(tools).toContain('govInfoSearch')
    expect(tools).toContain('searchTransactions')
    expect(tools).toContain('searchAccounts')
    expect(tools).toContain('getAccountBalance')
    expect(tools).toContain('getFundBalance')
    expect(tools).toContain('searchAuditLog')
    expect(tools).toHaveLength(9)
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool('unknownTool', {})
    expect(result).toEqual({ error: 'Unknown tool: unknownTool' })
  })

  it('executes taxLawSearch successfully', async () => {
    const result = await executeTool('taxLawSearch', {
      query: '501(c)(3)',
      topics: ['exempt-org'],
    }) as { results: Array<{ source: string; excerpt: string }> }
    expect(result.results).toBeDefined()
    expect(result.results.length).toBeGreaterThan(0)
  })
})
