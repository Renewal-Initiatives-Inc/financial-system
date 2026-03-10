import { eq, and, gte, lte, isNull } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'
import { inferQuarterFromTaskName } from '../generators/generate-941-report'

function getQuarterDates(taskName: string, year: number): { start: string; end: string } {
  const quarter = inferQuarterFromTaskName(taskName)
  const ranges: Record<string, { start: string; end: string }> = {
    Q1: { start: `${year}-01-01`, end: `${year}-03-31` },
    Q2: { start: `${year}-04-01`, end: `${year}-06-30` },
    Q3: { start: `${year}-07-01`, end: `${year}-09-30` },
    Q4: { start: `${year}-10-01`, end: `${year}-12-31` },
  }
  return ranges[quarter]
}

export const tax941Config: WorkflowConfig = {
  workflowType: 'tax_941',
  displayName: 'Federal 941 Filing',
  cluster: 'A',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: '941-payroll-runs-exist',
          label: 'Payroll runs for all 3 months of quarter exist',
          check: async () => {
            // Default to current quarter of prior year — real quarter inferred from deadline at runtime
            const year = new Date().getFullYear() - 1
            const month = new Date().getMonth()
            const quarter = month < 3 ? 'Q4' : month < 6 ? 'Q1' : month < 9 ? 'Q2' : 'Q3'
            const range = getQuarterDates(quarter, year)
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
          id: '941-entries-gl-posted',
          label: 'All payroll entries for quarter have GL transactions posted',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const month = new Date().getMonth()
            const quarter = month < 3 ? 'Q4' : month < 6 ? 'Q1' : month < 9 ? 'Q2' : 'Q3'
            const range = getQuarterDates(quarter, year)
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
          id: '941-deposits-on-schedule',
          label: 'Payroll deposits made on schedule (semi-weekly/monthly)?',
          requiresExplanation: true,
        },
        {
          id: '941-prior-reconciled',
          label: 'Reconciled to prior quarter\'s Form 941 if applicable?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['payroll-summary', '941-summary'],
      aiPromptTemplate: 'tax_941',
      citations: [
        {
          label: 'IRC §3102, §3111, §3402',
          url: 'https://www.irs.gov/form941',
        },
        {
          label: 'IRS Publication 15 (Circular E)',
          url: 'https://www.irs.gov/pub15',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-941-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/941/',
    },
  },
}
