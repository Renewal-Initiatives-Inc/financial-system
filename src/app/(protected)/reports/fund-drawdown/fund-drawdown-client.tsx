'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ReportShell } from '@/components/reports/report-shell'
import { Fragment } from 'react'
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
import { formatCurrency, formatPercent } from '@/lib/reports/types'
import type { FundDrawdownData, FundDrawdownRow } from '@/lib/reports/fund-drawdown'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function drawdownColor(pct: number): string {
  if (pct >= 90) return 'bg-destructive'
  if (pct >= 70) return 'bg-yellow-500'
  return 'bg-primary'
}

function statusBadgeVariant(
  status: string
): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'ACTIVE':
      return 'default'
    case 'COMPLETED':
      return 'secondary'
    case 'CANCELLED':
      return 'destructive'
    default:
      return 'outline'
  }
}

// ---------------------------------------------------------------------------
// CSV export builder
// ---------------------------------------------------------------------------

function buildExportData(rows: FundDrawdownRow[]) {
  return rows.map((r) => ({
    Fund: r.fundName,
    Awarded: formatCurrency(r.totalAwarded),
    Spent: formatCurrency(r.totalSpent),
    Released: formatCurrency(r.totalReleased),
    Remaining: formatCurrency(r.remaining),
    'Draw-Down %': formatPercent(r.drawdownPercent),
  }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface FundDrawdownClientProps {
  data: FundDrawdownData
}

export function FundDrawdownClient({ data }: FundDrawdownClientProps) {
  const router = useRouter()
  const [expandedFundId, setExpandedFundId] = useState<number | null>(null)

  const toggleExpand = (fundId: number) => {
    setExpandedFundId((prev) => (prev === fundId ? null : fundId))
  }

  const exportData = buildExportData(data.rows)

  return (
    <ReportShell
      title="Fund Draw-Down / Restricted Funding Status"
      reportSlug="fund-drawdown"
      exportData={exportData}
      exportColumns={[
        'Fund',
        'Awarded',
        'Spent',
        'Released',
        'Remaining',
        'Draw-Down %',
      ]}
    >
      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Awarded
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalAwarded)}
            </div>
            <p className="text-xs text-muted-foreground">
              Across {data.rows.length} restricted fund{data.rows.length !== 1 ? 's' : ''}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalSpent)}
            </div>
            <p className="text-xs text-muted-foreground">
              Expenses charged to restricted funds
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Remaining
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(data.totalRemaining)}
            </div>
            <p className="text-xs text-muted-foreground">
              Available restricted balance
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Main table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[200px]">Fund</TableHead>
              <TableHead className="text-right">Awarded</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Released</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="w-[180px]">Draw-Down %</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center">
                  No restricted funds found.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <Fragment key={row.fundId}>
                  {/* Main row */}
                  <TableRow
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(row.fundId)}
                    data-testid={`fund-row-${row.fundId}`}
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <span
                          className="text-xs text-muted-foreground transition-transform"
                          style={{
                            transform:
                              expandedFundId === row.fundId
                                ? 'rotate(90deg)'
                                : 'rotate(0deg)',
                          }}
                        >
                          {'\u25B6'}
                        </span>
                        {row.fundName}
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totalAwarded)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totalSpent)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.totalReleased)}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {formatCurrency(row.remaining)}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${drawdownColor(row.drawdownPercent)}`}
                            style={{
                              width: `${Math.min(row.drawdownPercent, 100)}%`,
                            }}
                          />
                        </div>
                        <span className="text-xs font-mono w-12 text-right">
                          {row.drawdownPercent.toFixed(1)}%
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail */}
                  {expandedFundId === row.fundId && (
                    <TableRow
                      key={`${row.fundId}-detail`}
                      data-testid={`fund-detail-${row.fundId}`}
                    >
                      <TableCell colSpan={6} className="bg-muted/30 p-4">
                        <div className="space-y-4">
                          {/* Contract Terms */}
                          <div>
                            <h4 className="text-sm font-semibold mb-2">
                              Contract Terms
                            </h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 rounded-md border bg-background p-4">
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Funder
                                </p>
                                <p className="text-sm font-medium mt-1">
                                  {row.funderName ?? '--'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Funding Amount
                                </p>
                                <p className="text-sm font-mono mt-1">
                                  {row.fundingAmount != null
                                    ? formatCurrency(Number(row.fundingAmount))
                                    : '--'}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Funding Type
                                </p>
                                <p className="text-sm mt-1">
                                  {row.fundingType ? (
                                    <Badge variant="outline">
                                      {row.fundingType}
                                    </Badge>
                                  ) : (
                                    '--'
                                  )}
                                </p>
                              </div>
                              <div>
                                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                  Status
                                </p>
                                <p className="text-sm mt-1">
                                  {row.fundingStatus ? (
                                    <Badge
                                      variant={statusBadgeVariant(
                                        row.fundingStatus
                                      )}
                                    >
                                      {row.fundingStatus}
                                    </Badge>
                                  ) : (
                                    '--'
                                  )}
                                </p>
                              </div>
                              {row.conditions && (
                                <div className="col-span-2 md:col-span-4">
                                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                                    Conditions
                                  </p>
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {row.conditions}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Milestones */}
                          {row.milestones.length > 0 && (
                            <div>
                              <h4 className="text-sm font-semibold mb-2">
                                Milestones
                              </h4>
                              <ul className="space-y-1">
                                {row.milestones.map((m, idx) => (
                                  <li
                                    key={idx}
                                    className="flex items-center gap-2 text-sm"
                                  >
                                    <span
                                      className={
                                        m.completed
                                          ? 'text-green-600'
                                          : 'text-muted-foreground'
                                      }
                                    >
                                      {m.completed ? '\u2713' : '\u25CB'}
                                    </span>
                                    <span
                                      className={
                                        m.completed
                                          ? 'line-through text-muted-foreground'
                                          : ''
                                      }
                                    >
                                      {m.description}
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell className="font-semibold">Totals</TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(data.totalAwarded)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(data.totalSpent)}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(
                    data.rows.reduce((s, r) => s + r.totalReleased, 0)
                  )}
                </TableCell>
                <TableCell className="text-right font-semibold font-mono">
                  {formatCurrency(data.totalRemaining)}
                </TableCell>
                <TableCell>
                  {data.totalAwarded > 0 && (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full ${drawdownColor(
                            (data.totalSpent / data.totalAwarded) * 100
                          )}`}
                          style={{
                            width: `${Math.min(
                              (data.totalSpent / data.totalAwarded) * 100,
                              100
                            )}%`,
                          }}
                        />
                      </div>
                      <span className="text-xs font-mono w-12 text-right">
                        {((data.totalSpent / data.totalAwarded) * 100).toFixed(
                          1
                        )}
                        %
                      </span>
                    </div>
                  )}
                </TableCell>
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>

      {/* Back link */}
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
