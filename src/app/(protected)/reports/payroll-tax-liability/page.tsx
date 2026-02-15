import { getPayrollTaxLiabilityData } from '@/lib/reports/payroll-tax-liability'
import { getQuarterRange } from '@/lib/reports/types'
import { PayrollTaxLiabilityClient } from './payroll-tax-liability-client'

export default async function PayrollTaxLiabilityPage() {
  const now = new Date()
  const currentQuarter = Math.ceil((now.getMonth() + 1) / 3)
  const { startDate, endDate } = getQuarterRange(now.getFullYear(), currentQuarter)

  const data = await getPayrollTaxLiabilityData({ startDate, endDate })

  return (
    <PayrollTaxLiabilityClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
