import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { transactions, transactionLines } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const budgetDraftConfig: WorkflowConfig = {
  workflowType: 'budget_cycle',
  displayName: 'Budget Draft',
  cluster: 'C',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'actuals-six-months',
          label: 'Current year actuals available through at least 6 months',
          check: async () => {
            const year = new Date().getFullYear()
            const sixMonthsAgo = new Date()
            sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
            const cutoff = sixMonthsAgo.toISOString().substring(0, 10)
            const [row] = await db
              .select({ id: transactions.id })
              .from(transactions)
              .where(
                and(
                  gte(transactions.date, `${year}-01-01`),
                  lte(transactions.date, cutoff),
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
          id: 'prior-year-final',
          label: 'Prior year actuals finalized and reconciled?',
          requiresExplanation: false,
        },
        {
          id: 'program-changes-documented',
          label: 'Any planned program changes or new grants documented for next year?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['budget-vs-actual', 'trial-balance'],
      aiPromptTemplate: 'budget_cycle',
      citations: [
        {
          label: 'Internal Budget Policy',
          url: undefined,
        },
      ],
    },
    draft: {
      artifactType: 'csv',
      generatorFn: 'generate-budget-draft',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/budget-draft/',
    },
  },
}
