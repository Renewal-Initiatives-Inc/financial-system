'use client'

import { useState, useTransition } from 'react'
import { ReportShell } from '@/components/reports/report-shell'
import { ReportTable, type ReportRow } from '@/components/reports/report-table'
import { FundSelector } from '@/components/shared/fund-selector'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import type { FundLevelData } from '@/lib/reports/fund-level'

// ---------------------------------------------------------------------------
// Typed CSV columns
// ---------------------------------------------------------------------------

const FUND_LEVEL_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'tab', label: 'Tab', format: 'text' },
  { key: 'account', label: 'Account', format: 'text' },
  { key: 'balance', label: 'Balance', format: 'currency' },
  { key: 'currentPeriod', label: 'Current Period', format: 'currency' },
  { key: 'yearToDate', label: 'Year-to-Date', format: 'currency' },
  { key: 'budget', label: 'Budget', format: 'currency' },
  { key: 'varianceDollar', label: 'Variance $', format: 'currency' },
  { key: 'variancePercent', label: 'Variance %', format: 'percent' },
]
import { getFundLevelData } from '../actions'
import type {
  BalanceSheetData,
  BalanceSheetSection,
} from '@/lib/reports/balance-sheet'
import type { ActivitiesData, ActivitiesSection } from '@/lib/reports/activities'

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface FundLevelClientProps {
  funds: FundRow[]
}

// ---------------------------------------------------------------------------
// Balance Sheet row builders (reuse same logic as balance-sheet-client)
// ---------------------------------------------------------------------------

function bsSectionToRows(
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
  rows.push({
    label: `Total ${section.title}`,
    isSubtotal: true,
    indent: indent - 1,
    yearToDate: section.total,
  })
  return rows
}

function buildBalanceSheetRows(data: BalanceSheetData): ReportRow[] {
  const rows: ReportRow[] = []

  rows.push({ label: 'ASSETS', isSectionHeader: true })
  rows.push({ label: 'Current Assets', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.currentAssets))
  rows.push({ label: 'Noncurrent Assets', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.noncurrentAssets))
  rows.push({
    label: 'TOTAL ASSETS',
    isTotal: true,
    yearToDate: data.totalAssets,
  })

  rows.push({ label: 'LIABILITIES', isSectionHeader: true })
  rows.push({ label: 'Current Liabilities', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.currentLiabilities))
  rows.push({ label: 'Long-Term Liabilities', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.longTermLiabilities))
  rows.push({
    label: 'TOTAL LIABILITIES',
    isTotal: true,
    yearToDate: data.totalLiabilities,
  })

  rows.push({ label: 'RETAINED EARNINGS', isSectionHeader: true })
  rows.push({ label: 'Without Donor Restrictions', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.netAssetsUnrestricted))
  rows.push({ label: 'With Donor Restrictions', isSectionHeader: true })
  rows.push(...bsSectionToRows(data.netAssetsRestricted))
  rows.push({
    label: 'TOTAL RETAINED EARNINGS',
    isTotal: true,
    yearToDate: data.totalNetAssets,
  })

  rows.push({
    label: 'TOTAL LIABILITIES AND RETAINED EARNINGS',
    isTotal: true,
    yearToDate: data.totalLiabilitiesAndNetAssets,
  })

  return rows
}

// ---------------------------------------------------------------------------
// Activities row builders (reuse same logic as activities-client)
// ---------------------------------------------------------------------------

function activitiesSectionDetailRows(section: ActivitiesSection): ReportRow[] {
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

function buildActivitiesRows(data: ActivitiesData): ReportRow[] {
  const rows: ReportRow[] = []

  rows.push({ label: 'REVENUE', isSectionHeader: true })
  for (const section of data.revenueSections) {
    rows.push({ label: section.title, isSectionHeader: true })
    rows.push(...activitiesSectionDetailRows(section))
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
    rows.push(...activitiesSectionDetailRows(section))
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

// ---------------------------------------------------------------------------
// CSV export
// ---------------------------------------------------------------------------

function buildExportData(data: FundLevelData): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []

  // Balance sheet rows
  const bsRows = buildBalanceSheetRows(data.balanceSheet)
  for (const row of bsRows) {
    if (row.isSectionHeader) continue
    out.push({
      tab: 'Balance Sheet',
      account: row.label,
      balance: row.yearToDate ?? null,
    })
  }

  // Activities rows
  for (const section of data.activities.revenueSections) {
    for (const row of section.rows) {
      out.push({
        tab: 'Activities',
        account: `${row.accountCode} - ${row.accountName}`,
        currentPeriod: row.currentPeriod,
        yearToDate: row.yearToDate,
        budget: row.budget,
        varianceDollar: row.variance?.dollarVariance ?? null,
        variancePercent: row.variance?.percentVariance ?? null,
      })
    }
  }
  for (const section of data.activities.expenseSections) {
    for (const row of section.rows) {
      out.push({
        tab: 'Activities',
        account: `${row.accountCode} - ${row.accountName}`,
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

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function FundLevelClient({ funds }: FundLevelClientProps) {
  const [fundId, setFundId] = useState<number | null>(null)
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0])
  const [data, setData] = useState<FundLevelData | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleApply() {
    if (!fundId) return
    startTransition(async () => {
      const result = await getFundLevelData(fundId, endDate)
      setData(result)
    })
  }

  const exportData = data ? buildExportData(data) : undefined

  return (
    <ReportShell
      title="Fund-Level P&L and Balance Sheet"
      fundName={data?.fundName}
      reportSlug="fund-level"
      exportData={exportData}
      csvColumns={FUND_LEVEL_CSV_COLUMNS}
      filters={{ endDate, ...(fundId ? { fundId: String(fundId) } : {}) }}
    >
      {/* Filter bar */}
      <div
        className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border"
        data-testid="report-filter-bar"
      >
        <div className="space-y-1 min-w-[240px]">
          <Label className="text-xs">Fund (required)</Label>
          <FundSelector
            funds={funds}
            value={fundId}
            onSelect={setFundId}
            placeholder="Select a fund..."
            testId="filter-fund"
          />
        </div>

        <div className="space-y-1">
          <Label className="text-xs">As of Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-40"
            data-testid="filter-end-date"
          />
        </div>

        <Button
          onClick={handleApply}
          disabled={!fundId || isPending}
          data-testid="filter-apply-btn"
        >
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
      </div>

      {/* Pre-selection state */}
      {!data && !isPending && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-muted-foreground text-lg font-medium mb-2">
            Select a fund to view report
          </div>
          <p className="text-sm text-muted-foreground max-w-md">
            Choose a fund from the selector above to view its combined Balance Sheet
            and Income Statement.
          </p>
        </div>
      )}

      {/* Loading state */}
      {isPending && (
        <div className="flex items-center justify-center py-8 text-muted-foreground">
          Loading fund report data...
        </div>
      )}

      {/* Report data */}
      {data && !isPending && (
        <>
          {/* Fund header badge */}
          <div className="flex items-center gap-3">
            <span className="text-lg font-semibold">{data.fundName}</span>
            <Badge
              variant="outline"
              className={cn(
                'text-xs',
                data.restrictionType === 'RESTRICTED'
                  ? 'bg-amber-100 text-amber-800 border-amber-200'
                  : 'bg-green-100 text-green-800 border-green-200'
              )}
            >
              {data.restrictionType === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
            </Badge>
          </div>

          {/* Tabbed content */}
          <Tabs defaultValue="balance-sheet" className="w-full">
            <TabsList>
              <TabsTrigger value="balance-sheet" data-testid="tab-balance-sheet">
                Balance Sheet
              </TabsTrigger>
              <TabsTrigger value="activities" data-testid="tab-activities">
                Activities
              </TabsTrigger>
            </TabsList>

            <TabsContent value="balance-sheet" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                As of {formatDate(data.balanceSheet.asOfDate)}
              </p>
              <ReportTable
                rows={buildBalanceSheetRows(data.balanceSheet)}
                showBudgetColumn={false}
                showVarianceColumn={false}
                showCurrentPeriodColumn={false}
                testIdPrefix="fund-bs"
              />
            </TabsContent>

            <TabsContent value="activities" className="mt-4">
              <p className="text-sm text-muted-foreground mb-4">
                {formatDate(data.activities.startDate)} &mdash;{' '}
                {formatDate(data.activities.endDate)}
              </p>
              <ReportTable
                rows={buildActivitiesRows(data.activities)}
                showBudgetColumn
                showVarianceColumn
                showCurrentPeriodColumn
                testIdPrefix="fund-activities"
              />
            </TabsContent>
          </Tabs>
        </>
      )}
    </ReportShell>
  )
}
