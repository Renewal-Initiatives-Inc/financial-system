import { fetchRegulation } from '../ecfr-client'
import type { CopilotToolDefinition } from '../types'

export const regulationLookupDefinition: CopilotToolDefinition = {
  name: 'regulationLookup',
  description:
    'Fetch a specific Treasury Regulation section from the eCFR (Electronic Code of Federal Regulations). Use for looking up specific regulatory text.',
  input_schema: {
    type: 'object',
    properties: {
      citation: {
        type: 'string',
        description: 'CFR citation (e.g., "26 CFR 1.501(c)(3)-1(d)(1)(ii)")',
      },
    },
    required: ['citation'],
  },
}

export async function handleRegulationLookup(
  input: { citation: string }
): Promise<{ citation: string; text: string; effectiveDate: string } | { error: string }> {
  const result = await fetchRegulation(input.citation)
  if (!result) {
    return { error: `Could not find regulation: ${input.citation}` }
  }
  return result
}
