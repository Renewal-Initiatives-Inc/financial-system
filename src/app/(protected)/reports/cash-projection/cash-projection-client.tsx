'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ChevronDown, ChevronRight } from 'lucide-react'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import type { CashProjectionData } from '@/lib/reports/cash-projection'
import type { WeeklyCashProjectionData, WeeklyCashProjectionWeek } from '@/lib/reports/weekly-cash-projection'
import { formatCurrency, formatDate } from '@/lib/reports/types'

interface CashProjectionClientProps {
  initialData: CashProjectionData
  initialWeeklyData: WeeklyCashProjectionData | null
  initialView: 'monthly' | 'weekly'
}

const CONFIDENCE_ICONS: Record<string, string> = {
  HIGH: '●',
  MODERATE: '◐',
  LOW: '◯',
}

const CONFIDENCE_COLORS: Record<string, string> = {
  HIGH: 'text-green-600',
  MODERATE: 'text-yellow-600',
  LOW: 'text-gray-400',
}

export function CashProjectionClient({
  initialData,
  initialWeeklyData,
  initialView,
}: CashProjectionClientProps) {
  const router = useRouter()
  const [view, setView] = useState<'monthly' | 'weekly'>(initialView)
  const [data] = useState(initialData)
  const [weeklyData] = useState(initialWeeklyData)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set())

  const handleViewChange = (newView: 'monthly' | 'weekly') => {
    setView(newView)
    router.push(`/reports/cash-projection?view=${newView}`)
  }

  const toggleWeekExpand = (weekNumber: number) => {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(weekNumber)) {
        next.delete(weekNumber)
      } else {
        next.add(weekNumber)
      }
      return next
    })
  }

  // View toggle buttons
  const viewToggle = (
    <div className="flex gap-1 rounded-md border p-0.5" data-testid="cash-projection-view-toggle">
      <Button
        variant={view === 'monthly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleViewChange('monthly')}
        data-testid="cash-projection-monthly-btn"
      >
        Monthly
      </Button>
      <Button
        variant={view === 'weekly' ? 'default' : 'ghost'}
        size="sm"
        onClick={() => handleViewChange('weekly')}
        data-testid="cash-projection-weekly-btn"
      >
        Weekly
      </Button>
    </div>
  )

  // --- MONTHLY VIEW (existing) ---
  if (view === 'monthly') {
    if (!data.projectionId || data.months.length === 0) {
      return (
        <ReportShell
          title="Cash Projection"
          generatedAt={data.generatedAt}
          reportSlug="cash-projection"
        >
          {viewToggle}
          <div className="text-center py-12 text-muted-foreground">
            No cash projection data available. Create a cash projection in the Budget module first.
          </div>
        </ReportShell>
      )
    }

    const exportRows: Record<string, unknown>[] = []
    for (const month of data.months) {
      for (const line of month.inflows) {
        exportRows.push({
          Month: month.monthLabel,
          Type: 'Inflow',
          Source: line.sourceLabel,
          'Auto Amount': line.autoAmount,
          'Override Amount': line.overrideAmount ?? '',
          'Effective Amount': line.effectiveAmount,
          Note: line.overrideNote ?? '',
        })
      }
      for (const line of month.outflows) {
        exportRows.push({
          Month: month.monthLabel,
          Type: 'Outflow',
          Source: line.sourceLabel,
          'Auto Amount': line.autoAmount,
          'Override Amount': line.overrideAmount ?? '',
          'Effective Amount': line.effectiveAmount,
          Note: line.overrideNote ?? '',
        })
      }
    }

    const exportColumns = [
      'Month',
      'Type',
      'Source',
      'Auto Amount',
      'Override Amount',
      'Effective Amount',
      'Note',
    ]

    return (
      <ReportShell
        title="3-Month Cash Projection"
        generatedAt={data.generatedAt}
        reportSlug="cash-projection"
        exportData={exportRows}
        exportColumns={exportColumns}
      >
        {viewToggle}
        <p className="text-sm text-muted-foreground">
          Fiscal Year {data.fiscalYear} — As of {formatDate(data.asOfDate)}
        </p>

        <div
          className="grid grid-cols-2 md:grid-cols-4 gap-4"
          data-testid="cash-projection-summary"
        >
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Starting Cash
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {formatCurrency(data.startingCash)}
              </div>
            </CardContent>
          </Card>
          {data.months.map((m, i) => (
            <Card key={m.month}>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  End of {m.monthLabel}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${data.endingCashByMonth[i] < 0 ? 'text-red-600' : ''}`}
                >
                  {formatCurrency(data.endingCashByMonth[i])}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {data.months.map((month, i) => (
          <div key={month.month} className="space-y-2">
            <h2 className="text-lg font-semibold">{month.monthLabel}</h2>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Source</TableHead>
                    <TableHead className="text-right">Auto</TableHead>
                    <TableHead className="text-right">Override</TableHead>
                    <TableHead className="text-right">Effective</TableHead>
                    <TableHead>Note</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="bg-green-50/50">
                    <TableCell
                      colSpan={5}
                      className="font-semibold text-sm text-green-800"
                    >
                      Inflows
                    </TableCell>
                  </TableRow>
                  {month.inflows.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm pl-6">
                        {line.sourceLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(line.autoAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {line.overrideAmount !== null ? (
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(line.overrideAmount)}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatCurrency(line.effectiveAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {line.overrideNote ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                  <TableRow className="bg-red-50/50">
                    <TableCell
                      colSpan={5}
                      className="font-semibold text-sm text-red-800"
                    >
                      Outflows
                    </TableCell>
                  </TableRow>
                  {month.outflows.map((line) => (
                    <TableRow key={line.id}>
                      <TableCell className="text-sm pl-6">
                        {line.sourceLabel}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {formatCurrency(line.autoAmount)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm">
                        {line.overrideAmount !== null ? (
                          <Badge variant="outline" className="text-xs">
                            {formatCurrency(line.overrideAmount)}
                          </Badge>
                        ) : (
                          '—'
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-sm font-medium">
                        {formatCurrency(line.effectiveAmount)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                        {line.overrideNote ?? ''}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Net Cash Flow</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell
                      className={`text-right font-semibold ${month.netCashFlow < 0 ? 'text-red-600' : 'text-green-600'}`}
                    >
                      {formatCurrency(month.netCashFlow)}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                  <TableRow>
                    <TableCell className="font-semibold">Ending Cash</TableCell>
                    <TableCell />
                    <TableCell />
                    <TableCell
                      className={`text-right font-bold ${data.endingCashByMonth[i] < 0 ? 'text-red-600' : ''}`}
                    >
                      {formatCurrency(data.endingCashByMonth[i])}
                    </TableCell>
                    <TableCell />
                  </TableRow>
                </TableFooter>
              </Table>
            </div>
          </div>
        ))}
      </ReportShell>
    )
  }

  // --- WEEKLY VIEW ---
  if (!weeklyData || !weeklyData.projectionId || weeklyData.weeks.length === 0) {
    return (
      <ReportShell
        title="13-Week Cash Forecast"
        generatedAt={weeklyData?.generatedAt ?? new Date().toISOString()}
        reportSlug="cash-projection"
      >
        {viewToggle}
        <div className="text-center py-12 text-muted-foreground">
          No weekly cash projection data available. Generate one in the Budget module first.
        </div>
      </ReportShell>
    )
  }

  // Build weekly export data
  const weeklyExportRows: Record<string, unknown>[] = []
  for (const week of weeklyData.weeks) {
    for (const line of [...week.inflows, ...week.outflows]) {
      weeklyExportRows.push({
        Week: week.weekLabel,
        'Week Start': week.weekStartDate,
        Type: line.lineType,
        Source: line.sourceLabel,
        Confidence: line.confidenceLevel,
        'Auto Amount': line.autoAmount,
        'Override Amount': line.overrideAmount ?? '',
        'Effective Amount': line.effectiveAmount,
        Note: line.overrideNote ?? '',
      })
    }
    // Summary row per week
    weeklyExportRows.push({
      Week: week.weekLabel,
      'Week Start': week.weekStartDate,
      Type: 'SUMMARY',
      Source: 'Net Cash Flow',
      Confidence: week.confidenceLevel,
      'Auto Amount': '',
      'Override Amount': '',
      'Effective Amount': week.netCashFlow,
      Note: '',
    })
  }

  const weeklyExportColumns = [
    'Week',
    'Week Start',
    'Type',
    'Source',
    'Confidence',
    'Auto Amount',
    'Override Amount',
    'Effective Amount',
    'Note',
  ]

  return (
    <ReportShell
      title="13-Week Cash Forecast"
      generatedAt={weeklyData.generatedAt}
      reportSlug="cash-projection"
      exportData={weeklyExportRows}
      exportColumns={weeklyExportColumns}
    >
      {viewToggle}

      <p className="text-sm text-muted-foreground">
        Fiscal Year {weeklyData.fiscalYear} — As of {formatDate(weeklyData.asOfDate)}
      </p>

      {/* Starting cash and summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="weekly-projection-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Starting Cash
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(weeklyData.startingCash)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Unrestricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(
                weeklyData.startingCash -
                  (weeklyData.weeks.length > 0
                    ? weeklyData.weeks[weeklyData.weeks.length - 1].restrictedBalance
                    : 0)
              )}
            </div>
            <p className="text-xs text-muted-foreground">at start</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Week 13 Ending
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.weeks.length > 0 && (
              <>
                <div
                  className={`text-2xl font-bold ${weeklyData.weeks[weeklyData.weeks.length - 1].endingCash < 0 ? 'text-red-600' : ''}`}
                >
                  {formatCurrency(weeklyData.weeks[weeklyData.weeks.length - 1].endingCash)}
                </div>
                <p className="text-xs text-muted-foreground">total balance</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Wk 13 Unrestricted
            </CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.weeks.length > 0 && (
              <>
                <div
                  className={`text-2xl font-bold ${weeklyData.weeks[weeklyData.weeks.length - 1].isWarning || weeklyData.weeks[weeklyData.weeks.length - 1].isCritical ? 'text-red-600' : ''}`}
                >
                  {formatCurrency(weeklyData.weeks[weeklyData.weeks.length - 1].unrestrictedBalance)}
                </div>
                {weeklyData.weeks[weeklyData.weeks.length - 1].isCritical && (
                  <Badge variant="destructive" className="text-xs mt-1">Critical</Badge>
                )}
                {weeklyData.weeks[weeklyData.weeks.length - 1].isWarning && (
                  <Badge variant="outline" className="text-xs mt-1 border-yellow-500 text-yellow-700">Warning</Badge>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Weekly forecast table */}
      <div className="rounded-md border" data-testid="weekly-forecast-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]"></TableHead>
              <TableHead>Week</TableHead>
              <TableHead className="text-right">Inflow</TableHead>
              <TableHead className="text-right">Outflow</TableHead>
              <TableHead className="text-right">Net</TableHead>
              <TableHead className="text-right">End $</TableHead>
              <TableHead className="text-right">Unrest. $</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {weeklyData.weeks.map((week) => (
              <WeekRow
                key={week.weekNumber}
                week={week}
                isExpanded={expandedWeeks.has(week.weekNumber)}
                onToggle={() => toggleWeekExpand(week.weekNumber)}
              />
            ))}
          </TableBody>
          <TableFooter>
            <TableRow>
              <TableCell colSpan={7} className="text-xs text-muted-foreground">
                <span className={`${CONFIDENCE_COLORS.HIGH} mr-3`}>● High confidence</span>
                <span className={`${CONFIDENCE_COLORS.MODERATE} mr-3`}>◐ Moderate</span>
                <span className={`${CONFIDENCE_COLORS.LOW} mr-3`}>◯ Low</span>
                {weeklyData.weeks.some((w) => w.isWarning || w.isCritical) && (
                  <span className="text-red-600">
                    ⚠ Unrestricted cash below {formatCurrency(weeklyData.thresholdWarning)} threshold
                  </span>
                )}
              </TableCell>
            </TableRow>
          </TableFooter>
        </Table>
      </div>
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// Week Row with expand/collapse
// ---------------------------------------------------------------------------

function WeekRow({
  week,
  isExpanded,
  onToggle,
}: {
  week: WeeklyCashProjectionWeek
  isExpanded: boolean
  onToggle: () => void
}) {
  const hasThresholdAlert = week.isWarning || week.isCritical

  return (
    <>
      <TableRow
        className={`cursor-pointer hover:bg-muted/50 ${hasThresholdAlert ? 'bg-red-50/30' : ''}`}
        onClick={onToggle}
        data-testid={`weekly-forecast-row-${week.weekNumber}`}
      >
        <TableCell className="w-[50px]">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">
          <span className={`mr-1 ${CONFIDENCE_COLORS[week.confidenceLevel]}`}>
            {CONFIDENCE_ICONS[week.confidenceLevel]}
          </span>
          {week.weekLabel}
        </TableCell>
        <TableCell className="text-right tabular-nums text-green-700">
          {formatCurrency(week.totalInflows)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-red-700">
          {formatCurrency(week.totalOutflows)}
        </TableCell>
        <TableCell
          className={`text-right tabular-nums font-medium ${week.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}
        >
          {formatCurrency(week.netCashFlow)}
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {formatCurrency(week.endingCash)}
        </TableCell>
        <TableCell className="text-right tabular-nums font-medium">
          {hasThresholdAlert && <span className="mr-1">⚠</span>}
          <span className={hasThresholdAlert ? 'text-red-600 font-bold' : ''}>
            {formatCurrency(week.unrestrictedBalance)}
          </span>
        </TableCell>
      </TableRow>

      {/* Expanded line detail */}
      {isExpanded && (
        <>
          {week.inflows.length > 0 && (
            <TableRow className="bg-green-50/30">
              <TableCell />
              <TableCell
                colSpan={6}
                className="text-xs font-semibold text-green-800"
              >
                Inflows
              </TableCell>
            </TableRow>
          )}
          {week.inflows.map((line) => (
            <TableRow key={line.id} className="bg-green-50/10">
              <TableCell />
              <TableCell className="text-xs pl-8">
                <span className={`mr-1 ${CONFIDENCE_COLORS[line.confidenceLevel]}`}>
                  {CONFIDENCE_ICONS[line.confidenceLevel]}
                </span>
                {line.sourceLabel}
              </TableCell>
              <TableCell className="text-right tabular-nums text-xs">
                {formatCurrency(line.effectiveAmount)}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell />
              <TableCell className="text-xs text-muted-foreground">
                {line.fundRestrictionType === 'RESTRICTED' && (
                  <Badge variant="outline" className="text-xs">Restricted</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
          {week.outflows.length > 0 && (
            <TableRow className="bg-red-50/30">
              <TableCell />
              <TableCell
                colSpan={6}
                className="text-xs font-semibold text-red-800"
              >
                Outflows
              </TableCell>
            </TableRow>
          )}
          {week.outflows.map((line) => (
            <TableRow key={line.id} className="bg-red-50/10">
              <TableCell />
              <TableCell className="text-xs pl-8">
                <span className={`mr-1 ${CONFIDENCE_COLORS[line.confidenceLevel]}`}>
                  {CONFIDENCE_ICONS[line.confidenceLevel]}
                </span>
                {line.sourceLabel}
              </TableCell>
              <TableCell />
              <TableCell className="text-right tabular-nums text-xs">
                {formatCurrency(line.effectiveAmount)}
              </TableCell>
              <TableCell />
              <TableCell />
              <TableCell className="text-xs text-muted-foreground">
                {line.fundRestrictionType === 'RESTRICTED' && (
                  <Badge variant="outline" className="text-xs">Restricted</Badge>
                )}
              </TableCell>
            </TableRow>
          ))}
        </>
      )}
    </>
  )
}
