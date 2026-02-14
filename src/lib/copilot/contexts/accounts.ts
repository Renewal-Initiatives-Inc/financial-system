import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, getAccountBalanceDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getAccountsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'accounts',
    pageDescription:
      'User is viewing the Chart of Accounts. Help with account types, GAAP classifications, Form 990 line mapping, and account hierarchy.',
    data: data || {},
    tools: [searchAccountsDefinition, getAccountBalanceDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting', 'reporting'],
  }
}
