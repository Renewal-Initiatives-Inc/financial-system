import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, getAccountBalanceDefinition } from '../tool-definitions'

export function getBankRecContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'bank-rec',
    pageDescription:
      'User is performing bank reconciliation. Help with matching transactions, identifying outstanding items, and resolving reconciliation differences.',
    data: data || {},
    tools: [searchTransactionsDefinition, getAccountBalanceDefinition],
    knowledge: ['fund-accounting'],
  }
}
