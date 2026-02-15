import { determine990FormType } from '@/lib/compliance/filing-progression'
import { ReadinessClient } from './readiness-client'
import { db } from '@/lib/db'
import { eq, and } from 'drizzle-orm'
import { accounts, functionalAllocations } from '@/lib/db/schema'

export default async function NineNinetyReadinessPage() {
  const currentYear = new Date().getFullYear()
  const determination = await determine990FormType(currentYear)

  // Checklist items
  const expenseAccounts = await db
    .select({ id: accounts.id, form990Line: accounts.form990Line })
    .from(accounts)
    .where(and(eq(accounts.type, 'EXPENSE'), eq(accounts.isActive, true)))

  const unmappedCount = expenseAccounts.filter((a) => !a.form990Line).length

  const allocationRows = await db
    .select()
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, currentYear))

  const allocatedAccountIds = new Set(allocationRows.map((r) => r.accountId))
  const unallocatedCount = expenseAccounts.filter(
    (a) => !allocatedAccountIds.has(a.id)
  ).length

  const checklist = [
    {
      label: 'Form 990 line mapped on all expense accounts',
      status: unmappedCount === 0 ? 'complete' : 'incomplete',
      detail: unmappedCount > 0 ? `${unmappedCount} accounts missing mapping` : 'All mapped',
    },
    {
      label: `Functional allocation completed for FY${currentYear}`,
      status: unallocatedCount === 0 ? 'complete' : 'incomplete',
      detail:
        unallocatedCount > 0
          ? `${unallocatedCount} accounts need allocation`
          : 'All allocated',
    },
    {
      label: 'Officer compensation data populated',
      status: 'not-applicable' as const,
      detail: 'Will be applicable when officer compensation tracking is added',
    },
    {
      label: 'Contribution source type tags on all donations',
      status: 'not-applicable' as const,
      detail: 'Tracked via donor records',
    },
  ]

  return (
    <div className="max-w-4xl mx-auto py-6">
      <ReadinessClient
        determination={determination}
        checklist={checklist}
        fiscalYear={currentYear}
      />
    </div>
  )
}
