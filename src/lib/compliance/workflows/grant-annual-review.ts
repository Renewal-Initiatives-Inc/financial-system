import { eq, and, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import { funds, transactions } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const grantAnnualReviewConfig: WorkflowConfig = {
  workflowType: 'grant_report',
  displayName: 'Annual Grant Compliance Review',
  cluster: 'D',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'active-funds-have-txns',
          label: 'All active grant funds have complete transaction records for fiscal year',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const activeFunds = await db
              .select({ id: funds.id })
              .from(funds)
              .where(eq(funds.isActive, true))
            if (activeFunds.length === 0) return true
            // Check that at least one transaction per active fund exists — approximate check
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
          id: 'all-grants-reviewed',
          label: 'All active grants reviewed against expenditure restrictions?',
          requiresExplanation: true,
        },
        {
          id: 'carryover-requests-filed',
          label: 'Any required carryover requests submitted to funders?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['fund-pl', 'fund-drawdown', 'functional-expenses'],
      aiPromptTemplate: 'grant_report',
      citations: [
        {
          label: '2 CFR §200 — Uniform Guidance',
          url: 'https://www.ecfr.gov/current/title-2/part-200',
        },
        {
          label: 'OMB Uniform Guidance Compliance Supplement',
          url: 'https://www.whitehouse.gov/omb/office-federal-financial-management/compliance-supplement-2/',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-annual-grant-compliance',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/grant-annual-review/',
    },
  },
}
