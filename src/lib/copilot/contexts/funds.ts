import type { CopilotContextPackage } from '../types'
import { getFundBalanceDefinition, searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getFundsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'funds',
    pageDescription:
      'User is managing funds. Help with fund restrictions, net asset classification, and ASC 958 requirements.',
    data: data || {},
    tools: [getFundBalanceDefinition, searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting', 'exempt-org'],
  }
}
