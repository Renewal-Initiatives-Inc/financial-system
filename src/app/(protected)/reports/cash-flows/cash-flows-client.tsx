'use client'

import { useState, useCallback, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { formatCurrency, getYTDRange } from '@/lib/reports/types'
import { cn } from '@/lib/utils'
import type { CashFlowsData, CashFlowLine, CashFlowSection } from '@/lib/reports/cash-flows'

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
    rows.push({ label: section.title, amount: '' })
    for (const line of section.lines) {
      rows.push({
        label: line.indent ? `  ${line.label}` : line.label,
        amount: line.amount,
      })
    }
  }

  addSection(data.operating)
  addSection(data.investing)
  addSection(data.financing)
  rows.push({ label: 'Net Change in Cash', amount: data.netChangeInCash })
  rows.push({ label: 'Beginning Cash', amount: data.beginningCash })
  rows.push({ label: 'Ending Cash', amount: data.endingCash })

  return rows
}

// ---------------------------------------------------------------------------
// Section renderer
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
  // The "Adjustments to reconcile" label row has amount 0 and is purely descriptive
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
// Main client component
// ---------------------------------------------------------------------------

export function CashFlowsClient({ initialData, funds }: CashFlowsClientProps) {
  const defaults = getYTDRange()
  const [data, setData] = useState<CashFlowsData>(initialData)
  const [startDate, setStartDate] = useState(initialData.startDate || defaults.startDate)
  const [endDate, setEndDate] = useState(initialData.endDate || defaults.endDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const params = new URLSearchParams({ startDate, endDate })
      if (fundId) params.set('fundId', String(fundId))

      const res = await fetch(`/api/reports/cash-flows?${params.toString()}`)
      if (res.ok) {
        const json = await res.json()
        setData(json)
      }
    })
  }, [startDate, endDate, fundId])

  const exportData = buildExportData(data)

  return (
    <ReportShell
      title="Statement of Cash Flows"
      fundName={data.fundName}
      reportSlug="cash-flows"
      exportData={exportData}
      exportColumns={['label', 'amount']}
    >
      <ReportFilterBar
        funds={funds}
        startDate={startDate}
        endDate={endDate}
        fundId={fundId}
        onStartDateChange={setStartDate}
        onEndDateChange={setEndDate}
        onFundChange={setFundId}
        onApply={handleApply}
        showPeriodSelector={false}
      />

      {isPending && (
        <div className="text-center py-8 text-muted-foreground text-sm">
          Loading...
        </div>
      )}

      <div
        className={cn(
          'border rounded-lg bg-card p-6 space-y-8',
          isPending && 'opacity-50 pointer-events-none'
        )}
        data-testid="cash-flows-report"
      >
        {/* Period header */}
        <p className="text-sm text-muted-foreground text-center">
          For the period {data.startDate} to {data.endDate}
          {data.fundName ? ` | Fund: ${data.fundName}` : ' | Consolidated'}
        </p>

        {/* Operating */}
        <SectionBlock section={data.operating} />

        {/* Investing */}
        <SectionBlock section={data.investing} />

        {/* Financing */}
        <SectionBlock section={data.financing} />

        {/* Net change and reconciliation */}
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
    </ReportShell>
  )
}
