import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, getFundBalanceDefinition, getAccountBalanceDefinition } from '../tool-definitions'

export function getBudgetsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'budgets',
    pageDescription:
      'User is managing budgets and cash projections. Help with budget creation, variance analysis, and cash flow forecasting.',
    data: data || {},
    tools: [searchAccountsDefinition, getFundBalanceDefinition, getAccountBalanceDefinition],
    knowledge: ['fund-accounting'],
  }
}
