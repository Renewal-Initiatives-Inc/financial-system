'use client'

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
import { ReportShell } from '@/components/reports/report-shell'
import type {
  OutstandingPayablesData,
  AgingBucket,
} from '@/lib/reports/outstanding-payables'

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

function fmtDate(value: string | undefined): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

const AGING_COLORS: Record<AgingBucket, string> = {
  current: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  '31-60':
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  '61-90':
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  '90+': 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const AGING_LABELS: Record<AgingBucket, string> = {
  current: 'Current',
  '31-60': '31-60 days',
  '61-90': '61-90 days',
  '90+': '90+ days',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface PayablesClientProps {
  data: OutstandingPayablesData
}

export function PayablesClient({ data }: PayablesClientProps) {
  const router = useRouter()

  // Build CSV export data from invoice detail
  const exportData = data.invoiceDetail.map((row) => ({
    Vendor: row.vendorName ?? '',
    'Invoice #': row.invoiceNumber ?? '',
    'Invoice Date': row.invoiceDate ?? '',
    'Due Date': row.dueDate ?? '',
    'PO Ref': row.poNumber ?? '',
    Amount: row.amount,
    Aging: AGING_LABELS[row.agingBucket],
  }))

  const exportColumns = [
    'Vendor',
    'Invoice #',
    'Invoice Date',
    'Due Date',
    'PO Ref',
    'Amount',
    'Aging',
  ]

  return (
    <ReportShell
      title="Outstanding Payables"
      generatedAt={data.generatedAt}
      reportSlug="outstanding-payables"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Aging Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Current (0-30 days)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {fmt(data.agingSummary.current)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              31-60 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {fmt(data.agingSummary['31-60'])}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              61-90 Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {fmt(data.agingSummary['61-90'])}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              90+ Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {fmt(data.agingSummary['90+'])}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grand Total */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Total Outstanding Payables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-3xl font-bold">{fmt(data.grandTotal)}</div>
          <p className="text-sm text-muted-foreground mt-1">
            Across {data.sections.length} payable{' '}
            {data.sections.length === 1 ? 'category' : 'categories'}
          </p>
        </CardContent>
      </Card>

      {/* Per-Section Detail */}
      {data.sections.map((section) => (
        <div key={section.title} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">{section.title}</h2>
            <span className="text-sm font-medium text-muted-foreground">
              {fmt(section.total)}
            </span>
          </div>

          {section.title === 'Accounts Payable' ? (
            /* AP section shows full invoice detail */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Vendor</TableHead>
                    <TableHead>Invoice #</TableHead>
                    <TableHead>Invoice Date</TableHead>
                    <TableHead>Due Date</TableHead>
                    <TableHead>PO Ref</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead>Aging</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-muted-foreground"
                      >
                        No outstanding invoices.
                      </TableCell>
                    </TableRow>
                  ) : (
                    section.rows.map((row, idx) => (
                      <TableRow key={`ap-${idx}`}>
                        <TableCell className="font-medium">
                          {row.vendorName ?? '-'}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.invoiceNumber ?? '-'}
                        </TableCell>
                        <TableCell>{fmtDate(row.invoiceDate)}</TableCell>
                        <TableCell>{fmtDate(row.dueDate)}</TableCell>
                        <TableCell className="font-mono text-sm">
                          {row.poNumber ?? '-'}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(row.amount)}
                        </TableCell>
                        <TableCell>
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${AGING_COLORS[row.agingBucket]}`}
                          >
                            {AGING_LABELS[row.agingBucket]}
                          </span>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {section.rows.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell colSpan={5} className="font-semibold">
                        Total Accounts Payable
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(section.total)}
                      </TableCell>
                      <TableCell />
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          ) : (
            /* Non-AP sections show GL balance summary */
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">GL Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {section.rows.length === 0 ? (
                    <TableRow>
                      <TableCell
                        colSpan={2}
                        className="h-16 text-center text-muted-foreground"
                      >
                        No outstanding balance.
                      </TableCell>
                    </TableRow>
                  ) : (
                    section.rows.map((row, idx) => (
                      <TableRow key={`gl-${section.title}-${idx}`}>
                        <TableCell className="font-medium">
                          {section.title}
                        </TableCell>
                        <TableCell className="text-right">
                          {fmt(row.amount)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
                {section.rows.length > 0 && (
                  <TableFooter>
                    <TableRow>
                      <TableCell className="font-semibold">
                        Total {section.title}
                      </TableCell>
                      <TableCell className="text-right font-semibold">
                        {fmt(section.total)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                )}
              </Table>
            </div>
          )}
        </div>
      ))}

      {data.sections.length === 0 && (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No outstanding payables found.
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
