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
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportShell } from '@/components/reports/report-shell'
import type { CapitalBudgetData, CapitalBudgetRow } from '@/lib/reports/capital-budget'
import { getCapitalBudgetData } from '../actions'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { formatCurrency, formatPercent } from '@/lib/reports/types'
import { ChevronDown, ChevronRight } from 'lucide-react'

type FundRow = { id: number; name: string; restrictionType: string; isActive: boolean }

function CapitalRow({ row }: { row: CapitalBudgetRow }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <TableRow
        className={`${row.costCodes.length > 0 ? 'cursor-pointer hover:bg-muted/50' : ''}`}
        onClick={() => row.costCodes.length > 0 && setIsExpanded(!isExpanded)}
      >
        <TableCell className="w-8">
          {row.costCodes.length > 0 ? (
            isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />
          ) : null}
        </TableCell>
        <TableCell className="font-mono text-sm">{row.accountCode}</TableCell>
        <TableCell className="font-medium text-sm">{row.accountName}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(row.budget)}</TableCell>
        <TableCell className="text-right tabular-nums">{formatCurrency(row.actual)}</TableCell>
        <TableCell className={`text-right tabular-nums ${row.variance < 0 ? 'text-red-600' : 'text-green-600'}`}>
          {formatCurrency(row.variance)}
        </TableCell>
        <TableCell className={`text-right tabular-nums ${row.variancePercent !== null && row.variancePercent < 0 ? 'text-red-600' : ''}`}>
          {row.variancePercent !== null ? formatPercent(row.variancePercent) : '—'}
        </TableCell>
      </TableRow>
      {isExpanded && row.costCodes.map((cc) => (
        <TableRow key={cc.costCodeId} className="bg-muted/30">
          <TableCell />
          <TableCell className="text-xs font-mono pl-6">{cc.costCode}</TableCell>
          <TableCell className="text-xs">{cc.costCodeName}</TableCell>
          <TableCell />
          <TableCell className="text-right text-xs tabular-nums">{formatCurrency(cc.actual)}</TableCell>
          <TableCell colSpan={2} />
        </TableRow>
      ))}
    </>
  )
}

interface CapitalBudgetClientProps {
  initialData: CapitalBudgetData
  funds: FundRow[]
  defaultYear: number
}

export function CapitalBudgetClient({ initialData, funds, defaultYear }: CapitalBudgetClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [year, setYear] = useState(String(defaultYear))
  const [fundId, setFundId] = useState<number | null>(null)

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getCapitalBudgetData({
        year: Number(year),
        fundId: fundId ?? undefined,
      })
      setData(result)
    })
  }, [year, fundId])

  const CAPITAL_BUDGET_CSV_COLUMNS: CSVColumnDef[] = [
    { key: 'accountCode', label: 'Account Code', format: 'text' },
    { key: 'account', label: 'Account', format: 'text' },
    { key: 'budget', label: 'Budget', format: 'currency' },
    { key: 'actual', label: 'Actual', format: 'currency' },
    { key: 'variance', label: 'Variance', format: 'currency' },
    { key: 'variancePercent', label: 'Variance %', format: 'percent' },
  ]

  const exportData = data.rows.map((r) => ({
    accountCode: r.accountCode,
    account: r.accountName,
    budget: r.budget,
    actual: r.actual,
    variance: r.variance,
    variancePercent: r.variancePercent,
  }))

  return (
    <ReportShell
      title="Capital & Financing Budget Summary"
      generatedAt={data.generatedAt}
      fundName={data.fundName}
      reportSlug="capital-budget"
      exportData={exportData}
      csvColumns={CAPITAL_BUDGET_CSV_COLUMNS}
      filters={{ year, ...(fundId ? { fundId: String(fundId) } : {}) }}
    >
      <div className="flex flex-wrap items-end gap-3" data-testid="capital-budget-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Fiscal Year</Label>
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-28 h-8 text-sm" data-testid="capital-budget-year-input">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 5 }, (_, i) => {
                const y = String(new Date().getFullYear() - 2 + i)
                return <SelectItem key={y} value={y}>{y}</SelectItem>
              })}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Fund</Label>
          <Select value={fundId ? String(fundId) : 'all'} onValueChange={(v) => setFundId(v === 'all' ? null : Number(v))}>
            <SelectTrigger className="w-44 h-8 text-sm" data-testid="capital-budget-fund-select"><SelectValue placeholder="All funds" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All funds</SelectItem>
              {funds.map((f) => (<SelectItem key={f.id} value={String(f.id)}>{f.name}</SelectItem>))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="capital-budget-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      <div className="rounded-md border" data-testid="capital-budget-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
              <TableHead className="text-right">Var %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="h-24 text-center text-muted-foreground">No capital accounts found.</TableCell></TableRow>
            ) : (
              data.rows.map((row) => <CapitalRow key={row.accountId} row={row} />)
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell /><TableCell colSpan={2} className="font-semibold">Total</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(data.totalBudget)}</TableCell>
                <TableCell className="text-right font-semibold">{formatCurrency(data.totalActual)}</TableCell>
                <TableCell className={`text-right font-semibold ${data.totalVariance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {formatCurrency(data.totalVariance)}
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
