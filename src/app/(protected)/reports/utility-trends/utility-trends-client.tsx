'use client'

import { useState, useTransition } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import { ReportShell } from '@/components/reports/report-shell'
import { FundSelector } from '@/components/shared/fund-selector'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import { formatCurrency, formatPercent } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import {
  UTILITY_TYPES,
  type UtilityTrendsData,
  type UtilityType,
} from '@/lib/reports/utility-trends'
import { getUtilityTrendsData } from '../actions'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface UtilityTrendsClientProps {
  initialData: UtilityTrendsData
  funds: FundRow[]
}

// ---------------------------------------------------------------------------
// Chart colors per utility type
// ---------------------------------------------------------------------------

const UTILITY_COLORS: Record<UtilityType, string> = {
  Electric: '#f59e0b',
  Gas: '#ef4444',
  'Water/Sewer': '#3b82f6',
  Internet: '#8b5cf6',
  'Security & Fire Monitoring': '#10b981',
  Trash: '#6b7280',
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

const UTILITY_TRENDS_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'month', label: 'Month', format: 'text' },
  { key: 'electric', label: 'Electric', format: 'currency' },
  { key: 'gas', label: 'Gas', format: 'currency' },
  { key: 'waterSewer', label: 'Water/Sewer', format: 'currency' },
  { key: 'internet', label: 'Internet', format: 'currency' },
  { key: 'securityFireMonitoring', label: 'Security & Fire Monitoring', format: 'currency' },
  { key: 'trash', label: 'Trash', format: 'currency' },
  { key: 'total', label: 'Total', format: 'currency' },
]

function buildExportData(
  data: UtilityTrendsData
): Record<string, unknown>[] {
  return data.months.map((m) => ({
    month: m.month,
    electric: m.values['Electric'],
    gas: m.values['Gas'],
    waterSewer: m.values['Water/Sewer'],
    internet: m.values['Internet'],
    securityFireMonitoring: m.values['Security & Fire Monitoring'],
    trash: m.values['Trash'],
    total: m.total,
  }))
}

// ---------------------------------------------------------------------------
// Format month label for display (e.g., "2024-01" -> "Jan 2024")
// ---------------------------------------------------------------------------

function formatMonth(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

function formatMonthShort(yyyyMm: string): string {
  const [year, month] = yyyyMm.split('-')
  const date = new Date(parseInt(year), parseInt(month) - 1, 1)
  return date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function UtilityTrendsClient({
  initialData,
  funds,
}: UtilityTrendsClientProps) {
  const [data, setData] = useState<UtilityTrendsData>(initialData)
  const [fundId, setFundId] = useState<number | null>(null)
  const [showCombined, setShowCombined] = useState(false)
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await getUtilityTrendsData({ fundId })
      setData(result)
    })
  }

  // Build chart data
  const chartData = data.months.map((m) => {
    const point: Record<string, string | number> = {
      month: formatMonthShort(m.month),
    }
    if (showCombined) {
      point['Total'] = m.total
    } else {
      for (const ut of UTILITY_TYPES) {
        point[ut] = m.values[ut]
      }
    }
    return point
  })

  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Utility Trend Analysis"
      reportSlug="utility-trends"
      exportData={exportData}
      csvColumns={UTILITY_TRENDS_CSV_COLUMNS}
      filters={fundId ? { fundId: String(fundId) } : {}}
    >
      {/* Filter bar */}
      <div
        className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border"
        data-testid="report-filter-bar"
      >
        <div className="space-y-1 min-w-[200px]">
          <Label className="text-xs">Fund</Label>
          <FundSelector
            funds={funds}
            value={fundId}
            onSelect={setFundId}
            placeholder="All Funds (Consolidated)"
            testId="filter-fund"
          />
        </div>

        <Button
          onClick={handleApply}
          disabled={isPending}
          data-testid="filter-apply-btn"
        >
          {isPending ? 'Loading...' : 'Apply'}
        </Button>

        <div className="flex items-center gap-2 ml-auto">
          <Label htmlFor="combined-toggle" className="text-xs">
            Individual utilities
          </Label>
          <Switch
            id="combined-toggle"
            checked={showCombined}
            onCheckedChange={setShowCombined}
            data-testid="toggle-combined"
          />
          <Label htmlFor="combined-toggle" className="text-xs">
            Combined total
          </Label>
        </div>
      </div>

      {isPending && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Loading trend data...
        </div>
      )}

      {/* Year-over-year summary card */}
      {data.yearOverYear && (
        <Card data-testid="yoy-summary">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Year-over-Year Comparison
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Current Period</p>
                <p className="font-mono font-medium">
                  {formatCurrency(data.yearOverYear.currentYear)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Prior Period</p>
                <p className="font-mono font-medium">
                  {formatCurrency(data.yearOverYear.priorYear)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">Change</p>
                <p
                  className={cn(
                    'font-mono font-medium',
                    data.yearOverYear.change > 0
                      ? 'text-red-700'
                      : data.yearOverYear.change < 0
                        ? 'text-green-700'
                        : ''
                  )}
                >
                  {formatCurrency(data.yearOverYear.change)}
                </p>
              </div>
              <div>
                <p className="text-muted-foreground">% Change</p>
                <p
                  className={cn(
                    'font-mono font-medium',
                    data.yearOverYear.changePercent > 0
                      ? 'text-red-700'
                      : data.yearOverYear.changePercent < 0
                        ? 'text-green-700'
                        : ''
                  )}
                >
                  {formatPercent(data.yearOverYear.changePercent)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Line chart */}
      <div
        className="border rounded-lg p-4 bg-background"
        data-testid="utility-chart"
      >
        <ResponsiveContainer width="100%" height={400}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
            <XAxis
              dataKey="month"
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              tick={{ fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value: number) =>
                new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                  minimumFractionDigits: 0,
                  maximumFractionDigits: 0,
                }).format(value)
              }
            />
            <Tooltip
              formatter={(value) => formatCurrency(Number(value))}
              labelStyle={{ fontWeight: 600 }}
            />
            <Legend />
            {showCombined ? (
              <Line
                type="monotone"
                dataKey="Total"
                stroke="#2563eb"
                strokeWidth={2}
                dot={{ r: 3 }}
                activeDot={{ r: 5 }}
              />
            ) : (
              UTILITY_TYPES.map((ut) => (
                <Line
                  key={ut}
                  type="monotone"
                  dataKey={ut}
                  stroke={UTILITY_COLORS[ut]}
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
              ))
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Data table below chart */}
      <div
        className="border rounded-lg overflow-x-auto"
        data-testid="utility-data-table"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-muted/50 border-b">
              <th className="text-left py-2 px-3 font-medium sticky left-0 bg-muted/50">
                Month
              </th>
              {UTILITY_TYPES.map((ut) => (
                <th
                  key={ut}
                  className="text-right py-2 px-3 font-medium whitespace-nowrap"
                >
                  {ut}
                </th>
              ))}
              <th className="text-right py-2 px-3 font-medium">Total</th>
            </tr>
          </thead>
          <tbody>
            {data.months.map((m) => (
              <tr key={m.month} className="border-b last:border-b-0">
                <td className="py-2 px-3 font-medium sticky left-0 bg-background">
                  {formatMonth(m.month)}
                </td>
                {UTILITY_TYPES.map((ut) => (
                  <td
                    key={ut}
                    className="py-2 px-3 text-right font-mono text-sm"
                  >
                    {m.values[ut] !== 0
                      ? formatCurrency(m.values[ut])
                      : '--'}
                  </td>
                ))}
                <td className="py-2 px-3 text-right font-mono text-sm font-semibold">
                  {formatCurrency(m.total)}
                </td>
              </tr>
            ))}

            {/* Grand total row */}
            <tr className="font-bold border-t-2 border-t-foreground/20 bg-muted/20">
              <td className="py-2 px-3 sticky left-0 bg-muted/20">TOTAL</td>
              {UTILITY_TYPES.map((ut) => {
                const sum = data.months.reduce(
                  (s, m) => s + m.values[ut],
                  0
                )
                return (
                  <td
                    key={ut}
                    className="py-2 px-3 text-right font-mono text-sm"
                  >
                    {formatCurrency(sum)}
                  </td>
                )
              })}
              <td className="py-2 px-3 text-right font-mono text-sm">
                {formatCurrency(
                  data.months.reduce((s, m) => s + m.total, 0)
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </ReportShell>
  )
}
