'use client'

import { useState } from 'react'
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
import { formatCurrency } from '@/lib/reports/types'
import type {
  GrantComplianceData,
  GrantComplianceRow,
} from '@/lib/reports/grant-compliance'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string) {
  switch (status) {
    case 'ACTIVE':
      return <Badge className="bg-green-600 text-white">Active</Badge>
    case 'COMPLETED':
      return <Badge variant="secondary">Completed</Badge>
    case 'CANCELLED':
      return <Badge variant="outline">Cancelled</Badge>
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}

function typeBadge(type: string) {
  if (type === 'CONDITIONAL') {
    return (
      <Badge className="bg-amber-500 text-white">Conditional</Badge>
    )
  }
  return (
    <Badge className="bg-green-600 text-white">Unconditional</Badge>
  )
}

function formatDaysRemaining(days: number | null): string {
  if (days === null) return '-'
  if (days < 0) return `${Math.abs(days)}d overdue`
  return `${days}d`
}

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

// ---------------------------------------------------------------------------
// Expandable Row
// ---------------------------------------------------------------------------

function GrantRow({ row }: { row: GrantComplianceRow }) {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${
          row.isAtRisk ? 'border-l-4 border-l-destructive' : ''
        }`}
        onClick={() => setIsExpanded(!isExpanded)}
        data-testid={`grant-row-${row.grantId}`}
      >
        <TableCell className="font-medium">{row.funderName}</TableCell>
        <TableCell>{row.fundName}</TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(row.awardAmount)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(row.amountSpent)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatCurrency(row.amountRemaining)}
        </TableCell>
        <TableCell className="text-right tabular-nums">
          {formatPercent(row.spentPercent)}
        </TableCell>
        <TableCell
          className={`text-right tabular-nums ${
            row.daysRemaining !== null && row.daysRemaining < 0
              ? 'text-destructive font-semibold'
              : row.daysRemaining !== null && row.daysRemaining <= 90
                ? 'text-amber-600 dark:text-amber-400 font-medium'
                : ''
          }`}
        >
          {formatDaysRemaining(row.daysRemaining)}
        </TableCell>
        <TableCell>{statusBadge(row.status)}</TableCell>
        <TableCell>{typeBadge(row.type)}</TableCell>
      </TableRow>

      {/* Expanded detail */}
      {isExpanded && (
        <TableRow data-testid={`grant-detail-${row.grantId}`}>
          <TableCell colSpan={9} className="bg-muted/30 px-6 py-4">
            <div className="space-y-3">
              {/* Conditions (conditional grants) */}
              {row.type === 'CONDITIONAL' && row.conditions && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Conditions
                  </p>
                  <p className="text-sm">{row.conditions}</p>
                </div>
              )}

              {/* Date range */}
              <div className="flex gap-6 text-sm">
                <div>
                  <span className="text-muted-foreground">Start: </span>
                  <span>
                    {row.startDate
                      ? new Date(row.startDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">End: </span>
                  <span>
                    {row.endDate
                      ? new Date(row.endDate).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'short',
                          day: 'numeric',
                        })
                      : '-'}
                  </span>
                </div>
              </div>

              {/* Milestones */}
              {row.milestones.length > 0 ? (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                    Milestones
                  </p>
                  <ul className="space-y-1">
                    {row.milestones.map((m, idx) => (
                      <li key={idx} className="flex items-center gap-2 text-sm">
                        <span
                          className={`inline-block w-4 h-4 rounded-full border ${
                            m.completed
                              ? 'bg-green-500 border-green-600'
                              : 'bg-muted border-border'
                          }`}
                        />
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
              ) : (
                <p className="text-sm text-muted-foreground">
                  No milestones found for this grant.
                </p>
              )}

              {/* At-risk warning */}
              {row.isAtRisk && (
                <div className="rounded-md border border-destructive bg-destructive/10 p-3">
                  <p className="text-sm font-medium text-destructive">
                    {row.daysRemaining !== null && row.daysRemaining < 0
                      ? `This grant is ${Math.abs(row.daysRemaining)} days past its end date and still active.`
                      : `This grant ends in ${row.daysRemaining} days with only ${formatPercent(row.spentPercent)} spent.`}
                  </p>
                </div>
              )}
            </div>
          </TableCell>
        </TableRow>
      )}
    </>
  )
}

// ---------------------------------------------------------------------------
// CSV export builder
// ---------------------------------------------------------------------------

function buildExportData(
  rows: GrantComplianceRow[]
): Record<string, string>[] {
  return rows.map((r) => ({
    Funder: r.funderName,
    Fund: r.fundName,
    Award: formatCurrency(r.awardAmount),
    Spent: formatCurrency(r.amountSpent),
    Remaining: formatCurrency(r.amountRemaining),
    '% Used': formatPercent(r.spentPercent),
    'Days Left': formatDaysRemaining(r.daysRemaining),
    Status: r.status,
    Type: r.type,
    'At Risk': r.isAtRisk ? 'YES' : '',
  }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface GrantComplianceClientProps {
  data: GrantComplianceData
}

export function GrantComplianceClient({ data }: GrantComplianceClientProps) {
  const exportData = buildExportData(data.rows)

  return (
    <ReportShell
      title="Grant Compliance Tracking"
      reportSlug="grant-compliance"
      exportData={exportData}
      exportColumns={[
        'Funder',
        'Fund',
        'Award',
        'Spent',
        'Remaining',
        '% Used',
        'Days Left',
        'Status',
        'Type',
        'At Risk',
      ]}
    >
      {/* Summary cards */}
      <div
        className="grid grid-cols-1 md:grid-cols-4 gap-4"
        data-testid="grant-compliance-summary"
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Active Grants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="active-grants-count">
              {data.activeGrants}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Awards
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-awards">
              {formatCurrency(data.totalAwards)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Spent
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="total-spent">
              {formatCurrency(data.totalSpent)}
            </div>
          </CardContent>
        </Card>
        <Card className={data.atRiskGrants > 0 ? 'border-destructive/50 bg-destructive/5' : ''}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              At-Risk Grants
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div
              className={`text-2xl font-bold ${
                data.atRiskGrants > 0
                  ? 'text-destructive'
                  : 'text-green-600 dark:text-green-400'
              }`}
              data-testid="at-risk-count"
            >
              {data.atRiskGrants}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Grants table */}
      <div className="rounded-md border" data-testid="grant-compliance-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Funder</TableHead>
              <TableHead>Fund</TableHead>
              <TableHead className="text-right">Award</TableHead>
              <TableHead className="text-right">Spent</TableHead>
              <TableHead className="text-right">Remaining</TableHead>
              <TableHead className="text-right">% Used</TableHead>
              <TableHead className="text-right">Days Left</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Type</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center">
                  No grants found.
                </TableCell>
              </TableRow>
            ) : (
              data.rows.map((row) => (
                <GrantRow key={row.grantId} row={row} />
              ))
            )}
          </TableBody>
          {data.rows.length > 0 && (
            <TableFooter>
              <TableRow>
                <TableCell colSpan={2} className="font-semibold">
                  Totals
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(data.totalAwards)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(data.totalSpent)}
                </TableCell>
                <TableCell className="text-right font-semibold tabular-nums">
                  {formatCurrency(data.totalAwards - data.totalSpent)}
                </TableCell>
                <TableCell colSpan={4} />
              </TableRow>
            </TableFooter>
          )}
        </Table>
      </div>
    </ReportShell>
  )
}
