'use client'

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
import { ReportShell } from '@/components/reports/report-shell'
import { formatCurrency } from '@/lib/reports/types'
import type { ARAgingData, AgingBuckets } from '@/lib/reports/ar-aging'

interface ARAgingClientProps {
  data: ARAgingData
}

function AgingCells({ aging }: { aging: AgingBuckets }) {
  return (
    <>
      <TableCell className="text-right">{formatCurrency(aging.current)}</TableCell>
      <TableCell className="text-right">{formatCurrency(aging.days31to60)}</TableCell>
      <TableCell className="text-right">{formatCurrency(aging.days61to90)}</TableCell>
      <TableCell className="text-right">{formatCurrency(aging.days90plus)}</TableCell>
      <TableCell className="text-right font-semibold">
        {formatCurrency(aging.total)}
      </TableCell>
    </>
  )
}

function AgingTableHeader() {
  return (
    <TableHeader>
      <TableRow>
        <TableHead className="min-w-[200px]">Name</TableHead>
        <TableHead className="text-right">Current (0-30)</TableHead>
        <TableHead className="text-right">31-60</TableHead>
        <TableHead className="text-right">61-90</TableHead>
        <TableHead className="text-right">90+</TableHead>
        <TableHead className="text-right">Total</TableHead>
      </TableRow>
    </TableHeader>
  )
}

function SectionTotal({ label, aging }: { label: string; aging: AgingBuckets }) {
  return (
    <TableFooter>
      <TableRow>
        <TableCell className="font-semibold">{label}</TableCell>
        <AgingCells aging={aging} />
      </TableRow>
    </TableFooter>
  )
}

export function ARAgingClient({ data }: ARAgingClientProps) {
  const exportData = [
    // Tenant rows
    ...data.tenantAR.rows.map((r) => ({
      Section: 'Tenant AR',
      Name: r.tenantName,
      Unit: r.unitNumber,
      'Funding Source': r.fundingSourceType,
      Current: r.aging.current,
      '31-60': r.aging.days31to60,
      '61-90': r.aging.days61to90,
      '90+': r.aging.days90plus,
      Total: r.aging.total,
    })),
    // Grant rows
    ...data.fundingSourceAR.rows.map((r) => ({
      Section: 'Funding Source AR',
      Name: r.funderName,
      Unit: '',
      'Funding Source': '',
      Current: r.aging.current,
      '31-60': r.aging.days31to60,
      '61-90': r.aging.days61to90,
      '90+': r.aging.days90plus,
      Total: r.aging.total,
    })),
    // Pledge rows
    ...data.pledgeAR.rows.map((r) => ({
      Section: 'Pledge AR',
      Name: r.donorName,
      Unit: '',
      'Funding Source': '',
      Current: r.aging.current,
      '31-60': r.aging.days31to60,
      '61-90': r.aging.days61to90,
      '90+': r.aging.days90plus,
      Total: r.aging.total,
    })),
  ]

  const exportColumns = [
    'Section',
    'Name',
    'Unit',
    'Funding Source',
    'Current',
    '31-60',
    '61-90',
    '90+',
    'Total',
  ]

  return (
    <ReportShell
      title="AR Aging Report"
      reportSlug="ar-aging"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      <div className="space-y-8">
        {/* --- Tenant AR Section --- */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Tenant Accounts Receivable</h2>
          <div className="rounded-md border">
            <Table>
              <AgingTableHeader />
              <TableBody>
                {data.tenantAR.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      No outstanding tenant receivables.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.tenantAR.rows.map((row) => (
                    <TableRow key={row.tenantId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.tenantName}</span>
                          <span className="text-sm text-muted-foreground">
                            ({row.unitNumber})
                          </span>
                          {row.isVASH && (
                            <Badge
                              variant="outline"
                              className="border-amber-400 bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400"
                            >
                              VASH
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <AgingCells aging={row.aging} />
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.tenantAR.rows.length > 0 && (
                <SectionTotal label="Tenant AR Subtotal" aging={data.tenantAR.total} />
              )}
            </Table>
          </div>
        </section>

        {/* --- Funding Source AR Section --- */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Funding Source Receivable</h2>
          <div className="rounded-md border">
            <Table>
              <AgingTableHeader />
              <TableBody>
                {data.fundingSourceAR.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      No outstanding funding source receivables.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.fundingSourceAR.rows.map((row) => (
                    <TableRow key={row.fundId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.funderName}</span>
                          <span className="text-sm text-muted-foreground">
                            (Award: {formatCurrency(row.fundingAmount)})
                          </span>
                        </div>
                      </TableCell>
                      <AgingCells aging={row.aging} />
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.fundingSourceAR.rows.length > 0 && (
                <SectionTotal label="Funding Source AR Subtotal" aging={data.fundingSourceAR.total} />
              )}
            </Table>
          </div>
        </section>

        {/* --- Pledge AR Section --- */}
        <section>
          <h2 className="text-lg font-semibold mb-3">Pledges Receivable</h2>
          <div className="rounded-md border">
            <Table>
              <AgingTableHeader />
              <TableBody>
                {data.pledgeAR.rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-16 text-center text-muted-foreground">
                      No outstanding pledge receivables.
                    </TableCell>
                  </TableRow>
                ) : (
                  data.pledgeAR.rows.map((row) => (
                    <TableRow key={row.pledgeId}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{row.donorName}</span>
                          <span className="text-sm text-muted-foreground">
                            (Pledged: {formatCurrency(row.pledgeAmount)})
                          </span>
                        </div>
                      </TableCell>
                      <AgingCells aging={row.aging} />
                    </TableRow>
                  ))
                )}
              </TableBody>
              {data.pledgeAR.rows.length > 0 && (
                <SectionTotal label="Pledge AR Subtotal" aging={data.pledgeAR.total} />
              )}
            </Table>
          </div>
        </section>

        {/* --- Grand Total --- */}
        <section>
          <div className="rounded-md border bg-muted/30">
            <Table>
              <TableBody>
                <TableRow className="font-semibold text-base">
                  <TableCell className="min-w-[200px]">Grand Total</TableCell>
                  <AgingCells aging={data.grandTotal} />
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </section>
      </div>
    </ReportShell>
  )
}
