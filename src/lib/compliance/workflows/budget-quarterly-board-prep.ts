import type { WorkflowConfig } from '../workflow-types'

export const budgetQuarterlyBoardPrepConfig: WorkflowConfig = {
  workflowType: 'budget_cycle',
  displayName: 'Quarterly Board Prep',
  cluster: 'C',
  requiresWarningDialog: false,
  simplified: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'financials-through-quarter',
          label: 'Financial statements prepared through end of quarter?',
          requiresExplanation: false,
        },
        {
          id: 'variances-flagged',
          label: 'Significant budget variances (>10%) identified and explained?',
          requiresExplanation: true,
        },
        {
          id: 'cash-position-current',
          label: 'Cash position and projections current?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: ['budget-vs-actual', 'cash-projection'],
      aiPromptTemplate: 'budget_cycle',
      citations: [
        {
          label: 'Internal Board Reporting Policy',
          url: undefined,
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-quarterly-board-pack',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/quarterly-board-prep/',
    },
  },
}
