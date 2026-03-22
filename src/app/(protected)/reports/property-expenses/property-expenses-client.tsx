'use client'

import { useState, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { MultiPeriodReportTable, type MultiPeriodReportRow } from '@/components/reports/multi-period-report-table'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import type { PropertyExpensesData, MultiPeriodPropertyExpensesData } from '@/lib/reports/property-expenses'
import { getPropertyExpensesServerData, getMultiPeriodPropertyExpensesData } from '../actions'
import type { PeriodType } from '@/lib/reports/types'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface PropertyExpensesClientProps {
  initialData: PropertyExpensesData
  funds: FundRow[]
  defaultStartDate: string
  defaultEndDate: string
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const PROPERTY_EXPENSES_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'category', label: 'Category', format: 'text' },
  { key: 'actual', label: 'Actual', format: 'currency' },
  { key: 'budget', label: 'Budget', format: 'currency' },
  { key: 'dollarVariance', label: '$ Variance', format: 'currency' },
  { key: 'percentVariance', label: '% Variance', format: 'percent' },
]

function buildExportData(data: PropertyExpensesData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const row of data.rows) {
    out.push({
      category: row.category,
      actual: row.actual,
      budget: row.budget,
      dollarVariance: row.variance?.dollarVariance ?? null,
      percentVariance: row.variance?.percentVariance ?? null,
    })
  }
  out.push({
    category: 'TOTAL',
    actual: data.total.actual,
    budget: data.total.budget,
    dollarVariance: null,
    percentVariance: null,
  })
  return out
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PropertyExpensesClient({
  initialData,
  funds,
  defaultStartDate,
  defaultEndDate,
}: PropertyExpensesClientProps) {
  const [data, setData] = useState<PropertyExpensesData>(initialData)
  const [multiData, setMultiData] = useState<MultiPeriodPropertyExpensesData | null>(null)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [periodType, setPeriodType] = useState<PeriodType>('ytd')
  const [isPending, startTransition] = useTransition()

  const isMultiPeriod = periodType !== 'ytd'

  function handleApply() {
    startTransition(async () => {
      if (periodType === 'ytd') {
        const result = await getPropertyExpensesServerData({ startDate, endDate, fundId })
        setData(result)
        setMultiData(null)
      } else {
        const result = await getMultiPeriodPropertyExpensesData({ startDate, endDate, fundId, periodType })
        setMultiData(result)
      }
    })
  }

  const exportData = buildExportData(data)
  const hasBudget = data.total.budget !== null

  return (
    <ReportShell
      title="Property Operating Expense Breakdown"
      fundName={(isMultiPeriod ? multiData?.fundName : data.fundName) ?? undefined}
      reportSlug="property-expenses"
      exportData={exportData}
      csvColumns={PROPERTY_EXPENSES_CSV_COLUMNS}
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
        showFundSelector
      />

      {isPending && (
        <div className="text-center py-4 text-sm text-muted-foreground">Loading report data...</div>
      )}

      {!isPending && isMultiPeriod && multiData ? (
        <MultiPeriodPropertyTable data={multiData} />
      ) : !isPending && !isMultiPeriod ? (
        <YtdPropertyTable data={data} hasBudget={hasBudget} />
      ) : null}
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// YTD table (existing)
// ---------------------------------------------------------------------------

function YtdPropertyTable({ data, hasBudget }: { data: PropertyExpensesData; hasBudget: boolean }) {
  return (
    <div className="border rounded-lg overflow-hidden" data-testid="property-expenses-table">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left py-2 px-4 font-medium">Category</th>
            <th className="text-right py-2 px-4 font-medium w-36">Actual</th>
            {hasBudget && <th className="text-right py-2 px-4 font-medium w-36">Budget</th>}
            {hasBudget && <th className="text-right py-2 px-4 font-medium w-40">$ Variance</th>}
            {hasBudget && <th className="text-right py-2 px-4 font-medium w-32">% Variance</th>}
          </tr>
        </thead>
        <tbody>
          {data.rows.map((row, i) => (
            <tr key={row.category} className="border-b last:border-b-0 transition-colors">
              <td className="py-2 px-4">{row.category}</td>
              <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(row.actual)}</td>
              {hasBudget && (
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {row.budget !== null ? formatCurrency(row.budget) : '---'}
                </td>
              )}
              {hasBudget && (
                <td className="py-2 px-4 text-right">
                  {row.variance ? (
                    <VarianceIndicator
                      dollarVariance={row.variance.dollarVariance}
                      percentVariance={row.variance.percentVariance}
                      severity={row.variance.severity}
                      testId={`property-variance-${i}`}
                    />
                  ) : (
                    <span className="text-muted-foreground">---</span>
                  )}
                </td>
              )}
              {hasBudget && (
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {row.variance?.percentVariance != null ? (
                    <span className={cn(
                      row.variance.severity === 'critical' && 'text-red-700 font-semibold',
                      row.variance.severity === 'warning' && 'text-yellow-700',
                      row.variance.severity === 'normal' && 'text-green-700',
                    )}>
                      {row.variance.percentVariance >= 0 ? '+' : ''}{row.variance.percentVariance.toFixed(1)}%
                    </span>
                  ) : (
                    <span className="text-muted-foreground">N/A</span>
                  )}
                </td>
              )}
            </tr>
          ))}
          <tr className="font-bold border-t-2 border-t-foreground/20 bg-muted/20" data-testid="property-expenses-total">
            <td className="py-2 px-4">TOTAL</td>
            <td className="py-2 px-4 text-right font-mono text-sm">{formatCurrency(data.total.actual)}</td>
            {hasBudget && (
              <td className="py-2 px-4 text-right font-mono text-sm">
                {data.total.budget !== null ? formatCurrency(data.total.budget) : '---'}
              </td>
            )}
            {hasBudget && (
              <td className="py-2 px-4 text-right font-mono text-sm">
                {data.total.budget !== null ? formatCurrency(data.total.actual - data.total.budget) : '---'}
              </td>
            )}
            {hasBudget && (
              <td className="py-2 px-4 text-right font-mono text-sm">
                {data.total.budget !== null && data.total.budget !== 0
                  ? `${(((data.total.actual - data.total.budget) / data.total.budget) * 100).toFixed(1)}%`
                  : 'N/A'}
              </td>
            )}
          </tr>
        </tbody>
      </table>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-period table
// ---------------------------------------------------------------------------

function MultiPeriodPropertyTable({ data }: { data: MultiPeriodPropertyExpensesData }) {
  const rows: MultiPeriodReportRow[] = data.rows.map((row) => ({
    label: row.category,
    periodValues: row.periodValues,
    total: row.total,
  }))

  rows.push({
    label: 'TOTAL',
    isTotal: true,
    periodValues: data.totalValues,
    total: data.grandTotal,
  })

  return (
    <MultiPeriodReportTable
      rows={rows}
      periodLabels={data.periodColumns.map((c) => c.label)}
      showBudgetColumn={false}
      showVarianceColumn={false}
      testIdPrefix="property-expenses-table"
    />
  )
}
