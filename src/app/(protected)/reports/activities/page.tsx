import { getActivitiesData } from '@/lib/reports/activities'
import { getFundsForFilter } from '@/app/(protected)/reports/actions'
import { getCurrentMonthRange } from '@/lib/reports/types'
import { ActivitiesClient } from './activities-client'

export default async function ActivitiesPage() {
  const { startDate, endDate } = getCurrentMonthRange()

  const [data, funds] = await Promise.all([
    getActivitiesData({ startDate, endDate }),
    getFundsForFilter(),
  ])

  return (
    <ActivitiesClient
      initialData={data}
      funds={funds}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
