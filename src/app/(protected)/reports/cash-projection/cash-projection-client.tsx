'use client'

import { useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import type { CashProjectionData } from '@/lib/reports/cash-projection'
import { formatCurrency, formatDate } from '@/lib/reports/types'

interface CashProjectionClientProps {
  initialData: CashProjectionData
}

export function CashProjectionClient({ initialData }: CashProjectionClientProps) {
  const [data] = useState(initialData)

  if (!data.projectionId || data.months.length === 0) {
    return (
      <ReportShell
        title="3-Month Cash Projection"
        generatedAt={data.generatedAt}
        reportSlug="cash-projection"
      >
        <div className="text-center py-12 text-muted-foreground">
          No cash projection data available. Create a cash projection in the Budget module first.
        </div>
      </ReportShell>
    )
  }

  // Build export data
  const exportRows: Record<string, unknown>[] = []
  for (const month of data.months) {
    for (const line of month.inflows) {
      exportRows.push({
        Month: month.monthLabel,
        Type: 'Inflow',
        Source: line.sourceLabel,
        'Auto Amount': line.autoAmount,
        'Override Amount': line.overrideAmount ?? '',
        'Effective Amount': line.effectiveAmount,
        Note: line.overrideNote ?? '',
      })
    }
    for (const line of month.outflows) {
      exportRows.push({
        Month: month.monthLabel,
        Type: 'Outflow',
        Source: line.sourceLabel,
        'Auto Amount': line.autoAmount,
        'Override Amount': line.overrideAmount ?? '',
        'Effective Amount': line.effectiveAmount,
        Note: line.overrideNote ?? '',
      })
    }
  }

  const exportColumns = ['Month', 'Type', 'Source', 'Auto Amount', 'Override Amount', 'Effective Amount', 'Note']

  return (
    <ReportShell
      title="3-Month Cash Projection"
      generatedAt={data.generatedAt}
      reportSlug="cash-projection"
      exportData={exportRows}
      exportColumns={exportColumns}
    >
      <p className="text-sm text-muted-foreground">
        Fiscal Year {data.fiscalYear} — As of {formatDate(data.asOfDate)}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="cash-projection-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Starting Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.startingCash)}</div>
          </CardContent>
        </Card>
        {data.months.map((m, i) => (
          <Card key={m.month}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                End of {m.monthLabel}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${data.endingCashByMonth[i] < 0 ? 'text-red-600' : ''}`}>
                {formatCurrency(data.endingCashByMonth[i])}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Per-month tables */}
      {data.months.map((month, i) => (
        <div key={month.month} className="space-y-2">
          <h2 className="text-lg font-semibold">{month.monthLabel}</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Auto</TableHead>
                  <TableHead className="text-right">Override</TableHead>
                  <TableHead className="text-right">Effective</TableHead>
                  <TableHead>Note</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="bg-green-50/50">
                  <TableCell colSpan={5} className="font-semibold text-sm text-green-800">
                    Inflows
                  </TableCell>
                </TableRow>
                {month.inflows.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm pl-6">{line.sourceLabel}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCurrency(line.autoAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {line.overrideAmount !== null ? (
                        <Badge variant="outline" className="text-xs">{formatCurrency(line.overrideAmount)}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(line.effectiveAmount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{line.overrideNote ?? ''}</TableCell>
                  </TableRow>
                ))}
                <TableRow className="bg-red-50/50">
                  <TableCell colSpan={5} className="font-semibold text-sm text-red-800">
                    Outflows
                  </TableCell>
                </TableRow>
                {month.outflows.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm pl-6">{line.sourceLabel}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">{formatCurrency(line.autoAmount)}</TableCell>
                    <TableCell className="text-right tabular-nums text-sm">
                      {line.overrideAmount !== null ? (
                        <Badge variant="outline" className="text-xs">{formatCurrency(line.overrideAmount)}</Badge>
                      ) : '—'}
                    </TableCell>
                    <TableCell className="text-right tabular-nums text-sm font-medium">{formatCurrency(line.effectiveAmount)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{line.overrideNote ?? ''}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Net Cash Flow</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className={`text-right font-semibold ${month.netCashFlow < 0 ? 'text-red-600' : 'text-green-600'}`}>
                    {formatCurrency(month.netCashFlow)}
                  </TableCell>
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="font-semibold">Ending Cash</TableCell>
                  <TableCell />
                  <TableCell />
                  <TableCell className={`text-right font-bold ${data.endingCashByMonth[i] < 0 ? 'text-red-600' : ''}`}>
                    {formatCurrency(data.endingCashByMonth[i])}
                  </TableCell>
                  <TableCell />
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      ))}
    </ReportShell>
  )
}
