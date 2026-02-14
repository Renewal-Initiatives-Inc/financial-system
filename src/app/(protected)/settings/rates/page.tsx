import { getAnnualRates } from '@/app/(protected)/payroll/actions'
import { RateConfigClient } from './rate-config-client'

export default async function RatesPage() {
  const rates = await getAnnualRates()

  return <RateConfigClient initialRates={rates} />
}
