'use client'

import { useState, useCallback, useTransition } from 'react'
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
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/tabs'
import { ReportShell } from '@/components/reports/report-shell'
import { getForm990Data } from '@/lib/reports/form-990-data'
import type { Form990Data } from '@/lib/reports/form-990-data'
import { formatCurrency } from '@/lib/reports/types'

interface Form990DataClientProps {
  initialData: Form990Data
  defaultYear: number
}

export function Form990DataClient({ initialData, defaultYear }: Form990DataClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [year, setYear] = useState(String(defaultYear))

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getForm990Data({ fiscalYear: Number(year) })
      setData(result)
    })
  }, [year])

  // Export data for Part IX
  const exportData = data.partIXExpenses.map((r) => ({
    Line: r.form990Line,
    Description: r.lineLabel,
    Total: r.total,
    Program: r.program,
    'M&G': r.admin,
    Fundraising: r.fundraising,
  }))
  const exportColumns = ['Line', 'Description', 'Total', 'Program', 'M&G', 'Fundraising']

  return (
    <ReportShell
      title="Form 990 / Form PC Data"
      generatedAt={data.generatedAt}
      reportSlug="form-990-data"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      <div className="flex items-end gap-3" data-testid="form-990-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Fiscal Year</Label>
          <Input type="number" value={year} onChange={(e) => setYear(e.target.value)} className="w-24 h-8 text-sm" data-testid="form-990-year-input" />
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="form-990-apply-btn">
          {isPending ? 'Loading...' : 'Generate'}
        </Button>
      </div>

      <Tabs defaultValue="part-ix" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="part-ix" data-testid="form-990-tab-part-ix">Part IX</TabsTrigger>
          <TabsTrigger value="revenue" data-testid="form-990-tab-revenue">Revenue</TabsTrigger>
          <TabsTrigger value="officers" data-testid="form-990-tab-officers">Officers</TabsTrigger>
          <TabsTrigger value="schedules" data-testid="form-990-tab-schedules">Schedules</TabsTrigger>
        </TabsList>

        <TabsContent value="part-ix" className="space-y-4">
          <h3 className="text-lg font-semibold">Part IX — Statement of Functional Expenses</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Program</TableHead>
                  <TableHead className="text-right">M&G</TableHead>
                  <TableHead className="text-right">Fundraising</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.partIXExpenses.map((row) => (
                  <TableRow key={row.form990Line}>
                    <TableCell className="font-mono text-xs">{row.form990Line}</TableCell>
                    <TableCell className="text-sm">{row.lineLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.total)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.program)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.admin)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.fundraising)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell /><TableCell className="font-semibold">Total</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.partIXTotal.total)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.partIXTotal.program)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.partIXTotal.admin)}</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.partIXTotal.fundraising)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="revenue" className="space-y-4">
          <h3 className="text-lg font-semibold">Revenue by 990 Line</h3>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Line</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.revenue.map((row) => (
                  <TableRow key={row.form990Line}>
                    <TableCell className="font-mono text-xs">{row.form990Line}</TableCell>
                    <TableCell className="text-sm">{row.lineLabel}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell /><TableCell className="font-semibold">Total Revenue</TableCell>
                  <TableCell className="text-right font-semibold">{formatCurrency(data.totalRevenue)}</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="officers" className="space-y-4">
          <h3 className="text-lg font-semibold">Officer Compensation</h3>
          <p className="text-sm text-muted-foreground">
            All employees are listed below. Manually identify officers for Form 990.
          </p>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Total Compensation</TableHead>
                  <TableHead>Officer?</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.officers.map((row) => (
                  <TableRow key={row.employeeId}>
                    <TableCell className="font-medium text-sm">{row.employeeName}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatCurrency(row.totalCompensation)}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.isOfficer ? 'Yes' : 'TBD'}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="schedules" className="space-y-4">
          <h3 className="text-lg font-semibold">Supplementary Schedule Data</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Schedule D — Fixed Assets</h4>
              <p className="text-sm">Count: {data.scheduleData.fixedAssetCount}</p>
              <p className="text-sm">Total Cost: {formatCurrency(data.scheduleData.fixedAssetTotal)}</p>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="font-semibold text-sm mb-2">Schedule D — CIP</h4>
              <p className="text-sm">Balance: {formatCurrency(data.scheduleData.cipBalance)}</p>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </ReportShell>
  )
}
