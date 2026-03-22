'use client'

import { useState, useCallback, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { MultiPeriodReportTable, type MultiPeriodReportRow } from '@/components/reports/multi-period-report-table'
import { formatCurrency, getYTDRange } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import type { CashFlowsData, CashFlowLine, CashFlowSection, MultiPeriodCashFlowsData } from '@/lib/reports/cash-flows'
import { getCashFlowsData, getMultiPeriodCashFlowsData } from '../actions'
import type { PeriodType } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'

const CASH_FLOWS_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'category', label: 'Category', format: 'text' },
  { key: 'amount', label: 'Amount', format: 'currency' },
]

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface CashFlowsClientProps {
  initialData: CashFlowsData
  funds: FundRow[]
}

// ---------------------------------------------------------------------------
// CSV export helpers
// ---------------------------------------------------------------------------

function buildExportData(data: CashFlowsData): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = []

  function addSection(section: CashFlowSection) {
    rows.push({ category: section.title, amount: null })
    for (const line of section.lines) {
      rows.push({
        category: line.indent ? `  ${line.label}` : line.label,
        amount: line.amount,
      })
    }
    rows.push({ category: `Net Cash from ${section.title}`, amount: section.subtotal })
  }

  addSection(data.operating)
  addSection(data.investing)
  addSection(data.financing)
  rows.push({ category: 'Net Change in Cash', amount: data.netChangeInCash })
  rows.push({ category: 'Beginning Cash', amount: data.beginningCash })
  rows.push({ category: 'Ending Cash', amount: data.endingCash })

  return rows
}

// ---------------------------------------------------------------------------
// Section renderer (YTD mode)
// ---------------------------------------------------------------------------

function SectionBlock({ section }: { section: CashFlowSection }) {
  return (
    <div className="space-y-1">
      <h3 className="text-sm font-bold uppercase tracking-wider text-muted-foreground py-2 border-b">
        {section.title}
      </h3>
      <div className="divide-y divide-border/50">
        {section.lines.map((line, i) => (
          <CashFlowRow key={i} line={line} />
        ))}
      </div>
    </div>
  )
}

function CashFlowRow({ line }: { line: CashFlowLine }) {
  const isDescriptiveLabel =
    line.label.startsWith('Adjustments') && !line.isSubtotal && !line.isTotal

  return (
    <div
      className={cn(
        'flex items-center justify-between py-1.5 px-2',
        line.isSubtotal && 'font-semibold border-t border-foreground/20 mt-1 pt-2',
        line.isTotal && 'font-bold border-t-2 border-foreground/30 mt-2 pt-2 bg-muted/20'
      )}
    >
      <span
        className={cn(
          'text-sm',
          line.isSubtotal && 'font-semibold',
          line.isTotal && 'font-bold',
          isDescriptiveLabel && 'italic text-muted-foreground'
        )}
        style={{ paddingLeft: line.indent ? `${line.indent * 1.5}rem` : undefined }}
      >
        {line.label}
      </span>
      {!isDescriptiveLabel && (
        <span
          className={cn(
            'font-mono text-sm tabular-nums text-right min-w-[120px]',
            line.isSubtotal && 'font-semibold',
            line.isTotal && 'font-bold'
          )}
        >
          {formatCurrency(line.amount)}
        </span>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Multi-period row builder
// ---------------------------------------------------------------------------

function buildMultiPeriodRows(data: MultiPeriodCashFlowsData): MultiPeriodReportRow[] {
  const rows: MultiPeriodReportRow[] = []

  function addSection(section: typeof data.operating) {
    rows.push({ label: section.title, isSectionHeader: true })
    for (const line of section.lines) {
      // Skip descriptive labels in multi-period view
      if (line.label.startsWith('Adjustments') && !line.isSubtotal && !line.isTotal) {
        rows.push({ label: line.label, indent: line.indent })
        continue
      }
      rows.push({
        label: line.label,
        indent: line.indent,
        isSubtotal: line.isSubtotal,
        isTotal: line.isTotal,
        periodValues: line.periodValues,
        total: line.total,
      })
    }
  }

  addSection(data.operating)
  addSection(data.investing)
  addSection(data.financing)

  rows.push({ label: '' })
  rows.push({
    label: 'Net Change in Cash',
    isTotal: true,
    periodValues: data.netChangeValues,
    total: data.netChangeTotal,
  })

  return rows
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

export function CashFlowsClient({ initialData, funds }: CashFlowsClientProps) {
  const defaults = getYTDRange()
  const [data, setData] = useState<CashFlowsData>(initialData)
  const [multiData, setMultiData] = useState<MultiPeriodCashFlowsData | null>(null)
  const [startDate, setStartDate] = useState(initialData.startDate || defaults.startDate)
  const [endDate, setEndDate] = useState(initialData.endDate || defaults.endDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [periodType, setPeriodType] = useState<PeriodType>('ytd')
  const [isPending, startTransition] = useTransition()

  const isMultiPeriod = periodType !== 'ytd'

  const handleApply = useCallback(() => {
    startTransition(async () => {
      if (periodType === 'ytd') {
        const result = await getCashFlowsData({ startDate, endDate, fundId })
        setData(result)
        setMultiData(null)
      } else {
        const result = await getMultiPeriodCashFlowsData({ startDate, endDate, fundId, periodType })
        setMultiData(result)
      }
    })
  }, [startDate, endDate, fundId, periodType])

  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Statement of Cash Flows"
      fundName={(isMultiPeriod ? multiData?.fundName : data.fundName) ?? undefined}
      reportSlug="cash-flows"
      exportData={exportData}
      csvColumns={CASH_FLOWS_CSV_COLUMNS}
      filters={{ startDate, endDate, ...(fundId ? { fundId: String(fundId) } : {}) }}
    >
      <ReportFilterBar
        funds={funds}
        startDate={startDate}
        endDate={endDate}
        fundId={fundId}
        periodType={periodType}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFundChange={setFundId}
        onPeriodTypeChange={setPeriodType}
        onApply={handleApply}
        showPeriodSelector
      />

      {isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Loading...
        </div>
      )}

      {isMultiPeriod && multiData ? (
        <MultiPeriodReportTable
          rows={buildMultiPeriodRows(multiData)}
          periodLabels={multiData.periodColumns.map((c) => c.label)}
          showBudgetColumn={false}
          showVarianceColumn={false}
          testIdPrefix="cash-flows-table"
        />
      ) : (
        <div
          className={cn(
            'border rounded-lg bg-card p-6 space-y-8',
            isPending && 'opacity-50 pointer-events-none'
          )}
          data-testid="cash-flows-report"
        >
          <p className="text-sm text-muted-foreground text-center">
            For the period {data.startDate} to {data.endDate}
            {data.fundName ? ` | Fund: ${data.fundName}` : ' | Consolidated'}
          </p>

          <SectionBlock section={data.operating} />
          <SectionBlock section={data.investing} />
          <SectionBlock section={data.financing} />

          <div className="border-t-2 border-foreground/30 pt-4 space-y-2">
            <div className="flex items-center justify-between py-1.5 px-2 font-bold">
              <span className="text-sm">Net Change in Cash</span>
              <span className="font-mono text-sm tabular-nums min-w-[120px] text-right">
                {formatCurrency(data.netChangeInCash)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2">
              <span className="text-sm">Cash, Beginning of Period</span>
              <span className="font-mono text-sm tabular-nums min-w-[120px] text-right">
                {formatCurrency(data.beginningCash)}
              </span>
            </div>
            <div className="flex items-center justify-between py-1.5 px-2 font-bold border-t-2 border-double border-foreground/40 pt-2">
              <span className="text-sm">Cash, End of Period</span>
              <span className="font-mono text-sm tabular-nums min-w-[120px] text-right">
                {formatCurrency(data.endingCash)}
              </span>
            </div>
          </div>
        </div>
      )}
    </ReportShell>
  )
}
