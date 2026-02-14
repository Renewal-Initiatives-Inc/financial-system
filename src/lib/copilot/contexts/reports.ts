import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, getFundBalanceDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getReportsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'reports',
    pageDescription:
      'User is viewing financial reports. Help with GAAP financial statement requirements, Form 990 reporting, and report interpretation.',
    data: data || {},
    tools: [searchAccountsDefinition, getFundBalanceDefinition, taxLawSearchDefinition],
    knowledge: ['reporting', 'fund-accounting'],
  }
}
