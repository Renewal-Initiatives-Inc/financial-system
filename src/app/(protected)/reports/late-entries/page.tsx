import { getLateEntriesData } from '@/lib/reports/late-entries'
import { LateEntriesClient } from './late-entries-client'

export default async function LateEntriesPage() {
  // Default: last month-end
  const now = new Date()
  const lastMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const periodEndDate = lastMonth.toISOString().split('T')[0]

  const data = await getLateEntriesData({ periodEndDate })
  return <LateEntriesClient initialData={data} defaultPeriodEndDate={periodEndDate} />
}
