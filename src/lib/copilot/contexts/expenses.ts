import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getExpensesContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'expenses',
    pageDescription:
      'User is recording expenses. Help with expense categorization, account selection, functional allocation (program/M&G/fundraising), and capitalization vs. expensing decisions.',
    data: data || {},
    tools: [searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['reporting', 'fund-accounting'],
  }
}
