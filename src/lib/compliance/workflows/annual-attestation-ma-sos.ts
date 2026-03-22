import type { WorkflowConfig } from '../workflow-types'

export const annualAttestationMASosConfig: WorkflowConfig = {
  workflowType: 'annual_attestation',
  displayName: 'MA Secretary of State Annual Report',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'ma-sos-registered-agent-confirmed',
          label: 'Registered agent name and address confirmed current?',
          requiresExplanation: false,
        },
        {
          id: 'ma-sos-officer-list-current',
          label: 'Officer and director list reviewed and updated if needed?',
          requiresExplanation: false,
        },
        {
          id: 'ma-sos-principal-address-confirmed',
          label: 'Principal office address confirmed current?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: [],
      aiPromptTemplate: 'annual_attestation',
      citations: [
        {
          label: 'M.G.L. c. 180 §26A — Annual Report Requirement',
          url: 'https://www.sec.state.ma.us/cor/corpweb/corannrpt/annrptidx.htm',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-ma-sos-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/ma-sos-annual-report/',
    },
  },
}
