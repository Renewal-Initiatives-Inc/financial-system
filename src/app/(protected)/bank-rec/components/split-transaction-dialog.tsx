'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2 } from 'lucide-react'
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
import { splitAndMatch } from '../actions'
import { toast } from 'sonner'
import type { BankTransactionRow } from '../actions'
import type { MatchCandidate } from '@/lib/bank-rec/matcher'

interface SplitLine {
  glTransactionLineId: number | null
  amount: string
  label: string
}

interface SplitTransactionDialogProps {
  open: boolean
  onClose: () => void
  bankTransaction: BankTransactionRow | null
  candidates: MatchCandidate[]
  sessionId: number | null
}

export function SplitTransactionDialog({
  open,
  onClose,
  bankTransaction,
  candidates,
  sessionId,
}: SplitTransactionDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [splits, setSplits] = useState<SplitLine[]>([
    { glTransactionLineId: null, amount: '', label: '' },
    { glTransactionLineId: null, amount: '', label: '' },
  ])

  const bankAmount = bankTransaction
    ? Math.abs(parseFloat(bankTransaction.amount))
    : 0

  const splitSum = splits.reduce(
    (sum, s) => sum + (parseFloat(s.amount) || 0),
    0
  )

  const remaining = Math.round((bankAmount - splitSum) * 100) / 100

  const addSplit = () => {
    setSplits([...splits, { glTransactionLineId: null, amount: '', label: '' }])
  }

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return
    setSplits(splits.filter((_, i) => i !== index))
  }

  const updateSplit = (index: number, field: keyof SplitLine, value: string | number) => {
    const newSplits = [...splits]
    if (field === 'glTransactionLineId') {
      const candidate = candidates.find(
        (c) => c.glTransactionLineId === Number(value)
      )
      newSplits[index] = {
        ...newSplits[index],
        glTransactionLineId: Number(value),
        label: candidate?.memo ?? '',
      }
    } else {
      newSplits[index] = { ...newSplits[index], [field]: value }
    }
    setSplits(newSplits)
  }

  const handleSubmit = () => {
    if (!bankTransaction) return

    const validSplits = splits
      .filter((s) => s.glTransactionLineId && s.amount)
      .map((s) => ({
        glTransactionLineId: s.glTransactionLineId!,
        amount: parseFloat(s.amount),
      }))

    if (validSplits.length < 2) {
      toast.error('At least 2 splits are required')
      return
    }

    startTransition(async () => {
      try {
        await splitAndMatch(
          bankTransaction.id,
          validSplits,
          sessionId,
          'system'
        )
        toast.success('Split match created')
        handleClose()
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Split failed')
      }
    })
  }

  const handleClose = () => {
    setSplits([
      { glTransactionLineId: null, amount: '', label: '' },
      { glTransactionLineId: null, amount: '', label: '' },
    ])
    onClose()
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[560px]">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription>
            Split bank transaction (
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(bankAmount)}
            ) into multiple GL matches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {splits.map((split, index) => (
            <div key={index} className="flex items-center gap-2">
              <div className="flex-1">
                <Label className="text-xs">GL Entry</Label>
                <select
                  className="w-full rounded-md border px-3 py-2 text-sm"
                  value={split.glTransactionLineId ?? ''}
                  onChange={(e) =>
                    updateSplit(index, 'glTransactionLineId', e.target.value)
                  }
                  data-testid={`split-gl-select-${index}`}
                >
                  <option value="">Select GL entry...</option>
                  {candidates.map((c) => (
                    <option key={c.glTransactionLineId} value={c.glTransactionLineId}>
                      {c.date} — {c.memo} (${c.amount.toFixed(2)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-[120px]">
                <Label className="text-xs">Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={split.amount}
                  onChange={(e) =>
                    updateSplit(index, 'amount', e.target.value)
                  }
                  placeholder="0.00"
                  data-testid={`split-amount-${index}`}
                />
              </div>
              {splits.length > 2 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="mt-5"
                  onClick={() => removeSplit(index)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}

          <Button variant="outline" size="sm" onClick={addSplit}>
            <Plus className="mr-1 h-3 w-3" />
            Add Split
          </Button>

          <div
            className={`text-sm font-medium ${
              Math.abs(remaining) < 0.01
                ? 'text-green-600'
                : 'text-red-600'
            }`}
          >
            Remaining: ${remaining.toFixed(2)}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || Math.abs(remaining) >= 0.01}
            data-testid="split-match-submit"
          >
            Confirm Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
