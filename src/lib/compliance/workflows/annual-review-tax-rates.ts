import type { WorkflowConfig } from '../workflow-types'

export const annualReviewTaxRatesConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'Annual Tax Rate Review (SS Wage Base)',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'ssa-announcement-reviewed',
          label: 'SSA wage base announcement for upcoming year reviewed?',
          requiresExplanation: false,
        },
        {
          id: 'rate-changes-identified',
          label: 'Any FICA rate changes (SS, Medicare) identified for upcoming year?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['annual-rate-config'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: '42 U.S.C. §430 — Cost-of-Living Adjustment',
          url: 'https://www.ssa.gov/oact/cola/cbb.html',
        },
        {
          label: 'IRS Publication 15 — Employer Tax Guide',
          url: 'https://www.irs.gov/pub15',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-tax-rate-review',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/tax-rate-review/',
    },
  },
}
