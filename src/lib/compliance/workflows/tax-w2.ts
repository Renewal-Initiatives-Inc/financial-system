import { eq, and, gte, lte, isNotNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const w2Config: WorkflowConfig = {
  workflowType: 'tax_w2',
  displayName: 'W-2 Filing',
  cluster: 'A',
  requiresWarningDialog: true,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'payroll-runs-complete',
          label: 'Payroll runs exist for all 12 months of calendar year',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const runs = await db
              .select({ id: payrollRuns.id, periodStart: payrollRuns.payPeriodStart })
              .from(payrollRuns)
              .where(
                and(
                  gte(payrollRuns.payPeriodStart, `${year}-01-01`),
                  lte(payrollRuns.payPeriodEnd, `${year}-12-31`),
                  eq(payrollRuns.status, 'POSTED')
                )
              )
            const months = new Set(runs.map((r) => r.periodStart.substring(0, 7)))
            return months.size >= 12
          },
        },
        {
          id: 'payroll-gl-posted',
          label: 'All payroll entries have GL transactions posted',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const [unposted] = await db
              .select({ id: payrollEntries.id })
              .from(payrollEntries)
              .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
              .where(
                and(
                  gte(payrollRuns.payPeriodStart, `${year}-01-01`),
                  lte(payrollRuns.payPeriodEnd, `${year}-12-31`),
                  isNotNull(payrollEntries.glTransactionId)
                )
              )
              .limit(1)
            return !unposted
          },
        },
      ],
      manualChecks: [
        {
          id: 'ssn-verified',
          label: 'All employee SSNs verified?',
          requiresExplanation: false,
        },
        {
          id: 'payroll-reconciled',
          label: 'Payroll reconciled to GL for full calendar year?',
          requiresExplanation: true,
        },
        {
          id: 'w9-on-file',
          label: 'W-9s on file for all employees?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: ['payroll-summary', 'w2-verification'],
      aiPromptTemplate: 'tax_w2',
      citations: [
        { label: 'IRC §6051; 26 CFR §31.6051-1', url: 'https://www.ssa.gov/employer/businessServices.htm' },
        { label: 'IRS Publication 15 (Circular E)', url: 'https://www.irs.gov/pub15' },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-w2-package',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/w2/',
    },
  },
}
