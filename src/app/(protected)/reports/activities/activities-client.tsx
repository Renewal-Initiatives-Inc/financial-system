'use client'

import { useState, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { ReportTable, type ReportRow } from '@/components/reports/report-table'
import { MultiPeriodReportTable, type MultiPeriodReportRow } from '@/components/reports/multi-period-report-table'
import type { ActivitiesData, ActivitiesSection, MultiPeriodActivitiesData, MultiPeriodSection } from '@/lib/reports/activities'
import { getActivitiesData, getMultiPeriodActivitiesData } from '../actions'
import type { PeriodType } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'

const YTD_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'accountCode', label: 'Account Code', format: 'text' },
  { key: 'accountName', label: 'Account Name', format: 'text' },
  { key: 'section', label: 'Section', format: 'text' },
  { key: 'currentPeriod', label: 'Current Period', format: 'currency' },
  { key: 'yearToDate', label: 'Year-to-Date', format: 'currency' },
  { key: 'budget', label: 'Budget', format: 'currency' },
  { key: 'varianceDollar', label: 'Variance', format: 'currency' },
  { key: 'variancePercent', label: 'Variance', format: 'percent' },
]

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface ActivitiesClientProps {
  initialData: ActivitiesData
  funds: FundRow[]
  defaultStartDate: string
  defaultEndDate: string
}

export function ActivitiesClient({
  initialData,
  funds,
  defaultStartDate,
  defaultEndDate,
}: ActivitiesClientProps) {
  const [ytdData, setYtdData] = useState<ActivitiesData>(initialData)
  const [multiData, setMultiData] = useState<MultiPeriodActivitiesData | null>(null)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [periodType, setPeriodType] = useState<PeriodType>('ytd')
  const [isPending, startTransition] = useTransition()

  const isMultiPeriod = periodType !== 'ytd'

  function handleApply() {
    startTransition(async () => {
      if (periodType === 'ytd') {
        const result = await getActivitiesData({ startDate, endDate, fundId })
        setYtdData(result)
        setMultiData(null)
      } else {
        const result = await getMultiPeriodActivitiesData({
          startDate,
          endDate,
          fundId,
          periodType,
        })
        setMultiData(result)
      }
    })
  }

  // -- CSV export data --
  const exportData = isMultiPeriod && multiData
    ? buildMultiPeriodExportData(multiData)
    : buildExportData(ytdData)

  // Build typed CSV columns (dynamic for multi-period)
  const csvColumns: CSVColumnDef[] = isMultiPeriod && multiData
    ? [
        { key: 'accountCode', label: 'Account Code', format: 'text' },
        { key: 'accountName', label: 'Account Name', format: 'text' },
        { key: 'section', label: 'Section', format: 'text' },
        ...multiData.periodColumns.map((c) => ({
          key: c.label,
          label: c.label,
          format: 'currency' as const,
        })),
        { key: 'total', label: 'Total', format: 'currency' },
        { key: 'budget', label: 'Budget', format: 'currency' },
      ]
    : YTD_CSV_COLUMNS

  const filters: Record<string, string> = {
    startDate,
    endDate,
    ...(fundId ? { fundId: String(fundId) } : {}),
  }

  return (
    <ReportShell
      title="Income Statement"
      fundName={(isMultiPeriod ? multiData?.fundName : ytdData.fundName) ?? undefined}
      reportSlug="activities"
      exportData={exportData}
      csvColumns={csvColumns}
      filters={filters}
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
        showFundSelector
      />

      {isPending && (
        <div className="text-center py-4 text-sm text-muted-foreground">
          Loading report data...
        </div>
      )}

      {isMultiPeriod && multiData ? (
        <MultiPeriodReportTable
          rows={buildMultiPeriodRows(multiData)}
          periodLabels={multiData.periodColumns.map((c) => c.label)}
          showBudgetColumn
          showVarianceColumn
          testIdPrefix="activities-table"
        />
      ) : (
        <ReportTable
          rows={buildYtdRows(ytdData)}
          showBudgetColumn
          showVarianceColumn
          showCurrentPeriodColumn
          testIdPrefix="activities-table"
        />
      )}
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// YTD mode row builders (existing logic)
// ---------------------------------------------------------------------------

function buildYtdRows(data: ActivitiesData): ReportRow[] {
  const rows: ReportRow[] = []

  rows.push({ label: 'REVENUE', isSectionHeader: true })
  for (const section of data.revenueSections) {
    rows.push({ label: section.title, isSectionHeader: true })
    rows.push(...sectionDetailRows(section))
    rows.push({
      label: `Total ${section.title}`,
      isSubtotal: true,
      currentPeriod: section.total.currentPeriod,
      yearToDate: section.total.yearToDate,
      budget: section.total.budget,
    })
  }
  rows.push({
    label: 'Total Revenue',
    isTotal: true,
    currentPeriod: data.totalRevenue.currentPeriod,
    yearToDate: data.totalRevenue.yearToDate,
    budget: data.totalRevenue.budget,
  })

  rows.push({ label: '' })
  rows.push({ label: 'EXPENSES', isSectionHeader: true })
  for (const section of data.expenseSections) {
    rows.push({ label: section.title, isSectionHeader: true })
    rows.push(...sectionDetailRows(section))
    rows.push({
      label: `Total ${section.title}`,
      isSubtotal: true,
      currentPeriod: section.total.currentPeriod,
      yearToDate: section.total.yearToDate,
      budget: section.total.budget,
    })
  }
  rows.push({
    label: 'Total Expenses',
    isTotal: true,
    currentPeriod: data.totalExpenses.currentPeriod,
    yearToDate: data.totalExpenses.yearToDate,
    budget: data.totalExpenses.budget,
  })

  rows.push({ label: '' })

  if (data.netAssetReleases.currentPeriod !== 0 || data.netAssetReleases.yearToDate !== 0) {
    rows.push({
      label: 'Net Assets Released from Restriction',
      currentPeriod: data.netAssetReleases.currentPeriod,
      yearToDate: data.netAssetReleases.yearToDate,
    })
  }

  rows.push({
    label: 'Change in Retained Earnings',
    isTotal: true,
    currentPeriod: data.changeInNetAssets.currentPeriod,
    yearToDate: data.changeInNetAssets.yearToDate,
    budget: data.changeInNetAssets.budget,
  })

  return rows
}

function sectionDetailRows(section: ActivitiesSection): ReportRow[] {
  return section.rows.map((row) => ({
    id: row.accountId,
    label: `${row.accountCode} - ${row.accountName}`,
    indent: 1,
    currentPeriod: row.currentPeriod,
    yearToDate: row.yearToDate,
    budget: row.budget,
    accountId: row.accountId,
  }))
}

// ---------------------------------------------------------------------------
// Multi-period mode row builders
// ---------------------------------------------------------------------------

function buildMultiPeriodRows(data: MultiPeriodActivitiesData): MultiPeriodReportRow[] {
  const rows: MultiPeriodReportRow[] = []

  rows.push({ label: 'REVENUE', isSectionHeader: true })
  for (const section of data.revenueSections) {
    rows.push({ label: section.title, isSectionHeader: true })
    rows.push(...multiSectionDetailRows(section))
    rows.push({
      label: `Total ${section.title}`,
      isSubtotal: true,
      periodValues: section.total.periodValues,
      total: section.total.total,
      budget: section.total.budget,
    })
  }
  rows.push({
    label: 'Total Revenue',
    isTotal: true,
    periodValues: data.totalRevenue.periodValues,
    total: data.totalRevenue.total,
    budget: data.totalRevenue.budget,
  })

  rows.push({ label: '' })
  rows.push({ label: 'EXPENSES', isSectionHeader: true })
  for (const section of data.expenseSections) {
    rows.push({ label: section.title, isSectionHeader: true })
    rows.push(...multiSectionDetailRows(section))
    rows.push({
      label: `Total ${section.title}`,
      isSubtotal: true,
      periodValues: section.total.periodValues,
      total: section.total.total,
      budget: section.total.budget,
    })
  }
  rows.push({
    label: 'Total Expenses',
    isTotal: true,
    periodValues: data.totalExpenses.periodValues,
    total: data.totalExpenses.total,
    budget: data.totalExpenses.budget,
  })

  rows.push({ label: '' })

  if (data.netAssetReleases.total !== 0) {
    rows.push({
      label: 'Net Assets Released from Restriction',
      periodValues: data.netAssetReleases.periodValues,
      total: data.netAssetReleases.total,
    })
  }

  rows.push({
    label: 'Change in Retained Earnings',
    isTotal: true,
    periodValues: data.changeInNetAssets.periodValues,
    total: data.changeInNetAssets.total,
    budget: data.changeInNetAssets.budget,
  })

  return rows
}

function multiSectionDetailRows(section: MultiPeriodSection): MultiPeriodReportRow[] {
  return section.rows.map((row) => ({
    id: row.accountId,
    label: `${row.accountCode} - ${row.accountName}`,
    indent: 1,
    periodValues: row.periodValues,
    total: row.total,
    budget: row.budget,
  }))
}

// ---------------------------------------------------------------------------
// CSV export helpers
// ---------------------------------------------------------------------------

function buildExportData(data: ActivitiesData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []

  for (const section of [...data.revenueSections, ...data.expenseSections]) {
    for (const row of section.rows) {
      out.push({
        accountCode: row.accountCode,
        accountName: row.accountName,
        section: section.title,
        currentPeriod: row.currentPeriod,
        yearToDate: row.yearToDate,
        budget: row.budget,
        varianceDollar: row.variance?.dollarVariance ?? null,
        variancePercent: row.variance?.percentVariance ?? null,
      })
    }
  }

  return out
}

function buildMultiPeriodExportData(data: MultiPeriodActivitiesData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []

  for (const section of [...data.revenueSections, ...data.expenseSections]) {
    for (const row of section.rows) {
      const record: Record<string, unknown> = {
        accountCode: row.accountCode,
        accountName: row.accountName,
        section: section.title,
      }
      for (let p = 0; p < data.periodColumns.length; p++) {
        record[data.periodColumns[p].label] = row.periodValues[p]
      }
      record.total = row.total
      record.budget = row.budget
      out.push(record)
    }
  }

  return out
}
