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
  const [monthlyData, weeklyData] = await Promise.all([
    getCashProjectionData(),
    getWeeklyCashProjectionData(),
  ])

  return (
    <CashProjectionClient
      initialData={monthlyData}
      initialWeeklyData={weeklyData}
      initialView={view as 'monthly' | 'weekly'}
    />
  )
}
