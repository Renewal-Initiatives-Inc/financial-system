import type { WorkflowConfig } from '../workflow-types'

export const annualReviewPublicSupportConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'Public Support Trajectory Review',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'five-year-data-available',
          label: 'Five-year contribution and revenue data available for public support calculation?',
          requiresExplanation: true,
        },
        {
          id: 'large-donors-identified',
          label: 'Unusual grants and large donor contributions identified and categorized?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['public-support-test', 'donor-summary'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: 'IRC §509(a)(1); Reg §1.509(a)-3',
          url: 'https://www.irs.gov/charities-non-profits/public-charities/public-support-test',
        },
        {
          label: 'IRS Form 990 Schedule A Instructions',
          url: 'https://www.irs.gov/instructions/i990sa',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-public-support-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/public-support/',
    },
  },
}
