'use client'

import { useState, useCallback, useTransition } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import { getLateEntriesData } from '@/lib/reports/late-entries'
import type { LateEntriesData } from '@/lib/reports/late-entries'
import { formatCurrency, formatDate, formatDateTime } from '@/lib/reports/types'

interface LateEntriesClientProps {
  initialData: LateEntriesData
  defaultPeriodEndDate: string
}

export function LateEntriesClient({ initialData, defaultPeriodEndDate }: LateEntriesClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [periodEndDate, setPeriodEndDate] = useState(defaultPeriodEndDate)
  const [lookbackDays, setLookbackDays] = useState('30')

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getLateEntriesData({
        periodEndDate,
        lookbackDays: Number(lookbackDays),
      })
      setData(result)
    })
  }, [periodEndDate, lookbackDays])

  const exportData = data.rows.map((r) => ({
    'Transaction ID': r.transactionId,
    'Transaction Date': r.date,
    'Created At': formatDateTime(r.createdAt),
    Memo: r.memo,
    Source: r.sourceType,
    Amount: r.totalAmount,
    'Days Late': r.daysLate,
  }))

  const exportColumns = ['Transaction ID', 'Transaction Date', 'Created At', 'Memo', 'Source', 'Amount', 'Days Late']

  return (
    <ReportShell
      title="Late Entry Report"
      generatedAt={data.generatedAt}
      reportSlug="late-entries"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3" data-testid="late-entries-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Period End Date</Label>
          <Input
            type="date"
            value={periodEndDate}
            onChange={(e) => setPeriodEndDate(e.target.value)}
            className="w-40 h-8 text-sm"
            data-testid="late-entries-period-end-date-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lookback Window</Label>
          <Select value={lookbackDays} onValueChange={setLookbackDays}>
            <SelectTrigger className="w-32 h-8 text-sm" data-testid="late-entries-lookback-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">7 days</SelectItem>
              <SelectItem value="14">14 days</SelectItem>
              <SelectItem value="30">30 days</SelectItem>
              <SelectItem value="60">60 days</SelectItem>
              <SelectItem value="90">90 days</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="late-entries-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="late-entries-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Late Entries
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalLateEntries}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Amount
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalLateAmount)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Period End
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatDate(data.periodEndDate)}</div>
            <p className="text-xs text-muted-foreground">{data.lookbackDays}-day lookback</p>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <div className="rounded-md border" data-testid="late-entries-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Txn Date</TableHead>
              <TableHead>Created At</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Amount</TableHead>
              <TableHead className="text-right">Days Late</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No late entries found for this period.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TableRow key={row.transactionId}>
                  <TableCell className="tabular-nums text-sm">{formatDate(row.date)}</TableCell>
                  <TableCell className="text-xs tabular-nums">{formatDateTime(row.createdAt)}</TableCell>
                  <TableCell className="max-w-xs truncate text-sm">{row.memo}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">
                      {row.sourceType.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right tabular-nums text-sm">
                    {formatCurrency(row.totalAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant={row.daysLate > 14 ? 'destructive' : 'outline'}
                      className="text-xs tabular-nums"
                    >
                      {row.daysLate}d
                    </Badge>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={4} className="font-semibold">
                  Total ({data.totalLateEntries} entries)
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(data.totalLateAmount)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </ReportShell>
  )
}
