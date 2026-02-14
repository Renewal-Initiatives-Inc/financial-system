'use client'

import { cn } from '@/lib/utils'
import { formatCurrency, formatPercent } from '@/lib/reports/types'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import { calculateVariance } from '@/lib/budget/variance'

export interface ReportRow {
  id?: string | number
  label: string
  indent?: number
  isSectionHeader?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
  currentPeriod?: number
  yearToDate?: number
  budget?: number | null
  isClickable?: boolean
  accountId?: number
  fundId?: number
}

interface ReportTableProps {
  rows: ReportRow[]
  showBudgetColumn?: boolean
  showVarianceColumn?: boolean
  showCurrentPeriodColumn?: boolean
  onRowClick?: (row: ReportRow) => void
  testIdPrefix?: string
}

export function ReportTable({
  rows,
  showBudgetColumn = true,
  showVarianceColumn = true,
  showCurrentPeriodColumn = true,
  onRowClick,
  testIdPrefix = 'report-table',
}: ReportTableProps) {
  return (
    <div className="border rounded-lg overflow-hidden" data-testid={testIdPrefix}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left py-2 px-4 font-medium">Account</th>
            {showCurrentPeriodColumn && (
              <th className="text-right py-2 px-4 font-medium w-36">Current Period</th>
            )}
            <th className="text-right py-2 px-4 font-medium w-36">Year-to-Date</th>
            {showBudgetColumn && (
              <th className="text-right py-2 px-4 font-medium w-36">Budget</th>
            )}
            {showVarianceColumn && showBudgetColumn && (
              <th className="text-right py-2 px-4 font-medium w-40">Variance</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const variance =
              row.yearToDate !== undefined && row.budget != null
                ? calculateVariance(row.yearToDate, row.budget)
                : null

            if (row.isSectionHeader) {
              return (
                <tr key={i} className="bg-muted/30">
                  <td
                    colSpan={5}
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
                  row.isTotal && 'font-bold border-t-2 border-t-foreground/20 bg-muted/20',
                  row.isSubtotal && 'font-semibold border-t',
                  row.isClickable && onRowClick && 'cursor-pointer hover:bg-muted/50'
                )}
                onClick={() => row.isClickable && onRowClick?.(row)}
                data-testid={row.isTotal ? `${testIdPrefix}-total` : undefined}
              >
                <td
                  className="py-2 px-4"
                  style={{ paddingLeft: row.indent ? `${1 + row.indent * 1.5}rem` : undefined }}
                >
                  {row.label}
                </td>
                {showCurrentPeriodColumn && (
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {row.currentPeriod !== undefined ? formatCurrency(row.currentPeriod) : ''}
                  </td>
                )}
                <td className="py-2 px-4 text-right font-mono text-sm">
                  {row.yearToDate !== undefined ? formatCurrency(row.yearToDate) : ''}
                </td>
                {showBudgetColumn && (
                  <td className="py-2 px-4 text-right font-mono text-sm">
                    {row.budget != null ? formatCurrency(row.budget) : '—'}
                  </td>
                )}
                {showVarianceColumn && showBudgetColumn && (
                  <td className="py-2 px-4 text-right">
                    {variance ? (
                      <VarianceIndicator
                        dollarVariance={variance.dollarVariance}
                        percentVariance={variance.percentVariance}
                        severity={variance.severity}
                        testId={`${testIdPrefix}-variance-${i}`}
                      />
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                )}
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
