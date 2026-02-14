import { getUtilityTrendsData } from '@/lib/reports/utility-trends'
import { getFundsForFilter } from '@/app/(protected)/reports/actions'
import { UtilityTrendsClient } from './utility-trends-client'

export default async function UtilityTrendsPage() {
  const [data, funds] = await Promise.all([
    getUtilityTrendsData(),
    getFundsForFilter(),
  ])

  return <UtilityTrendsClient initialData={data} funds={funds} />
}
