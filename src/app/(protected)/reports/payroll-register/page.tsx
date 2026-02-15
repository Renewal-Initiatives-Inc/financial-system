import { getPayrollRegisterData } from '@/lib/reports/payroll-register'
import { getCurrentMonthRange } from '@/lib/reports/types'
import { PayrollRegisterClient } from './payroll-register-client'

export default async function PayrollRegisterPage() {
  const { startDate, endDate } = getCurrentMonthRange()
  const data = await getPayrollRegisterData({ startDate, endDate })

  return (
    <PayrollRegisterClient
      initialData={data}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
