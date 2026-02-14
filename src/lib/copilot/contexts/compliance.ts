import type { CopilotContextPackage } from '../types'
import {
  nonprofitExplorerDefinition,
  taxLawSearchDefinition,
  govInfoSearchDefinition,
} from '../tool-definitions'

export function getComplianceContext(data?: Record<string, unknown>): CopilotContextPackage {
  return {
    pageId: 'compliance',
    pageDescription: `User is on the compliance page. Help with Form 990 preparation, functional allocation defaults (three-tier system: permanent rules > prior-year > sub-type defaults), comparable org benchmarking, and public support test monitoring. Reference validated comps: Falcon Housing (75.6% program), Pioneer Valley Habitat (78.0%), Valley CDC (85.2%). Flag outliers below 65% or above 90% program allocation. For public support questions: the 2% threshold applies to ALL donors (not just related_party), unusual grants are excludable per Reg. 1.509(a)-3(c)(4), and rental income enters Total Support (Line 10a) but not Public Support (Line 1) — RI's ratio will decline post-construction (~FY2028+).

You have access to the govInfoSearch tool which searches the official GovInfo database (Federal Register, US Code, CFR, Public Laws) via the U.S. Government Publishing Office API. Use it to check for regulatory changes when compliance calendar items prompt a review. Key use cases:
- October "annual tax rate review": use the annualRateReview template to find SS wage base announcements and Pub 15-T updates
- 990 filing prep: use the form990Changes template to check for form revisions since last filing
- Exempt org regulatory changes: use exemptOrgChanges or cfrCitationChanges templates to verify whether IRC/CFR sections the system depends on (501(c)(3), 509(a), 170) have been amended
- 1099 threshold changes: use informationReturnChanges template to check for reporting threshold legislation
- New tax laws: use taxLegislation template with collection PLAW to find enacted legislation

When reporting results, always cite the Federal Register document title, date, and provide the detailsUrl so the user can read the full text.`,
    data: data || {},
    tools: [nonprofitExplorerDefinition, taxLawSearchDefinition, govInfoSearchDefinition],
    knowledge: ['reporting', 'exempt-org'],
  }
}
