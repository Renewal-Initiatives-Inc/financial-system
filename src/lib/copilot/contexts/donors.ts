import type { CopilotContextPackage } from '../types'
import { taxLawSearchDefinition, nonprofitExplorerDefinition } from '../tool-definitions'

export function getDonorsContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'donors',
    pageDescription:
      'User is managing donors. Help with: (1) Contribution source type tagging — guide users to choose government/public/related_party correctly, as this data feeds the deferred Schedule A Part II calculation (~FY2030). Government sources get full credit (Line 3); all other donors are subject to the universal 2% cap (Line 5). (2) Donor relationship awareness — contributions from related persons (family members, controlled entities per § 4946(a)(1)(C)-(G)) are aggregated as one person for the 2% cap. Note: RI files Part II (170(b)(1)(A)(vi)), which has NO disqualified person exclusion — that concept applies only to Part III (509(a)(2)) organizations. (3) Donor acknowledgment requirements per IRC § 170(f)(8) for gifts >= $250.',
    data: data || {},
    tools: [taxLawSearchDefinition, nonprofitExplorerDefinition],
    knowledge: ['exempt-org'],
  }
}
