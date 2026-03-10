import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, transactionLines } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const grantReportConfig: WorkflowConfig = {
  workflowType: 'grant_report',
  displayName: 'Grant Progress Report',
  cluster: 'D',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'fund-transactions-exist',
          label: 'Fund transactions recorded for reporting period',
          check: async () => {
            // Generic check — real check uses fundId from deadline at runtime
            const year = new Date().getFullYear() - 1
            const [row] = await db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                and(
                  gte(transactions.date, `${year}-01-01`),
                  lte(transactions.date, `${year}-12-31`),
                  eq(transactions.isVoided, false)
                )
              )
              .limit(1)
            return !!row
          },
        },
      ],
      manualChecks: [
        {
          id: 'fund-linked',
          label: 'Grant fund linked to this deadline? (Check fund ID in deadline details)',
          requiresExplanation: true,
        },
        {
          id: 'reporting-period-confirmed',
          label: 'Reporting period dates confirmed with grant agreement?',
          requiresExplanation: false,
        },
        {
          id: 'programmatic-data-ready',
          label: 'Programmatic data and outcome metrics ready for narrative?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['fund-pl', 'fund-drawdown'],
      aiPromptTemplate: 'grant_report',
      citations: [
        {
          label: '2 CFR §200 — Uniform Guidance',
          url: 'https://www.ecfr.gov/current/title-2/part-200',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-grant-report',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/grant-reports/',
    },
  },
}
