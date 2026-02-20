import type { CopilotContextPackage } from '../types'
import { getFundBalanceDefinition, searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getFundsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'funds',
    pageDescription:
      'User is managing funds (funding sources). Funds are the unified entity for both GL accounting buckets and funder relationships. Restricted funds include funder, amount, type (conditional/unconditional), contract terms, and compliance tracking. Help with fund restrictions, net asset classification, ASC 958 requirements, and funding source management.',
    data: data || {},
    tools: [getFundBalanceDefinition, searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting', 'exempt-org'],
  }
}
