import type { CopilotContextPackage } from '../types'
import { nonprofitExplorerDefinition, taxLawSearchDefinition } from '../tool-definitions'

export function getComplianceContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'compliance',
    pageDescription:
      "User is on the compliance page. Help with Form 990 preparation, functional allocation defaults (three-tier system: permanent rules > prior-year > sub-type defaults), comparable org benchmarking, and public support test monitoring. Reference validated comps: Falcon Housing (75.6% program), Pioneer Valley Habitat (78.0%), Valley CDC (85.2%). Flag outliers below 65% or above 90% program allocation. For public support questions: the 2% threshold applies to ALL donors (not just related_party), unusual grants are excludable per Reg. 1.509(a)-3(c)(4), and rental income enters Total Support (Line 10a) but not Public Support (Line 1) — RI's ratio will decline post-construction (~FY2028+).",
    data: data || {},
    tools: [nonprofitExplorerDefinition, taxLawSearchDefinition],
    knowledge: ['reporting', 'exempt-org'],
  }
}
