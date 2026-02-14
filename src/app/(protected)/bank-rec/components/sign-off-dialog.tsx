'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { signOffReconciliation } from '../actions'
import { toast } from 'sonner'
import type { ReconciliationBalance } from '@/lib/bank-rec/reconciliation'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

interface SignOffDialogProps {
  open: boolean
  onClose: () => void
  sessionId: number | null
  balance: ReconciliationBalance | null
  statementDate: string
}

export function SignOffDialog({
  open,
  onClose,
  sessionId,
  balance,
  statementDate,
}: SignOffDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const handleSignOff = () => {
    if (!sessionId) return

    startTransition(async () => {
      try {
        await signOffReconciliation(sessionId, 'system')
        toast.success('Reconciliation signed off')
        onClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Sign-off failed')
      }
    })
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Sign Off Reconciliation</DialogTitle>
          <DialogDescription>
            Confirm that bank reconciliation for {statementDate} is complete.
          </DialogDescription>
        </DialogHeader>

        {balance && (
          <div className="space-y-3 py-4">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-muted-foreground">GL Balance:</span>
              <span className="font-mono font-medium">
                {formatCurrency(balance.glBalance)}
              </span>
              <span className="text-muted-foreground">
                Adjusted Bank Balance:
              </span>
              <span className="font-mono font-medium">
                {formatCurrency(balance.adjustedBankBalance)}
              </span>
              <span className="text-muted-foreground">Variance:</span>
              <span
                className={`font-mono font-medium ${
                  balance.isReconciled
                    ? 'text-green-600'
                    : 'text-red-600'
                }`}
              >
                {formatCurrency(balance.variance)}
              </span>
            </div>

            {!balance.isReconciled && (
              <div className="rounded-lg border border-yellow-300 bg-yellow-50 p-3 text-sm text-yellow-800 dark:border-yellow-700 dark:bg-yellow-950 dark:text-yellow-200">
                Warning: There is an unresolved variance of{' '}
                {formatCurrency(balance.variance)}. You may still sign off,
                but the variance will be recorded.
              </div>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSignOff}
            disabled={isPending}
            data-testid="sign-off-submit"
          >
            Sign Off
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
