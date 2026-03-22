'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import {
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Loader2,
  Lock,
  ChevronRight,
  ChevronLeft,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  runPreCloseChecklist,
  postYearEndClose,
  getClosingEntriesPreview,
} from './actions'
import type { ChecklistResult } from './actions'
import type {
  ClosingEntriesPreview,
  FundClosingEntry,
} from '@/lib/year-end-close/compute-closing-entries'

type WizardStep = 1 | 2 | 3 | 4

const currentYear = new Date().getFullYear()
const defaultFiscalYear = currentYear - 1

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount)
}

const STEP_LABELS = ['Checklist', 'Preview', 'Confirm', 'Done'] as const

export function CloseBooksStepper() {
  const router = useRouter()
  const [step, setStep] = useState<WizardStep>(1)
  const [fiscalYear, setFiscalYear] = useState(defaultFiscalYear)
  const [checklist, setChecklist] = useState<ChecklistResult | null>(null)
  const [checklistLoading, setChecklistLoading] = useState(false)
  const [preview, setPreview] = useState<ClosingEntriesPreview | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [posting, setPosting] = useState(false)
  const [postResult, setPostResult] = useState<{
    transactionIds: number[]
  } | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Run checklist on mount and when fiscal year changes
  const runChecklist = useCallback(async () => {
    setChecklistLoading(true)
    setError(null)
    try {
      const result = await runPreCloseChecklist(fiscalYear)
      setChecklist(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run checklist')
    } finally {
      setChecklistLoading(false)
    }
  }, [fiscalYear])

  useEffect(() => {
    if (step === 1) runChecklist()
  }, [step, runChecklist])

  // Load preview when entering step 2
  const loadPreview = useCallback(async () => {
    setPreviewLoading(true)
    setError(null)
    try {
      const result = await getClosingEntriesPreview(fiscalYear)
      setPreview(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to compute closing entries')
    } finally {
      setPreviewLoading(false)
    }
  }, [fiscalYear])

  const handleContinueToPreview = () => {
    setStep(2)
    loadPreview()
  }

  const handlePostClose = async () => {
    setPosting(true)
    setError(null)
    try {
      const result = await postYearEndClose(fiscalYear)
      if (result.success) {
        setPostResult({ transactionIds: result.transactionIds })
        setStep(4)
        toast.success(`Fiscal year ${fiscalYear} has been closed.`)
      } else {
        setError(result.error ?? 'Unknown error occurred during year-end close.')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to post closing entries')
    } finally {
      setPosting(false)
    }
  }

  const yearOptions = Array.from({ length: 3 }, (_, i) => currentYear - 1 - i)

  return (
    <div className="space-y-6" data-testid="close-books-wizard">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            <Lock className="h-6 w-6" />
            Close the Books
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Post closing entries and lock a fiscal year.
          </p>
        </div>
        {step < 4 && (
          <Button
            variant="outline"
            onClick={() => router.push('/accounts')}
          >
            Cancel
          </Button>
        )}
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {STEP_LABELS.map((label, i) => {
          const stepNum = (i + 1) as WizardStep
          const isActive = step === stepNum
          const isComplete = step > stepNum
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && (
                <div
                  className={`h-px w-8 ${
                    isComplete ? 'bg-primary' : 'bg-border'
                  }`}
                />
              )}
              <div className="flex items-center gap-1.5">
                <div
                  className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-medium ${
                    isActive
                      ? 'bg-primary text-primary-foreground'
                      : isComplete
                        ? 'bg-primary/20 text-primary'
                        : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4" />
                  ) : (
                    stepNum
                  )}
                </div>
                <span
                  className={`text-sm ${
                    isActive ? 'font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {label}
                </span>
              </div>
            </div>
          )
        })}
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/20 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* ── Step 1: Pre-Close Checklist ── */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Pre-Close Checklist</CardTitle>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium">Fiscal Year:</label>
                <Select
                  value={String(fiscalYear)}
                  onValueChange={(v) => setFiscalYear(parseInt(v, 10))}
                >
                  <SelectTrigger className="w-[120px]" data-testid="fiscal-year-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {yearOptions.map((y) => (
                      <SelectItem key={y} value={String(y)}>
                        {y}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {checklistLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Running pre-close checks...
                </span>
              </div>
            ) : checklist ? (
              <>
                <div className="space-y-2">
                  {checklist.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-start gap-3 rounded-lg border p-4"
                      data-testid={`checklist-${item.id}`}
                    >
                      {item.passed ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600 mt-0.5" />
                      ) : (
                        <XCircle className="h-5 w-5 shrink-0 text-destructive mt-0.5" />
                      )}
                      <div className="space-y-1">
                        <p className="text-sm font-medium">{item.label}</p>
                        {item.detail && (
                          <p className="text-sm text-muted-foreground">{item.detail}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end pt-4">
                  <Button
                    onClick={handleContinueToPreview}
                    disabled={!checklist.allPassed}
                    data-testid="checklist-continue-btn"
                  >
                    Continue
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>

                {!checklist.allPassed && (
                  <p className="text-xs text-muted-foreground text-right">
                    All items must pass before proceeding.
                  </p>
                )}
              </>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── Step 2: Trial Balance Preview ── */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Trial Balance Preview — FY {fiscalYear}</CardTitle>
          </CardHeader>
          <CardContent>
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">
                  Computing closing entries...
                </span>
              </div>
            ) : preview ? (
              <div className="space-y-4">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fund</TableHead>
                      <TableHead className="text-right">Revenue</TableHead>
                      <TableHead className="text-right">Expenses</TableHead>
                      <TableHead className="text-right">Net Change</TableHead>
                      <TableHead>RE Account</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.funds.map((fund) => {
                      const totalRevenue = fund.revenueLines.reduce(
                        (s, l) => s + l.amount,
                        0
                      )
                      const totalExpense = fund.expenseLines.reduce(
                        (s, l) => s + l.amount,
                        0
                      )
                      return (
                        <TableRow
                          key={fund.fundId}
                          data-testid={`preview-fund-${fund.fundId}`}
                        >
                          <TableCell>
                            {fund.fundName}
                            <Badge variant="outline" className="ml-2 text-xs">
                              {fund.restrictionType}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(totalRevenue)}
                          </TableCell>
                          <TableCell className="text-right tabular-nums">
                            {formatCurrency(totalExpense)}
                          </TableCell>
                          <TableCell
                            className={`text-right font-medium tabular-nums ${
                              fund.netToRetainedEarnings >= 0
                                ? 'text-green-700 dark:text-green-400'
                                : 'text-destructive'
                            }`}
                          >
                            {formatCurrency(fund.netToRetainedEarnings)}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {fund.retainedEarningsAccountCode}
                          </TableCell>
                        </TableRow>
                      )
                    })}
                  </TableBody>
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">Total</TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(
                          preview.funds.reduce(
                            (s, f) =>
                              s +
                              f.revenueLines.reduce((a, l) => a + l.amount, 0),
                            0
                          )
                        )}
                      </TableCell>
                      <TableCell className="text-right font-semibold tabular-nums">
                        {formatCurrency(
                          preview.funds.reduce(
                            (s, f) =>
                              s +
                              f.expenseLines.reduce((a, l) => a + l.amount, 0),
                            0
                          )
                        )}
                      </TableCell>
                      <TableCell
                        className={`text-right font-semibold tabular-nums ${
                          preview.totalNetChange >= 0
                            ? 'text-green-700 dark:text-green-400'
                            : 'text-destructive'
                        }`}
                      >
                        {formatCurrency(preview.totalNetChange)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                </Table>

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={() => setStep(3)}
                    data-testid="preview-continue-btn"
                  >
                    Review Closing Entries
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* ── Step 3: Closing Entries Confirm ── */}
      {step === 3 && preview && (
        <div className="space-y-4">
          {/* Warning banner */}
          <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-sm space-y-1">
                <p className="font-semibold text-amber-800 dark:text-amber-200">
                  This action will post closing entries and lock fiscal year{' '}
                  {fiscalYear}.
                </p>
                <p className="text-amber-700 dark:text-amber-300">
                  This cannot be automatically undone. To post audit adjustments
                  after closing, use Settings &gt; Fiscal Years to reopen the
                  period.
                </p>
              </div>
            </div>
          </div>

          {/* Per-fund closing entry detail */}
          {preview.funds.map((fund) => (
            <Card key={fund.fundId} data-testid={`closing-entry-${fund.fundId}`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{fund.fundName}</CardTitle>
                  <Badge variant="outline">{fund.restrictionType}</Badge>
                </div>
                <p className="text-xs text-muted-foreground">
                  Date: {fiscalYear}-12-31 &middot; Source: YEAR_END_CLOSE
                  &middot; Memo: Year-end closing entry — {fiscalYear} —{' '}
                  {fund.fundName}
                </p>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Account</TableHead>
                      <TableHead className="text-right">Debit</TableHead>
                      <TableHead className="text-right">Credit</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {/* Revenue accounts — DR to zero */}
                    {fund.revenueLines.map((line) => (
                      <TableRow key={`rev-${line.accountId}`}>
                        <TableCell className="text-sm">
                          {line.accountCode} — {line.accountName}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Math.abs(line.amount))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    ))}
                    {/* Expense accounts — CR to zero */}
                    {fund.expenseLines.map((line) => (
                      <TableRow key={`exp-${line.accountId}`}>
                        <TableCell className="text-sm">
                          {line.accountCode} — {line.accountName}
                        </TableCell>
                        <TableCell />
                        <TableCell className="text-right tabular-nums">
                          {formatCurrency(Math.abs(line.amount))}
                        </TableCell>
                      </TableRow>
                    ))}
                    {/* Retained earnings — net */}
                    <TableRow className="font-semibold border-t-2">
                      <TableCell>
                        {fund.retainedEarningsAccountCode} — Retained Earnings
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fund.netToRetainedEarnings < 0
                          ? formatCurrency(Math.abs(fund.netToRetainedEarnings))
                          : ''}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fund.netToRetainedEarnings > 0
                          ? formatCurrency(fund.netToRetainedEarnings)
                          : ''}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          ))}

          <div className="flex justify-between pt-2">
            <Button variant="outline" onClick={() => setStep(2)}>
              <ChevronLeft className="mr-1 h-4 w-4" />
              Back
            </Button>
            <Button
              variant="destructive"
              onClick={handlePostClose}
              disabled={posting}
              data-testid="close-books-confirm-btn"
            >
              {posting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Posting...
                </>
              ) : (
                <>
                  <Lock className="mr-2 h-4 w-4" />
                  Close the Books
                </>
              )}
            </Button>
          </div>
        </div>
      )}

      {/* ── Step 4: Success ── */}
      {step === 4 && postResult && preview && (
        <Card>
          <CardContent className="pt-6 space-y-6">
            <div className="flex items-center gap-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 p-5">
              <CheckCircle2 className="h-7 w-7 text-green-600 shrink-0" />
              <div>
                <p className="font-semibold text-green-800 dark:text-green-200 text-lg">
                  {postResult.transactionIds.length} closing{' '}
                  {postResult.transactionIds.length === 1 ? 'entry' : 'entries'}{' '}
                  posted. Fiscal year {fiscalYear} is now locked.
                </p>
                <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                  Transaction IDs: {postResult.transactionIds.join(', ')}
                </p>
              </div>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fund</TableHead>
                  <TableHead className="text-right">Net Change</TableHead>
                  <TableHead>RE Account</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {preview.funds.map((fund) => (
                  <TableRow key={fund.fundId}>
                    <TableCell className="font-medium">{fund.fundName}</TableCell>
                    <TableCell
                      className={`text-right tabular-nums ${
                        fund.netToRetainedEarnings >= 0
                          ? 'text-green-700 dark:text-green-400'
                          : 'text-destructive'
                      }`}
                    >
                      {formatCurrency(fund.netToRetainedEarnings)}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {fund.retainedEarningsAccountCode}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell
                    className={`text-right font-semibold tabular-nums ${
                      preview.totalNetChange >= 0
                        ? 'text-green-700 dark:text-green-400'
                        : 'text-destructive'
                    }`}
                  >
                    {formatCurrency(preview.totalNetChange)}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>

            <div className="flex justify-end">
              <Button
                onClick={() => router.push('/accounts')}
                data-testid="close-books-done-btn"
              >
                Done
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
