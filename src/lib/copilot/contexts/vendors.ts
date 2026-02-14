import type { CopilotContextPackage } from '../types'
import { searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getVendorsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'vendors',
    pageDescription:
      'User is managing vendors. Help with 1099 eligibility, W-9 requirements, vendor payment tracking, and IRS reporting thresholds.',
    data: data || {},
    tools: [searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['reporting'],
  }
}
