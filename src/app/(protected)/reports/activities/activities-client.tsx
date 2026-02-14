'use client'

import { useState, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { ReportTable, type ReportRow } from '@/components/reports/report-table'
import type { ActivitiesData, ActivitiesSection } from '@/lib/reports/activities'
import { getActivitiesData } from '@/lib/reports/activities'
import type { PeriodType } from '@/lib/reports/types'

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
  const [data, setData] = useState<ActivitiesData>(initialData)
  const [startDate, setStartDate] = useState(defaultStartDate)
  const [endDate, setEndDate] = useState(defaultEndDate)
  const [fundId, setFundId] = useState<number | null>(null)
  const [periodType, setPeriodType] = useState<PeriodType>('monthly')
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    startTransition(async () => {
      const result = await getActivitiesData({ startDate, endDate, fundId })
      setData(result)
    })
  }

  // -- Build flat row arrays for the ReportTable component --

  const rows: ReportRow[] = []

  // Revenue sections
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

  // Spacer
  rows.push({ label: '' })

  // Expense sections
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

  // Spacer
  rows.push({ label: '' })

  // Net asset releases
  if (data.netAssetReleases.currentPeriod !== 0 || data.netAssetReleases.yearToDate !== 0) {
    rows.push({
      label: 'Net Assets Released from Restriction',
      currentPeriod: data.netAssetReleases.currentPeriod,
      yearToDate: data.netAssetReleases.yearToDate,
    })
  }

  // Change in net assets
  rows.push({
    label: 'Change in Net Assets',
    isTotal: true,
    currentPeriod: data.changeInNetAssets.currentPeriod,
    yearToDate: data.changeInNetAssets.yearToDate,
    budget: data.changeInNetAssets.budget,
  })

  // -- CSV export data --
  const exportData = buildExportData(data)
  const exportColumns = [
    'Account Code',
    'Account Name',
    'Section',
    'Current Period',
    'Year-to-Date',
    'Budget',
    'Variance $',
    'Variance %',
  ]

  return (
    <ReportShell
      title="Statement of Activities"
      fundName={data.fundName}
      reportSlug="activities"
      exportData={exportData}
      exportColumns={exportColumns}
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

      <ReportTable
        rows={rows}
        showBudgetColumn
        showVarianceColumn
        showCurrentPeriodColumn
        testIdPrefix="activities-table"
      />
    </ReportShell>
  )
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

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

function buildExportData(data: ActivitiesData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []

  for (const section of data.revenueSections) {
    for (const row of section.rows) {
      out.push({
        'Account Code': row.accountCode,
        'Account Name': row.accountName,
        Section: section.title,
        'Current Period': row.currentPeriod,
        'Year-to-Date': row.yearToDate,
        Budget: row.budget,
        'Variance $': row.variance?.dollarVariance ?? null,
        'Variance %': row.variance?.percentVariance ?? null,
      })
    }
  }

  for (const section of data.expenseSections) {
    for (const row of section.rows) {
      out.push({
        'Account Code': row.accountCode,
        'Account Name': row.accountName,
        Section: section.title,
        'Current Period': row.currentPeriod,
        'Year-to-Date': row.yearToDate,
        Budget: row.budget,
        'Variance $': row.variance?.dollarVariance ?? null,
        'Variance %': row.variance?.percentVariance ?? null,
      })
    }
  }

  return out
}
