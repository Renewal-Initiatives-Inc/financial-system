'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { format } from 'date-fns'
import { Pencil, MoreHorizontal, RotateCcw, Ban, ArrowLeft } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Separator } from '@/components/ui/separator'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { ReverseTransactionDialog } from '@/components/transactions/reverse-transaction-dialog'
import { VoidTransactionDialog } from '@/components/transactions/void-transaction-dialog'
import type { TransactionDetail } from '../actions'

interface TransactionDetailClientProps {
  transaction: TransactionDetail
}

const sourceColors: Record<string, string> = {
  MANUAL: 'bg-blue-100 text-blue-800',
  SYSTEM: 'bg-purple-100 text-purple-800',
  TIMESHEET: 'bg-teal-100 text-teal-800',
  EXPENSE_REPORT: 'bg-amber-100 text-amber-800',
  RAMP: 'bg-orange-100 text-orange-800',
  BANK_FEED: 'bg-cyan-100 text-cyan-800',
  FY25_IMPORT: 'bg-gray-100 text-gray-800',
}

const sourceLabels: Record<string, string> = {
  MANUAL: 'Manual',
  SYSTEM: 'System',
  TIMESHEET: 'Timesheet',
  EXPENSE_REPORT: 'Expense Report',
  RAMP: 'Ramp',
  BANK_FEED: 'Bank Feed',
  FY25_IMPORT: 'FY25 Import',
}

export function TransactionDetailClient({
  transaction: txn,
}: TransactionDetailClientProps) {
  const router = useRouter()
  const [reverseOpen, setReverseOpen] = useState(false)
  const [voidOpen, setVoidOpen] = useState(false)

  const canEdit =
    !txn.isVoided && !txn.isSystemGenerated && txn.reversedById === null
  const canReverse = !txn.isVoided && txn.reversedById === null
  const canVoid = !txn.isVoided

  const totalDebits = txn.lines.reduce(
    (sum, l) => sum + (parseFloat(l.debit ?? '0') || 0),
    0
  )
  const totalCredits = txn.lines.reduce(
    (sum, l) => sum + (parseFloat(l.credit ?? '0') || 0),
    0
  )

  return (
    <div className="space-y-6">
      {/* Back nav + header */}
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push('/transactions')}
          data-testid="txn-detail-back"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
      </div>

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Transaction #{txn.id}
          </h1>
          <div className="flex items-center gap-2 flex-wrap">
            {/* Status badges */}
            {txn.isVoided ? (
              <Badge variant="outline" className="bg-red-100 text-red-800">
                Voided
              </Badge>
            ) : txn.reversedById ? (
              <Badge variant="outline" className="bg-amber-100 text-amber-800">
                Reversed
              </Badge>
            ) : (
              <Badge variant="outline" className="bg-green-100 text-green-800">
                Active
              </Badge>
            )}
            {txn.isSystemGenerated && (
              <Badge variant="outline" className="bg-purple-100 text-purple-800">
                System-Generated
              </Badge>
            )}
            <Badge
              variant="outline"
              className={sourceColors[txn.sourceType] ?? ''}
            >
              {sourceLabels[txn.sourceType] ?? txn.sourceType}
            </Badge>
            <span className="text-sm text-muted-foreground">
              {format(new Date(txn.date + 'T12:00:00'), 'MMM dd, yyyy')}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/transactions/${txn.id}/edit`)}
              data-testid="txn-edit-btn"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          {(canReverse || canVoid) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" data-testid="txn-actions-menu">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canReverse && (
                  <DropdownMenuItem
                    onClick={() => setReverseOpen(true)}
                    data-testid="txn-reverse-action"
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Reverse
                  </DropdownMenuItem>
                )}
                {canVoid && (
                  <DropdownMenuItem
                    onClick={() => setVoidOpen(true)}
                    className="text-destructive"
                    data-testid="txn-void-action"
                  >
                    <Ban className="mr-2 h-4 w-4" />
                    Void
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Memo */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Memo
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm" data-testid="txn-detail-memo">
            {txn.memo}
          </p>
        </CardContent>
      </Card>

      {/* Lines table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            Lines <HelpTooltip term="double-entry" />
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Funding Source</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead>Cost Code</TableHead>
                <TableHead>Memo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {txn.lines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell>
                    <span className="font-mono text-xs mr-1">
                      {line.accountCode}
                    </span>
                    <span className="text-sm">{line.accountName}</span>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <span className="text-sm">{line.fundName}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] ${
                          line.fundRestrictionType === 'RESTRICTED'
                            ? 'bg-amber-100 text-amber-800 border-amber-200'
                            : 'bg-green-100 text-green-800 border-green-200'
                        }`}
                      >
                        {line.fundRestrictionType === 'RESTRICTED'
                          ? 'R'
                          : 'U'}
                      </Badge>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {line.debit
                      ? `$${parseFloat(line.debit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}`
                      : ''}
                  </TableCell>
                  <TableCell className="text-right font-mono text-sm">
                    {line.credit
                      ? `$${parseFloat(line.credit).toLocaleString('en-US', {
                          minimumFractionDigits: 2,
                        })}`
                      : ''}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.cipCostCodeName ?? ''}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {line.memo ?? ''}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-medium">
                  Totals
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  $
                  {totalDebits.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell className="text-right font-mono font-medium">
                  $
                  {totalCredits.toLocaleString('en-US', {
                    minimumFractionDigits: 2,
                  })}
                </TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      {/* Reversal chain */}
      {(txn.reversalOfId || txn.reversedById) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Reversal Chain <HelpTooltip term="reversed-transaction" />
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-1">
            {txn.reversedById && (
              <p>
                This transaction was reversed by{' '}
                <Link
                  href={`/transactions/${txn.reversedById}`}
                  className="text-primary underline"
                  data-testid="txn-reversed-by-link"
                >
                  Transaction #{txn.reversedById}
                </Link>
              </p>
            )}
            {txn.reversalOfId && (
              <p>
                This is a reversal of{' '}
                <Link
                  href={`/transactions/${txn.reversalOfId}`}
                  className="text-primary underline"
                  data-testid="txn-reversal-of-link"
                >
                  Transaction #{txn.reversalOfId}
                </Link>
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Audit trail */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            Audit Trail <HelpTooltip term="audit-trail" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {txn.auditEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No audit entries.</p>
          ) : (
            <div className="space-y-2">
              {txn.auditEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-start gap-3 text-sm border-l-2 border-muted pl-3 py-1"
                >
                  <span className="text-muted-foreground whitespace-nowrap">
                    {format(new Date(entry.timestamp), 'MMM dd, yyyy h:mm a')}
                  </span>
                  <span>
                    <strong className="capitalize">{entry.action}</strong> by{' '}
                    {entry.userId}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />

      <div className="text-xs text-muted-foreground">
        Created by {txn.createdBy} on{' '}
        {format(new Date(txn.createdAt), 'MMM dd, yyyy h:mm a')}
      </div>

      {/* Dialogs */}
      <ReverseTransactionDialog
        transaction={txn}
        open={reverseOpen}
        onOpenChange={setReverseOpen}
      />
      <VoidTransactionDialog
        transactionId={txn.id}
        open={voidOpen}
        onOpenChange={setVoidOpen}
      />
    </div>
  )
}
