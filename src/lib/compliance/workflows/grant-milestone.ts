import type { WorkflowConfig } from '../workflow-types'

export const grantMilestoneConfig: WorkflowConfig = {
  workflowType: 'grant_milestone',
  displayName: 'Grant Milestone Report',
  cluster: 'D',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'milestone-completed',
          label: 'Milestone deliverable completed and documented?',
          requiresExplanation: false,
        },
        {
          id: 'supporting-docs-ready',
          label: 'Supporting documentation (photos, reports, participant data) assembled?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['fund-pl'],
      aiPromptTemplate: 'grant_milestone',
      citations: [
        {
          label: '2 CFR §200 — Uniform Guidance',
          url: 'https://www.ecfr.gov/current/title-2/part-200',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-grant-milestone-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/grant-milestone/',
    },
  },
}
