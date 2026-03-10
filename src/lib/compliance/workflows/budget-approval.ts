import type { WorkflowConfig } from '../workflow-types'

export const budgetApprovalConfig: WorkflowConfig = {
  workflowType: 'budget_cycle',
  displayName: 'Budget Board Approval',
  cluster: 'C',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'board-quorum',
          label: 'Board quorum present at meeting?',
          requiresExplanation: false,
        },
        {
          id: 'board-vote-recorded',
          label: 'Vote to approve budget recorded in board minutes?',
          requiresExplanation: false,
        },
        {
          id: 'irs-990-alignment',
          label: 'Board-approved budget aligns with IRS Form 990 Part VI disclosure?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['budget-summary'],
      aiPromptTemplate: 'budget_cycle',
      citations: [
        {
          label: "Robert's Rules of Order — Budget Approval Process",
          url: undefined,
        },
        {
          label: 'IRS Form 990 Part VI Governance',
          url: 'https://www.irs.gov/pub/irs-pdf/f990.pdf',
        },
      ],
    },
    draft: {
      artifactType: 'docx',
      generatorFn: 'generate-budget-resolution',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/budget-resolution/',
    },
  },
}
