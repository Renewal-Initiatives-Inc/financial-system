'use client'

import { CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { ReconciliationBalance } from '@/lib/bank-rec/reconciliation'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

interface ReconciliationBalanceBarProps {
  balance: ReconciliationBalance | null
  onSignOff: () => void
  hasSession: boolean
}

export function ReconciliationBalanceBar({
  balance,
  onSignOff,
  hasSession,
}: ReconciliationBalanceBarProps) {
  if (!balance || !hasSession) return null

  return (
    <div
      className="sticky top-0 z-10 bg-background border rounded-lg p-3 flex items-center justify-between gap-4 flex-wrap shadow-sm"
      data-testid="bank-rec-balance-bar"
    >
      <div className="flex items-center gap-6 text-sm">
        <div>
          <span className="text-muted-foreground">GL Balance: </span>
          <span className="font-mono font-medium">
            {formatCurrency(balance.glBalance)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Bank Balance: </span>
          <span className="font-mono font-medium">
            {formatCurrency(balance.bankBalance)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Variance: </span>
          <span
            className={`font-mono font-medium ${
              balance.isReconciled
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {formatCurrency(balance.variance)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">Outstanding: </span>
          <span className="font-mono text-xs">
            {formatCurrency(balance.outstandingChecks)} checks, {formatCurrency(balance.outstandingDeposits)} deposits
          </span>
        </div>
      </div>
      <Button
        size="sm"
        disabled={!balance.isReconciled}
        onClick={onSignOff}
        data-testid="bank-rec-balance-bar-signoff-btn"
      >
        <CheckCircle2 className="mr-1 h-3 w-3" />
        Sign Off
      </Button>
    </div>
  )
}
