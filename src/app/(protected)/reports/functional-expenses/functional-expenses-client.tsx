'use client'

import { useState, useCallback, useTransition } from 'react'
import { Info } from 'lucide-react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import type {
  FunctionalExpensesData,
  FunctionalExpenseFormat,
  FunctionalExpenseRow,
  MultiPeriodFunctionalExpensesData,
} from '@/lib/reports/functional-expenses'
import { getFunctionalExpensesData, getMultiPeriodFunctionalExpensesData } from '../actions'
import type { PeriodType } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'

const FUNC_EXP_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'account', label: 'Account', format: 'text' },
  { key: 'total', label: 'Total', format: 'currency' },
  { key: 'program', label: 'Program', format: 'currency' },
  { key: 'admin', label: 'Management & General', format: 'currency' },
  { key: 'fundraising', label: 'Fundraising', format: 'currency' },
  { key: 'unallocated', label: 'Unallocated', format: 'currency' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface FunctionalExpensesClientProps {
  initialData: FunctionalExpensesData
  funds: FundRow[]
}

// ---------------------------------------------------------------------------
// CSV export helpers
// ---------------------------------------------------------------------------

function buildExportData(
  rows: FunctionalExpenseRow[],
  totals: FunctionalExpensesData['totals']
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []

  for (const row of rows) {
    if (row.isGroupHeader) continue
    result.push({
      account: row.label,
      total: row.total,
      program: row.program,
      admin: row.admin,
      fundraising: row.fundraising,
      unallocated: row.unallocated,
    })
  }

  result.push({
    account: 'GRAND TOTAL',
    total: totals.total,
    program: totals.program,
    admin: totals.admin,
    fundraising: totals.fundraising,
    unallocated: totals.unallocated,
  })

  return result
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FunctionalExpensesClient({
  initialData,
  funds,
}: FunctionalExpensesClientProps) {
  const [data, setData] = useState<FunctionalExpensesData>(initialData)
  const [multiData, setMultiData] = useState<MultiPeriodFunctionalExpensesData | null>(null)
  const [startDate, setStartDate] = useState(initialData.startDate)
  const [endDate, setEndDate] = useState(initialData.endDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [format, setFormat] = useState<FunctionalExpenseFormat>(initialData.format)
  const [periodType, setPeriodType] = useState<PeriodType>('ytd')
  const [isPending, startTransition] = useTransition()

  const isMultiPeriod = periodType !== 'ytd'

  const handleApply = useCallback(() => {
    startTransition(async () => {
      if (periodType === 'ytd') {
        const result = await getFunctionalExpensesData({
          startDate, endDate, fundId: fundId ?? undefined, format,
        })
        setData(result)
        setMultiData(null)
      } else {
        const result = await getMultiPeriodFunctionalExpensesData({
          startDate, endDate, fundId: fundId ?? undefined, format, periodType,
        })
        setMultiData(result)
      }
    })
  }, [startDate, endDate, fundId, format, periodType])

  const handleFormatChange = useCallback(
    (value: string) => {
      const newFormat = value as FunctionalExpenseFormat
      setFormat(newFormat)
      startTransition(async () => {
        if (periodType === 'ytd') {
          const result = await getFunctionalExpensesData({
            startDate, endDate, fundId: fundId ?? undefined, format: newFormat,
          })
          setData(result)
        } else {
          const result = await getMultiPeriodFunctionalExpensesData({
            startDate, endDate, fundId: fundId ?? undefined, format: newFormat, periodType,
          })
          setMultiData(result)
        }
      })
    },
    [startDate, endDate, fundId, periodType]
  )

  const hasUnallocated = isMultiPeriod ? multiData?.hasUnallocated : data.hasUnallocated
  const exportData = buildExportData(data.rows, data.totals)

  return (
    <ReportShell
      title="Statement of Functional Expenses"
      fundName={(isMultiPeriod ? multiData?.fundName : data.fundName) ?? undefined}
      reportSlug="functional-expenses"
      exportData={exportData}
      csvColumns={FUNC_EXP_CSV_COLUMNS}
      filters={{ startDate, endDate, ...(fundId ? { fundId: String(fundId) } : {}) }}
    >
      <p className="text-sm text-muted-foreground -mt-4">
        {formatDate(startDate)} &mdash; {formatDate(endDate)}
      </p>

      <ReportFilterBar
        funds={funds}
        startDate={startDate}
        endDate={endDate}
        fundId={fundId}
        periodType={periodType}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFundChange={setFundId}
        onPeriodTypeChange={setPeriodType}
        onApply={handleApply}
        showPeriodSelector
      />

      {/* GAAP / 990 toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">Format:</span>
        <Tabs value={format} onValueChange={handleFormatChange}>
          <TabsList>
            <TabsTrigger value="gaap" data-testid="format-gaap">GAAP</TabsTrigger>
            <TabsTrigger value="990" data-testid="format-990">Form 990</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {hasUnallocated && (
        <div
          className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30"
          data-testid="unallocated-alert"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Some expenses have not been allocated. Use the Functional Allocation wizard (Settings) to assign allocations.
          </p>
        </div>
      )}

      {isPending && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">Loading...</div>
      )}

      {!isPending && isMultiPeriod && multiData ? (
        <MultiPeriodFunctionalTable data={multiData} />
      ) : !isPending && !isMultiPeriod ? (
        <YtdFunctionalTable data={data} />
      ) : null}
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// YTD table (existing)
// ---------------------------------------------------------------------------

function YtdFunctionalTable({ data }: { data: FunctionalExpensesData }) {
  return (
    <div className="border rounded-lg overflow-hidden" data-testid="functional-expenses-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left py-2 px-4 font-medium">Account</th>
            <th className="text-right py-2 px-4 font-medium w-28">Total</th>
            <th className="text-right py-2 px-4 font-medium w-28">Program</th>
            <th className="text-right py-2 px-4 font-medium w-28">M&amp;G</th>
            <th className="text-right py-2 px-4 font-medium w-28">Fundraising</th>
            <th className="text-right py-2 px-4 font-medium w-28">Unallocated</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.length === 0 && (
            <tr><td colSpan={6} className="h-24 text-center text-muted-foreground">No expense data for the selected period.</td></tr>
          )}
          {data.rows.map((row, i) => {
            if (row.isGroupHeader) {
              return (
                <tr key={i} className="bg-muted/30">
                  <td colSpan={6} className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">{row.label}</td>
                </tr>
              )
            }
            return (
              <tr key={i} className={cn('border-b last:border-b-0', row.isTotal && 'font-semibold border-t bg-muted/20')}>
                <td className={cn('py-2 px-4', !row.isTotal && 'pl-8')}>{row.label}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(row.total)}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(row.program)}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(row.admin)}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(row.fundraising)}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">{row.unallocated !== 0 ? formatCurrency(row.unallocated) : '\u2014'}</td>
              </tr>
            )
          })}
        </tbody>
        {data.rows.length > 0 && (
          <tfoot>
            <tr className="font-bold border-t-2 border-t-foreground/20 bg-muted/20" data-testid="functional-expenses-grand-total">
              <td className="py-2 px-4">TOTAL EXPENSES</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(data.totals.total)}</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(data.totals.program)}</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(data.totals.admin)}</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(data.totals.fundraising)}</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{data.totals.unallocated !== 0 ? formatCurrency(data.totals.unallocated) : '\u2014'}</td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-period table — period columns show total per period,
// then Total + Program/Admin/Fundraising/Unallocated summary columns
// ---------------------------------------------------------------------------

function MultiPeriodFunctionalTable({ data }: { data: MultiPeriodFunctionalExpensesData }) {
  return (
    <div className="border rounded-lg overflow-x-auto" data-testid="functional-expenses-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left py-2 px-4 font-medium sticky left-0 bg-muted/50 min-w-[200px]">Account</th>
            {data.periodColumns.map((col) => (
              <th key={col.label} className="text-right py-2 px-3 font-medium whitespace-nowrap min-w-[90px]">{col.label}</th>
            ))}
            <th className="text-right py-2 px-3 font-medium min-w-[100px] border-l">Total</th>
            <th className="text-right py-2 px-3 font-medium min-w-[90px]">Program</th>
            <th className="text-right py-2 px-3 font-medium min-w-[90px]">M&amp;G</th>
            <th className="text-right py-2 px-3 font-medium min-w-[90px]">Fundrais.</th>
            <th className="text-right py-2 px-3 font-medium min-w-[90px]">Unalloc.</th>
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => {
            if (row.isGroupHeader) {
              const colSpan = data.periodColumns.length + 6
              return (
                <tr key={i} className="bg-muted/30">
                  <td colSpan={colSpan} className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground">{row.label}</td>
                </tr>
              )
            }
            return (
              <tr key={i} className={cn('border-b last:border-b-0', row.isTotal && 'font-semibold border-t bg-muted/20')}>
                <td className={cn('py-2 px-4 sticky left-0 bg-background', !row.isTotal && 'pl-8')}>{row.label}</td>
                {row.periodValues.map((val, p) => (
                  <td key={p} className="py-2 px-3 text-right font-mono text-sm whitespace-nowrap">{formatCurrency(val)}</td>
                ))}
                <td className="py-2 px-3 text-right font-mono text-sm border-l">{formatCurrency(row.total)}</td>
                <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(row.programTotal)}</td>
                <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(row.adminTotal)}</td>
                <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(row.fundraisingTotal)}</td>
                <td className="py-2 px-3 text-right font-mono text-sm">{row.unallocatedTotal !== 0 ? formatCurrency(row.unallocatedTotal) : '\u2014'}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="font-bold border-t-2 border-t-foreground/20 bg-muted/20" data-testid="functional-expenses-grand-total">
            <td className="py-2 px-4 sticky left-0 bg-muted/20">TOTAL EXPENSES</td>
            {data.totals.periodValues.map((val, p) => (
              <td key={p} className="py-2 px-3 text-right font-mono text-sm whitespace-nowrap">{formatCurrency(val)}</td>
            ))}
            <td className="py-2 px-3 text-right font-mono text-sm border-l">{formatCurrency(data.totals.total)}</td>
            <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(data.totals.programTotal)}</td>
            <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(data.totals.adminTotal)}</td>
            <td className="py-2 px-3 text-right font-mono text-sm">{formatCurrency(data.totals.fundraisingTotal)}</td>
            <td className="py-2 px-3 text-right font-mono text-sm">{data.totals.unallocatedTotal !== 0 ? formatCurrency(data.totals.unallocatedTotal) : '\u2014'}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
