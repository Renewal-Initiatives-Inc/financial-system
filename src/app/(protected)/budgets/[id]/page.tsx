import { notFound } from 'next/navigation'
import { getBudgetAction, getBudgetVarianceAction, getCIPVarianceAction } from '../actions'
import { getFunds } from '@/app/(protected)/funds/actions'
import { BudgetReviewClient } from './budget-review-client'

interface Props {
  params: Promise<{ id: string }>
}

export default async function BudgetReviewPage({ params }: Props) {
  const { id } = await params
  const budgetId = parseInt(id)
  if (isNaN(budgetId)) notFound()

  const [budget, variance, cipVariance, funds] = await Promise.all([
    getBudgetAction(budgetId),
    getBudgetVarianceAction(budgetId),
    getCIPVarianceAction(budgetId),
    getFunds(),
  ])

  if (!budget) notFound()

  return (
    <BudgetReviewClient
      budget={budget}
      initialVariance={variance}
      initialCIPVariance={cipVariance}
      grantBudgetContext={null}
      funds={funds}
    />
  )
}
