import { getQuarterlyTaxPrepData } from '@/lib/reports/quarterly-tax-prep'
import { QuarterlyTaxPrepClient } from './quarterly-tax-prep-client'

export default async function QuarterlyTaxPrepPage() {
  const now = new Date()
  const currentYear = now.getFullYear()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)

  const data = await getQuarterlyTaxPrepData({
    year: currentYear,
    quarter: currentQuarter,
  })

  return <QuarterlyTaxPrepClient initialData={data} />
}
