'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, CalendarIcon, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import { Calendar } from '@/components/ui/calendar'
import { AccountSelector } from '@/components/shared/account-selector'
import { FundSelector } from '@/components/shared/fund-selector'
import { CipCostCodeSelector } from '@/components/shared/cip-cost-code-selector'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { cn } from '@/lib/utils'
import { createManualTransaction } from '../actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'
import type { FundRow, CipCostCodeRow } from '../actions'

interface JournalEntryFormProps {
  accounts: AccountRow[]
  funds: FundRow[]
  cipCostCodes: CipCostCodeRow[]
  defaultFundId: number | null
  // For edit mode: pre-fill with existing data
  initialData?: {
    date: string
    memo: string
    lines: JournalEntryLine[]
  }
  editMode?: boolean
  transactionId?: number
}

interface JournalEntryLine {
  key: string
  accountId: number | null
  fundId: number | null
  debit: string
  credit: string
  cipCostCodeId: number | null
  memo: string
}

function createEmptyLine(defaultFundId: number | null): JournalEntryLine {
  return {
    key: crypto.randomUUID(),
    accountId: null,
    fundId: defaultFundId,
    debit: '',
    credit: '',
    cipCostCodeId: null,
    memo: '',
  }
}

function todayISO(): string {
  return new Date().toISOString().split('T')[0]
}

export function JournalEntryForm({
  accounts,
  funds,
  cipCostCodes,
  defaultFundId,
  initialData,
  editMode = false,
}: JournalEntryFormProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const [date, setDate] = useState(initialData?.date ?? todayISO())
  const [memo, setMemo] = useState(initialData?.memo ?? '')
  const [lines, setLines] = useState<JournalEntryLine[]>(
    initialData?.lines ?? [
      createEmptyLine(defaultFundId),
      createEmptyLine(defaultFundId),
    ]
  )

  // Check if an account is a CIP sub-account
  const isCipAccount = useCallback(
    (accountId: number | null): boolean => {
      if (!accountId) return false
      const account = accounts.find((a) => a.id === accountId)
      if (!account || !account.parentAccountId) return false
      const parent = accounts.find((a) => a.id === account.parentAccountId)
      return parent?.subType === 'CIP' || parent?.code?.startsWith('16') || false
    },
    [accounts]
  )

  // Line mutation helpers
  const updateLine = (key: string, updates: Partial<JournalEntryLine>) => {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, ...updates } : l))
    )
  }

  const addLine = () => {
    setLines((prev) => [...prev, createEmptyLine(defaultFundId)])
  }

  const removeLine = (key: string) => {
    if (lines.length <= 2) return
    setLines((prev) => prev.filter((l) => l.key !== key))
  }

  // Handle debit/credit mutual exclusivity
  const handleDebitChange = (key: string, value: string) => {
    // Only allow numeric input
    const cleaned = value.replace(/[^0-9.]/g, '')
    updateLine(key, { debit: cleaned, credit: '' })
  }

  const handleCreditChange = (key: string, value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, '')
    updateLine(key, { credit: cleaned, debit: '' })
  }

  // Balance calculation
  const totalDebits = lines.reduce(
    (sum, l) => sum + (parseFloat(l.debit) || 0),
    0
  )
  const totalCredits = lines.reduce(
    (sum, l) => sum + (parseFloat(l.credit) || 0),
    0
  )
  const isBalanced = Math.abs(totalDebits - totalCredits) < 0.001
  const hasAmounts = totalDebits > 0 || totalCredits > 0

  // Validation
  const linesWithAmounts = lines.filter(
    (l) => parseFloat(l.debit) > 0 || parseFloat(l.credit) > 0
  )
  const allLinesHaveAccount = linesWithAmounts.every((l) => l.accountId !== null)
  const allLinesHaveFund = linesWithAmounts.every((l) => l.fundId !== null)
  const canSubmit =
    date &&
    memo.trim() &&
    isBalanced &&
    hasAmounts &&
    linesWithAmounts.length >= 2 &&
    allLinesHaveAccount &&
    allLinesHaveFund &&
    !pending

  const handleSubmit = async () => {
    if (!canSubmit) return

    setPending(true)
    try {
      const txnLines = linesWithAmounts.map((l) => ({
        accountId: l.accountId!,
        fundId: l.fundId!,
        debit: l.debit ? parseFloat(l.debit) : null,
        credit: l.credit ? parseFloat(l.credit) : null,
        cipCostCodeId: l.cipCostCodeId,
        memo: l.memo || null,
      }))

      const result = await createManualTransaction({ date, memo, lines: txnLines })

      const msg = result.releaseTransactionId
        ? `Journal entry #${result.transactionId} created. Net asset release #${result.releaseTransactionId} auto-generated.`
        : `Journal entry #${result.transactionId} created.`

      toast.success(msg)
      router.push(`/transactions/${result.transactionId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create transaction'
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  // Parse date for calendar
  const selectedDate = date ? new Date(date + 'T12:00:00') : undefined

  return (
    <Card>
      <CardContent className="pt-6 space-y-6">
        {/* Header fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="txn-date">Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !date && 'text-muted-foreground'
                  )}
                  data-testid="txn-date-picker"
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date
                    ? format(new Date(date + 'T12:00:00'), 'MMM dd, yyyy')
                    : 'Pick a date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(d) => {
                    if (d) setDate(format(d, 'yyyy-MM-dd'))
                  }}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          <div className="space-y-2">
            <Label htmlFor="txn-memo">
              Memo <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="txn-memo"
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="Describe this journal entry..."
              className="resize-none"
              rows={2}
              data-testid="txn-memo"
            />
          </div>
        </div>

        {/* Lines */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Lines</Label>
            <HelpTooltip term="journal-entry" />
          </div>

          {/* Column headers */}
          <div className="hidden md:grid md:grid-cols-[40px_1fr_1fr_120px_120px_40px] gap-2 px-2 text-xs font-medium text-muted-foreground">
            <span>#</span>
            <span className="flex items-center gap-1">
              Account <HelpTooltip term="account-type" />
            </span>
            <span className="flex items-center gap-1">
              Funding Source <HelpTooltip term="fund" />
            </span>
            <span className="flex items-center gap-1">
              Debit <HelpTooltip term="debit" />
            </span>
            <span className="flex items-center gap-1">
              Credit <HelpTooltip term="credit" />
            </span>
            <span />
          </div>

          {lines.map((line, index) => (
            <div
              key={line.key}
              className="space-y-2 rounded-md border p-3 md:p-2"
              data-testid={`txn-line-${index}`}
            >
              <div className="grid grid-cols-1 md:grid-cols-[40px_1fr_1fr_120px_120px_40px] gap-2 items-start">
                <span className="hidden md:flex items-center h-9 text-sm text-muted-foreground">
                  {index + 1}
                </span>

                <AccountSelector
                  accounts={accounts}
                  value={line.accountId}
                  onSelect={(id) => {
                    updateLine(line.key, { accountId: id, cipCostCodeId: null })
                  }}
                  testId={`txn-line-${index}-account`}
                />

                <div className="space-y-1">
                  <FundSelector
                    funds={funds}
                    value={line.fundId}
                    onSelect={(id) => updateLine(line.key, { fundId: id })}
                    testId={`txn-line-${index}-fund`}
                  />
                  {!line.fundId &&
                    (parseFloat(line.debit) > 0 ||
                      parseFloat(line.credit) > 0) && (
                      <p className="text-xs text-amber-600 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        No fund — defaults to General Fund
                      </p>
                    )}
                </div>

                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={line.debit}
                  onChange={(e) => handleDebitChange(line.key, e.target.value)}
                  className="text-right font-mono"
                  data-testid={`txn-line-${index}-debit`}
                />

                <Input
                  type="text"
                  inputMode="decimal"
                  placeholder="0.00"
                  value={line.credit}
                  onChange={(e) => handleCreditChange(line.key, e.target.value)}
                  className="text-right font-mono"
                  data-testid={`txn-line-${index}-credit`}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => removeLine(line.key)}
                  disabled={lines.length <= 2}
                  className="h-9 w-9"
                  data-testid={`txn-line-${index}-remove`}
                >
                  <Trash2 className="h-4 w-4 text-muted-foreground" />
                </Button>
              </div>

              {/* CIP Cost Code — conditional */}
              {isCipAccount(line.accountId) && (
                <div className="md:ml-[40px] md:max-w-[300px]">
                  <Label className="text-xs text-muted-foreground flex items-center gap-1">
                    CIP Cost Code <HelpTooltip term="cip" />
                  </Label>
                  <CipCostCodeSelector
                    costCodes={cipCostCodes}
                    value={line.cipCostCodeId}
                    onSelect={(id) =>
                      updateLine(line.key, { cipCostCodeId: id })
                    }
                    testId={`txn-line-${index}-cip`}
                  />
                </div>
              )}

              {/* Optional line memo */}
              <div className="md:ml-[40px]">
                <Input
                  placeholder="Line memo (optional)"
                  value={line.memo}
                  onChange={(e) =>
                    updateLine(line.key, { memo: e.target.value })
                  }
                  className="text-sm"
                  data-testid={`txn-line-${index}-memo`}
                />
              </div>
            </div>
          ))}

          <Button
            variant="outline"
            size="sm"
            onClick={addLine}
            data-testid="txn-add-line"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Line
          </Button>
        </div>

        {/* Balance indicator */}
        {hasAmounts && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-md p-3 text-sm font-medium',
              isBalanced
                ? 'bg-green-50 text-green-800 border border-green-200'
                : 'bg-red-50 text-red-800 border border-red-200'
            )}
            data-testid="txn-balance-indicator"
          >
            {isBalanced ? (
              <>
                Debits ${totalDebits.toFixed(2)} = Credits $
                {totalCredits.toFixed(2)} ✓
              </>
            ) : (
              <>
                Debits ${totalDebits.toFixed(2)} ≠ Credits $
                {totalCredits.toFixed(2)} (off by $
                {Math.abs(totalDebits - totalCredits).toFixed(2)})
              </>
            )}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-between pt-2">
          <Button
            variant="outline"
            onClick={() => router.back()}
            disabled={pending}
            data-testid="txn-cancel"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            data-testid="txn-submit"
          >
            {pending
              ? 'Submitting...'
              : editMode
                ? 'Save Changes'
                : 'Submit Entry'}
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export type { JournalEntryLine }
