'use client'

import { useState } from 'react'
import { Plus, Trash2, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { FundSelector } from '@/components/shared/fund-selector'
import { HelpTooltip } from '@/components/shared/help-tooltip'

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface FundSplit {
  key: string
  fundId: number | null
  percentage: string
}

interface SplitResult {
  fundId: number
  amount: number
}

interface FundSplitHelperProps {
  funds: FundRow[]
  onApply: (splits: SplitResult[]) => void
}

export function FundSplitHelper({ funds, onApply }: FundSplitHelperProps) {
  const [open, setOpen] = useState(false)
  const [totalAmount, setTotalAmount] = useState('')
  const [splits, setSplits] = useState<FundSplit[]>([
    { key: crypto.randomUUID(), fundId: null, percentage: '' },
    { key: crypto.randomUUID(), fundId: null, percentage: '' },
  ])

  const totalPercentage = splits.reduce(
    (sum, s) => sum + (parseFloat(s.percentage) || 0),
    0
  )
  const isValid =
    parseFloat(totalAmount) > 0 &&
    Math.abs(totalPercentage - 100) < 0.01 &&
    splits.every((s) => s.fundId !== null && parseFloat(s.percentage) > 0)

  const addSplit = () => {
    setSplits((prev) => [
      ...prev,
      { key: crypto.randomUUID(), fundId: null, percentage: '' },
    ])
  }

  const removeSplit = (key: string) => {
    if (splits.length <= 2) return
    setSplits((prev) => prev.filter((s) => s.key !== key))
  }

  const updateSplit = (key: string, updates: Partial<FundSplit>) => {
    setSplits((prev) =>
      prev.map((s) => (s.key === key ? { ...s, ...updates } : s))
    )
  }

  const handleApply = () => {
    if (!isValid) return

    const total = parseFloat(totalAmount)
    const results: SplitResult[] = []
    let remaining = total

    // Calculate amounts, last split absorbs rounding
    for (let i = 0; i < splits.length; i++) {
      const pct = parseFloat(splits[i].percentage) / 100
      if (i === splits.length - 1) {
        results.push({
          fundId: splits[i].fundId!,
          amount: Math.round(remaining * 100) / 100,
        })
      } else {
        const amount = Math.round(total * pct * 100) / 100
        remaining -= amount
        results.push({ fundId: splits[i].fundId!, amount })
      }
    }

    onApply(results)
    setOpen(false)
  }

  const reset = () => {
    setTotalAmount('')
    setSplits([
      { key: crypto.randomUUID(), fundId: null, percentage: '' },
      { key: crypto.randomUUID(), fundId: null, percentage: '' },
    ])
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" data-testid="fund-split-trigger">
          <Calculator className="mr-2 h-4 w-4" />
          Split by %
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Fund Split by Percentage
            <HelpTooltip term="percentage-split" />
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Total Amount</Label>
            <Input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={totalAmount}
              onChange={(e) =>
                setTotalAmount(e.target.value.replace(/[^0-9.]/g, ''))
              }
              className="font-mono"
              data-testid="fund-split-total"
            />
          </div>

          <div className="space-y-2">
            <Label>Fund Allocations</Label>
            {splits.map((split, index) => (
              <div
                key={split.key}
                className="flex items-center gap-2"
                data-testid={`fund-split-row-${index}`}
              >
                <div className="flex-1">
                  <FundSelector
                    funds={funds}
                    value={split.fundId}
                    onSelect={(id) => updateSplit(split.key, { fundId: id })}
                    testId={`fund-split-${index}-fund`}
                  />
                </div>
                <div className="w-24">
                  <Input
                    type="text"
                    inputMode="decimal"
                    placeholder="%"
                    value={split.percentage}
                    onChange={(e) =>
                      updateSplit(split.key, {
                        percentage: e.target.value.replace(/[^0-9.]/g, ''),
                      })
                    }
                    className="text-right font-mono"
                    data-testid={`fund-split-${index}-pct`}
                  />
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeSplit(split.key)}
                  disabled={splits.length <= 2}
                  className="h-9 w-9"
                  data-testid={`fund-split-${index}-remove-btn`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}

            <Button variant="outline" size="sm" onClick={addSplit} data-testid="fund-split-add-fund-btn">
              <Plus className="mr-2 h-4 w-4" />
              Add Fund
            </Button>
          </div>

          <div
            className={`text-sm font-medium ${
              Math.abs(totalPercentage - 100) < 0.01
                ? 'text-green-700'
                : 'text-red-700'
            }`}
          >
            Total: {totalPercentage.toFixed(1)}%
            {Math.abs(totalPercentage - 100) < 0.01 ? ' ✓' : ' (must be 100%)'}
          </div>

          {/* Preview */}
          {isValid && parseFloat(totalAmount) > 0 && (
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <p className="font-medium">Preview:</p>
              {splits.map((split) => {
                const fund = funds.find((f) => f.id === split.fundId)
                const amount =
                  (parseFloat(totalAmount) * parseFloat(split.percentage)) / 100
                return (
                  <p key={split.key}>
                    {fund?.name}: ${amount.toFixed(2)} ({split.percentage}%)
                  </p>
                )
              })}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setOpen(false)} data-testid="fund-split-cancel-btn">
              Cancel
            </Button>
            <Button
              onClick={handleApply}
              disabled={!isValid}
              data-testid="fund-split-apply"
            >
              Apply Split
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
