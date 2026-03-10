import type { WorkflowConfig } from '../workflow-types'

export const annualReviewUBITConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'UBIT Annual Review',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'ubit-activities-identified',
          label: 'All potentially unrelated business activities identified and listed?',
          requiresExplanation: true,
        },
        {
          id: 'ubit-revenue-reviewed',
          label: 'Revenue from any trade or business activities reviewed for UBIT exposure?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['revenue-by-source', 'trial-balance'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: 'IRC §511-515; Reg §1.512(a)-1',
          url: 'https://www.irs.gov/charities-non-profits/unrelated-business-income-tax',
        },
        {
          label: 'IRS Publication 598 — Tax on Unrelated Business Income',
          url: 'https://www.irs.gov/pub/irs-pdf/p598.pdf',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-ubit-memo',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/ubit-review/',
    },
  },
}
