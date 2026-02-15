import { getDonorGivingHistoryData } from '@/lib/reports/donor-giving-history'
import { getFundsForFilter } from '../actions'
import { DonorGivingHistoryClient } from './donor-giving-history-client'
import { getYTDRange } from '@/lib/reports/types'

export default async function DonorGivingHistoryPage() {
  const { startDate, endDate } = getYTDRange()
  const [data, funds] = await Promise.all([
    getDonorGivingHistoryData({ startDate, endDate }),
    getFundsForFilter(),
  ])
  return (
    <DonorGivingHistoryClient
      initialData={data}
      funds={funds}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
