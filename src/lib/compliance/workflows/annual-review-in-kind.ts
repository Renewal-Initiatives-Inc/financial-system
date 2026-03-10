import type { WorkflowConfig } from '../workflow-types'

export const annualReviewInKindConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'Annual In-Kind Review',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'donor-acknowledgements-issued',
          label: 'Written acknowledgements issued to donors for in-kind gifts ≥ $250?',
          requiresExplanation: true,
        },
        {
          id: 'fair-market-value-documented',
          label: 'Fair market value documented for all non-cash contributions?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['in-kind-summary'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: 'IRC §170(f)(8); ASC 958-605',
          url: 'https://www.irs.gov/charities-non-profits/charitable-organizations/substantiation-and-disclosure-requirements',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-in-kind-summary',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/in-kind-review/',
    },
  },
}
