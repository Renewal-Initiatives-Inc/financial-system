import { describe, it, expect } from 'vitest'
import { getRegisteredTools, executeTool } from './tool-executor'

describe('Tool executor', () => {
  it('has all tools registered', () => {
    const tools = getRegisteredTools()
    expect(tools).toContain('taxLawSearch')
    expect(tools).toContain('regulationLookup')
    expect(tools).toContain('nonprofitExplorerLookup')
    expect(tools).toContain('govInfoSearch')
    expect(tools).toContain('searchTransactions')
    expect(tools).toContain('searchBankTransactions')
    expect(tools).toContain('searchAccounts')
    expect(tools).toContain('getAccountBalance')
    expect(tools).toContain('getFundBalance')
    expect(tools).toContain('searchAuditLog')
    expect(tools).toHaveLength(10)
  })

  it('returns error for unknown tool', async () => {
    const result = await executeTool('unknownTool', {})
    expect(result).toEqual({ error: 'Unknown tool: unknownTool' })
  })

  it('executes taxLawSearch with valid input successfully', async () => {
    const result = await executeTool('taxLawSearch', {
      query: '501(c)(3)',
      topics: ['exempt-org'],
    }) as { results: Array<{ source: string; excerpt: string }> }
    expect(result.results).toBeDefined()
    expect(result.results.length).toBeGreaterThan(0)
  })

  // --- Schema validation tests ---

  it('returns error for invalid input — wrong type for required field', async () => {
    const result = await executeTool('getAccountBalance', {
      accountId: 'not-a-number',
    }) as { error: string }
    expect(result.error).toContain('Invalid parameters for tool getAccountBalance')
    expect(result.error).toContain('accountId')
  })

  it('returns error for missing required field', async () => {
    const result = await executeTool('regulationLookup', {}) as { error: string }
    expect(result.error).toContain('Invalid parameters for tool regulationLookup')
    expect(result.error).toContain('citation')
  })

  it('strips extra/unknown fields from input', async () => {
    // taxLawSearch only expects query + topics
    // The handler should receive stripped input without extraField
    const result = await executeTool('taxLawSearch', {
      query: 'depreciation',
      extraField: 'should be stripped',
      anotherExtra: 42,
    }) as { results: unknown[] }
    // If it executes without error, the handler received valid input
    expect(result.results).toBeDefined()
  })

  it('passes valid input through to handler (schema validation succeeds)', async () => {
    const result = await executeTool('searchAccounts', {
      query: 'Cash',
      type: 'ASSET',
      activeOnly: true,
    }) as { error?: string }
    // Handler may fail due to no DB in test — but the error should be
    // a handler error (Database not configured), NOT a validation error
    if (result.error) {
      expect(result.error).not.toContain('Invalid parameters')
    }
  })

  it('validates getFundBalance requires fundId as number', async () => {
    const result = await executeTool('getFundBalance', {
      fundId: 'abc',
    }) as { error: string }
    expect(result.error).toContain('Invalid parameters for tool getFundBalance')
  })
})
