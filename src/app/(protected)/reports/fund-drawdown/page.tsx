import { getFundDrawdownData } from '@/lib/reports/fund-drawdown'
import { FundDrawdownClient } from './fund-drawdown-client'

export default async function FundDrawdownPage() {
  const data = await getFundDrawdownData()
  return <FundDrawdownClient data={data} />
}
