import { getFunctionalExpensesData } from '@/lib/reports/functional-expenses'
import { getFundsForFilter } from '../actions'
import { FunctionalExpensesClient } from './functional-expenses-client'

export default async function FunctionalExpensesPage() {
  const now = new Date()
  const year = now.getFullYear()
  const startDate = `${year}-01-01`
  const endDate = now.toISOString().split('T')[0]

  const [data, funds] = await Promise.all([
    getFunctionalExpensesData({ startDate, endDate, format: 'gaap' }),
    getFundsForFilter(),
  ])

  return <FunctionalExpensesClient initialData={data} funds={funds} />
}
