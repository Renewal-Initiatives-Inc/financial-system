import {
  searchNonprofits,
  getOrganization,
  getFinancials,
  RI_BENCHMARKS,
  type OrgSummary,
  type OrgDetail,
  type OrgFinancial,
  type FunctionalBenchmark,
} from '../propublica-client'
import type { CopilotToolDefinition } from '../types'

export const nonprofitExplorerDefinition: CopilotToolDefinition = {
  name: 'nonprofitExplorerLookup',
  description:
    'Query ProPublica Nonprofit Explorer to find comparable organizations or look up specific EINs. Can also return validated functional allocation benchmarks for RI comparable orgs.',
  input_schema: {
    type: 'object',
    properties: {
      ein: {
        type: 'string',
        description: 'Specific EIN to look up (e.g., "04-3538884")',
      },
      query: {
        type: 'string',
        description: 'Search query to find organizations (single keywords work best)',
      },
      includeBenchmarks: {
        type: 'boolean',
        description: 'Include validated functional allocation benchmarks for RI comparable orgs',
      },
    },
  },
}

interface NonprofitExplorerResult {
  organization?: OrgDetail | null
  financials?: OrgFinancial[] | null
  searchResults?: OrgSummary[]
  benchmarks?: FunctionalBenchmark[]
}

export async function handleNonprofitExplorerLookup(
  input: { ein?: string; query?: string; includeBenchmarks?: boolean }
): Promise<NonprofitExplorerResult> {
  const result: NonprofitExplorerResult = {}

  if (input.ein) {
    result.organization = await getOrganization(input.ein)
    result.financials = await getFinancials(input.ein)
  }

  if (input.query) {
    result.searchResults = await searchNonprofits(input.query)
  }

  if (input.includeBenchmarks) {
    result.benchmarks = RI_BENCHMARKS
  }

  return result
}
