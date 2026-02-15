'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
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
import { ReportShell } from '@/components/reports/report-shell'
import { getTransactionHistoryData } from '@/lib/reports/transaction-history'
import type { TransactionHistoryData, TransactionHistoryRow } from '@/lib/reports/transaction-history'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import { ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight } from 'lucide-react'

type FundRow = { id: number; name: string; restrictionType: string; isActive: boolean }

const SOURCE_TYPES = [
  'MANUAL',
  'TIMESHEET',
  'EXPENSE_REPORT',
  'RAMP',
  'BANK_FEED',
  'SYSTEM',
  'FY25_IMPORT',
] as const

const SOURCE_BADGE_COLORS: Record<string, string> = {
  MANUAL: 'bg-blue-100 text-blue-800',
  TIMESHEET: 'bg-teal-100 text-teal-800',
  EXPENSE_REPORT: 'bg-purple-100 text-purple-800',
  RAMP: 'bg-orange-100 text-orange-800',
  BANK_FEED: 'bg-cyan-100 text-cyan-800',
  SYSTEM: 'bg-gray-100 text-gray-800',
  FY25_IMPORT: 'bg-yellow-100 text-yellow-800',
}

// ---------------------------------------------------------------------------
// Expandable row
// ---------------------------------------------------------------------------

function TransactionRow({ row }: { row: TransactionHistoryRow }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-8">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
        </TableCell>
        <TableCell className="tabular-nums text-sm">{formatDate(row.date)}</TableCell>
        <TableCell className="max-w-xs truncate text-sm">{row.memo}</TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Badge
              variant="outline"
              className={`text-xs ${SOURCE_BADGE_COLORS[row.sourceType] ?? ''}`}
            >
              {row.sourceType.replace(/_/g, ' ')}
            </Badge>
            {row.isVoided && (
              <Badge variant="destructive" className="text-xs">
                VOID
              </Badge>
            )}
            {row.isReversed && (
              <Badge variant="outline" className="text-xs bg-orange-50">
                REVERSED
              </Badge>
            )}
          </div>
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {formatCurrency(row.totalDebit)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-sm">
          {formatCurrency(row.totalCredit)}
        </TableCell>
      </TableRow>
      {isExpanded && row.lines.map((line) => (
        <TableRow key={line.lineId} className="bg-muted/30">
          <TableCell />
          <TableCell />
          <TableCell className="text-xs font-mono" colSpan={2}>
            {line.accountCode} — {line.accountName}
            <span className="text-muted-foreground ml-2">({line.fundName})</span>
          </TableCell>
          <TableCell className="text-right text-xs tabular-nums">
            {line.debit > 0 ? formatCurrency(line.debit) : ''}
          </TableCell>
          <TableCell className="text-right text-xs tabular-nums">
            {line.credit > 0 ? formatCurrency(line.credit) : ''}
          </TableCell>
        </TableRow>
      ))}
    </>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface TransactionHistoryClientProps {
  initialData: TransactionHistoryData
  funds: FundRow[]
  defaultStartDate: string
  defaultEndDate: string
}

export function TransactionHistoryClient({
  initialData,
  funds,
  defaultStartDate,
  defaultEndDate,
}: TransactionHistoryClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [sourceType, setSourceType] = useState('')
  const [fundId, setFundId] = useState<number | null>(null)
  const [memoSearch, setMemoSearch] = useState('')

  const fetchPage = useCallback(
    (page: number) => {
      startTransition(async () => {
        const result = await getTransactionHistoryData({
          startDate,
          endDate,
          sourceType: sourceType || undefined,
          fundId: fundId ?? undefined,
          memoSearch: memoSearch || undefined,
          page,
        })
        setData(result)
      })
    },
    [startDate, endDate, sourceType, fundId, memoSearch]
  )

  const handleApply = useCallback(() => fetchPage(1), [fetchPage])

  const exportData = data.rows.map((r) => ({
    Date: r.date,
    Memo: r.memo,
    Source: r.sourceType,
    Status: r.isVoided ? 'VOIDED' : r.isReversed ? 'REVERSED' : 'Active',
    Debit: r.totalDebit,
    Credit: r.totalCredit,
  }))

  const exportColumns = ['Date', 'Memo', 'Source', 'Status', 'Debit', 'Credit']

  return (
    <ReportShell
      title="Transaction History"
      generatedAt={data.generatedAt}
      reportSlug="transaction-history"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3" data-testid="transaction-history-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 h-8 text-sm"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="w-36 h-8 text-sm">
              <SelectValue placeholder="All sources" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All sources</SelectItem>
              {SOURCE_TYPES.map((s) => (
                <SelectItem key={s} value={s}>
                  {s.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fund</Label>
          <Select
            value={fundId ? String(fundId) : 'all'}
            onValueChange={(v) => setFundId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-44 h-8 text-sm">
              <SelectValue placeholder="All funds" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All funds</SelectItem>
              {funds.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {f.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Memo Search</Label>
          <Input
            placeholder="Search memo..."
            value={memoSearch}
            onChange={(e) => setMemoSearch(e.target.value)}
            className="w-40 h-8 text-sm"
          />
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="transaction-history-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      <p className="text-sm text-muted-foreground">
        {data.totalCount.toLocaleString()} transactions
        {data.totalPages > 1 && ` — Page ${data.page} of ${data.totalPages}`}
      </p>

      {/* Table */}
      <div className="rounded-md border" data-testid="transaction-history-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Date</TableHead>
              <TableHead>Memo</TableHead>
              <TableHead>Source</TableHead>
              <TableHead className="text-right">Debit</TableHead>
              <TableHead className="text-right">Credit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No transactions found.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <TransactionRow key={row.id} row={row} />
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-end gap-1" data-testid="transaction-history-pagination">
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(1)} disabled={data.page === 1 || isPending}>
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.page - 1)} disabled={data.page === 1 || isPending}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 tabular-nums">{data.page} / {data.totalPages}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.page + 1)} disabled={data.page === data.totalPages || isPending}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.totalPages)} disabled={data.page === data.totalPages || isPending}>
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </ReportShell>
  )
}
