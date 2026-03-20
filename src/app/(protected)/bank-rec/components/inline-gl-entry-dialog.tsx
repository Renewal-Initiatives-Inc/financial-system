'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GroupedAccountSelect, type AccountOption } from './grouped-account-select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { createInlineGlEntry } from '../actions'
import { toast } from 'sonner'
import type { BankTransactionRow } from '../actions'

const THRESHOLD = 500

interface InlineGlEntryDialogProps {
  open: boolean
  onClose: () => void
  bankTransaction: BankTransactionRow | null
  accountOptions: AccountOption[]
  fundOptions: { id: number; name: string }[]
  sessionId: number | null
}

export function InlineGlEntryDialog({
  open,
  onClose,
  bankTransaction,
  accountOptions,
  fundOptions,
  sessionId,
}: InlineGlEntryDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [date, setDate] = useState(bankTransaction?.date ?? '')
  const [memo, setMemo] = useState(bankTransaction?.merchantName ?? '')
  const [accountId, setAccountId] = useState('')
  const [fundId, setFundId] = useState('')
  const [showWarning, setShowWarning] = useState(false)

  // Sync form state when bankTransaction changes (dialog is always mounted)
  useEffect(() => {
    if (bankTransaction && open) {
      setDate(bankTransaction.date ?? '')
      setMemo(bankTransaction.merchantName ?? '')
      setAccountId('')
      setFundId('')
      setShowWarning(false)
    }
  }, [bankTransaction?.id, open])

  const amount = bankTransaction ? Math.abs(parseFloat(bankTransaction.amount)) : 0
  const isOverThreshold = amount > THRESHOLD

  const handleSubmit = () => {
    if (isOverThreshold && !showWarning) {
      setShowWarning(true)
      return
    }

    if (!bankTransaction || !accountId || !fundId) return

    startTransition(async () => {
      try {
        await createInlineGlEntry(
          {
            date,
            memo,
            accountId: parseInt(accountId, 10),
            fundId: parseInt(fundId, 10),
            amount: bankTransaction.amount,
            bankTransactionId: bankTransaction.id,
          },
          sessionId
        )
        toast.success('GL entry created and matched')
        handleClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create GL entry')
      }
    })
  }

  const handleClose = () => {
    setDate('')
    setMemo('')
    setAccountId('')
    setFundId('')
    setShowWarning(false)
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Create GL Entry
            <HelpTooltip term="bank-originated-entry" />
          </DialogTitle>
          <DialogDescription>
            Create a GL entry for this bank-originated transaction and
            auto-match it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {bankTransaction && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <p className="text-sm font-medium">
                {bankTransaction.merchantName ?? 'Unknown'}
              </p>
              <p className="text-sm">
                {bankTransaction.date} &middot;{' '}
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(amount)}
              </p>
            </div>
          )}

          <div className="grid gap-2">
            <Label htmlFor="gl-date">Date</Label>
            <Input
              id="gl-date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              data-testid="inline-gl-date"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="gl-memo">Memo</Label>
            <Input
              id="gl-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Description"
              data-testid="inline-gl-memo"
            />
          </div>

          <div className="grid gap-2">
            <Label>
              Account <span className="text-destructive">*</span>
            </Label>
            <GroupedAccountSelect
              accounts={accountOptions}
              value={accountId}
              onValueChange={setAccountId}
              placeholder="Select account"
              testId="inline-gl-account"
            />
          </div>

          <div className="grid gap-2">
            <Label>
              Fund <span className="text-destructive">*</span>
            </Label>
            <Select value={fundId} onValueChange={setFundId}>
              <SelectTrigger data-testid="inline-gl-fund">
                <SelectValue placeholder="Select fund" />
              </SelectTrigger>
              <SelectContent>
                {fundOptions.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {showWarning && (
            <div className="flex items-center gap-2 rounded-lg border border-yellow-300 bg-yellow-50 p-3 dark:border-yellow-700 dark:bg-yellow-950">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                This bank-originated entry exceeds ${THRESHOLD}. Please
                confirm.
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !accountId || !fundId}
            data-testid="inline-gl-submit"
          >
            {showWarning ? 'Confirm & Create' : 'Create GL Entry'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
