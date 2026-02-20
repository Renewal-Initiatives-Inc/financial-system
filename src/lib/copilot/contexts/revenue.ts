import type { CopilotContextPackage } from '../types'
import { taxLawSearchDefinition, searchAccountsDefinition, getFundBalanceDefinition } from '../tool-definitions'

export function getRevenueContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'revenue',
    pageDescription:
      'User is recording revenue. Help with: (1) contribution_source_type classification — government (AHP, CPA, MassDev funding), public (individual/corporate donations), related_party (donations from officers/board/family). (2) Funding type assessment — conditional vs unconditional per ASC 958-605. (3) Fund assignment — restricted fund for donor-restricted contributions, General Fund for unrestricted. Funding sources (grants/contracts) are managed under Revenue → Funding Sources.',
    data: data || {},
    tools: [taxLawSearchDefinition, searchAccountsDefinition, getFundBalanceDefinition],
    knowledge: ['exempt-org', 'fund-accounting'],
  }
}
