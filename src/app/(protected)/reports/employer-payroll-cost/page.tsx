import { getEmployerPayrollCostData } from '@/lib/reports/employer-payroll-cost'
import { EmployerPayrollCostClient } from './employer-payroll-cost-client'

export default async function EmployerPayrollCostPage() {
  const currentYear = new Date().getFullYear()
  const data = await getEmployerPayrollCostData({ year: currentYear })

  return <EmployerPayrollCostClient initialData={data} />
}
