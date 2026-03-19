'use client'

import { CheckCircle2, Clock, AlertTriangle, Scale } from 'lucide-react'
import { SummaryCard } from '@/components/smart-dashboard/summary-card'
import type { DailyCloseSummary } from '../actions'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

interface SummaryCardsProps {
  summary: DailyCloseSummary | null
}

export function SummaryCards({ summary }: SummaryCardsProps) {
  if (!summary) {
    return null
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="bank-rec-summary-cards">
      <SummaryCard
        icon={CheckCircle2}
        label="Auto-Matched"
        count={summary.autoMatched}
        variant="success"
        testId="bank-rec-auto-matched-card"
      />
      <SummaryCard
        icon={Clock}
        label="Pending Review"
        count={summary.pendingReview}
        variant="warning"
        testId="bank-rec-pending-review-card"
      />
      <SummaryCard
        icon={AlertTriangle}
        label="Exceptions"
        count={summary.exceptions}
        variant="error"
        testId="bank-rec-exceptions-card"
      />
      <SummaryCard
        icon={Scale}
        label="Variance"
        count={formatCurrency(summary.variance)}
        variant={summary.isReconciled ? 'success' : 'error'}
        testId="bank-rec-variance-card"
      />
    </div>
  )
}
