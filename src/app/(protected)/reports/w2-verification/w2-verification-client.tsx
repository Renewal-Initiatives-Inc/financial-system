'use client'

import { useState, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
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
  getW2VerificationData,
  type W2VerificationData,
} from '@/lib/reports/w2-verification'
import { cn } from '@/lib/utils'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface W2VerificationClientProps {
  initialData: W2VerificationData
}

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildExportData(data: W2VerificationData): Record<string, unknown>[] {
  return data.rows.map((row) => ({
    'Employee ID': row.employeeId,
    Employee: row.employeeName,
    'Box 1 - Wages': row.box1,
    'Box 2 - Fed W/H': row.box2,
    'Box 3 - SS Wages': row.box3,
    'Box 4 - SS Tax': row.box4,
    'Box 5 - Medicare Wages': row.box5,
    'Box 6 - Medicare Tax': row.box6,
    'Box 16 - State Wages': row.box16,
    'Box 17 - State Tax': row.box17,
    'SS Wage Base Exceeded': row.hasWageBaseExceeded ? 'Yes' : 'No',
  }))
}

const exportColumns = [
  'Employee ID',
  'Employee',
  'Box 1 - Wages',
  'Box 2 - Fed W/H',
  'Box 3 - SS Wages',
  'Box 4 - SS Tax',
  'Box 5 - Medicare Wages',
  'Box 6 - Medicare Tax',
  'Box 16 - State Wages',
  'Box 17 - State Tax',
  'SS Wage Base Exceeded',
]

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function W2VerificationClient({ initialData }: W2VerificationClientProps) {
  const [data, setData] = useState<W2VerificationData>(initialData)
  const [year, setYear] = useState(initialData.year)
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await getW2VerificationData({ year })
      setData(result)
    })
  }

  const currentYear = new Date().getFullYear()
  const exportData = buildExportData(data)

  // Compute totals for summary
  const totals = data.rows.reduce(
    (acc, row) => ({
      box1: acc.box1 + row.box1,
      box2: acc.box2 + row.box2,
      box3: acc.box3 + row.box3,
      box4: acc.box4 + row.box4,
      box5: acc.box5 + row.box5,
      box6: acc.box6 + row.box6,
      box16: acc.box16 + row.box16,
      box17: acc.box17 + row.box17,
    }),
    { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, box16: 0, box17: 0 }
  )

  const exceededCount = data.rows.filter((r) => r.hasWageBaseExceeded).length

  return (
    <ReportShell
      title="W-2 Data Verification"
      generatedAt={data.generatedAt}
      reportSlug="w2-verification"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Year Selector */}
      <div className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border" data-testid="w2-verification-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Tax Year</Label>
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
        <Button onClick={handleApply} disabled={isPending} data-testid="w2-verification-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="w2-verification-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Tax Year
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.year}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Employees
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.totalEmployees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              SS Wage Base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.ssWageBase)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Exceeded SS Base
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={cn(
                'text-2xl font-bold',
                exceededCount > 0 ? 'text-yellow-600' : 'text-green-600'
              )}
            >
              {exceededCount}
            </div>
            <p className="text-xs text-muted-foreground">
              {exceededCount === 1 ? 'employee' : 'employees'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* SS Wage Base Info */}
      {exceededCount > 0 && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800 dark:bg-yellow-950/20 dark:border-yellow-900 dark:text-yellow-200">
          <strong>Note:</strong> {exceededCount}{' '}
          {exceededCount === 1 ? 'employee has' : 'employees have'} wages
          exceeding the {data.year} Social Security wage base of{' '}
          {formatCurrency(data.ssWageBase)}. Box 3 (SS Wages) has been capped
          accordingly. Highlighted rows below indicate affected employees.
        </div>
      )}

      {/* W-2 Verification Table */}
      <div className="space-y-2" data-testid="w2-verification-table">
        <h2 className="text-lg font-semibold">Per-Employee W-2 Box Values</h2>
        <div className="rounded-md border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 bg-background z-10">
                  Employee
                </TableHead>
                <TableHead className="text-right">Box 1</TableHead>
                <TableHead className="text-right">Box 2</TableHead>
                <TableHead className="text-right">Box 3</TableHead>
                <TableHead className="text-right">Box 4</TableHead>
                <TableHead className="text-right">Box 5</TableHead>
                <TableHead className="text-right">Box 6</TableHead>
                <TableHead className="text-right">Box 16</TableHead>
                <TableHead className="text-right">Box 17</TableHead>
                <TableHead className="text-center">Flag</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={10}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No payroll data found for {data.year}.
                  </TableCell>
                </TableRow>
              ) : (
                <>
                  {/* Column descriptions sub-header */}
                  <TableRow className="bg-muted/30 text-xs text-muted-foreground">
                    <TableCell className="sticky left-0 bg-muted/30 z-10">
                      &nbsp;
                    </TableCell>
                    <TableCell className="text-right">Wages</TableCell>
                    <TableCell className="text-right">Fed W/H</TableCell>
                    <TableCell className="text-right">SS Wages</TableCell>
                    <TableCell className="text-right">SS Tax</TableCell>
                    <TableCell className="text-right">Med Wages</TableCell>
                    <TableCell className="text-right">Med Tax</TableCell>
                    <TableCell className="text-right">State Wages</TableCell>
                    <TableCell className="text-right">State Tax</TableCell>
                    <TableCell className="text-center">&nbsp;</TableCell>
                  </TableRow>

                  {data.rows.map((row) => (
                    <TableRow
                      key={row.employeeId}
                      className={cn(
                        row.hasWageBaseExceeded &&
                          'bg-yellow-50 dark:bg-yellow-950/20'
                      )}
                    >
                      <TableCell className="sticky left-0 bg-background z-10">
                        <div className="font-medium">{row.employeeName}</div>
                        <div className="text-xs text-muted-foreground">
                          {row.employeeId}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box1)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box2)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          'text-right font-mono',
                          row.hasWageBaseExceeded && 'text-yellow-700 font-semibold dark:text-yellow-300'
                        )}
                      >
                        {formatCurrency(row.box3)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box4)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box5)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box6)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box16)}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {formatCurrency(row.box17)}
                      </TableCell>
                      <TableCell className="text-center">
                        {row.hasWageBaseExceeded && (
                          <Badge variant="outline" className="text-yellow-700 border-yellow-400 dark:text-yellow-300">
                            Capped
                          </Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}

                  {/* Totals Row */}
                  <TableRow className="font-bold border-t-2 border-t-foreground/20 bg-muted/20">
                    <TableCell className="sticky left-0 bg-muted/20 z-10 font-semibold">
                      Totals ({data.totalEmployees} employees)
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box1)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box2)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box3)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box4)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box5)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box6)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box16)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(totals.box17)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </ReportShell>
  )
}
