import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, searchTransactionsDefinition } from '../tool-definitions'

export function getRampContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'ramp',
    pageDescription:
      'User is categorizing Ramp card transactions. Help with account mapping, expense categorization, and GL posting rules for corporate card transactions.',
    data: data || {},
    tools: [searchAccountsDefinition, searchTransactionsDefinition],
    knowledge: ['fund-accounting'],
  }
}
