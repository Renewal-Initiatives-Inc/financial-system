'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter } from 'next/navigation'
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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ReportShell } from '@/components/reports/report-shell'
import { getRentCollectionData } from '@/lib/reports/rent-collection'
import type { RentCollectionData } from '@/lib/reports/rent-collection'

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmt(value: number): string {
  if (value < 0) {
    return `(${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(value))})`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function fmtPct(value: number): string {
  return `${value.toFixed(1)}%`
}

function formatMonthLabel(month: string): string {
  const [year, mon] = month.split('-').map(Number)
  const d = new Date(year, mon - 1, 1)
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' })
}

const FUNDING_LABELS: Record<string, string> = {
  TENANT_DIRECT: 'Direct',
  VASH: 'VASH',
  MRVP: 'MRVP',
  SECTION_8: 'Section 8',
  OTHER_VOUCHER: 'Other',
}

// ---------------------------------------------------------------------------
// Progress Bar
// ---------------------------------------------------------------------------

function CollectionBar({ rate }: { rate: number }) {
  const clampedRate = Math.min(rate, 100)
  let barColor = 'bg-green-500'
  if (rate < 50) barColor = 'bg-red-500'
  else if (rate < 80) barColor = 'bg-yellow-500'

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${barColor}`}
          style={{ width: `${clampedRate}%` }}
        />
      </div>
      <span className="text-xs font-medium w-12 text-right tabular-nums">
        {fmtPct(rate)}
      </span>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RentCollectionClientProps {
  initialData: RentCollectionData
}

export function RentCollectionClient({ initialData }: RentCollectionClientProps) {
  const router = useRouter()
  const [data, setData] = useState(initialData)
  const [selectedMonth, setSelectedMonth] = useState(initialData.month)
  const [isPending, startTransition] = useTransition()

  const handleMonthChange = useCallback((newMonth: string) => {
    setSelectedMonth(newMonth)
    startTransition(async () => {
      const result = await getRentCollectionData({ month: newMonth })
      setData(result)
    })
  }, [])

  // Build CSV export data
  const exportData = data.rows.map((row) => ({
    Unit: row.unitNumber,
    Tenant: row.tenantName,
    'Funding Source': FUNDING_LABELS[row.fundingSourceType] ?? row.fundingSourceType,
    'Monthly Rent': row.monthlyRent,
    Billed: row.billed,
    Collected: row.collected,
    Outstanding: row.outstanding,
    'Collection %': `${row.collectionRate.toFixed(1)}%`,
  }))

  const exportColumns = [
    'Unit',
    'Tenant',
    'Funding Source',
    'Monthly Rent',
    'Billed',
    'Collected',
    'Outstanding',
    'Collection %',
  ]

  return (
    <ReportShell
      title="Rent Collection Status"
      generatedAt={data.generatedAt}
      reportSlug="rent-collection"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Month Selector */}
      <div className="flex items-end gap-4">
        <div className="space-y-1">
          <Label htmlFor="month-selector" className="text-sm font-medium">
            Report Month
          </Label>
          <Input
            id="month-selector"
            type="month"
            value={selectedMonth}
            onChange={(e) => handleMonthChange(e.target.value)}
            className="w-48"
          />
        </div>
        <p className="text-sm text-muted-foreground pb-1">
          {formatMonthLabel(data.month)}
          {isPending && ' (loading...)'}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Billed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{fmt(data.totalBilled)}</div>
            <p className="text-xs text-muted-foreground">
              {data.occupiedUnits} units with rent
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Collected
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {fmt(data.totalCollected)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Collection Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.collectionRate >= 95
                  ? 'text-green-600'
                  : data.collectionRate >= 80
                    ? 'text-yellow-600'
                    : 'text-red-600'
              }`}
            >
              {fmtPct(data.collectionRate)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Occupancy Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fmtPct(data.occupancyRate)}
            </div>
            <p className="text-xs text-muted-foreground">
              {data.occupiedUnits} / {data.totalUnits} units
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Per-Unit Collection Table */}
      <div className="space-y-2">
        <h2 className="text-lg font-semibold">Per-Unit Detail</h2>
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Unit</TableHead>
                <TableHead>Tenant</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Rent</TableHead>
                <TableHead className="text-right">Billed</TableHead>
                <TableHead className="text-right">Collected</TableHead>
                <TableHead className="text-right">Outstanding</TableHead>
                <TableHead className="w-40">Collection</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.rows.length === 0 ? (
                <TableRow>
                  <TableCell
                    colSpan={8}
                    className="h-24 text-center text-muted-foreground"
                  >
                    No active tenants with rent found.
                  </TableCell>
                </TableRow>
              ) : (
                data.rows.map((row) => (
                  <TableRow
                    key={row.tenantId}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => router.push(`/tenants/${row.tenantId}`)}
                  >
                    <TableCell className="font-mono text-sm">
                      {row.unitNumber}
                    </TableCell>
                    <TableCell className="font-medium">
                      {row.tenantName}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {FUNDING_LABELS[row.fundingSourceType] ??
                          row.fundingSourceType}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(row.monthlyRent)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(row.billed)}
                    </TableCell>
                    <TableCell className="text-right">
                      {fmt(row.collected)}
                    </TableCell>
                    <TableCell
                      className={`text-right ${row.outstanding > 0 ? 'text-red-600 font-medium' : ''}`}
                    >
                      {fmt(row.outstanding)}
                    </TableCell>
                    <TableCell>
                      <CollectionBar rate={row.collectionRate} />
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
            {data.rows.length > 0 && (
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={3} className="font-semibold">
                    Totals
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(data.totalBilled)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(data.totalBilled)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(data.totalCollected)}
                  </TableCell>
                  <TableCell className="text-right font-semibold">
                    {fmt(data.totalOutstanding)}
                  </TableCell>
                  <TableCell>
                    <CollectionBar rate={data.collectionRate} />
                  </TableCell>
                </TableRow>
              </TableFooter>
            )}
          </Table>
        </div>
      </div>

      {/* Vacancy Section */}
      {data.vacantUnits.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Vacant Units</h2>
            <span className="text-sm font-medium text-red-600">
              Vacancy Loss: {fmt(data.vacancyLoss)}/mo
            </span>
          </div>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Unit</TableHead>
                  <TableHead>Last Tenant</TableHead>
                  <TableHead className="text-right">Potential Rent</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.vacantUnits.map((unit) => (
                  <TableRow key={unit.tenantId}>
                    <TableCell className="font-mono text-sm">
                      {unit.unitNumber}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {unit.tenantName}
                    </TableCell>
                    <TableCell className="text-right text-red-600">
                      {fmt(unit.monthlyRent)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2} className="font-semibold">
                    Total Vacancy Loss
                  </TableCell>
                  <TableCell className="text-right font-semibold text-red-600">
                    {fmt(data.vacancyLoss)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex gap-2">
        <Badge
          variant="outline"
          className="cursor-pointer"
          onClick={() => router.push('/reports')}
        >
          Back to Reports
        </Badge>
      </div>
    </ReportShell>
  )
}
