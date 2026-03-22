import type { WorkflowConfig } from './workflow-types'
import { form990Config } from './workflows/tax-form-990'
import { formPCConfig } from './workflows/tax-form-pc'
import { w2Config } from './workflows/tax-w2'
import { tax1099NECConfig } from './workflows/tax-1099-nec'
import { tax941Config } from './workflows/tax-941'
import { taxM941Config } from './workflows/tax-m941'
import { annualReviewOfficerCompConfig } from './workflows/annual-review-officer-comp'
import { annualReviewCOIConfig } from './workflows/annual-review-coi'
import { annualAttestationMASosConfig } from './workflows/annual-attestation-ma-sos'
import { annualReviewInKindConfig } from './workflows/annual-review-in-kind'
import { annualReviewUBITConfig } from './workflows/annual-review-ubit'
import { annualReviewPublicSupportConfig } from './workflows/annual-review-public-support'
import { annualReviewFunctionalAllocationConfig } from './workflows/annual-review-functional-allocation'
import { annualReviewTaxRatesConfig } from './workflows/annual-review-tax-rates'
import { budgetDraftConfig } from './workflows/budget-draft'
import { budgetCirculationConfig } from './workflows/budget-circulation'
import { budgetApprovalConfig } from './workflows/budget-approval'
import { budgetQuarterlyBoardPrepConfig } from './workflows/budget-quarterly-board-prep'
import { grantReportConfig } from './workflows/grant-report'
import { grantCloseoutConfig } from './workflows/grant-closeout'
import { grantMilestoneConfig } from './workflows/grant-milestone'
import { grantAnnualReviewConfig } from './workflows/grant-annual-review'
import { tenantDepositConfig } from './workflows/tenant-deposit'

// Maps each workflowType enum value to its full WorkflowConfig
const registry: Record<string, WorkflowConfig> = {
  tax_form_990: form990Config,
  tax_form_pc: formPCConfig,
  tax_w2: w2Config,
  tax_1099_nec: tax1099NECConfig,
  tax_941: tax941Config,
  tax_m941: taxM941Config,

  // Cluster B — multiple configs share the same workflowType enum value
  // The registry maps the primary entry; display name disambiguates at runtime
  annual_review: annualReviewOfficerCompConfig,        // Default for annual_review
  annual_attestation: annualReviewCOIConfig,           // Default for annual_attestation

  budget_cycle: budgetQuarterlyBoardPrepConfig,        // Default for budget_cycle

  grant_report: grantReportConfig,
  grant_closeout: grantCloseoutConfig,
  grant_milestone: grantMilestoneConfig,

  tenant_deposit: tenantDepositConfig,
}

// Extended registry keyed by workflowType + optional displayName slug for disambiguation
const extendedRegistry: Record<string, WorkflowConfig> = {
  ...registry,

  // Named entries for configs that share a workflowType enum value
  'annual_review:officer-comp': annualReviewOfficerCompConfig,
  'annual_review:coi': annualReviewCOIConfig,
  'annual_attestation:ma-sos': annualAttestationMASosConfig,
  'annual_review:in-kind': annualReviewInKindConfig,
  'annual_review:ubit': annualReviewUBITConfig,
  'annual_review:public-support': annualReviewPublicSupportConfig,
  'annual_review:functional-allocation': annualReviewFunctionalAllocationConfig,
  'annual_review:tax-rates': annualReviewTaxRatesConfig,

  'budget_cycle:draft': budgetDraftConfig,
  'budget_cycle:circulation': budgetCirculationConfig,
  'budget_cycle:approval': budgetApprovalConfig,
  'budget_cycle:quarterly-board-prep': budgetQuarterlyBoardPrepConfig,

  'grant_report:annual-review': grantAnnualReviewConfig,
}

/**
 * Look up a WorkflowConfig by workflowType.
 * Optionally pass a disambiguator slug (e.g. 'officer-comp') for types with multiple configs.
 */
export function getWorkflowConfig(
  workflowType: string,
  slug?: string
): WorkflowConfig | null {
  if (slug) {
    const key = `${workflowType}:${slug}`
    return extendedRegistry[key] ?? registry[workflowType] ?? null
  }
  return registry[workflowType] ?? null
}

/** List all registered configs (useful for admin/debug). */
export function listAllConfigs(): WorkflowConfig[] {
  return Object.values(extendedRegistry)
}

/**
 * Derive a disambiguation slug from the task name so the correct config is
 * resolved even though the DB only stores the base workflowType enum value.
 */
const TASK_NAME_SLUG_MAP: { pattern: RegExp; slug: string }[] = [
  // annual_attestation variants
  { pattern: /secretary of state/i, slug: 'ma-sos' },
  // annual_review variants
  { pattern: /in.kind/i, slug: 'in-kind' },
  { pattern: /officer comp/i, slug: 'officer-comp' },
  { pattern: /tax rate/i, slug: 'tax-rates' },
  { pattern: /functional allocation/i, slug: 'functional-allocation' },
  { pattern: /public support/i, slug: 'public-support' },
  { pattern: /ubit/i, slug: 'ubit' },
  // budget_cycle variants
  { pattern: /budget draft/i, slug: 'draft' },
  { pattern: /board circulation/i, slug: 'circulation' },
  { pattern: /board approval/i, slug: 'approval' },
  { pattern: /quarterly board prep/i, slug: 'quarterly-board-prep' },
  // grant_report variants
  { pattern: /annual grant/i, slug: 'annual-review' },
]

export function getWorkflowSlug(taskName: string): string | undefined {
  for (const { pattern, slug } of TASK_NAME_SLUG_MAP) {
    if (pattern.test(taskName)) return slug
  }
  return undefined
}
