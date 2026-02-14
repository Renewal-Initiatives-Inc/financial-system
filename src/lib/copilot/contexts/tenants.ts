import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getTenantsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'tenants',
    pageDescription:
      'User is managing tenants. Help with MA security deposit law (G.L. c. 186 § 15B), rental income recording, and tenant accounting.',
    data: data || {},
    tools: [searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['ma-compliance'],
  }
}
