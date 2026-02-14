import { getCashPositionData } from '@/lib/reports/cash-position'
import { CashPositionClient } from './cash-position-client'

export default async function CashPositionPage() {
  const data = await getCashPositionData()
  return <CashPositionClient data={data} />
}
