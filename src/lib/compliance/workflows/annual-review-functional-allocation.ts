import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { functionalAllocations } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const annualReviewFunctionalAllocationConfig: WorkflowConfig = {
  workflowType: 'annual_review',
  displayName: 'Year-End Functional Allocation Review',
  cluster: 'B',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'allocations-configured',
          label: 'Functional allocations configured for current fiscal year',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const [row] = await db
              .select({ id: functionalAllocations.id })
              .from(functionalAllocations)
              .where(eq(functionalAllocations.fiscalYear, year))
              .limit(1)
            return !!row
          },
        },
      ],
      manualChecks: [
        {
          id: 'time-study-available',
          label: 'Time study or activity-based allocation methodology documented?',
          requiresExplanation: true,
        },
        {
          id: 'allocations-reviewed',
          label: 'Allocation percentages reviewed and approved by management?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: ['functional-expenses', 'functional-allocations'],
      aiPromptTemplate: 'annual_review',
      citations: [
        {
          label: 'ASC 958-720-45; FASB ASU 2016-14',
          url: 'https://fasb.org/page/PageContent?pageId=/standards/fasb-accounting-standards-codification.html',
        },
        {
          label: 'IRS Form 990 Part IX Instructions',
          url: 'https://www.irs.gov/instructions/i990',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-functional-allocation-summary',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/functional-allocation/',
    },
  },
}
