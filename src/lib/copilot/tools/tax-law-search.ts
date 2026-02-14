import { searchKnowledge } from '../knowledge'
import type { CopilotToolDefinition } from '../types'

export const taxLawSearchDefinition: CopilotToolDefinition = {
  name: 'taxLawSearch',
  description:
    'Search the tax law knowledge corpus for information about IRC sections, ASC standards, IRS publications, and MA compliance rules. Returns relevant excerpts with source citations.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "501(c)(3) operational test", "MACRS depreciation rates")',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional topic filters: exempt-org, fund-accounting, depreciation, payroll-tax, ma-compliance, reporting, construction',
      },
    },
    required: ['query'],
  },
}

export async function handleTaxLawSearch(
  input: { query: string; topics?: string[] }
): Promise<{ results: Array<{ source: string; excerpt: string }> }> {
  const results = searchKnowledge(input.query, input.topics)
  return { results }
}
