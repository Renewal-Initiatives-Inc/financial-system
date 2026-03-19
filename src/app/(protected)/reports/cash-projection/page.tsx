import { getCashProjectionData } from '@/lib/reports/cash-projection'
import { getWeeklyCashProjectionData } from '@/lib/reports/weekly-cash-projection'
import { CashProjectionClient } from './cash-projection-client'

export default async function CashProjectionPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const params = await searchParams
  const view = params.view ?? 'monthly'
  const monthlyData = await getCashProjectionData()
  const weeklyData = view === 'weekly' ? await getWeeklyCashProjectionData() : null

  return (
    <CashProjectionClient
      initialData={monthlyData}
      initialWeeklyData={weeklyData}
      initialView={view as 'monthly' | 'weekly'}
    />
  )
}
