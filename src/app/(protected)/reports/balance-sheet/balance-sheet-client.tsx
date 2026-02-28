'use client'

import { useState, useCallback, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportFilterBar } from '@/components/reports/report-filter-bar'
import { ReportTable, type ReportRow } from '@/components/reports/report-table'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import type {
  BalanceSheetData,
  BalanceSheetSection,
} from '@/lib/reports/balance-sheet'
import { getBalanceSheetData } from '@/lib/reports/balance-sheet'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface BalanceSheetClientProps {
  initialData: BalanceSheetData
  funds: FundRow[]
}

// ---------------------------------------------------------------------------
// Helpers: convert BalanceSheetData to ReportRow[] for the ReportTable
// ---------------------------------------------------------------------------

function sectionToRows(
  section: BalanceSheetSection,
  indent: number = 1
): ReportRow[] {
  const rows: ReportRow[] = []
  for (const r of section.rows) {
    rows.push({
      id: r.accountId || r.accountName,
      label: r.accountCode ? `${r.accountCode} — ${r.accountName}` : r.accountName,
      indent,
      yearToDate: r.balance,
      accountId: r.accountId || undefined,
    })
  }
  // Subtotal
  rows.push({
    label: `Total ${section.title}`,
    isSubtotal: true,
    indent: indent - 1,
    yearToDate: section.total,
  })
  return rows
}

function buildReportRows(data: BalanceSheetData): ReportRow[] {
  const rows: ReportRow[] = []

  // ---- ASSETS ----
  rows.push({ label: 'ASSETS', isSectionHeader: true })
  rows.push({ label: 'Current Assets', isSectionHeader: true })
  rows.push(...sectionToRows(data.currentAssets))
  rows.push({ label: 'Noncurrent Assets', isSectionHeader: true })
  rows.push(...sectionToRows(data.noncurrentAssets))
  rows.push({
    label: 'TOTAL ASSETS',
    isTotal: true,
    yearToDate: data.totalAssets,
  })

  // ---- LIABILITIES ----
  rows.push({ label: 'LIABILITIES', isSectionHeader: true })
  rows.push({ label: 'Current Liabilities', isSectionHeader: true })
  rows.push(...sectionToRows(data.currentLiabilities))
  rows.push({ label: 'Long-Term Liabilities', isSectionHeader: true })
  rows.push(...sectionToRows(data.longTermLiabilities))
  rows.push({
    label: 'TOTAL LIABILITIES',
    isTotal: true,
    yearToDate: data.totalLiabilities,
  })

  // ---- NET ASSETS ----
  rows.push({ label: 'NET ASSETS', isSectionHeader: true })
  rows.push({ label: 'Without Donor Restrictions', isSectionHeader: true })
  rows.push(...sectionToRows(data.netAssetsUnrestricted))
  rows.push({ label: 'With Donor Restrictions', isSectionHeader: true })
  rows.push(...sectionToRows(data.netAssetsRestricted))
  rows.push({
    label: 'TOTAL NET ASSETS',
    isTotal: true,
    yearToDate: data.totalNetAssets,
  })

  // ---- TOTAL L + NA ----
  rows.push({
    label: 'TOTAL LIABILITIES AND NET ASSETS',
    isTotal: true,
    yearToDate: data.totalLiabilitiesAndNetAssets,
  })

  return rows
}

// ---------------------------------------------------------------------------
// CSV export data builder
// ---------------------------------------------------------------------------

function buildExportData(
  rows: ReportRow[]
): { Account: string; Balance: string }[] {
  return rows
    .filter((r) => !r.isSectionHeader)
    .map((r) => ({
      Account: r.label,
      Balance:
        r.yearToDate !== undefined
          ? formatCurrency(r.yearToDate)
          : '',
    }))
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BalanceSheetClient({
  initialData,
  funds,
}: BalanceSheetClientProps) {
  const [data, setData] = useState<BalanceSheetData>(initialData)
  const [endDate, setEndDate] = useState(
    initialData.asOfDate || new Date().toISOString().split('T')[0]
  )
  const [fundId, setFundId] = useState<number | null>(null)
  const [isPending, startTransition] = useTransition()

  const handleApply = useCallback(() => {
    startTransition(async () => {
      const result = await getBalanceSheetData({
        endDate,
        fundId: fundId ?? undefined,
      })
      setData(result)
    })
  }, [endDate, fundId])

  const reportRows = buildReportRows(data)
  const exportData = buildExportData(reportRows)

  return (
    <ReportShell
      title="Statement of Financial Position"
      fundName={data.fundName}
      reportSlug="balance-sheet"
      exportData={exportData}
      exportColumns={['Account', 'Balance']}
    >
      {/* Subtitle */}
      <p className="text-sm text-muted-foreground -mt-4">
        As of {formatDate(data.asOfDate)}
      </p>

      {/* Filter bar — point-in-time: no period selector, no start date needed */}
      <ReportFilterBar
        funds={funds}
        startDate={endDate}
        endDate={endDate}
        fundId={fundId}
        onStartDateChange={setEndDate}
        onEndDateChange={setEndDate}
        onFundChange={setFundId}
        onApply={handleApply}
        showPeriodSelector={false}
      />

      {/* Loading overlay */}
      {isPending && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Loading...
        </div>
      )}

      {/* Report table — balance sheet only uses YTD column as the balance */}
      {!isPending && (
        <>
          <ReportTable
            rows={reportRows}
            showBudgetColumn={false}
            showVarianceColumn={false}
            showCurrentPeriodColumn={false}
            testIdPrefix="balance-sheet"
          />

        </>
      )}
    </ReportShell>
  )
}
