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
import type { DonorGivingHistoryData, DonorSummaryRow } from '@/lib/reports/donor-giving-history'
import { getDonorGivingHistoryData } from '../actions'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { ChevronDown, ChevronRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Typed CSV columns
// ---------------------------------------------------------------------------

const DONOR_GIVING_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'donor', label: 'Donor Name', format: 'text' },
  { key: 'type', label: 'Type', format: 'text' },
  { key: 'totalGiven', label: 'Total Given', format: 'currency' },
  { key: 'restricted', label: 'Restricted', format: 'currency' },
  { key: 'unrestricted', label: 'Unrestricted', format: 'currency' },
  { key: 'giftCount', label: 'Gift Count', format: 'count' },
  { key: 'firstGift', label: 'First Gift', format: 'date' },
  { key: 'lastGift', label: 'Last Gift', format: 'date' },
]

type FundRow = { id: number; name: string; restrictionType: string; isActive: boolean }

function DonorRow({ row }: { row: DonorSummaryRow }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-8">
          {row.giftCount > 0 ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : null}
        </TableCell>
        <TableCell className="font-medium text-sm">{row.donorName}</TableCell>
        <TableCell>
          <Badge variant="outline" className="text-xs">{row.donorType}</Badge>
        </TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(row.totalGiven)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(row.restrictedAmount)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(row.unrestrictedAmount)}</TableCell>
        <TableCell className="text-center tabular-nums">{row.giftCount}</TableCell>
        <TableCell className="text-sm">{row.lastGift ? formatDate(row.lastGift) : '—'}</TableCell>
      </TableRow>
      {isExpanded && row.gifts.map((gift) => (
        <TableRow key={`${gift.transactionId}-${gift.date}`} className="bg-muted/30">
          <TableCell />
          <TableCell className="text-xs" colSpan={2}>
            {formatDate(gift.date)} — {gift.memo}
          </TableCell>
          <TableCell className="text-right text-xs tabular-nums">
            {formatCurrency(gift.amount)}
          </TableCell>
          <TableCell className="text-xs">
            <Badge variant="outline" className="text-xs">
              {gift.restrictionType === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
            </Badge>
          </TableCell>
          <TableCell className="text-xs">{gift.fundName}</TableCell>
          <TableCell colSpan={2} />
        </TableRow>
      ))}
    </>
  )
}

interface DonorGivingHistoryClientProps {
  initialData: DonorGivingHistoryData
  funds: FundRow[]
  defaultStartDate: string
  defaultEndDate: string
}

export function DonorGivingHistoryClient({
  initialData,
  funds,
  defaultStartDate,
  defaultEndDate,
}: DonorGivingHistoryClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [fundId, setFundId] = useState<number | null>(null)

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getDonorGivingHistoryData({
        startDate,
        endDate,
        fundId: fundId ?? undefined,
      })
      setData(result)
    })
  }, [startDate, endDate, fundId])

  const exportData = data.rows.map((r) => ({
    donor: r.donorName,
    type: r.donorType,
    totalGiven: r.totalGiven,
    restricted: r.restrictedAmount,
    unrestricted: r.unrestrictedAmount,
    giftCount: r.giftCount,
    firstGift: r.firstGift ?? null,
    lastGift: r.lastGift ?? null,
  }))

  return (
    <ReportShell
      title="Donor Giving History"
      generatedAt={data.generatedAt}
      reportSlug="donor-giving-history"
      exportData={exportData}
      csvColumns={DONOR_GIVING_CSV_COLUMNS}
      filters={{ startDate, endDate, ...(fundId ? { fundId: String(fundId) } : {}) }}
    >
      <div className="flex flex-wrap items-end gap-3" data-testid="donor-giving-history-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-36 h-8 text-sm" data-testid="donor-giving-history-start-date-input" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-36 h-8 text-sm" data-testid="donor-giving-history-end-date-input" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fund</Label>
          <Select value={fundId ? String(fundId) : 'all'} onValueChange={(v) => setFundId(v === 'all' ? null : Number(v))}>
            <SelectTrigger className="w-44 h-8 text-sm" data-testid="donor-giving-history-fund-select"><SelectValue placeholder="All funds" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All funds</SelectItem>
              {funds.map((f) => (<SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="donor-giving-history-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="donor-giving-history-summary">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Donors</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{data.totalDonors}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Giving</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold">{formatCurrency(data.totalGiving)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Restricted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-blue-600">{formatCurrency(data.totalRestricted)}</div></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Unrestricted</CardTitle></CardHeader><CardContent><div className="text-2xl font-bold text-green-600">{formatCurrency(data.totalUnrestricted)}</div></CardContent></Card>
      </div>

      <div className="rounded-md border" data-testid="donor-giving-history-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Donor</TableHead>
              <TableHead>Type</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead className="text-right">Restricted</TableHead>
              <TableHead className="text-right">Unrestricted</TableHead>
              <TableHead className="text-center">Gifts</TableHead>
              <TableHead>Last Gift</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow><TableCell colSpan={8} className="h-24 text-center text-muted-foreground">No donors found.</TableCell></TableRow>
            ) : (
              data.rows.map((row) => <DonorRow key={row.donorId} row={row} />)
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell /><TableCell colSpan={2} className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(data.totalGiving)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(data.totalRestricted)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(data.totalUnrestricted)}</TableCell>
                <TableCell colSpan={2} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </ReportShell>
  )
}
