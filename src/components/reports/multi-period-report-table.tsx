'use client'

import { cn } from '@/lib/utils'
import { formatCurrency } from '@/lib/reports/types'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import { calculateVariance } from '@/lib/budget/variance'

export interface MultiPeriodReportRow {
  id?: string | number
  label: string
  indent?: number
  isSectionHeader?: boolean
  isSubtotal?: boolean
  isTotal?: boolean
  /** One value per period column */
  periodValues?: number[]
  /** Summary total across all periods */
  total?: number
  budget?: number | null
}

interface MultiPeriodReportTableProps {
  rows: MultiPeriodReportRow[]
  periodLabels: string[]
  showBudgetColumn?: boolean
  showVarianceColumn?: boolean
  testIdPrefix?: string
}

export function MultiPeriodReportTable({
  rows,
  periodLabels,
  showBudgetColumn = true,
  showVarianceColumn = true,
  testIdPrefix = 'report-table',
}: MultiPeriodReportTableProps) {
  return (
    <div className="border rounded-lg overflow-x-auto" data-testid={testIdPrefix}>
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted/50 border-b">
            <th className="text-left py-2 px-4 font-medium sticky left-0 bg-muted/50 min-w-[200px]">
              Account
            </th>
            {periodLabels.map((label) => (
              <th key={label} className="text-right py-2 px-3 font-medium whitespace-nowrap min-w-[100px]">
                {label}
              </th>
            ))}
            <th className="text-right py-2 px-4 font-medium min-w-[110px] border-l">Total</th>
            {showBudgetColumn && (
              <th className="text-right py-2 px-4 font-medium min-w-[110px]">Budget</th>
            )}
            {showVarianceColumn && showBudgetColumn && (
              <th className="text-right py-2 px-4 font-medium min-w-[130px]">Variance</th>
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const variance =
              row.total !== undefined && row.budget != null
                ? calculateVariance(row.total, row.budget)
                : null

            if (row.isSectionHeader) {
              const colSpan = periodLabels.length + 2 + (showBudgetColumn ? 1 : 0) + (showVarianceColumn && showBudgetColumn ? 1 : 0)
              return (
                <tr key={i} className="bg-muted/30">
                  <td
                    colSpan={colSpan}
                    className="py-2 px-4 font-bold text-xs uppercase tracking-wider text-muted-foreground"
                  >
                    {row.label}
                  </td>
                </tr>
              )
            }

            // Empty spacer row
            if (!row.label && !row.periodValues) {
              return <tr key={i}><td className="py-1" /></tr>
            }

            return (
              <tr
                key={i}
                className={cn(
                  'border-b last:border-b-0 transition-colors',
                  row.isTotal && 'font-bold border-t-2 border-t-foreground/20 bg-muted/20',
                  row.isSubtotal && 'font-semibold border-t',
                )}
                data-testid={row.isTotal ? `${testIdPrefix}-total` : undefined}
              >
                <td
                  className="py-2 px-4 sticky left-0 bg-background"
                  style={{ paddingLeft: row.indent ? `${1 + row.indent * 1.5}rem` : undefined }}
                >
                  {row.label}
                </td>
                {(row.periodValues ?? []).map((val, p) => (
                  <td key={p} className="py-2 px-3 text-right font-mono text-sm whitespace-nowrap">
                    {formatCurrency(val)}
                  </td>
                ))}
                {/* Pad if periodValues is shorter than periodLabels (spacer rows) */}
                {(!row.periodValues || row.periodValues.length < periodLabels.length) &&
                  Array.from({ length: periodLabels.length - (row.periodValues?.length ?? 0) }).map((_, p) => (
                    <td key={`pad-${p}`} className="py-2 px-3" />
                  ))
                }
                <td className="py-2 px-4 text-right font-mono text-sm border-l">
                  {row.total !== undefined ? formatCurrency(row.total) : ''}
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
