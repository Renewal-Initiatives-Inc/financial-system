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
import type { TransactionHistoryData, TransactionHistoryRow } from '@/lib/reports/transaction-history'
import { getTransactionHistoryData } from '../actions'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import { ChevronDown, ChevronRight, ChevronLeft, ChevronsLeft, ChevronsRight, ExternalLink } from 'lucide-react'
import Link from 'next/link'

type FundRow = { id: number; name: string; restrictionType: string; isActive: boolean }
type AccountSelectorRow = { id: number; code: string; name: string }

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
        <TableCell className="w-8" onClick={(e) => e.stopPropagation()}>
          <Link
            href={`/transactions/${row.id}`}
            className="text-muted-foreground hover:text-foreground"
            title="View transaction detail"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
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
          <TableCell />
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
  accounts: AccountSelectorRow[]
  defaultStartDate: string
  defaultEndDate: string
  initialAccountId?: number | null
}

export function TransactionHistoryClient({
  initialData,
  funds,
  accounts,
  defaultStartDate,
  defaultEndDate,
  initialAccountId,
}: TransactionHistoryClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [sourceType, setSourceType] = useState('')
  const [accountId, setAccountId] = useState<number | null>(initialAccountId ?? null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [memoSearch, setMemoSearch] = useState('')

  const fetchPage = useCallback(
    (page: number) => {
      startTransition(async () => {
        const result = await getTransactionHistoryData({
          startDate,
          endDate,
          sourceType: sourceType || undefined,
          accountId: accountId ?? undefined,
          fundId: fundId ?? undefined,
          memoSearch: memoSearch || undefined,
          page,
        })
        setData(result)
      })
    },
    [startDate, endDate, sourceType, accountId, fundId, memoSearch]
  )

  const handleApply = useCallback(() => fetchPage(1), [fetchPage])

  const TRANSACTION_HISTORY_CSV_COLUMNS: CSVColumnDef[] = [
    { key: 'date', label: 'Date', format: 'date' },
    { key: 'memo', label: 'Memo', format: 'text' },
    { key: 'source', label: 'Source', format: 'text' },
    { key: 'status', label: 'Status', format: 'text' },
    { key: 'account', label: 'Account', format: 'text' },
    { key: 'fund', label: 'Fund', format: 'text' },
    { key: 'debit', label: 'Debit', format: 'currency' },
    { key: 'credit', label: 'Credit', format: 'currency' },
  ]

  const exportData = data.rows.flatMap((r) =>
    r.lines.map((line, i) => ({
      date: i === 0 ? r.date : '',
      memo: i === 0 ? r.memo : '',
      source: i === 0 ? r.sourceType : '',
      status: i === 0 ? (r.isVoided ? 'VOIDED' : r.isReversed ? 'REVERSED' : 'Active') : '',
      account: `${line.accountCode} — ${line.accountName}`,
      fund: line.fundName,
      debit: line.debit || null,
      credit: line.credit || null,
    }))
  )

  return (
    <ReportShell
      title="Transaction History"
      generatedAt={data.generatedAt}
      reportSlug="transaction-history"
      exportData={exportData}
      csvColumns={TRANSACTION_HISTORY_CSV_COLUMNS}
      filters={{
        startDate,
        endDate,
        ...(sourceType ? { sourceType } : {}),
        ...(accountId ? { accountId: String(accountId) } : {}),
        ...(fundId ? { fundId: String(fundId) } : {}),
        ...(memoSearch ? { memoSearch } : {}),
      }}
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
            data-testid="transaction-history-start-date-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 h-8 text-sm"
            data-testid="transaction-history-end-date-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Source</Label>
          <Select value={sourceType} onValueChange={setSourceType}>
            <SelectTrigger className="w-36 h-8 text-sm" data-testid="transaction-history-source-select">
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
          <Label className="text-xs">Account</Label>
          <Select
            value={accountId ? String(accountId) : 'all'}
            onValueChange={(v) => setAccountId(v === 'all' ? null : Number(v))}
          >
            <SelectTrigger className="w-52 h-8 text-sm" data-testid="transaction-history-account-select">
              <SelectValue placeholder="All accounts" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All accounts</SelectItem>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>
                  {a.code} — {a.name}
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
            <SelectTrigger className="w-44 h-8 text-sm" data-testid="transaction-history-fund-select">
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
            data-testid="transaction-history-memo-search-input"
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
              <TableHead className="w-8" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
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
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(1)} disabled={data.page === 1 || isPending} data-testid="transaction-history-first-page-btn">
            <ChevronsLeft className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.page - 1)} disabled={data.page === 1 || isPending} data-testid="transaction-history-prev-page-btn">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm px-2 tabular-nums">{data.page} / {data.totalPages}</span>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.page + 1)} disabled={data.page === data.totalPages || isPending} data-testid="transaction-history-next-page-btn">
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="outline" className="h-8 w-8" onClick={() => fetchPage(data.totalPages)} disabled={data.page === data.totalPages || isPending} data-testid="transaction-history-last-page-btn">
            <ChevronsRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </ReportShell>
  )
}
