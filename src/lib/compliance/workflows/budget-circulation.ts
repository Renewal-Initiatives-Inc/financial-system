import type { WorkflowConfig } from '../workflow-types'

export const budgetCirculationConfig: WorkflowConfig = {
  workflowType: 'budget_cycle',
  displayName: 'Budget Board Circulation',
  cluster: 'C',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'ed-approved-budget',
          label: 'ED has reviewed and approved budget draft?',
          requiresExplanation: false,
        },
        {
          id: 'finance-committee-reviewed',
          label: 'Finance committee review completed (if applicable)?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['budget-draft'],
      aiPromptTemplate: 'budget_cycle',
      citations: [
        {
          label: 'Internal Budget Policy',
          url: undefined,
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-budget-board-pack',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/budget-circulation/',
    },
  },
}
