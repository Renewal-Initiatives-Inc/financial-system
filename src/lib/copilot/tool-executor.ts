import { handleTaxLawSearch } from './tools/tax-law-search'
import { handleRegulationLookup } from './tools/regulation-lookup'
import { handleNonprofitExplorerLookup } from './tools/nonprofit-explorer'
import { handleGovInfoSearch } from './tools/govinfo-search'
import { handleSearchTransactions } from './tools/search-transactions'
import { handleSearchAccounts } from './tools/search-accounts'
import { handleGetAccountBalance } from './tools/get-account-balance'
import { handleGetFundBalance } from './tools/get-fund-balance'
import { handleSearchAuditLog } from './tools/search-audit-log'

type ToolHandler = (input: Record<string, unknown>) => Promise<unknown>

const toolHandlers: Record<string, ToolHandler> = {
  taxLawSearch: handleTaxLawSearch as ToolHandler,
  regulationLookup: handleRegulationLookup as ToolHandler,
  nonprofitExplorerLookup: handleNonprofitExplorerLookup as ToolHandler,
  govInfoSearch: handleGovInfoSearch as ToolHandler,
  searchTransactions: handleSearchTransactions as ToolHandler,
  searchAccounts: handleSearchAccounts as ToolHandler,
  getAccountBalance: handleGetAccountBalance as ToolHandler,
  getFundBalance: handleGetFundBalance as ToolHandler,
  searchAuditLog: handleSearchAuditLog as ToolHandler,
}

/**
 * Execute a tool by name with the given input.
 * Returns the tool result or an error object.
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const handler = toolHandlers[name]
  if (!handler) {
    return { error: `Unknown tool: ${name}` }
  }

  try {
    return await handler(input)
  } catch (error) {
    console.error(`Tool execution error (${name}):`, error)
    return {
      error: `Tool ${name} failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    }
  }
}

/** Get list of registered tool names */
export function getRegisteredTools(): string[] {
  return Object.keys(toolHandlers)
}
