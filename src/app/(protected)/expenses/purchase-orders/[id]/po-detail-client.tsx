'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  AlertTriangle,
  FileText,
  DollarSign,
  CreditCard,
} from 'lucide-react'
import { format, isPast, addDays, isBefore } from 'date-fns'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { updatePurchaseOrderStatus, markPaymentInProcess } from '../../actions'
import type { PurchaseOrderDetail } from '../../actions'
import { toast } from 'sonner'

// --- Constants ---

const statusColors: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ACTIVE: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPLETED:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CANCELLED: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

const paymentStatusColors: Record<string, string> = {
  PENDING: 'bg-gray-100 text-gray-800',
  POSTED: 'bg-blue-100 text-blue-800',
  PAYMENT_IN_PROCESS: 'bg-yellow-100 text-yellow-800',
  MATCHED_TO_PAYMENT: 'bg-green-100 text-green-800',
  PAID: 'bg-green-100 text-green-800',
}

const paymentStatusLabels: Record<string, string> = {
  PENDING: 'Pending',
  POSTED: 'Posted',
  PAYMENT_IN_PROCESS: 'Payment in Process',
  MATCHED_TO_PAYMENT: 'Matched to Payment',
  PAID: 'Paid',
}

// --- Helpers ---

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d, yyyy')
}

interface MilestoneItem {
  name?: string
  description?: string
  date?: string
  dueDate?: string
}

interface TermItem {
  name?: string
  description?: string
  paymentSchedule?: string
  amount?: string
}

interface CovenantItem {
  name?: string
  description?: string
  requirement?: string
}

function parseMilestones(data: unknown): MilestoneItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as MilestoneItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.milestones)) return obj.milestones as MilestoneItem[]
    if (Array.isArray(obj.items)) return obj.items as MilestoneItem[]
  }
  return []
}

function parseTerms(data: unknown): TermItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as TermItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.terms)) return obj.terms as TermItem[]
    if (Array.isArray(obj.items)) return obj.items as TermItem[]
  }
  return []
}

function parseCovenants(data: unknown): CovenantItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as CovenantItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.covenants)) return obj.covenants as CovenantItem[]
    if (Array.isArray(obj.items)) return obj.items as CovenantItem[]
  }
  return []
}

// --- Compliance warning logic ---

interface ComplianceWarning {
  type: 'budget' | 'milestone'
  severity: 'yellow' | 'red'
  message: string
}

function getComplianceWarnings(po: PurchaseOrderDetail): ComplianceWarning[] {
  const warnings: ComplianceWarning[] = []

  const total = parseFloat(po.totalAmount)
  const invoiced = parseFloat(po.invoicedAmount)

  if (total > 0) {
    const utilization = invoiced / total
    if (utilization > 1) {
      warnings.push({
        type: 'budget',
        severity: 'red',
        message: `Budget overrun: ${formatCurrency(invoiced)} invoiced against ${formatCurrency(total)} total (${Math.round(utilization * 100)}%)`,
      })
    } else if (utilization >= 0.9) {
      warnings.push({
        type: 'budget',
        severity: 'yellow',
        message: `Budget nearing capacity: ${formatCurrency(invoiced)} invoiced of ${formatCurrency(total)} total (${Math.round(utilization * 100)}%)`,
      })
    }
  }

  const milestones = parseMilestones(po.extractedMilestones)
  const now = new Date()
  const sevenDaysFromNow = addDays(now, 7)

  for (const milestone of milestones) {
    const dateStr = milestone.date || milestone.dueDate
    if (!dateStr) continue

    const milestoneDate = new Date(dateStr)
    if (isNaN(milestoneDate.getTime())) continue

    const milestoneName = milestone.name || milestone.description || 'Unnamed milestone'

    if (isPast(milestoneDate)) {
      warnings.push({
        type: 'milestone',
        severity: 'red',
        message: `Milestone overdue: "${milestoneName}" was due ${formatDate(milestoneDate)}`,
      })
    } else if (isBefore(milestoneDate, sevenDaysFromNow)) {
      warnings.push({
        type: 'milestone',
        severity: 'yellow',
        message: `Milestone upcoming: "${milestoneName}" due ${formatDate(milestoneDate)}`,
      })
    }
  }

  return warnings
}

// --- Component ---

interface PODetailClientProps {
  po: PurchaseOrderDetail
}

export function PODetailClient({ po }: PODetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    milestones: false,
    terms: false,
    covenants: false,
  })

  const total = parseFloat(po.totalAmount)
  const invoiced = parseFloat(po.invoicedAmount)
  const remaining = total - invoiced

  const milestones = parseMilestones(po.extractedMilestones)
  const terms = parseTerms(po.extractedTerms)
  const covenants = parseCovenants(po.extractedCovenants)
  const hasContractTerms =
    milestones.length > 0 || terms.length > 0 || covenants.length > 0

  const complianceWarnings = getComplianceWarnings(po)

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const handleStatusChange = (
    newStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
  ) => {
    startTransition(async () => {
      try {
        await updatePurchaseOrderStatus(po.id, newStatus, 'system')
        toast.success(`Purchase order status updated to ${statusLabels[newStatus]}`)
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Failed to update purchase order status'
        )
      }
    })
  }

  const handleMarkPaymentInProcess = (invoiceId: number) => {
    startTransition(async () => {
      try {
        await markPaymentInProcess(invoiceId, 'system')
        toast.success('Invoice marked as payment in process')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error
            ? err.message
            : 'Failed to mark payment in process'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* 1. Header */}
      <div className="flex items-center gap-4">
        <Link href="/expenses/purchase-orders">
          <Button
            variant="ghost"
            size="icon"
            data-testid="po-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            PO-{po.id}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-muted-foreground">{po.vendorName}</span>
            <Badge
              variant="outline"
              className={statusColors[po.status] ?? ''}
            >
              {statusLabels[po.status] ?? po.status}
            </Badge>
          </div>
        </div>
      </div>

      {/* 2. Summary Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
            <div>
              <Label className="text-muted-foreground">Total Amount</Label>
              <p className="text-lg font-semibold font-mono">
                {formatCurrency(po.totalAmount)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Invoiced Amount</Label>
              <p className="text-lg font-semibold font-mono">
                {formatCurrency(po.invoicedAmount)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Remaining Budget</Label>
              <p
                className={`text-lg font-semibold font-mono ${
                  remaining < 0
                    ? 'text-red-600'
                    : remaining < total * 0.1
                      ? 'text-yellow-600'
                      : ''
                }`}
              >
                {formatCurrency(remaining)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Fund</Label>
              <p>{po.fundName}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">GL Account</Label>
              <p>
                {po.accountCode} - {po.accountName}
              </p>
            </div>
            {po.cipCostCodeName && (
              <div>
                <Label className="text-muted-foreground">CIP Cost Code</Label>
                <p>{po.cipCostCodeName}</p>
              </div>
            )}
          </div>
          {po.contractPdfUrl && (
            <div className="mt-4">
              <a
                href={po.contractPdfUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
              >
                <FileText className="h-4 w-4" />
                View Contract PDF
                <ExternalLink className="h-3 w-3" />
              </a>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 3. Compliance Warnings Card */}
      {complianceWarnings.length > 0 && (
        <Card data-testid="po-compliance-warnings">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-yellow-600" />
              Compliance Warnings
              <HelpTooltip term="po-compliance-warning" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {complianceWarnings.map((warning, idx) => (
                <li
                  key={idx}
                  className={`flex items-start gap-2 rounded-md p-2 text-sm ${
                    warning.severity === 'red'
                      ? 'bg-red-50 text-red-800 dark:bg-red-950 dark:text-red-200'
                      : 'bg-yellow-50 text-yellow-800 dark:bg-yellow-950 dark:text-yellow-200'
                  }`}
                >
                  <AlertTriangle
                    className={`mt-0.5 h-4 w-4 flex-shrink-0 ${
                      warning.severity === 'red'
                        ? 'text-red-600'
                        : 'text-yellow-600'
                    }`}
                  />
                  {warning.message}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 4. Contract Terms Card */}
      <Card>
        <CardHeader>
          <CardTitle>Contract Terms</CardTitle>
        </CardHeader>
        <CardContent>
          {!hasContractTerms ? (
            <p className="text-sm text-muted-foreground">
              No contract terms extracted
            </p>
          ) : (
            <div className="space-y-3">
              {/* Milestones */}
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                  onClick={() => toggleSection('milestones')}
                >
                  <span>
                    Milestones{' '}
                    {milestones.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {milestones.length}
                      </Badge>
                    )}
                  </span>
                  {expandedSections.milestones ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.milestones && (
                  <div className="border-t px-3 pb-3">
                    {milestones.length === 0 ? (
                      <p className="pt-3 text-sm text-muted-foreground">
                        No milestones
                      </p>
                    ) : (
                      <ul className="space-y-2 pt-3">
                        {milestones.map((m, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">
                              {m.name || m.description || `Milestone ${idx + 1}`}
                            </span>
                            {(m.date || m.dueDate) && (
                              <span className="ml-2 text-muted-foreground">
                                Due: {formatDate(m.date || m.dueDate!)}
                              </span>
                            )}
                            {m.description && m.name && (
                              <p className="text-muted-foreground">
                                {m.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Payment Terms */}
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                  onClick={() => toggleSection('terms')}
                >
                  <span>
                    Payment Terms{' '}
                    {terms.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {terms.length}
                      </Badge>
                    )}
                  </span>
                  {expandedSections.terms ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.terms && (
                  <div className="border-t px-3 pb-3">
                    {terms.length === 0 ? (
                      <p className="pt-3 text-sm text-muted-foreground">
                        No payment terms
                      </p>
                    ) : (
                      <ul className="space-y-2 pt-3">
                        {terms.map((t, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">
                              {t.name || t.description || `Term ${idx + 1}`}
                            </span>
                            {t.paymentSchedule && (
                              <span className="ml-2 text-muted-foreground">
                                Schedule: {t.paymentSchedule}
                              </span>
                            )}
                            {t.amount && (
                              <span className="ml-2 text-muted-foreground">
                                Amount: {formatCurrency(t.amount)}
                              </span>
                            )}
                            {t.description && t.name && (
                              <p className="text-muted-foreground">
                                {t.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Covenants */}
              <div className="border rounded-md">
                <button
                  type="button"
                  className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                  onClick={() => toggleSection('covenants')}
                >
                  <span>
                    Covenants{' '}
                    {covenants.length > 0 && (
                      <Badge variant="secondary" className="ml-1">
                        {covenants.length}
                      </Badge>
                    )}
                  </span>
                  {expandedSections.covenants ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedSections.covenants && (
                  <div className="border-t px-3 pb-3">
                    {covenants.length === 0 ? (
                      <p className="pt-3 text-sm text-muted-foreground">
                        No covenants
                      </p>
                    ) : (
                      <ul className="space-y-2 pt-3">
                        {covenants.map((c, idx) => (
                          <li key={idx} className="text-sm">
                            <span className="font-medium">
                              {c.name || c.description || `Covenant ${idx + 1}`}
                            </span>
                            {c.requirement && (
                              <p className="text-muted-foreground">
                                {c.requirement}
                              </p>
                            )}
                            {c.description && c.name && (
                              <p className="text-muted-foreground">
                                {c.description}
                              </p>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Invoices Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Invoices
          </CardTitle>
          <Link
            href={`/expenses/purchase-orders/${po.id}/invoices/new`}
          >
            <Button
              size="sm"
              data-testid="po-add-invoice-btn"
            >
              Add Invoice
            </Button>
          </Link>
        </CardHeader>
        <CardContent>
          {po.invoices.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No invoices recorded yet.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Invoice Date</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Payment Status</TableHead>
                  <TableHead>GL Entry</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {po.invoices.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell className="font-medium">
                      {inv.invoiceNumber || `INV-${inv.id}`}
                    </TableCell>
                    <TableCell className="font-mono">
                      {formatCurrency(inv.amount)}
                    </TableCell>
                    <TableCell>{formatDate(inv.invoiceDate)}</TableCell>
                    <TableCell>
                      {inv.dueDate ? formatDate(inv.dueDate) : '-'}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          paymentStatusColors[inv.paymentStatus] ?? ''
                        }
                      >
                        {paymentStatusLabels[inv.paymentStatus] ??
                          inv.paymentStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {inv.glTransactionId ? (
                        <Link
                          href={`/transactions?id=${inv.glTransactionId}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          GL-{inv.glTransactionId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    {/* 7. Payment Status Actions */}
                    <TableCell>
                      {inv.paymentStatus === 'POSTED' && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending}
                          onClick={() =>
                            handleMarkPaymentInProcess(inv.id)
                          }
                          data-testid={`mark-payment-btn-${inv.id}`}
                        >
                          Mark Payment in Process
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 6. Actions Card */}
      {(po.status === 'DRAFT' || po.status === 'ACTIVE') && (
        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="flex gap-2">
            {po.status === 'DRAFT' && (
              <Button
                onClick={() => handleStatusChange('ACTIVE')}
                disabled={isPending}
                data-testid="po-activate-btn"
              >
                Activate
              </Button>
            )}
            {po.status === 'ACTIVE' && (
              <>
                <Button
                  onClick={() => handleStatusChange('COMPLETED')}
                  disabled={isPending}
                  data-testid="po-complete-btn"
                >
                  Complete
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => handleStatusChange('CANCELLED')}
                  disabled={isPending}
                  data-testid="po-cancel-btn"
                >
                  Cancel
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
