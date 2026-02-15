'use client'

import { useState, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
import { formatCurrency } from '@/lib/reports/types'
import {
  getEmployerPayrollCostData,
  type EmployerPayrollCostData,
  type EmployerCostMonth,
} from '@/lib/reports/employer-payroll-cost'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface EmployerPayrollCostClientProps {
  initialData: EmployerPayrollCostData
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildExportData(data: EmployerPayrollCostData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = data.months.map((m) => ({
    Month: m.monthLabel,
    'Total Wages': m.totalWages,
    'Employer SS': m.employerSS,
    'Employer Medicare': m.employerMedicare,
    'Total FICA': m.totalEmployerFICA,
    'Total Burden': m.totalBurden,
    Budget: m.budget,
    Variance: m.variance,
  }))
  rows.push({
    Month: 'YTD TOTAL',
    'Total Wages': data.ytdWages,
    'Employer SS': data.ytdEmployerSS,
    'Employer Medicare': data.ytdEmployerMedicare,
    'Total FICA': data.ytdTotalFICA,
    'Total Burden': data.ytdTotalBurden,
    Budget: data.ytdBudget,
    Variance: data.ytdVariance,
  })
  return rows
}

const exportColumns = [
  'Month',
  'Total Wages',
  'Employer SS',
  'Employer Medicare',
  'Total FICA',
  'Total Burden',
  'Budget',
  'Variance',
]

// ---------------------------------------------------------------------------
// Variance display
// ---------------------------------------------------------------------------

function VarianceCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-muted-foreground">&mdash;</span>
  }
  // Positive variance = under budget (favorable), negative = over budget (unfavorable)
  const isFavorable = value >= 0
  return (
    <span
      className={cn(
        'font-mono',
        isFavorable ? 'text-green-600' : 'text-red-600 font-semibold'
      )}
    >
      {isFavorable ? '' : ''}
      {formatCurrency(value)}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function EmployerPayrollCostClient({
  initialData,
}: EmployerPayrollCostClientProps) {
  const [data, setData] = useState<EmployerPayrollCostData>(initialData)
  const [year, setYear] = useState(initialData.year)
  const [isPending, startTransition] = useTransition()

  const currentYear = new Date().getFullYear()

  function handleApply() {
    startTransition(async () => {
      const result = await getEmployerPayrollCostData({ year })
      setData(result)
    })
  }

  const exportData = buildExportData(data)
  const hasBudget = data.ytdBudget !== null

  // Compute burden rate (employer FICA as % of wages)
  const burdenRate =
    data.ytdWages > 0
      ? ((data.ytdTotalFICA / data.ytdWages) * 100).toFixed(2)
      : '0.00'

  return (
    <ReportShell
      title="Employer Payroll Cost Summary"
      generatedAt={data.generatedAt}
      reportSlug="employer-payroll-cost"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Year Selector */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="employer-payroll-cost-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Year</Label>
          <Select
            value={String(year)}
            onValueChange={(v) => setYear(Number(v))}
          >
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleApply} disabled={isPending} data-testid="employer-payroll-cost-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="employer-payroll-cost-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              YTD Wages
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.ytdWages)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employer FICA
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.ytdTotalFICA)}
            </div>
            <p className="text-xs text-muted-foreground">
              {burdenRate}% of wages
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Burden
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.ytdTotalBurden)}
            </div>
            <p className="text-xs text-muted-foreground">
              Wages + employer FICA
            </p>
          </CardContent>
        </Card>
        {hasBudget && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                YTD Variance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={cn(
                  'text-2xl font-bold',
                  data.ytdVariance !== null && data.ytdVariance >= 0
                    ? 'text-green-600'
                    : 'text-red-600'
                )}
              >
                {data.ytdVariance !== null
                  ? formatCurrency(data.ytdVariance)
                  : 'N/A'}
              </div>
              <p className="text-xs text-muted-foreground">
                {data.ytdVariance !== null && data.ytdVariance >= 0
                  ? 'Under budget'
                  : 'Over budget'}
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Monthly Table */}
      <div className="space-y-2" data-testid="employer-payroll-cost-table">
        <h2 className="text-lg font-semibold">Monthly Breakdown &mdash; {data.year}</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Wages</TableHead>
                <TableHead className="text-right">Employer SS</TableHead>
                <TableHead className="text-right">Employer Medicare</TableHead>
                <TableHead className="text-right">Total Burden</TableHead>
                {hasBudget && (
                  <TableHead className="text-right">Budget</TableHead>
                )}
                {hasBudget && (
                  <TableHead className="text-right">Variance</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.months.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={hasBudget ? 7 : 5}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No payroll data found for {data.year}.
                  </TableCell>
                </TableRow>
              ) : (
                data.months.map((m) => (
                  <TableRow key={m.month}>
                    <TableCell className="font-medium">
                      {m.monthLabel}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(m.totalWages)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(m.employerSS)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(m.employerMedicare)}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(m.totalBurden)}
                    </TableCell>
                    {hasBudget && (
                      <TableCell className="text-right font-mono">
                        {m.budget !== null ? (
                          formatCurrency(m.budget)
                        ) : (
                          <span className="text-muted-foreground">&mdash;</span>
                        )}
                      </TableCell>
                    )}
                    {hasBudget && (
                      <TableCell className="text-right">
                        <VarianceCell value={m.variance} />
                      </TableCell>
                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.months.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">YTD Total</TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.ytdWages)}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.ytdEmployerSS)}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.ytdEmployerMedicare)}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.ytdTotalBurden)}
                  </TableCell>
                  {hasBudget && (
                    <TableCell className="text-right font-semibold font-mono">
                      {data.ytdBudget !== null ? (
                        formatCurrency(data.ytdBudget)
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                  )}
                  {hasBudget && (
                    <TableCell className="text-right font-semibold">
                      <VarianceCell value={data.ytdVariance} />
                    </TableCell>
                  )}
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </ReportShell>
  )
}
