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
import { formatCurrency, formatDate, getQuarterRange, getMonthRange } from '@/lib/reports/types'
import {
  getPayrollTaxLiabilityData,
  type PayrollTaxLiabilityData,
} from '@/lib/reports/payroll-tax-liability'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PayrollTaxLiabilityClientProps {
  initialData: PayrollTaxLiabilityData
  defaultStartDate: string
  defaultEndDate: string
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

type PeriodMode = 'monthly' | 'quarterly'

function getCurrentYear(): number {
  return new Date().getFullYear()
}

function getCurrentMonth(): number {
  return new Date().getMonth() + 1
}

function getCurrentQuarter(): number {
  return Math.ceil((new Date().getMonth() + 1) / 3)
}

const QUARTER_LABELS: Record<number, string> = {
  1: 'Q1 (Jan-Mar)',
  2: 'Q2 (Apr-Jun)',
  3: 'Q3 (Jul-Sep)',
  4: 'Q4 (Oct-Dec)',
}

const MONTH_LABELS: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildExportData(data: PayrollTaxLiabilityData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = data.rows.map((row) => ({
    'Tax Type': row.taxType,
    'Employee Amount': row.employeeAmount,
    'Employer Amount': row.employerAmount,
    'Total Amount': row.totalAmount,
  }))
  out.push({
    'Tax Type': 'TOTAL',
    'Employee Amount': data.totalEmployeeWithholding,
    'Employer Amount': data.totalEmployerContribution,
    'Total Amount': data.grandTotal,
  })
  return out
}

const exportColumns = [
  'Tax Type',
  'Employee Amount',
  'Employer Amount',
  'Total Amount',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayrollTaxLiabilityClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
}: PayrollTaxLiabilityClientProps) {
  const [data, setData] = useState<PayrollTaxLiabilityData>(initialData)
  const [periodMode, setPeriodMode] = useState<PeriodMode>('quarterly')
  const [year, setYear] = useState(getCurrentYear())
  const [quarter, setQuarter] = useState(getCurrentQuarter())
  const [month, setMonth] = useState(getCurrentMonth())
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      let startDate: string
      let endDate: string
      if (periodMode === 'quarterly') {
        const range = getQuarterRange(year, quarter)
        startDate = range.startDate
        endDate = range.endDate
      } else {
        const range = getMonthRange(year, month)
        startDate = range.startDate
        endDate = range.endDate
      }
      const result = await getPayrollTaxLiabilityData({ startDate, endDate })
      setData(result)
    })
  }

  const exportData = buildExportData(data)

  const periodLabel =
    periodMode === 'quarterly'
      ? `${QUARTER_LABELS[quarter]} ${year}`
      : `${MONTH_LABELS[month]} ${year}`

  return (
    <ReportShell
      title="Payroll Tax Liability Summary"
      generatedAt={data.generatedAt}
      reportSlug="payroll-tax-liability"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Period Selector */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="payroll-tax-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Period Type</Label>
          <Select
            value={periodMode}
            onValueChange={(v) => setPeriodMode(v as PeriodMode)}
          >
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
            </SelectContent>
          </Select>
        </div>

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
              {[getCurrentYear() - 1, getCurrentYear(), getCurrentYear() + 1].map(
                (y) => (
                  <SelectItem key={y} value={String(y)}>
                    {y}
                  </SelectItem>
                )
              )}
            </SelectContent>
          </Select>
        </div>

        {periodMode === 'quarterly' ? (
          <div className="space-y-1">
            <Label className="text-xs">Quarter</Label>
            <Select
              value={String(quarter)}
              onValueChange={(v) => setQuarter(Number(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[1, 2, 3, 4].map((q) => (
                  <SelectItem key={q} value={String(q)}>
                    {QUARTER_LABELS[q]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs">Month</Label>
            <Select
              value={String(month)}
              onValueChange={(v) => setMonth(Number(v))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <SelectItem key={m} value={String(m)}>
                    {MONTH_LABELS[m]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <Button onClick={handleApply} disabled={isPending} data-testid="payroll-tax-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Period & Employee Count Info */}
      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>
          Period: {formatDate(data.periodStart)} &mdash;{' '}
          {formatDate(data.periodEnd)}
        </span>
        <span>
          Employees: {data.employeeCount}
        </span>
        {isPending && <span>(loading...)</span>}
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4" data-testid="payroll-tax-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employee Withholding
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalEmployeeWithholding)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Employer Contribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.totalEmployerContribution)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Tax Liability
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.grandTotal)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tax Liability Table */}
      <div className="space-y-2" data-testid="payroll-tax-table">
        <h2 className="text-lg font-semibold">Tax Liability by Type</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tax Type</TableHead>
                <TableHead className="text-right">Employee Amount</TableHead>
                <TableHead className="text-right">Employer Amount</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No payroll tax data found for this period.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row) => (
                  <TableRow key={row.taxType}>
                    <TableCell className="font-medium">
                      {row.taxType}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.employeeAmount)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {row.employerAmount > 0 ? (
                        formatCurrency(row.employerAmount)
                      ) : (
                        <span className="text-muted-foreground">&mdash;</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono font-semibold">
                      {formatCurrency(row.totalAmount)}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.totalEmployeeWithholding)}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.totalEmployerContribution)}
                  </TableCell>
                  <TableCell className="text-right font-semibold font-mono">
                    {formatCurrency(data.grandTotal)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>
    </ReportShell>
  )
}
