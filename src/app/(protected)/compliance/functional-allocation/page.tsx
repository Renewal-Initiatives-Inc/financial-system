import { loadDefaults, getAllocationYearSummaries } from './actions'
import { getAllocationsForYear } from '@/lib/compliance/functional-allocation-logic'
import { AllocationsPageClient } from './allocations-page-client'

export default async function FunctionalAllocationPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; edit?: string }>
}) {
  const params = await searchParams
  const selectedYear = params.year ? parseInt(params.year) : null
  const isEditing = params.edit === '1'

  const yearSummaries = await getAllocationYearSummaries()

  // If a year is selected, load its data
  let defaults = null
  let existingCount = 0
  if (selectedYear) {
    defaults = await loadDefaults(selectedYear)
    const existing = await getAllocationsForYear(selectedYear)
    existingCount = existing.length
  }

  return (
    <div className="max-w-4xl mx-auto py-6">
      <AllocationsPageClient
        yearSummaries={yearSummaries}
        selectedYear={selectedYear}
        defaults={defaults}
        existingCount={existingCount}
        isEditing={isEditing}
      />
    </div>
  )
}
