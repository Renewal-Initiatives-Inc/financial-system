import { getCashProjectionData } from '@/lib/reports/cash-projection'
import { CashProjectionClient } from './cash-projection-client'

export default async function CashProjectionPage() {
  const data = await getCashProjectionData()
  return <CashProjectionClient initialData={data} />
}
