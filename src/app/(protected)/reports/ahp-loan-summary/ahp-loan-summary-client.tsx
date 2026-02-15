'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import type { AHPLoanSummaryData } from '@/lib/reports/ahp-loan-summary'
import { formatCurrency, formatDate, formatPercent } from '@/lib/reports/types'

interface AHPLoanSummaryClientProps {
  initialData: AHPLoanSummaryData
}

export function AHPLoanSummaryClient({ initialData }: AHPLoanSummaryClientProps) {
  const [data] = useState(initialData)

  if (!data.summary) {
    return (
      <ReportShell title="AHP Loan Summary" generatedAt={data.generatedAt} reportSlug="ahp-loan-summary">
        <div className="text-center py-12 text-muted-foreground">No AHP loan configuration found.</div>
      </ReportShell>
    )
  }

  const s = data.summary

  const exportData = [
    ...data.drawPaymentHistory.map((e) => ({
      Type: 'Draw/Payment',
      Date: e.date,
      Amount: e.amount,
      Category: e.type,
      Memo: e.memo,
    })),
    ...data.interestAccruals.map((e) => ({
      Type: 'Interest Accrual',
      Date: e.date,
      Amount: e.amount,
      Category: 'accrual',
      Memo: e.memo,
    })),
  ]
  const exportColumns = ['Type', 'Date', 'Amount', 'Category', 'Memo']

  return (
    <ReportShell
      title="AHP Loan Summary"
      generatedAt={data.generatedAt}
      reportSlug="ahp-loan-summary"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ahp-loan-summary-cards">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Credit Limit</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(s.creditLimit)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Drawn</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{formatCurrency(s.currentDrawnAmount)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Available</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(s.availableCredit)}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Current Rate</CardTitle></CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(s.currentInterestRate * 100).toFixed(3)}%</div>
            <p className="text-xs text-muted-foreground">Effective {formatDate(s.rateEffectiveDate)}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
        <div><span className="text-muted-foreground">Annual Payment Date:</span> {s.annualPaymentDate}</div>
        <div><span className="text-muted-foreground">Last Payment:</span> {s.lastPaymentDate ? formatDate(s.lastPaymentDate) : 'None'}</div>
        <div><span className="text-muted-foreground">Total Interest Accrued:</span> {formatCurrency(data.totalInterestAccrued)}</div>
      </div>

      {/* Draw / Payment History */}
      {data.drawPaymentHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Draw / Payment History</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.drawPaymentHistory.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell>
                      <Badge variant={entry.type === 'draw' ? 'outline' : 'default'} className="text-xs">
                        {entry.type === 'draw' ? 'Draw' : 'Payment'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(entry.amount)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{entry.memo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Interest Accrual History */}
      {data.interestAccruals.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Interest Accrual History</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                  <TableHead className="text-right">Running Total</TableHead>
                  <TableHead>Memo</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.interestAccruals.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums text-sm">{formatDate(entry.date)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(entry.amount)}</TableCell>
                    <TableCell className="text-right tabular-nums font-medium">{formatCurrency(entry.runningTotal)}</TableCell>
                    <TableCell className="text-sm max-w-xs truncate">{entry.memo}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* Rate History */}
      {data.rateHistory.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Rate History</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fiscal Year</TableHead>
                  <TableHead>Rate</TableHead>
                  <TableHead>Effective Date</TableHead>
                  <TableHead>Notes</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.rateHistory.map((entry, i) => (
                  <TableRow key={i}>
                    <TableCell className="tabular-nums">{entry.fiscalYear}</TableCell>
                    <TableCell className="tabular-nums font-medium">{(entry.rate * 100).toFixed(3)}%</TableCell>
                    <TableCell>{entry.effectiveDate ? formatDate(entry.effectiveDate) : '—'}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">{entry.notes ?? '—'}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ReportShell>
  )
}
