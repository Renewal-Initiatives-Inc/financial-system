'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  AlertTriangle,
  DollarSign,
  CreditCard,
  X,
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
import {
  ContractTermsCard,
  parseMilestones,
} from '@/components/shared/contract-terms-card'
import { updatePurchaseOrderStatus, dismissComplianceWarning } from '../../actions'
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
  POSTED: 'bg-blue-100 text-blue-800',
  PAID: 'bg-green-100 text-green-800',
}

const paymentStatusLabels: Record<string, string> = {
  POSTED: 'Posted',
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

  const total = parseFloat(po.totalAmount)
  const invoiced = parseFloat(po.invoicedAmount)
  const remaining = total - invoiced

  const dismissed = (po.dismissedWarnings ?? []) as { type: string; message: string }[]
  const complianceWarnings = getComplianceWarnings(po).filter(
    (w) => !dismissed.some((d) => d.type === w.type && d.message === w.message)
  )

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

  const handleDismissWarning = (warning: ComplianceWarning) => {
    startTransition(async () => {
      try {
        await dismissComplianceWarning(po.id, warning.type, warning.message)
        toast.success('Warning dismissed')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to dismiss warning'
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
              <Label className="text-muted-foreground">Funding Source</Label>
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
                  <span className="flex-1">{warning.message}</span>
                  <button
                    type="button"
                    onClick={() => handleDismissWarning(warning)}
                    disabled={isPending}
                    className="ml-auto flex-shrink-0 rounded p-0.5 opacity-60 hover:opacity-100 transition-opacity"
                    title="Dismiss warning"
                    data-testid={`dismiss-warning-${idx}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      {/* 4. Contract Terms Card */}
      <ContractTermsCard
        milestones={po.extractedMilestones}
        terms={po.extractedTerms}
        covenants={po.extractedCovenants}
        contractPdfUrl={po.contractPdfUrl}
      />

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
                          href={`/transactions/${inv.glTransactionId}`}
                          className="text-blue-600 hover:underline text-sm"
                        >
                          GL-{inv.glTransactionId}
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </TableCell>
                    <TableCell />
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
