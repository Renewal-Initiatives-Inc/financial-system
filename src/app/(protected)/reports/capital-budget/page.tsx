import { getCapitalBudgetData } from '@/lib/reports/capital-budget'
import { getFundsForFilter } from '../actions'
import { CapitalBudgetClient } from './capital-budget-client'

export default async function CapitalBudgetPage() {
  const year = new Date().getFullYear()
  const [data, funds] = await Promise.all([
    getCapitalBudgetData({ year }),
    getFundsForFilter(),
  ])
  return <CapitalBudgetClient initialData={data} funds={funds} defaultYear={year} />
}
