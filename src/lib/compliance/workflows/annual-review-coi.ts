import type { WorkflowConfig } from '../workflow-types'

export const annualReviewCOIConfig: WorkflowConfig = {
  workflowType: 'annual_attestation',
  displayName: 'Conflict of Interest Attestation',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'coi-disclosures-collected',
          label: 'I confirm that all board members and officers have disclosed any potential conflicts of interest.',
          requiresExplanation: false,
        },
        {
          id: 'coi-policy-reviewed',
          label: 'COI policy reviewed and confirmed current?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: ['coi-log'],
      aiPromptTemplate: 'annual_attestation',
      citations: [
        {
          label: 'IRS Form 990 Part VI Line 12',
          url: 'https://www.irs.gov/pub/irs-pdf/f990.pdf',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-coi-attestation',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/coi-attestation/',
    },
  },
}
