import type { WorkflowConfig } from '../workflow-types'

export const annualReviewOfficerCompConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'Officer Compensation Review',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'comp-data-pulled',
          label: 'Current officer compensation figures pulled from payroll?',
          requiresExplanation: false,
        },
        {
          id: 'comparability-data-checked',
          label: 'Comparability data reviewed (see Open990.org for similar organizations)?',
          requiresExplanation: true,
        },
        {
          id: 'board-approved',
          label: 'Compensation approved by disinterested board members?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['payroll-summary', 'officer-comp'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: 'IRC §4958; Reg §53.4958-6',
          url: 'https://www.irs.gov/charities-non-profits/charitable-organizations/intermediate-sanctions-irc-4958',
        },
        {
          label: 'ProPublica Nonprofit Explorer — Comparability Data',
          url: 'https://projects.propublica.org/nonprofits/',
        },
      ],
    },
    draft: {
      artifactType: 'docx',
      generatorFn: 'generate-officer-comp-resolution',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/officer-comp/',
    },
  },
}
