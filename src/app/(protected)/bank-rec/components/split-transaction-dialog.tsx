'use client'

import { useState, useEffect, useTransition } from 'react'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { GroupedAccountSelect, type AccountOption } from './grouped-account-select'
import { splitAndCreateGlEntries } from '../actions'
import { toast } from 'sonner'
import type { BankTransactionRow } from '../actions'

interface SplitLine {
  accountId: number | null
  fundId: number | null
  amount: string
  showFund: boolean
}

interface SplitTransactionDialogProps {
  open: boolean
  onClose: (matched?: boolean) => void
  bankTransaction: BankTransactionRow | null
  accountOptions: AccountOption[]
  fundOptions: { id: number; name: string }[]
  defaultFundId: number | null
  sessionId: number | null
}

export function SplitTransactionDialog({
  open,
  onClose,
  bankTransaction,
  accountOptions,
  fundOptions,
  defaultFundId,
  sessionId,
}: SplitTransactionDialogProps) {
  const [isPending, startTransition] = useTransition()
  const [splits, setSplits] = useState<SplitLine[]>([
    { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
    { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
  ])

  const bankAmount = bankTransaction
    ? Math.abs(parseFloat(bankTransaction.amount))
    : 0

  const isOutflow = bankTransaction ? parseFloat(bankTransaction.amount) > 0 : true

  const splitSum = splits.reduce(
    (sum, s) => sum + (parseFloat(s.amount) || 0),
    0
  )

  const remaining = Math.round((bankAmount - splitSum) * 100) / 100

  // Reset when transaction changes
  useEffect(() => {
    if (bankTransaction && open) {
      setSplits([
        { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
        { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
      ])
    }
  }, [bankTransaction?.id, open, defaultFundId])

  const addSplit = () => {
    setSplits([...splits, { accountId: null, fundId: defaultFundId, amount: '', showFund: false }])
  }

  const removeSplit = (index: number) => {
    if (splits.length <= 2) return
    setSplits(splits.filter((_, i) => i !== index))
  }

  const updateSplit = (index: number, field: keyof SplitLine, value: string | number | null) => {
    const newSplits = [...splits]
    newSplits[index] = { ...newSplits[index], [field]: value }
    setSplits(newSplits)
  }

  const allSplitsValid = splits.every((s) => s.accountId && s.fundId && parseFloat(s.amount) > 0)

  const handleSubmit = () => {
    if (!bankTransaction) return

    const validSplits = splits
      .filter((s) => s.accountId && s.fundId && s.amount)
      .map((s) => ({
        accountId: s.accountId!,
        fundId: s.fundId!,
        amount: parseFloat(s.amount),
      }))

    if (validSplits.length < 2) {
      toast.error('At least 2 splits are required')
      return
    }

    startTransition(async () => {
      try {
        await splitAndCreateGlEntries(
          {
            bankTransactionId: bankTransaction.id,
            date: bankTransaction.date,
            memo: bankTransaction.merchantName ?? 'Split bank transaction',
            splits: validSplits,
          },
          sessionId
        )
        toast.success('Split match created')
        handleClose(true)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Split failed')
      }
    })
  }

  const handleClose = (matched?: boolean) => {
    setSplits([
      { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
      { accountId: null, fundId: defaultFundId, amount: '', showFund: false },
    ])
    onClose(matched)
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Split Transaction</DialogTitle>
          <DialogDescription>
            Split{' '}
            {new Intl.NumberFormat('en-US', {
              style: 'currency',
              currency: 'USD',
            }).format(bankAmount)}{' '}
            {bankTransaction?.merchantName ? `(${bankTransaction.merchantName}) ` : ''}
            across multiple accounts.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          {splits.map((split, index) => (
            <div key={index} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium text-muted-foreground">
                  Split {index + 1}
                </Label>
                {splits.length > 2 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6"
                    onClick={() => removeSplit(index)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                )}
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Label className="text-xs">
                    {isOutflow ? 'Where did this portion go?' : 'Where did this portion come from?'}
                  </Label>
                  <GroupedAccountSelect
                    accounts={accountOptions}
                    value={split.accountId ? String(split.accountId) : ''}
                    onValueChange={(v) => updateSplit(index, 'accountId', parseInt(v, 10))}
                    placeholder="Select account..."
                    testId={`split-account-${index}`}
                  />
                </div>
                <div className="w-[120px]">
                  <Label className="text-xs">Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={split.amount}
                    onChange={(e) => updateSplit(index, 'amount', e.target.value)}
                    placeholder="0.00"
                    data-testid={`split-amount-${index}`}
                  />
                </div>
              </div>
              {/* Fund — collapsed by default */}
              {split.showFund ? (
                <div className="grid gap-1">
                  <Label className="text-xs">Funding Source</Label>
                  <Select
                    value={split.fundId ? String(split.fundId) : ''}
                    onValueChange={(v) => updateSplit(index, 'fundId', parseInt(v, 10))}
                  >
                    <SelectTrigger data-testid={`split-fund-${index}`}>
                      <SelectValue placeholder="Select fund..." />
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
              ) : (
                <button
                  type="button"
                  className="text-xs text-muted-foreground hover:text-foreground text-left"
                  onClick={() => {
                    const newSplits = [...splits]
                    newSplits[index] = { ...newSplits[index], showFund: true }
                    setSplits(newSplits)
                  }}
                >
                  Fund: {fundOptions.find((f) => f.id === split.fundId)?.name ?? 'General Fund'} — change
                </button>
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
          <Button variant="outline" onClick={() => handleClose()}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || Math.abs(remaining) >= 0.01 || !allSplitsValid}
            data-testid="split-match-submit"
          >
            Confirm Split
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
