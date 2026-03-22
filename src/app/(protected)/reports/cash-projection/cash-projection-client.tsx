'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronDown, ChevronRight, Settings, RefreshCw } from 'lucide-react'
import { toast } from 'sonner'
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import type { CashProjectionData, CashProjectionMonth, CashProjectionLine } from '@/lib/reports/cash-projection'
import type { WeeklyCashProjectionData, WeeklyCashProjectionWeek, WeeklyCashProjectionLine } from '@/lib/reports/weekly-cash-projection'
import { formatCurrency, formatDate } from '@/lib/reports/types'

const MONTHLY_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'month', label: 'Month', format: 'text' },
  { key: 'type', label: 'Type', format: 'text' },
  { key: 'source', label: 'Source', format: 'text' },
  { key: 'autoAmount', label: 'Auto Amount', format: 'currency' },
  { key: 'overrideAmount', label: 'Override Amount', format: 'currency' },
  { key: 'effectiveAmount', label: 'Effective Amount', format: 'currency' },
]

const WEEKLY_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'week', label: 'Week', format: 'text' },
  { key: 'weekStartDate', label: 'Week Start', format: 'date' },
  { key: 'type', label: 'Type', format: 'text' },
  { key: 'source', label: 'Source', format: 'text' },
  { key: 'confidence', label: 'Confidence', format: 'text' },
  { key: 'autoAmount', label: 'Auto Amount', format: 'currency' },
  { key: 'overrideAmount', label: 'Override Amount', format: 'currency' },
  { key: 'effectiveAmount', label: 'Effective Amount', format: 'currency' },
]
import {
  regenerateMonthlyProjectionAction,
  regenerateWeeklyProjectionAction,
  saveMonthlyOverrideAction,
  saveWeeklyOverrideAction,
} from '../actions'

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

// ---------------------------------------------------------------------------
// Inline override input — saves on blur
// ---------------------------------------------------------------------------

function OverrideInput({
  lineId,
  projectionId,
  currentOverride,
  autoAmount,
  mode,
  onSaved,
}: {
  lineId: number
  projectionId: number
  currentOverride: number | null
  autoAmount: number
  mode: 'monthly' | 'weekly'
  onSaved: (lineId: number, newOverride: number | null) => void
}) {
  const [value, setValue] = useState(
    currentOverride !== null ? currentOverride.toString() : ''
  )
  const [saving, setSaving] = useState(false)

  const handleBlur = async () => {
    const parsed = value.trim() === '' ? null : parseFloat(value)
    // Skip if nothing changed
    if (parsed === currentOverride) return
    if (parsed !== null && isNaN(parsed)) return

    setSaving(true)
    const action =
      mode === 'monthly' ? saveMonthlyOverrideAction : saveWeeklyOverrideAction
    const result = await action(projectionId, lineId, parsed)
    setSaving(false)

    if ('error' in result) {
      toast.error(result.error)
    } else {
      onSaved(lineId, parsed)
    }
  }

  return (
    <Input
      type="number"
      step="0.01"
      placeholder={autoAmount.toFixed(2)}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
      }}
      className={`h-7 w-24 text-right text-xs tabular-nums ${saving ? 'opacity-50' : ''} ${value ? 'border-blue-400' : ''}`}
      onClick={(e) => e.stopPropagation()}
      data-testid={`override-input-${lineId}`}
    />
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export function CashProjectionClient({
  initialData,
  initialWeeklyData,
  initialView,
}: CashProjectionClientProps) {
  const router = useRouter()
  const [view, setView] = useState<'monthly' | 'weekly'>(initialView)
  const [data, setData] = useState(initialData)
  const [weeklyData, setWeeklyData] = useState(initialWeeklyData)
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set())
  const [regenerating, setRegenerating] = useState(false)

  const handleViewChange = (newView: 'monthly' | 'weekly') => {
    setView(newView)
    router.push(`/reports/cash-projection?view=${newView}`)
  }

  const handleRegenerate = async () => {
    setRegenerating(true)
    try {
      const [monthlyResult, weeklyResult] = await Promise.all([
        regenerateMonthlyProjectionAction(),
        regenerateWeeklyProjectionAction(),
      ])
      if ('error' in monthlyResult) {
        toast.error(`Monthly: ${monthlyResult.error}`)
      } else if ('error' in weeklyResult) {
        toast.error(`Weekly: ${weeklyResult.error}`)
      } else {
        toast.success('Cash projections regenerated')
      }
      router.refresh()
    } catch {
      toast.error('Failed to regenerate projections')
    } finally {
      setRegenerating(false)
    }
  }

  const toggleExpand = (key: string) => {
    setExpandedRows((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  // Apply a local override to monthly data and recalculate
  const applyMonthlyOverride = useCallback(
    (lineId: number, newOverride: number | null) => {
      setData((prev) => {
        const updated = { ...prev, months: prev.months.map((m) => ({ ...m })) }
        for (const month of updated.months) {
          const allLines = [...month.inflows, ...month.outflows]
          const line = allLines.find((l) => l.id === lineId)
          if (line) {
            line.overrideAmount = newOverride
            line.effectiveAmount = newOverride ?? line.autoAmount
            // Rebuild month totals from the modified arrays
            month.inflows = month.inflows.map((l) =>
              l.id === lineId ? { ...l, overrideAmount: newOverride, effectiveAmount: newOverride ?? l.autoAmount } : l
            )
            month.outflows = month.outflows.map((l) =>
              l.id === lineId ? { ...l, overrideAmount: newOverride, effectiveAmount: newOverride ?? l.autoAmount } : l
            )
            month.totalInflows = month.inflows.reduce((s, l) => s + l.effectiveAmount, 0)
            month.totalOutflows = month.outflows.reduce((s, l) => s + l.effectiveAmount, 0)
            month.netCashFlow = Math.round((month.totalInflows - month.totalOutflows) * 100) / 100
            break
          }
        }
        // Recalculate ending cash
        let running = updated.startingCash
        updated.endingCashByMonth = updated.months.map((m) => {
          running += m.netCashFlow
          return Math.round(running * 100) / 100
        })
        return updated
      })
    },
    []
  )

  // Apply a local override to weekly data and recalculate
  const applyWeeklyOverride = useCallback(
    (lineId: number, newOverride: number | null) => {
      setWeeklyData((prev) => {
        if (!prev) return prev
        const updated = { ...prev, weeks: prev.weeks.map((w) => ({ ...w })) }
        for (const week of updated.weeks) {
          const allLines = [...week.inflows, ...week.outflows]
          const found = allLines.find((l) => l.id === lineId)
          if (found) {
            week.inflows = week.inflows.map((l) =>
              l.id === lineId ? { ...l, overrideAmount: newOverride, effectiveAmount: newOverride ?? l.autoAmount } : l
            )
            week.outflows = week.outflows.map((l) =>
              l.id === lineId ? { ...l, overrideAmount: newOverride, effectiveAmount: newOverride ?? l.autoAmount } : l
            )
            week.totalInflows = week.inflows.reduce((s, l) => s + l.effectiveAmount, 0)
            week.totalOutflows = week.outflows.reduce((s, l) => s + l.effectiveAmount, 0)
            week.netCashFlow = Math.round((week.totalInflows - week.totalOutflows) * 100) / 100
            break
          }
        }
        // Recalculate ending cash across all weeks
        let running = updated.startingCash
        for (const w of updated.weeks) {
          running += w.netCashFlow
          w.endingCash = Math.round(running * 100) / 100
        }
        return updated
      })
    },
    []
  )

  // --- View toggle ---
  const viewToggle = (
    <div className="flex items-center gap-2">
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
      <Button
        variant="outline"
        size="sm"
        onClick={handleRegenerate}
        disabled={regenerating}
        data-testid="cash-projection-regenerate-btn"
      >
        <RefreshCw className={`mr-1 h-3.5 w-3.5 ${regenerating ? 'animate-spin' : ''}`} />
        {regenerating ? 'Regenerating...' : 'Regenerate'}
      </Button>
      <Button variant="ghost" size="icon" asChild>
        <Link href="/settings/cash-thresholds" data-testid="cash-forecast-settings-link">
          <Settings className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  )

  // =========================================================================
  // MONTHLY VIEW — collapsible table (mirrors weekly format)
  // =========================================================================
  if (view === 'monthly') {
    if (!data.projectionId || data.months.length === 0) {
      return (
        <ReportShell title="Cash Projection" generatedAt={data.generatedAt} reportSlug="cash-projection">
          {viewToggle}
          <div className="text-center py-12 text-muted-foreground">
            No monthly cash projection data available. Click Regenerate above to create one.
          </div>
        </ReportShell>
      )
    }

    const exportRows: Record<string, unknown>[] = []
    for (const month of data.months) {
      for (const line of [...month.inflows, ...month.outflows]) {
        exportRows.push({
          month: month.monthLabel,
          type: line.lineType === 'INFLOW' ? 'Inflow' : 'Outflow',
          source: line.sourceLabel,
          autoAmount: line.autoAmount,
          overrideAmount: line.overrideAmount,
          effectiveAmount: line.effectiveAmount,
        })
      }
    }

    return (
      <ReportShell
        title="3-Month Cash Projection"
        generatedAt={data.generatedAt}
        reportSlug="cash-projection"
        exportData={exportRows}
        csvColumns={MONTHLY_CSV_COLUMNS}
        filters={{ view: 'monthly' }}
      >
        {viewToggle}
        <p className="text-sm text-muted-foreground">
          Fiscal Year {data.fiscalYear} — As of {formatDate(data.asOfDate)}
        </p>

        {/* Summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="cash-projection-summary">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Starting Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.startingCash)}</div>
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
                <div className={`text-2xl font-bold ${data.endingCashByMonth[i] < 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(data.endingCashByMonth[i])}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Collapsible monthly table */}
        <div className="rounded-md border" data-testid="monthly-forecast-table">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[50px]" />
                <TableHead>Month</TableHead>
                <TableHead className="text-right">Inflow</TableHead>
                <TableHead className="text-right">Outflow</TableHead>
                <TableHead className="text-right">Net</TableHead>
                <TableHead className="text-right">Ending Cash</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.months.map((month, i) => (
                <MonthRow
                  key={month.month}
                  month={month}
                  endingCash={data.endingCashByMonth[i]}
                  isExpanded={expandedRows.has(`m-${month.month}`)}
                  onToggle={() => toggleExpand(`m-${month.month}`)}
                  projectionId={data.projectionId!}
                  onOverrideSaved={applyMonthlyOverride}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      </ReportShell>
    )
  }

  // =========================================================================
  // WEEKLY VIEW — collapsible table (existing pattern, with inline overrides)
  // =========================================================================
  if (!weeklyData || !weeklyData.projectionId || weeklyData.weeks.length === 0) {
    return (
      <ReportShell
        title="13-Week Cash Forecast"
        generatedAt={weeklyData?.generatedAt ?? new Date().toISOString()}
        reportSlug="cash-projection"
      >
        {viewToggle}
        <div className="text-center py-12 text-muted-foreground">
          No weekly cash projection data available. Click Regenerate above to create one.
        </div>
      </ReportShell>
    )
  }

  const weeklyExportRows: Record<string, unknown>[] = []
  for (const week of weeklyData.weeks) {
    for (const line of [...week.inflows, ...week.outflows]) {
      weeklyExportRows.push({
        week: week.weekLabel,
        weekStartDate: week.weekStartDate,
        type: line.lineType,
        source: line.sourceLabel,
        confidence: line.confidenceLevel,
        autoAmount: line.autoAmount,
        overrideAmount: line.overrideAmount,
        effectiveAmount: line.effectiveAmount,
      })
    }
  }

  return (
    <ReportShell
      title="13-Week Cash Forecast"
      generatedAt={weeklyData.generatedAt}
      reportSlug="cash-projection"
      exportData={weeklyExportRows}
      csvColumns={WEEKLY_CSV_COLUMNS}
      filters={{ view: 'weekly' }}
    >
      {viewToggle}

      <p className="text-sm text-muted-foreground">
        Fiscal Year {weeklyData.fiscalYear} — As of {formatDate(weeklyData.asOfDate)}
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="weekly-projection-summary">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Starting Cash</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(weeklyData.startingCash)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unrestricted</CardTitle>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">Week 13 Ending</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.weeks.length > 0 && (
              <>
                <div className={`text-2xl font-bold ${weeklyData.weeks[weeklyData.weeks.length - 1].endingCash < 0 ? 'text-red-600' : ''}`}>
                  {formatCurrency(weeklyData.weeks[weeklyData.weeks.length - 1].endingCash)}
                </div>
                <p className="text-xs text-muted-foreground">total balance</p>
              </>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Wk 13 Unrestricted</CardTitle>
          </CardHeader>
          <CardContent>
            {weeklyData.weeks.length > 0 && (
              <>
                <div className={`text-2xl font-bold ${weeklyData.weeks[weeklyData.weeks.length - 1].isWarning || weeklyData.weeks[weeklyData.weeks.length - 1].isCritical ? 'text-red-600' : ''}`}>
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
              <TableHead className="w-[50px]" />
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
                isExpanded={expandedRows.has(`w-${week.weekNumber}`)}
                onToggle={() => toggleExpand(`w-${week.weekNumber}`)}
                projectionId={weeklyData.projectionId!}
                onOverrideSaved={applyWeeklyOverride}
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
// Month Row with expand/collapse (mirrors WeekRow)
// ---------------------------------------------------------------------------

function MonthRow({
  month,
  endingCash,
  isExpanded,
  onToggle,
  projectionId,
  onOverrideSaved,
}: {
  month: CashProjectionMonth
  endingCash: number
  isExpanded: boolean
  onToggle: () => void
  projectionId: number
  onOverrideSaved: (lineId: number, newOverride: number | null) => void
}) {
  return (
    <>
      <TableRow
        className="cursor-pointer hover:bg-muted/50"
        onClick={onToggle}
        data-testid={`monthly-forecast-row-${month.month}`}
      >
        <TableCell className="w-[50px]">
          {isExpanded ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
        </TableCell>
        <TableCell className="font-medium">{month.monthLabel}</TableCell>
        <TableCell className="text-right tabular-nums text-green-700">
          {formatCurrency(month.totalInflows)}
        </TableCell>
        <TableCell className="text-right tabular-nums text-red-700">
          {formatCurrency(month.totalOutflows)}
        </TableCell>
        <TableCell className={`text-right tabular-nums font-medium ${month.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
          {formatCurrency(month.netCashFlow)}
        </TableCell>
        <TableCell className={`text-right tabular-nums font-medium ${endingCash < 0 ? 'text-red-600' : ''}`}>
          {formatCurrency(endingCash)}
        </TableCell>
      </TableRow>

      {isExpanded && (
        <>
          {month.inflows.length > 0 && (
            <TableRow className="bg-green-50/30">
              <TableCell />
              <TableCell colSpan={5} className="text-xs font-semibold text-green-800">Inflows</TableCell>
            </TableRow>
          )}
          {month.inflows.map((line) => (
            <MonthLineRow
              key={line.id}
              line={line}
              type="inflow"
              projectionId={projectionId}
              onOverrideSaved={onOverrideSaved}
            />
          ))}
          {month.outflows.length > 0 && (
            <TableRow className="bg-red-50/30">
              <TableCell />
              <TableCell colSpan={5} className="text-xs font-semibold text-red-800">Outflows</TableCell>
            </TableRow>
          )}
          {month.outflows.map((line) => (
            <MonthLineRow
              key={line.id}
              line={line}
              type="outflow"
              projectionId={projectionId}
              onOverrideSaved={onOverrideSaved}
            />
          ))}
        </>
      )}
    </>
  )
}

function MonthLineRow({
  line,
  type,
  projectionId,
  onOverrideSaved,
}: {
  line: CashProjectionLine
  type: 'inflow' | 'outflow'
  projectionId: number
  onOverrideSaved: (lineId: number, newOverride: number | null) => void
}) {
  if (line.sourceLabel === 'Starting Cash') return null

  return (
    <TableRow className={type === 'inflow' ? 'bg-green-50/10' : 'bg-red-50/10'}>
      <TableCell />
      <TableCell className="text-xs pl-8">{line.sourceLabel}</TableCell>
      <TableCell className={`text-right tabular-nums text-xs ${type === 'inflow' ? '' : ''}`}>
        {type === 'inflow' ? formatCurrency(line.effectiveAmount) : ''}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {type === 'outflow' ? formatCurrency(line.effectiveAmount) : ''}
      </TableCell>
      <TableCell className="text-right">
        <OverrideInput
          lineId={line.id}
          projectionId={projectionId}
          currentOverride={line.overrideAmount}
          autoAmount={line.autoAmount}
          mode="monthly"
          onSaved={onOverrideSaved}
        />
      </TableCell>
      <TableCell />
    </TableRow>
  )
}

// ---------------------------------------------------------------------------
// Week Row with expand/collapse + inline overrides
// ---------------------------------------------------------------------------

function WeekRow({
  week,
  isExpanded,
  onToggle,
  projectionId,
  onOverrideSaved,
}: {
  week: WeeklyCashProjectionWeek
  isExpanded: boolean
  onToggle: () => void
  projectionId: number
  onOverrideSaved: (lineId: number, newOverride: number | null) => void
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
        <TableCell className={`text-right tabular-nums font-medium ${week.netCashFlow >= 0 ? 'text-green-700' : 'text-red-700'}`}>
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

      {isExpanded && (
        <>
          {week.inflows.length > 0 && (
            <TableRow className="bg-green-50/30">
              <TableCell />
              <TableCell colSpan={6} className="text-xs font-semibold text-green-800">Inflows</TableCell>
            </TableRow>
          )}
          {week.inflows.map((line) => (
            <WeekLineRow
              key={line.id}
              line={line}
              type="inflow"
              projectionId={projectionId}
              onOverrideSaved={onOverrideSaved}
            />
          ))}
          {week.outflows.length > 0 && (
            <TableRow className="bg-red-50/30">
              <TableCell />
              <TableCell colSpan={6} className="text-xs font-semibold text-red-800">Outflows</TableCell>
            </TableRow>
          )}
          {week.outflows.map((line) => (
            <WeekLineRow
              key={line.id}
              line={line}
              type="outflow"
              projectionId={projectionId}
              onOverrideSaved={onOverrideSaved}
            />
          ))}
        </>
      )}
    </>
  )
}

function WeekLineRow({
  line,
  type,
  projectionId,
  onOverrideSaved,
}: {
  line: WeeklyCashProjectionLine
  type: 'inflow' | 'outflow'
  projectionId: number
  onOverrideSaved: (lineId: number, newOverride: number | null) => void
}) {
  return (
    <TableRow className={type === 'inflow' ? 'bg-green-50/10' : 'bg-red-50/10'}>
      <TableCell />
      <TableCell className="text-xs pl-8">
        <span className={`mr-1 ${CONFIDENCE_COLORS[line.confidenceLevel]}`}>
          {CONFIDENCE_ICONS[line.confidenceLevel]}
        </span>
        {line.sourceLabel}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {type === 'inflow' ? formatCurrency(line.effectiveAmount) : ''}
      </TableCell>
      <TableCell className="text-right tabular-nums text-xs">
        {type === 'outflow' ? formatCurrency(line.effectiveAmount) : ''}
      </TableCell>
      <TableCell className="text-right">
        <OverrideInput
          lineId={line.id}
          projectionId={projectionId}
          currentOverride={line.overrideAmount}
          autoAmount={line.autoAmount}
          mode="weekly"
          onSaved={onOverrideSaved}
        />
      </TableCell>
      <TableCell />
      <TableCell className="text-xs text-muted-foreground">
        {line.fundRestrictionType === 'RESTRICTED' && (
          <Badge variant="outline" className="text-xs">Restricted</Badge>
        )}
      </TableCell>
    </TableRow>
  )
}
