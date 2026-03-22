'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import type { PayableItem } from '../actions'
import { differenceInDays, parseISO } from 'date-fns'

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

const typeLabels: Record<string, string> = {
  AP: 'Accounts Payable',
  REIMBURSEMENT: 'Reimbursements Payable',
  CREDIT_CARD: 'Credit Card Payable',
}

const typeColors: Record<string, string> = {
  AP: 'bg-blue-100 text-blue-800',
  REIMBURSEMENT: 'bg-purple-100 text-purple-800',
  CREDIT_CARD: 'bg-orange-100 text-orange-800',
}

const statusColors: Record<string, string> = {
  POSTED: 'bg-yellow-100 text-yellow-800',
}

const statusLabels: Record<string, string> = {
  POSTED: 'Posted',
}

function getAgingBucket(dateStr: string): string {
  const days = differenceInDays(new Date(), parseISO(dateStr))
  if (days <= 30) return 'Current'
  if (days <= 60) return '31-60 days'
  if (days <= 90) return '61-90 days'
  return '90+ days'
}

function getAgingColor(dateStr: string): string {
  const days = differenceInDays(new Date(), parseISO(dateStr))
  if (days <= 30) return ''
  if (days <= 60) return 'text-yellow-600'
  if (days <= 90) return 'text-orange-600'
  return 'text-red-600 font-medium'
}

interface PayablesClientProps {
  payables: PayableItem[]
}

export function PayablesClient({ payables }: PayablesClientProps) {
  const [filter, setFilter] = useState<string>('all')

  const filtered =
    filter === 'all' ? payables : payables.filter((p) => p.type === filter)

  // Group by vendor
  const byVendor = new Map<string, PayableItem[]>()
  for (const p of filtered) {
    const key = p.vendorName
    if (!byVendor.has(key)) byVendor.set(key, [])
    byVendor.get(key)!.push(p)
  }

  const totalOutstanding = filtered.reduce(
    (sum, p) => sum + parseFloat(p.amount),
    0
  )

  return (
    <div className="space-y-4">
      {/* Summary & Filters */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="text-lg font-semibold">
            Total Outstanding:{' '}
            <span className="font-mono">{formatCurrency(totalOutstanding)}</span>
          </div>
          <HelpTooltip term="outstanding-payables" />
        </div>
        <div className="flex gap-2">
          {['all', 'AP', 'REIMBURSEMENT', 'CREDIT_CARD'].map((t) => (
            <Button
              key={t}
              variant={filter === t ? 'default' : 'outline'}
              size="sm"
              onClick={() => setFilter(t)}
              data-testid={`payables-filter-${t.toLowerCase()}`}
            >
              {t === 'all' ? 'All' : typeLabels[t]}
            </Button>
          ))}
        </div>
      </div>

      {/* Payables by vendor */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No outstanding payables.
          </CardContent>
        </Card>
      ) : (
        Array.from(byVendor.entries()).map(([vendorName, items]) => {
          const vendorTotal = items.reduce(
            (sum, p) => sum + parseFloat(p.amount),
            0
          )
          return (
            <Card key={vendorName}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">
                    {items[0].vendorId ? (
                      <Link
                        href={`/vendors/${items[0].vendorId}`}
                        className="hover:underline"
                      >
                        {vendorName}
                      </Link>
                    ) : (
                      vendorName
                    )}
                  </CardTitle>
                  <span className="font-mono text-sm font-medium">
                    {formatCurrency(vendorTotal)}
                  </span>
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Aging</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map((item, i) => (
                      <TableRow key={`${item.type}-${item.invoiceId ?? i}`}>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={typeColors[item.type]}
                          >
                            {typeLabels[item.type]}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {item.invoiceNumber
                            ? item.invoiceNumber
                            : item.invoiceId
                              ? `INV-${item.invoiceId}`
                              : '-'}
                        </TableCell>
                        <TableCell>{item.date}</TableCell>
                        <TableCell>
                          <span className={getAgingColor(item.date)}>
                            {getAgingBucket(item.date)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(item.amount)}
                        </TableCell>
                        <TableCell>
                          {item.paymentStatus && (
                            <Badge
                              variant="outline"
                              className={
                                statusColors[item.paymentStatus] ?? ''
                              }
                            >
                              {statusLabels[item.paymentStatus] ??
                                item.paymentStatus}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )
        })
      )}
    </div>
  )
}
