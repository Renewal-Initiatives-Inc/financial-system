import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, searchAccountsDefinition, getFundBalanceDefinition, getAccountBalanceDefinition } from '../tool-definitions'

export function getDashboardContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'dashboard',
    pageDescription:
      "User is on the dashboard overview. Help navigate to relevant reports and answer questions about the organization's financial position.",
    data: data || {},
    tools: [
      searchTransactionsDefinition,
      searchAccountsDefinition,
      getFundBalanceDefinition,
      getAccountBalanceDefinition,
    ],
    knowledge: ['fund-accounting'],
  }
}
