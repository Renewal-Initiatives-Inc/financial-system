import { getCashFlows } from '@/lib/reports/cash-flows'
import { getFundsForFilter } from '@/app/(protected)/reports/actions'
import { getYTDRange } from '@/lib/reports/types'
import { CashFlowsClient } from './cash-flows-client'

export default async function CashFlowsPage() {
  const { startDate, endDate } = getYTDRange()
  const [data, fundRows] = await Promise.all([
    getCashFlows({ startDate, endDate }),
    getFundsForFilter(),
  ])

  return <CashFlowsClient initialData={data} funds={fundRows} />
}
