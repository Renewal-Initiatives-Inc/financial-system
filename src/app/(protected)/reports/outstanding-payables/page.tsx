import { getOutstandingPayablesData } from '@/lib/reports/outstanding-payables'
import { PayablesClient } from './payables-client'

export default async function OutstandingPayablesPage() {
  const data = await getOutstandingPayablesData()
  return <PayablesClient data={data} />
}
