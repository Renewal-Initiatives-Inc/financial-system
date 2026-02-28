import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getMigrationReviewContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'migration-review',
    pageDescription:
      'User is reviewing QBO transactions for import into the financial system. They may ask about GL account classification, 990 implications, GAAP treatment, accrual vs cash basis questions, or fund assignment. The cutoff date is 12/31/2025. This is a cash-to-accrual conversion for Renewal Initiatives, a 501(c)(3). Help them decide the correct account, fund, and whether an accrual adjustment is needed.',
    data: data || {},
    tools: [searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['fund-accounting/restricted-funds', 'fund-accounting/net-asset-releases'],
  }
}
