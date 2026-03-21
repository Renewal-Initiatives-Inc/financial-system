import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, searchBankTransactionsDefinition, searchAccountsDefinition, searchAuditLogDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getTransactionsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'transactions',
    pageDescription:
      'User is viewing or creating journal entries. Help with debit/credit rules, transaction corrections, and GL posting.',
    data: data || {},
    tools: [searchTransactionsDefinition, searchBankTransactionsDefinition, searchAccountsDefinition, searchAuditLogDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting'],
  }
}
