import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, reconciliationSessions } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const form990Config: WorkflowConfig = {
  workflowType: 'tax_form_990',
  displayName: 'Form 990 Filing',
  cluster: 'A',
  requiresWarningDialog: true,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'trial-balance-exists',
          label: 'Trial balance for fiscal year exists in DB',
          check: async () => {
            const currentYear = new Date().getFullYear()
            const fyStart = `${currentYear - 1}-01-01`
            const fyEnd = `${currentYear - 1}-12-31`
            const [row] = await db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                and(
                  gte(transactions.date, fyStart),
                  lte(transactions.date, fyEnd),
                  eq(transactions.isVoided, false)
                )
              )
              .limit(1)
            return !!row
          },
        },
        {
          id: 'accounts-reconciled',
          label: 'All accounts reconciled for fiscal year',
          check: async () => {
            const [unreconciled] = await db
              .select({ id: reconciliationSessions.id })
              .from(reconciliationSessions)
              .where(eq(reconciliationSessions.status, 'in_progress'))
              .limit(1)
            return !unreconciled
          },
        },
      ],
      manualChecks: [
        {
          id: 'officer-comp-reviewed',
          label: 'All officer compensation amounts reviewed and confirmed?',
          requiresExplanation: true,
        },
        {
          id: 'part-vii-prepared',
          label: 'Part VII compensation table prepared and verified?',
          requiresExplanation: false,
        },
        {
          id: 'schedule-o-drafted',
          label: 'Schedule O narratives drafted for any required explanations?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['trial-balance', 'payroll-summary', 'functional-expenses'],
      aiPromptTemplate: 'tax_form_990',
      citations: [
        { label: 'IRC §6033; Reg §1.6033-2', url: 'https://www.irs.gov/form990' },
        { label: 'IRS Form 990 Instructions', url: 'https://www.irs.gov/instructions/i990' },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-990-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/990/',
      notifyRoles: ['admin'],
    },
  },
}
