import type { WorkflowConfig } from '../workflow-types'

export const grantCloseoutConfig: WorkflowConfig = {
  workflowType: 'grant_closeout',
  displayName: 'Grant Close-Out Report',
  cluster: 'D',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'fund-linked',
          label: 'Grant fund linked to this deadline?',
          requiresExplanation: true,
        },
        {
          id: 'all-expenses-posted',
          label: 'All allowable expenses posted to grant fund?',
          requiresExplanation: false,
        },
        {
          id: 'unspent-balance-reviewed',
          label: 'Unspent balance reviewed — return or carryover decision made?',
          requiresExplanation: true,
        },
        {
          id: 'final-invoice-submitted',
          label: 'Final invoice or drawdown request submitted to funder?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['fund-pl', 'fund-drawdown', 'budget-vs-actual'],
      aiPromptTemplate: 'grant_closeout',
      citations: [
        {
          label: '2 CFR §200.343 — Closeout',
          url: 'https://www.ecfr.gov/current/title-2/part-200/section-200.343',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-grant-closeout',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/grant-closeout/',
    },
  },
}
