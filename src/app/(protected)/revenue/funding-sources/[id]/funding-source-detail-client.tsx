'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { AlertTriangle, ArrowLeft, Clock, Lock, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { ContractTermsCard } from '@/components/shared/contract-terms-card'
import {
  updateFund,
  toggleFundActive,
  recordFundCashReceiptAction,
  recognizeConditionalFundRevenue,
  createArInvoice,
  recordArInvoicePayment,
} from '../../actions'
import type { FundDetail, ArInvoiceRow } from '../../actions'
import { toast } from 'sonner'

function formatCurrency(value: string | null): string {
  if (!value) return '-'
  const num = parseFloat(value)
  const prefix = num < 0 ? '-' : ''
  return `${prefix}$${Math.abs(num).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface Props {
  source: FundDetail & { funderName: string | null }
  transactions: Array<{
    id: number
    date: string
    memo: string
    createdAt: Date
  }>
  arInvoices: ArInvoiceRow[]
}

export function FundingSourceDetailClient({ source, transactions, arInvoices }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(source.name)
  const [description, setDescription] = useState(source.description ?? '')
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)

  // Cash receipt state
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  // Revenue recognition state
  const [recognitionAmount, setRecognitionAmount] = useState('')
  const [recognitionDate, setRecognitionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [recognitionNote, setRecognitionNote] = useState('')

  // AR invoice state
  const [arAmount, setArAmount] = useState('')
  const [arInvoiceNumber, setArInvoiceNumber] = useState('')
  const [arInvoiceDate, setArInvoiceDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [arDueDate, setArDueDate] = useState('')
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const balance = parseFloat(source.balance)
  const hasNonZeroBalance = Math.abs(balance) >= 0.005
  const isRestricted = source.restrictionType === 'RESTRICTED'

  // Close-out approach warnings
  const daysUntilEnd = source.endDate
    ? Math.ceil(
        (new Date(source.endDate + 'T00:00:00').getTime() - Date.now()) /
          (1000 * 60 * 60 * 24)
      )
    : null

  const closeOutWarning =
    daysUntilEnd !== null && daysUntilEnd >= 0 && daysUntilEnd <= 90
      ? daysUntilEnd <= 30
        ? ('red' as const)
        : ('yellow' as const)
      : null

  // Cost-share / match warning
  const matchPercent = source.matchRequirementPercent
    ? parseFloat(source.matchRequirementPercent)
    : null
  const awardAmount = source.amount ? parseFloat(source.amount) : null
  const expenseTotal = parseFloat(source.expenseTotal)
  const matchWarning =
    matchPercent !== null && awardAmount !== null && awardAmount > 0
      ? (() => {
          const requiredMatch = (awardAmount * matchPercent) / 100
          const matchMet = Math.abs(expenseTotal) >= requiredMatch
          return matchMet
            ? null
            : {
                required: requiredMatch,
                current: Math.abs(expenseTotal),
                percent: matchPercent,
              }
        })()
      : null

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateFund(
          source.id,
          {
            ...(name !== source.name ? { name } : {}),
            ...(description !== (source.description ?? '')
              ? { description: description || null }
              : {}),
          },
          'system'
        )
        setIsEditing(false)
        toast.success('Funding source updated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update')
      }
    })
  }

  const handleToggleActive = (active: boolean) => {
    if (!active) {
      setIsConfirmDeactivateOpen(true)
      return
    }
    startTransition(async () => {
      try {
        await toggleFundActive(source.id, true, 'system')
        toast.success('Funding source reactivated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to reactivate')
      }
    })
  }

  const confirmDeactivation = () => {
    startTransition(async () => {
      try {
        await toggleFundActive(source.id, false, 'system')
        setIsConfirmDeactivateOpen(false)
        toast.success('Funding source deactivated')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to deactivate')
        setIsConfirmDeactivateOpen(false)
      }
    })
  }

  const handleCashReceipt = () => {
    startTransition(async () => {
      try {
        await recordFundCashReceiptAction(
          { fundId: source.id, amount: receiptAmount, date: receiptDate },
          'system'
        )
        toast.success('Cash receipt recorded')
        setReceiptAmount('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record receipt')
      }
    })
  }

  const handleRecognizeRevenue = () => {
    startTransition(async () => {
      try {
        await recognizeConditionalFundRevenue(
          {
            fundId: source.id,
            amount: recognitionAmount,
            date: recognitionDate,
            note: recognitionNote,
          },
          'system'
        )
        toast.success('Revenue recognized')
        setRecognitionAmount('')
        setRecognitionNote('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to recognize revenue')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/revenue/funding-sources">
          <Button variant="ghost" size="icon" data-testid="funding-source-detail-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">
              {source.name}
            </h1>
            {source.isSystemLocked && (
              <Badge variant="outline" className="gap-1">
                <Lock className="h-3 w-3" />
                System Locked
              </Badge>
            )}
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={
                isRestricted
                  ? 'bg-amber-100 text-amber-800'
                  : 'bg-green-100 text-green-800'
              }
            >
              {isRestricted ? 'Restricted' : 'Unrestricted'}
            </Badge>
            {source.type && (
              <Badge variant="outline">
                {source.type === 'CONDITIONAL' ? 'Conditional' : 'Unconditional'}
              </Badge>
            )}
            <Badge variant={source.isActive ? 'default' : 'secondary'}>
              {source.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Balance Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Balance Summary <HelpTooltip term="fund-balance" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <p className="text-3xl font-bold">{formatCurrency(source.balance)}</p>
            <p className="text-sm text-muted-foreground">
              Net balance ({source.transactionCount} transaction
              {source.transactionCount !== 1 ? 's' : ''})
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Assets</p>
              <p className="font-mono text-sm">{formatCurrency(source.assetTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Liabilities</p>
              <p className="font-mono text-sm">{formatCurrency(source.liabilityTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Net Assets</p>
              <p className="font-mono text-sm">{formatCurrency(source.netAssetTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Revenue</p>
              <p className="font-mono text-sm">{formatCurrency(source.revenueTotal)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Expenses</p>
              <p className="font-mono text-sm">{formatCurrency(source.expenseTotal)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Warnings */}
      {(closeOutWarning || matchWarning) && (
        <div className="space-y-3">
          {closeOutWarning && (
            <div
              className={`flex items-start gap-3 rounded-lg border p-4 ${
                closeOutWarning === 'red'
                  ? 'border-red-200 bg-red-50 text-red-800'
                  : 'border-yellow-200 bg-yellow-50 text-yellow-800'
              }`}
              data-testid="close-out-warning"
            >
              <Clock className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">
                  {daysUntilEnd === 0
                    ? 'Grant period ends today'
                    : `Grant period ends in ${daysUntilEnd} day${daysUntilEnd !== 1 ? 's' : ''}`}
                </p>
                <p className="text-sm opacity-80">
                  End date: {formatDate(source.endDate)}.
                  {closeOutWarning === 'red'
                    ? ' Begin close-out procedures immediately.'
                    : ' Plan for close-out and final reporting.'}
                </p>
              </div>
            </div>
          )}
          {matchWarning && (
            <div
              className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 text-yellow-800"
              data-testid="match-warning"
            >
              <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
              <div>
                <p className="font-medium">
                  Cost-share match below requirement ({matchWarning.percent}%)
                </p>
                <p className="text-sm opacity-80">
                  Required: {formatCurrency(String(matchWarning.required))} | Current
                  spending: {formatCurrency(String(matchWarning.current))}
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Funding Source Information (restricted only) */}
      {isRestricted && (
        <Card>
          <CardHeader>
            <CardTitle>Funding Information</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label className="text-muted-foreground">Funder</Label>
              <p>{source.funderName ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Award Amount</Label>
              <p>{formatCurrency(source.amount)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Period</Label>
              <p>
                {formatDate(source.startDate)} — {formatDate(source.endDate)}
              </p>
            </div>
            {source.reportingFrequency && (
              <div>
                <Label className="text-muted-foreground">Reporting Frequency</Label>
                <p className="capitalize">{source.reportingFrequency}</p>
              </div>
            )}
            {source.conditions && (
              <div className="sm:col-span-2">
                <Label className="text-muted-foreground">Conditions</Label>
                <p className="whitespace-pre-line">{source.conditions}</p>
              </div>
            )}
            {source.matchRequirementPercent && (
              <div>
                <Label className="text-muted-foreground">Match Requirement</Label>
                <p>{source.matchRequirementPercent}%</p>
              </div>
            )}
            {source.retainagePercent && (
              <div>
                <Label className="text-muted-foreground">Retainage</Label>
                <p>{source.retainagePercent}%</p>
              </div>
            )}
            {source.isUnusualGrant && (
              <div>
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                  Unusual Grant
                </Badge>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Contract Terms (if any extracted) */}
      {!!(source.extractedMilestones || source.extractedTerms || source.extractedCovenants) && (
        <ContractTermsCard
          milestones={source.extractedMilestones}
          terms={source.extractedTerms}
          covenants={source.extractedCovenants}
          contractPdfUrl={source.contractPdfUrl}
        />
      )}

      {/* Fund Details (editable) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Details</CardTitle>
          {!source.isSystemLocked && !isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-funding-source-btn"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              {isEditing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="edit-funding-source-name"
                />
              ) : (
                <p>{source.name}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Restriction Type <HelpTooltip term="restriction-type" />
              </Label>
              <p>
                {isRestricted ? 'Restricted' : 'Unrestricted'}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Cannot be changed after creation
              </p>
            </div>
          </div>

          <div>
            <Label className="text-muted-foreground">Description</Label>
            {isEditing ? (
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="edit-funding-source-description"
              />
            ) : (
              <p>{source.description || '-'}</p>
            )}
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={isPending} data-testid="save-funding-source-btn">
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setName(source.name)
                  setDescription(source.description ?? '')
                }}
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funding History */}
      <Card>
        <CardHeader>
          <CardTitle>Funding History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex justify-between text-sm border-b pb-2"
                >
                  <div>
                    <span className="text-muted-foreground">#{txn.id}</span>{' '}
                    {txn.memo}
                  </div>
                  <span className="text-muted-foreground">{formatDate(txn.date)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cash Receipt & Revenue Recognition (restricted only) */}
      {isRestricted && source.type && (
        <div className="grid gap-4 sm:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Record Cash Receipt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={receiptAmount}
                  onChange={(e) => setReceiptAmount(e.target.value)}
                  data-testid="funding-source-receipt-amount"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={receiptDate}
                  onChange={(e) => setReceiptDate(e.target.value)}
                  data-testid="funding-source-receipt-date"
                />
              </div>
              <Button
                onClick={handleCashReceipt}
                disabled={isPending || !receiptAmount}
                data-testid="funding-source-receipt-submit"
              >
                {isPending ? 'Recording...' : 'Record Receipt'}
              </Button>
            </CardContent>
          </Card>

          {source.type === 'CONDITIONAL' && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-1">
                  Recognize Revenue <HelpTooltip term="refundable-advance" />
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <Label>Amount</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={recognitionAmount}
                    onChange={(e) => setRecognitionAmount(e.target.value)}
                    data-testid="funding-source-recognition-amount"
                  />
                </div>
                <div>
                  <Label>Date</Label>
                  <Input
                    type="date"
                    value={recognitionDate}
                    onChange={(e) => setRecognitionDate(e.target.value)}
                    data-testid="funding-source-recognition-date"
                  />
                </div>
                <div>
                  <Label>Note</Label>
                  <Textarea
                    value={recognitionNote}
                    onChange={(e) => setRecognitionNote(e.target.value)}
                    placeholder="Describe condition met"
                    data-testid="funding-source-recognition-note"
                  />
                </div>
                <Button
                  onClick={handleRecognizeRevenue}
                  disabled={
                    isPending || !recognitionAmount || !recognitionNote.trim()
                  }
                  data-testid="funding-source-recognition-submit"
                >
                  {isPending ? 'Recognizing...' : 'Recognize Revenue'}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* AR Invoices (restricted funding sources only) */}
      {isRestricted && (
        <Card>
          <CardHeader>
            <CardTitle>AR Invoices</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Outstanding invoices */}
            {arInvoices.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Outstanding Invoices</p>
                {arInvoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="flex items-center justify-between rounded-lg border p-3 text-sm"
                    data-testid="ar-invoice-row"
                  >
                    <div>
                      <span className="font-medium">
                        {inv.invoiceNumber || `AR-${inv.id}`}
                      </span>
                      <span className="ml-2 text-muted-foreground">
                        {formatCurrency(inv.amount)} · {formatDate(inv.invoiceDate)}
                        {inv.dueDate && ` · Due ${formatDate(inv.dueDate)}`}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`text-xs font-medium ${
                          inv.paymentStatus === 'PAID'
                            ? 'text-green-600'
                            : 'text-amber-600'
                        }`}
                      >
                        {inv.paymentStatus}
                      </span>
                      {inv.paymentStatus !== 'PAID' && (
                        <div className="flex items-center gap-2">
                          <input
                            type="date"
                            className="h-7 rounded border px-2 text-xs"
                            value={paymentDate}
                            onChange={(e) => setPaymentDate(e.target.value)}
                            data-testid={`ar-payment-date-${inv.id}`}
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isPending}
                            onClick={() => {
                              startTransition(async () => {
                                try {
                                  await recordArInvoicePayment(inv.id, paymentDate, 'system')
                                  toast.success('Payment recorded')
                                  router.refresh()
                                } catch (err) {
                                  toast.error(err instanceof Error ? err.message : 'Failed')
                                }
                              })
                            }}
                            data-testid={`ar-payment-btn-${inv.id}`}
                          >
                            Record Payment
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Issue new AR invoice */}
            <div>
              <p className="mb-3 text-sm font-medium">Issue Invoice</p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Invoice Number <span className="text-muted-foreground text-xs">(optional)</span></Label>
                  <input
                    className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm"
                    value={arInvoiceNumber}
                    onChange={(e) => setArInvoiceNumber(e.target.value)}
                    placeholder="e.g. INV-2026-001"
                    data-testid="ar-invoice-number"
                  />
                </div>
                <div>
                  <Label>Amount <span className="text-destructive">*</span></Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={arAmount}
                    onChange={(e) => setArAmount(e.target.value)}
                    data-testid="ar-invoice-amount"
                  />
                </div>
                <div>
                  <Label>Invoice Date <span className="text-destructive">*</span></Label>
                  <Input
                    type="date"
                    value={arInvoiceDate}
                    onChange={(e) => setArInvoiceDate(e.target.value)}
                    data-testid="ar-invoice-date"
                  />
                </div>
                <div>
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={arDueDate}
                    onChange={(e) => setArDueDate(e.target.value)}
                    data-testid="ar-invoice-due-date"
                  />
                </div>
              </div>
              <Button
                className="mt-3"
                disabled={isPending || !arAmount}
                onClick={() => {
                  startTransition(async () => {
                    try {
                      const result = await createArInvoice(
                        {
                          fundId: source.id,
                          invoiceNumber: arInvoiceNumber.trim() || undefined,
                          amount: parseFloat(arAmount),
                          invoiceDate: arInvoiceDate,
                          dueDate: arDueDate || undefined,
                        },
                        'system'
                      )
                      toast.success(`AR Invoice issued — GL #${result.glTransactionId}`)
                      setArAmount('')
                      setArInvoiceNumber('')
                      setArDueDate('')
                      router.refresh()
                    } catch (err) {
                      toast.error(err instanceof Error ? err.message : 'Failed to issue invoice')
                    }
                  })
                }}
                data-testid="ar-invoice-submit"
              >
                {isPending ? 'Issuing...' : 'Issue Invoice'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Active Status <HelpTooltip term="deactivation" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={source.isActive}
              onCheckedChange={handleToggleActive}
              disabled={source.isSystemLocked || isPending}
              data-testid="funding-source-active-toggle"
            />
            <span className="text-sm">
              {source.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
          {source.isSystemLocked && (
            <p className="text-sm text-muted-foreground flex items-center gap-1">
              <Lock className="h-3 w-3" /> System-locked funds cannot be deactivated
            </p>
          )}
          {!source.isSystemLocked && hasNonZeroBalance && source.isActive && (
            <p className="text-sm text-amber-600">
              This fund has a non-zero balance of {formatCurrency(source.balance)}.
              It must have a zero balance before it can be deactivated.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Deactivation Confirmation */}
      <Dialog open={isConfirmDeactivateOpen} onOpenChange={setIsConfirmDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Funding Source</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{source.name}</strong>?
              {hasNonZeroBalance && (
                <>
                  {' '}
                  This fund has a balance of {formatCurrency(source.balance)}.
                  Deactivation will be blocked if the balance is non-zero.
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-funding-source-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
