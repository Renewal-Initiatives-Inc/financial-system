import { getLoanFundingSources } from '@/lib/reports/amortization-schedule'
import { AmortizationScheduleClient } from './amortization-schedule-client'

export default async function AmortizationSchedulePage() {
  const loans = await getLoanFundingSources()
  return <AmortizationScheduleClient loans={loans} />
}
