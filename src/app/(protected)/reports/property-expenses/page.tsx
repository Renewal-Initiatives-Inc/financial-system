import { getPropertyExpensesData } from '@/lib/reports/property-expenses'
import { getFundsForFilter } from '@/app/(protected)/reports/actions'
import { getCurrentMonthRange } from '@/lib/reports/types'
import { PropertyExpensesClient } from './property-expenses-client'

export default async function PropertyExpensesPage() {
  const { startDate, endDate } = getCurrentMonthRange()

  const [data, funds] = await Promise.all([
    getPropertyExpensesData({ startDate, endDate }),
    getFundsForFilter(),
  ])

  return (
    <PropertyExpensesClient
      initialData={data}
      funds={funds}
      defaultStartDate={startDate}
      defaultEndDate={endDate}
    />
  )
}
