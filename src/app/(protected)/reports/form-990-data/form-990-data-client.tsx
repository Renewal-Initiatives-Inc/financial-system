'use client'

import { Fragment, useState, useCallback, useMemo, useTransition } from 'react'
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { ReportShell } from '@/components/reports/report-shell'
import { getForm990Data } from '@/lib/reports/form-990-data'
import type { Form990Data, Form990RevenueSourceRow } from '@/lib/reports/form-990-data'
import { formatCurrency } from '@/lib/reports/types'

interface Form990DataClientProps {
  initialData: Form990Data
  defaultYear: number
}

function classificationLabel(value: string | null): string {
  if (!value) return 'Unclassified'
  return value === 'GRANT_REVENUE' ? 'Grant Revenue' : 'Earned Income'
}

function classificationBadgeVariant(value: string | null): 'default' | 'secondary' | 'outline' {
  if (!value) return 'outline'
  return value === 'GRANT_REVENUE' ? 'default' : 'secondary'
}

function categoryLabel(value: string | null): string {
  if (!value) return '--'
  return value.charAt(0) + value.slice(1).toLowerCase()
}

export function Form990DataClient({ initialData, defaultYear }: Form990DataClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [year, setYear] = useState(String(defaultYear))
  const [activeTab, setActiveTab] = useState('part-ix')

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getForm990Data({ fiscalYear: Number(year) })
      setData(result)
    })
  }, [year])

  // Group source rows by 990 line for the classification schedule
  const sourcesByLine = useMemo(() => {
    const grouped = new Map<string, { label: string; rows: Form990RevenueSourceRow[]; subtotal: number }>()
    for (const row of data.revenueBySource) {
      const existing = grouped.get(row.form990Line)
      if (existing) {
        existing.rows.push(row)
        existing.subtotal += row.amount
      } else {
        grouped.set(row.form990Line, {
          label: row.form990LineLabel,
          rows: [row],
          subtotal: row.amount,
        })
      }
    }
    return grouped
  }, [data.revenueBySource])

  // Tab-aware export data
  const { exportData, exportColumns } = useMemo(() => {
    if (activeTab === 'revenue') {
      const rows = data.revenueBySource.map((r) => ({
        '990 Line': r.form990Line,
        'Line Description': r.form990LineLabel,
        'Funding Source': r.fundName,
        Funder: r.funderName ?? '',
        Category: r.fundingCategory ?? '',
        Classification: r.revenueClassification
          ? r.revenueClassification === 'GRANT_REVENUE'
            ? 'Grant Revenue (ASC 958-605)'
            : 'Earned Income (ASC 606)'
          : '',
        Amount: r.amount,
        Rationale: r.classificationRationale ?? '',
      }))
      return {
        exportData: rows,
        exportColumns: ['990 Line', 'Line Description', 'Funding Source', 'Funder', 'Category', 'Classification', 'Amount', 'Rationale'],
      }
    }
    return {
      exportData: data.partIXExpenses.map((r) => ({
        Line: r.form990Line,
        Description: r.lineLabel,
        Total: r.total,
        Program: r.program,
        'M&G': r.admin,
        Fundraising: r.fundraising,
      })),
      exportColumns: ['Line', 'Description', 'Total', 'Program', 'M&G', 'Fundraising'],
    }
  }, [activeTab, data])

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

      <Tabs defaultValue="part-ix" onValueChange={setActiveTab} className="w-full">
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

        <TabsContent value="revenue" className="space-y-6">
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

          {/* Revenue Classification Schedule */}
          <div className="pt-2">
            <h3 className="text-lg font-semibold">Revenue Classification Schedule</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Per-funding-source breakdown with ASC 958-605 / ASC 606 classification for CPA working papers.
            </p>

            {data.revenueBySource.length === 0 ? (
              <p className="text-sm text-muted-foreground italic">
                No revenue transactions found for this fiscal year.
              </p>
            ) : (
              <TooltipProvider>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Line</TableHead>
                        <TableHead>Funding Source</TableHead>
                        <TableHead>Funder</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Classification</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-20">Rationale</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[...sourcesByLine.entries()].map(([line, group]) => (
                        <Fragment key={line}>
                          <TableRow className="bg-muted/50">
                            <TableCell className="font-mono text-xs font-semibold">{line}</TableCell>
                            <TableCell colSpan={4} className="text-sm font-semibold">
                              {group.label}
                            </TableCell>
                            <TableCell className="text-right tabular-nums font-semibold">
                              {formatCurrency(group.subtotal)}
                            </TableCell>
                            <TableCell />
                          </TableRow>
                          {group.rows.map((row) => (
                            <TableRow key={`${row.fundId}-${row.accountCode}`}>
                              <TableCell />
                              <TableCell className="text-sm pl-6">{row.fundName}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {row.funderName ?? '--'}
                              </TableCell>
                              <TableCell>
                                <span className="text-xs">{categoryLabel(row.fundingCategory)}</span>
                              </TableCell>
                              <TableCell>
                                <Badge variant={classificationBadgeVariant(row.revenueClassification)}>
                                  {classificationLabel(row.revenueClassification)}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {formatCurrency(row.amount)}
                              </TableCell>
                              <TableCell className="text-center">
                                {row.classificationRationale ? (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Badge variant="outline" className="cursor-help text-xs">
                                        View
                                      </Badge>
                                    </TooltipTrigger>
                                    <TooltipContent side="left" className="max-w-xs text-xs">
                                      {row.classificationRationale}
                                    </TooltipContent>
                                  </Tooltip>
                                ) : (
                                  <span className="text-xs text-muted-foreground">--</span>
                                )}
                              </TableCell>
                            </TableRow>
                          ))}
                        </Fragment>
                      ))}
                    </TableBody>
                    <TableFooter>
                      <TableRow>
                        <TableCell />
                        <TableCell colSpan={4} className="font-semibold">Total (all sources)</TableCell>
                        <TableCell className="text-right font-semibold tabular-nums">
                          {formatCurrency(data.revenueBySource.reduce((s, r) => s + r.amount, 0))}
                        </TableCell>
                        <TableCell />
                      </TableRow>
                    </TableFooter>
                  </Table>
                </div>
              </TooltipProvider>
            )}
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
