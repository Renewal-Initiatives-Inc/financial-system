import { getBudgetListAction } from './actions'
import { BudgetsClient } from './budgets-client'

export default async function BudgetsPage() {
  const budgets = await getBudgetListAction()
  return <BudgetsClient initialBudgets={budgets} />
}
