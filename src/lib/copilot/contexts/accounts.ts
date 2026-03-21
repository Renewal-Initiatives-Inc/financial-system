import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, getAccountBalanceDefinition, searchTransactionsDefinition, searchBankTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getAccountsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'accounts',
    pageDescription:
      'User is viewing the Chart of Accounts. Help with account types, GAAP classifications, Form 990 line mapping, and account hierarchy.',
    data: data || {},
    tools: [searchAccountsDefinition, getAccountBalanceDefinition, searchTransactionsDefinition, searchBankTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting', 'reporting'],
  }
}
