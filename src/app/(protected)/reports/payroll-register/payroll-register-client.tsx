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
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReportShell } from '@/components/reports/report-shell'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import {
  getPayrollRegisterData,
  type PayrollRegisterData,
  type PayrollRunSummary,
  type PayrollRegisterRow,
} from '@/lib/reports/payroll-register'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface PayrollRegisterClientProps {
  initialData: PayrollRegisterData
  defaultStartDate: string
  defaultEndDate: string
}

// ---------------------------------------------------------------------------
// CSV export helpers
// ---------------------------------------------------------------------------

function buildExportData(data: PayrollRegisterData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  for (const run of data.runs) {
    for (const row of run.rows) {
      out.push({
        'Pay Period': `${formatDate(run.payPeriodStart)} - ${formatDate(run.payPeriodEnd)}`,
        'Run ID': run.runId,
        Employee: row.employeeName,
        'Employee ID': row.employeeId,
        'Gross Pay': row.grossPay,
        'Federal W/H': row.federalWithholding,
        'State W/H': row.stateWithholding,
        'SS (EE)': row.socialSecurityEmployee,
        'Medicare (EE)': row.medicareEmployee,
        'Net Pay': row.netPay,
        'Fund Allocations': row.fundAllocations
          .map((a) => `${a.fundName} (${a.percentage}%)`)
          .join('; '),
      })
    }
  }
  return out
}

const exportColumns = [
  'Pay Period',
  'Run ID',
  'Employee',
  'Employee ID',
  'Gross Pay',
  'Federal W/H',
  'State W/H',
  'SS (EE)',
  'Medicare (EE)',
  'Net Pay',
  'Fund Allocations',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PayrollRegisterClient({
  initialData,
  defaultStartDate,
  defaultEndDate,
}: PayrollRegisterClientProps) {
  const [data, setData] = useState<PayrollRegisterData>(initialData)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await getPayrollRegisterData({ startDate, endDate })
      setData(result)
    })
  }

  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Payroll Register"
      generatedAt={data.generatedAt}
      reportSlug="payroll-register"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Date Range Filters */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="payroll-register-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-40"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
          />
        </div>
        <Button onClick={handleApply} disabled={isPending} data-testid="payroll-register-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4" data-testid="payroll-register-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grand Total Gross
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.grandTotalGross)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Federal W/H
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.grandTotalFederal)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              State W/H
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {formatCurrency(data.grandTotalState)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              FICA (SS + Med)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.grandTotalSS + data.grandTotalMedicare)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Grand Total Net
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.grandTotalNet)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Payroll Runs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.runs.length}</div>
          </CardContent>
        </Card>
      </div>

      {/* Per-Run Tables */}
      {data.runs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground border rounded-lg">
          No posted payroll runs found for the selected date range.
        </div>
      ) : (
        data.runs.map((run) => (
          <PayrollRunTable key={run.runId} run={run} />
        ))
      )}

      {/* Grand Totals */}
      {data.runs.length > 1 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Grand Totals</h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">Gross</TableHead>
                  <TableHead className="text-right">Federal</TableHead>
                  <TableHead className="text-right">State</TableHead>
                  <TableHead className="text-right">SS (EE)</TableHead>
                  <TableHead className="text-right">Medicare (EE)</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow className="font-bold bg-muted/20">
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalGross)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalFederal)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalState)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalSS)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalMedicare)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(data.grandTotalNet)}
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// Per-Run Table
// ---------------------------------------------------------------------------

function PayrollRunTable({ run }: { run: PayrollRunSummary }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Pay Period: {formatDate(run.payPeriodStart)} &mdash;{' '}
          {formatDate(run.payPeriodEnd)}
        </h2>
        <div className="flex items-center gap-2">
          <Badge variant="outline">Run #{run.runId}</Badge>
          <Badge
            variant={run.status === 'POSTED' ? 'default' : 'secondary'}
          >
            {run.status}
          </Badge>
        </div>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Employee</TableHead>
              <TableHead className="text-right">Gross Pay</TableHead>
              <TableHead className="text-right">Federal</TableHead>
              <TableHead className="text-right">State</TableHead>
              <TableHead className="text-right">SS (EE)</TableHead>
              <TableHead className="text-right">Medicare (EE)</TableHead>
              <TableHead className="text-right">Net Pay</TableHead>
              <TableHead>Fund Allocation</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {run.rows.length === 0 ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="h-24 text-center text-muted-foreground"
                >
                  No entries in this payroll run.
                </TableCell>
              </TableRow>
            ) : (
              run.rows.map((row) => (
                <EmployeeRow key={row.entryId} row={row} />
              ))
            )}
          </TableBody>
          {run.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">
                  Run Totals ({run.rows.length} employees)
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalGross)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalFederal)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalState)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalSS)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalMedicare)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(run.totalNet)}
                </TableCell>
                <TableCell />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Employee Row
// ---------------------------------------------------------------------------

function EmployeeRow({ row }: { row: PayrollRegisterRow }) {
  return (
    <TableRow>
      <TableCell>
        <div className="font-medium">{row.employeeName}</div>
        <div className="text-xs text-muted-foreground">{row.employeeId}</div>
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(row.grossPay)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(row.federalWithholding)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(row.stateWithholding)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(row.socialSecurityEmployee)}
      </TableCell>
      <TableCell className="text-right font-mono">
        {formatCurrency(row.medicareEmployee)}
      </TableCell>
      <TableCell className="text-right font-mono font-semibold">
        {formatCurrency(row.netPay)}
      </TableCell>
      <TableCell>
        <div className="flex flex-wrap gap-1">
          {row.fundAllocations.length > 0 ? (
            row.fundAllocations.map((alloc, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {alloc.fundName} ({alloc.percentage}%)
              </Badge>
            ))
          ) : (
            <span className="text-xs text-muted-foreground">General</span>
          )}
        </div>
      </TableCell>
    </TableRow>
  )
}
