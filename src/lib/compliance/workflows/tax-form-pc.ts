import type { WorkflowConfig } from '../workflow-types'

export const formPCConfig: WorkflowConfig = {
  workflowType: 'tax_form_pc',
  displayName: 'Form PC Filing (MA AG)',
  cluster: 'A',
  requiresWarningDialog: false,
  simplified: true,
  steps: {
    checklist: {
      autoChecks: [],
      manualChecks: [
        {
          id: 'form-990-delivered',
          label: 'Annual report filed with IRS (990 delivered)?',
          requiresExplanation: false,
        },
        {
          id: 'ma-registration-current',
          label: 'MA charitable registration current?',
          requiresExplanation: false,
        },
        {
          id: 'financials-calculated',
          label: 'Gross support and revenue amounts calculated?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: [],
      aiPromptTemplate: 'tax_form_pc',
      citations: [
        {
          label: 'M.G.L. c. 12 §8F',
          url: 'https://www.mass.gov/how-to/file-your-annual-report-form-pc',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-form-pc-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/form-pc/',
    },
  },
}
