'use client'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import type { ReconciliationSummary, ReconciliationBalance } from '@/lib/bank-rec/reconciliation'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

interface ReconciliationSummaryPanelProps {
  summary: ReconciliationSummary | null
  balance: ReconciliationBalance | null
}

export function ReconciliationSummaryPanel({
  summary,
  balance,
}: ReconciliationSummaryPanelProps) {
  if (!summary || !balance) {
    return (
      <Card>
        <CardContent className="py-4 text-center text-sm text-muted-foreground">
          Start a reconciliation session to see the summary.
        </CardContent>
      </Card>
    )
  }

  return (
    <Card data-testid="reconciliation-summary">
      <CardContent className="py-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Statement Balance</p>
            <p className="text-lg font-semibold">
              {formatCurrency(balance.bankBalance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">GL Balance</p>
            <p className="text-lg font-semibold">
              {formatCurrency(balance.glBalance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Variance</p>
            <p
              className={`text-lg font-semibold ${
                balance.isReconciled
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }`}
            >
              {formatCurrency(balance.variance)}
            </p>
          </div>
          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge
              variant={summary.status === 'completed' ? 'default' : 'secondary'}
              className="mt-1"
              data-testid="reconciliation-status"
            >
              {summary.status === 'completed' ? 'Signed Off' : 'In Progress'}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 pt-4 border-t">
          <div>
            <p className="text-xs text-muted-foreground">Matched (Bank)</p>
            <p className="text-sm font-medium">{summary.matchedBankCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unmatched (Bank)</p>
            <p className="text-sm font-medium">{summary.unmatchedBankCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding (GL)</p>
            <p className="text-sm font-medium">{summary.outstandingCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding Checks</p>
            <p className="text-sm font-medium">
              {formatCurrency(balance.outstandingChecks)}
            </p>
          </div>
        </div>

        {summary.signedOffBy && (
          <div className="mt-4 pt-4 border-t text-sm text-muted-foreground">
            Signed off by {summary.signedOffBy} on{' '}
            {summary.signedOffAt
              ? new Date(summary.signedOffAt).toLocaleDateString()
              : ''}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
