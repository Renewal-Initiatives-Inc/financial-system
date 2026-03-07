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
} from '@/lib/reports/functional-expenses'
import { getFunctionalExpensesData } from '../actions'

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
// CSV export helper
// ---------------------------------------------------------------------------

function buildExportData(
  rows: FunctionalExpenseRow[],
  totals: FunctionalExpensesData['totals']
): Record<string, unknown>[] {
  const result: Record<string, unknown>[] = []

  for (const row of rows) {
    if (row.isGroupHeader) continue
    result.push({
      Account: row.label,
      Total: formatCurrency(row.total),
      Program: formatCurrency(row.program),
      'Management & General': formatCurrency(row.admin),
      Fundraising: formatCurrency(row.fundraising),
      Unallocated: formatCurrency(row.unallocated),
    })
  }

  result.push({
    Account: 'GRAND TOTAL',
    Total: formatCurrency(totals.total),
    Program: formatCurrency(totals.program),
    'Management & General': formatCurrency(totals.admin),
    Fundraising: formatCurrency(totals.fundraising),
    Unallocated: formatCurrency(totals.unallocated),
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
  const [startDate, setStartDate] = useState(initialData.startDate)
  const [endDate, setEndDate] = useState(initialData.endDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [format, setFormat] = useState<FunctionalExpenseFormat>(
    initialData.format
  )
  const [isPending, startTransition] = useTransition()

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getFunctionalExpensesData({
        startDate,
        endDate,
        fundId: fundId ?? undefined,
        format,
      })
      setData(result)
    })
  }, [startDate, endDate, fundId, format])

  const handleFormatChange = useCallback(
    (value: string) => {
      const newFormat = value as FunctionalExpenseFormat
      setFormat(newFormat)
      startTransition(async () => {
        const result = await getFunctionalExpensesData({
          startDate,
          endDate,
          fundId: fundId ?? undefined,
          format: newFormat,
        })
        setData(result)
      })
    },
    [startDate, endDate, fundId]
  )

  const exportData = buildExportData(data.rows, data.totals)

  return (
    <ReportShell
      title="Statement of Functional Expenses"
      fundName={data.fundName}
      reportSlug="functional-expenses"
      exportData={exportData}
      exportColumns={[
        'Account',
        'Total',
        'Program',
        'Management & General',
        'Fundraising',
        'Unallocated',
      ]}
    >
      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-4">
        {formatDate(data.startDate)} &mdash; {formatDate(data.endDate)}
      </p>

      {/* Filter bar */}
      <ReportFilterBar
        funds={funds}
        startDate={startDate}
        endDate={endDate}
        fundId={fundId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFundChange={setFundId}
        onApply={handleApply}
        showPeriodSelector={false}
      />

      {/* GAAP / 990 toggle */}
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-muted-foreground">
          Format:
        </span>
        <Tabs value={format} onValueChange={handleFormatChange}>
          <TabsList>
            <TabsTrigger value="gaap" data-testid="format-gaap">
              GAAP
            </TabsTrigger>
            <TabsTrigger value="990" data-testid="format-990">
              Form 990
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Unallocated warning */}
      {data.hasUnallocated && (
        <div
          className="flex items-start gap-3 rounded-md border border-blue-200 bg-blue-50 p-4 dark:border-blue-800 dark:bg-blue-950/30"
          data-testid="unallocated-alert"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Some expenses have not been allocated. Use the Functional Allocation
            wizard (Settings) to assign allocations.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Loading...
        </div>
      )}

      {/* Matrix table */}
      {!isPending && (
        <div
          className="border rounded-lg overflow-hidden"
          data-testid="functional-expenses-table"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b">
                <th className="text-left py-2 px-4 font-medium">Account</th>
                <th className="text-right py-2 px-4 font-medium w-28">
                  Total
                </th>
                <th className="text-right py-2 px-4 font-medium w-28">
                  Program
                </th>
                <th className="text-right py-2 px-4 font-medium w-28">
                  M&amp;G
                </th>
                <th className="text-right py-2 px-4 font-medium w-28">
                  Fundraising
                </th>
                <th className="text-right py-2 px-4 font-medium w-28">
                  Unallocated
                </th>
              </tr>
            </thead>
            <tbody>
              {data.rows.length === 0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No expense data for the selected period.
                  </td>
                </tr>
              )}
              {data.rows.map((row, i) => {
                if (row.isGroupHeader) {
                  return (
                    <tr key={i} className="bg-muted/30">
                      <td
                        colSpan={6}
                        className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground"
                      >
                        {row.label}
                      </td>
                    </tr>
                  )
                }

                return (
                  <tr
                    key={i}
                    className={cn(
                      'border-b last:border-b-0 transition-colors',
                      row.isTotal &&
                        'font-semibold border-t bg-muted/20'
                    )}
                  >
                    <td
                      className={cn(
                        'py-2 px-4',
                        !row.isTotal && 'pl-8'
                      )}
                    >
                      {row.label}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-sm">
                      {formatCurrency(row.total)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-sm">
                      {formatCurrency(row.program)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-sm">
                      {formatCurrency(row.admin)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-sm">
                      {formatCurrency(row.fundraising)}
                    </td>
                    <td className="py-2 px-4 text-right font-mono text-sm">
                      {row.unallocated !== 0
                        ? formatCurrency(row.unallocated)
                        : '\u2014'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
            {data.rows.length > 0 && (
              <tfoot>
                <tr
                  className="font-bold border-t-2 border-t-foreground/20 bg-muted/20"
                  data-testid="functional-expenses-grand-total"
                >
                  <td className="py-2 px-4">TOTAL EXPENSES</td>
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {formatCurrency(data.totals.total)}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {formatCurrency(data.totals.program)}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {formatCurrency(data.totals.admin)}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {formatCurrency(data.totals.fundraising)}
                  </td>
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {data.totals.unallocated !== 0
                      ? formatCurrency(data.totals.unallocated)
                      : '\u2014'}
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      )}
    </ReportShell>
  )
}
