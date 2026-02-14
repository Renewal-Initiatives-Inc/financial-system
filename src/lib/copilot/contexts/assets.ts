import type { CopilotContextPackage } from '../types'
import { searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getAssetsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'assets',
    pageDescription:
      'User is managing fixed assets, CIP, and depreciation. Help with MACRS useful lives, CIP-to-asset conversion at PIS date, component allocation, and depreciation calculations.',
    data: data || {},
    tools: [searchAccountsDefinition, searchTransactionsDefinition, taxLawSearchDefinition],
    knowledge: ['depreciation', 'construction'],
  }
}
