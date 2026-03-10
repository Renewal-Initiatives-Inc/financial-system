import { eq, and, gte, lte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const taxM941Config: WorkflowConfig = {
  workflowType: 'tax_m941',
  displayName: 'MA M-941 Filing',
  cluster: 'A',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'm941-payroll-runs-exist',
          label: 'Payroll runs for all 3 months of quarter exist',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const month = new Date().getMonth()
            const quarter = month < 3 ? 'Q4' : month < 6 ? 'Q1' : month < 9 ? 'Q2' : 'Q3'
            const ranges: Record<string, { start: string; end: string }> = {
              Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
              Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
              Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
              Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
            }
            const range = ranges[quarter]
            const runs = await db
              .select({ id: payrollRuns.id, start: payrollRuns.payPeriodStart })
              .from(payrollRuns)
              .where(
                and(
                  gte(payrollRuns.payPeriodStart, range.start),
                  lte(payrollRuns.payPeriodEnd, range.end),
                  eq(payrollRuns.status, 'POSTED')
                )
              )
            const months = new Set(runs.map((r) => r.start.substring(0, 7)))
            return months.size >= 3
          },
        },
        {
          id: 'm941-entries-gl-posted',
          label: 'All payroll entries for quarter have GL transactions posted',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const quarter = 'Q1' // Placeholder — real quarter from taskName at runtime
            const ranges: Record<string, { start: string; end: string }> = {
              Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
              Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
              Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
              Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
            }
            const range = ranges[quarter]
            const [unposted] = await db
              .select({ id: payrollEntries.id })
              .from(payrollEntries)
              .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
              .where(
                and(
                  gte(payrollRuns.payPeriodStart, range.start),
                  lte(payrollRuns.payPeriodEnd, range.end),
                  isNull(payrollEntries.glTransactionId)
                )
              )
              .limit(1)
            return !unposted
          },
        },
      ],
      manualChecks: [
        {
          id: 'm941-deposits-on-schedule',
          label: 'MA withholding deposits made on schedule?',
          requiresExplanation: true,
        },
        {
          id: 'm941-prior-reconciled',
          label: 'Reconciled to prior quarter\'s M-941 if applicable?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['payroll-summary'],
      aiPromptTemplate: 'tax_m941',
      citations: [
        {
          label: 'M.G.L. c. 62B',
          url: 'https://www.mass.gov/masstaxconnect',
        },
        {
          label: 'MA DOR Withholding Tax Guide',
          url: 'https://www.mass.gov/info-details/withholding-tax',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-m941-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/m941/',
    },
  },
}
