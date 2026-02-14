import { getARAgingData } from '@/lib/reports/ar-aging'
import { ARAgingClient } from './ar-aging-client'

export default async function ARAgingPage() {
  const data = await getARAgingData()
  return <ARAgingClient data={data} />
}
