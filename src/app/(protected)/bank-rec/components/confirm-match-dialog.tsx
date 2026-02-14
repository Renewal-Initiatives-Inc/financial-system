'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { confirmMatch, createMatchingRuleAction } from '../actions'
import { toast } from 'sonner'
import type { MatchCandidate } from '@/lib/bank-rec/matcher'
import type { BankTransactionRow } from '../actions'

interface ConfirmMatchDialogProps {
  open: boolean
  onClose: () => void
  bankTransaction: BankTransactionRow | null
  candidate: MatchCandidate | null
  sessionId: number | null
}

export function ConfirmMatchDialog({
  open,
  onClose,
  bankTransaction,
  candidate,
  sessionId,
}: ConfirmMatchDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState<'confirm' | 'create-rule'>('confirm')
  const [merchantPattern, setMerchantPattern] = useState('')

  const handleConfirm = () => {
    if (!bankTransaction || !candidate) return

    startTransition(async () => {
      try {
        await confirmMatch(
          bankTransaction.id,
          candidate.glTransactionLineId,
          sessionId,
          'system'
        )
        toast.success('Match confirmed')

        // Ask about creating a rule if there's a merchant name
        if (bankTransaction.merchantName) {
          setMerchantPattern(bankTransaction.merchantName)
          setStep('create-rule')
        } else {
          handleClose()
          router.refresh()
        }
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Match failed')
      }
    })
  }

  const handleCreateRule = () => {
    if (!candidate) return

    startTransition(async () => {
      try {
        await createMatchingRuleAction(
          { merchantPattern },
          {
            glAccountId: candidate.transactionId, // Uses the transaction's account
            fundId: 1, // Default fund
          },
          'system'
        )
        toast.success('Matching rule created — future similar transactions will auto-match')
        handleClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create rule')
      }
    })
  }

  const handleClose = () => {
    setStep('confirm')
    setMerchantPattern('')
    onClose()
  }

  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(num))
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        {step === 'confirm' && (
          <>
            <DialogHeader>
              <DialogTitle>Confirm Match</DialogTitle>
              <DialogDescription>
                Match bank transaction to GL entry?
              </DialogDescription>
            </DialogHeader>

            {bankTransaction && candidate && (
              <div className="space-y-4 py-4">
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    Bank Transaction
                  </p>
                  <p className="font-medium">
                    {bankTransaction.merchantName ?? 'Unknown'}
                  </p>
                  <p className="text-sm">
                    {bankTransaction.date} &middot;{' '}
                    {formatCurrency(bankTransaction.amount)}
                  </p>
                </div>
                <div className="rounded-lg border p-3">
                  <p className="text-xs text-muted-foreground mb-1">
                    GL Entry
                  </p>
                  <p className="font-medium">{candidate.memo}</p>
                  <p className="text-sm">
                    {candidate.date} &middot;{' '}
                    {formatCurrency(candidate.amount)}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button
                onClick={handleConfirm}
                disabled={isPending}
                data-testid="confirm-match-submit"
              >
                Confirm Match
              </Button>
            </DialogFooter>
          </>
        )}

        {step === 'create-rule' && (
          <>
            <DialogHeader>
              <DialogTitle>Create Matching Rule?</DialogTitle>
              <DialogDescription>
                Auto-match similar transactions in the future.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="grid gap-2">
                <Label>Merchant Pattern</Label>
                <Input
                  value={merchantPattern}
                  onChange={(e) => setMerchantPattern(e.target.value)}
                  placeholder="e.g., EVERSOURCE"
                  data-testid="rule-merchant-pattern"
                />
                <p className="text-xs text-muted-foreground">
                  Future bank transactions with this merchant name will be
                  auto-matched.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  handleClose()
                  router.refresh()
                }}
                data-testid="skip-rule-btn"
              >
                Skip
              </Button>
              <Button
                onClick={handleCreateRule}
                disabled={isPending || !merchantPattern.trim()}
                data-testid="create-rule-submit"
              >
                Create Rule
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
