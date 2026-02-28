import type { CopilotContextPackage } from '../types'
import { taxLawSearchDefinition, searchAccountsDefinition, getFundBalanceDefinition } from '../tool-definitions'

export function getRevenueContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'revenue',
    pageDescription:
      'User is recording revenue. Help with: (1) contribution_source_type classification — government (CPA, MassDev funding), public (individual/corporate donations), related_party (donations from officers/board/family). (2) Funding type assessment — conditional vs unconditional per ASC 958-605. (3) Fund assignment — restricted fund for donor-restricted contributions, General Fund for unrestricted. Funding sources (grants, contracts, loans) are managed under Revenue → Funding Sources. Each has a category (GRANT/CONTRACT/LOAN), restriction type (RESTRICTED/UNRESTRICTED), and for grants/contracts a revenue classification (GRANT_REVENUE → 4100, EARNED_INCOME → 4300). Unrestricted funding sources still post expenses to General Fund for GL purposes.',
    data: data || {},
    tools: [taxLawSearchDefinition, searchAccountsDefinition, getFundBalanceDefinition],
    knowledge: ['exempt-org', 'fund-accounting'],
  }
}
