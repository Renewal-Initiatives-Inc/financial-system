import { notFound } from 'next/navigation'
import { getBudgetAction } from '../../actions'
import { getAccounts } from '@/app/(protected)/accounts/actions'
import { getFunds } from '@/app/(protected)/funds/actions'
import { BudgetEditClient } from './budget-edit-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BudgetEditPage({ params }: Props) {
  const { id } = await params
  const budgetId = parseInt(id)
  if (isNaN(budgetId)) notFound()

  const [budget, accounts, funds] = await Promise.all([
    getBudgetAction(budgetId),
    getAccounts(),
    getFunds(),
  ])

  if (!budget) notFound()

  return (
    <BudgetEditClient
      budget={budget}
      accounts={accounts}
      funds={funds}
    />
  )
}
