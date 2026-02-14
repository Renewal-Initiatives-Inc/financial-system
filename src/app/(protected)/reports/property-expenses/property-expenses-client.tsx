'use client'

import { useState, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import {
  getPropertyExpensesData,
  type PropertyExpensesData,
} from '@/lib/reports/property-expenses'

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

function buildExportData(
  data: PropertyExpensesData
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const row of data.rows) {
    out.push({
      Category: row.category,
      Actual: row.actual,
      Budget: row.budget,
      '$ Variance': row.variance?.dollarVariance ?? null,
      '% Variance': row.variance?.percentVariance ?? null,
    })
  }
  out.push({
    Category: 'TOTAL',
    Actual: data.total.actual,
    Budget: data.total.budget,
    '$ Variance': null,
    '% Variance': null,
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
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await getPropertyExpensesData({ startDate, endDate, fundId })
      setData(result)
    })
  }

  const exportData = buildExportData(data)
  const exportColumns = [
    'Category',
    'Actual',
    'Budget',
    '$ Variance',
    '% Variance',
  ]

  const hasBudget = data.total.budget !== null

  return (
    <ReportShell
      title="Property Operating Expense Breakdown"
      fundName={data.fundName}
      reportSlug="property-expenses"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      <p className="text-sm text-muted-foreground -mt-4">
        {formatDate(data.startDate)} &mdash; {formatDate(data.endDate)}
      </p>

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
        showFundSelector
      />

      {isPending && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Loading report data...
        </div>
      )}

      {/* Property expense table */}
      <div
        className="border rounded-lg overflow-hidden"
        data-testid="property-expenses-table"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left py-2 px-4 font-medium">Category</th>
              <th className="text-right py-2 px-4 font-medium w-36">Actual</th>
              {hasBudget && (
                <th className="text-right py-2 px-4 font-medium w-36">Budget</th>
              )}
              {hasBudget && (
                <th className="text-right py-2 px-4 font-medium w-40">
                  $ Variance
                </th>
              )}
              {hasBudget && (
                <th className="text-right py-2 px-4 font-medium w-32">
                  % Variance
                </th>
              )}
            </tr>
          </thead>
          <tbody>
            {data.rows.map((row, i) => (
              <tr
                key={row.category}
                className="border-b last:border-b-0 transition-colors"
              >
                <td className="py-2 px-4">{row.category}</td>
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {formatCurrency(row.actual)}
                </td>
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
                    {row.variance?.percentVariance !== null &&
                    row.variance?.percentVariance !== undefined ? (
                      <span
                        className={cn(
                          row.variance.severity === 'critical' &&
                            'text-red-700 font-semibold',
                          row.variance.severity === 'warning' &&
                            'text-yellow-700',
                          row.variance.severity === 'normal' &&
                            'text-green-700'
                        )}
                      >
                        {row.variance.percentVariance >= 0 ? '+' : ''}
                        {row.variance.percentVariance.toFixed(1)}%
                      </span>
                    ) : (
                      <span className="text-muted-foreground">N/A</span>
                    )}
                  </td>
                )}
              </tr>
            ))}

            {/* Total row */}
            <tr
              className="font-bold border-t-2 border-t-foreground/20 bg-muted/20"
              data-testid="property-expenses-total"
            >
              <td className="py-2 px-4">TOTAL</td>
              <td className="py-2 px-4 text-right font-mono text-sm">
                {formatCurrency(data.total.actual)}
              </td>
              {hasBudget && (
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {data.total.budget !== null
                    ? formatCurrency(data.total.budget)
                    : '---'}
                </td>
              )}
              {hasBudget && (
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {data.total.budget !== null
                    ? formatCurrency(data.total.actual - data.total.budget)
                    : '---'}
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
    </ReportShell>
  )
}
