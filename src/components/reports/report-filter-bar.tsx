'use client'

import { useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { FundSelector } from '@/components/shared/fund-selector'
import type { PeriodType } from '@/lib/reports/types'

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface ReportFilterBarProps {
  funds: FundRow[]
  startDate: string
  endDate: string
  fundId: number | null
  periodType?: PeriodType
  onStartDateChange: (v: string) => void
  onEndDateChange: (v: string) => void
  onFundChange: (v: number | null) => void
  onPeriodTypeChange?: (v: PeriodType) => void
  onApply: () => void
  showPeriodSelector?: boolean
  showFundSelector?: boolean
}

export function ReportFilterBar({
  funds,
  startDate,
  endDate,
  fundId,
  periodType = 'monthly',
  onStartDateChange,
  onEndDateChange,
  onFundChange,
  onPeriodTypeChange,
  onApply,
  showPeriodSelector = true,
  showFundSelector = true,
}: ReportFilterBarProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  const handleApply = useCallback(() => {
    // Sync filters to URL search params for bookmarking
    const params = new URLSearchParams(searchParams.toString())
    params.set('startDate', startDate)
    params.set('endDate', endDate)
    if (fundId) params.set('fundId', String(fundId))
    else params.delete('fundId')
    if (periodType) params.set('period', periodType)
    router.replace(`?${params.toString()}`, { scroll: false })
    onApply()
  }, [startDate, endDate, fundId, periodType, searchParams, router, onApply])

  return (
    <div
      className="flex flex-wrap items-end gap-4 p-4 bg-muted/50 rounded-lg border"
      data-testid="report-filter-bar"
    >
      <div className="space-y-1">
        <Label className="text-xs">Start Date</Label>
        <Input
          type="date"
          value={startDate}
          onChange={(e) => onStartDateChange(e.target.value)}
          className="w-40"
          data-testid="filter-start-date"
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">End Date</Label>
        <Input
          type="date"
          value={endDate}
          onChange={(e) => onEndDateChange(e.target.value)}
          className="w-40"
          data-testid="filter-end-date"
        />
      </div>

      {showFundSelector && (
        <div className="space-y-1 min-w-[200px]">
          <Label className="text-xs">Funding Source</Label>
          <FundSelector
            funds={funds}
            value={fundId}
            onSelect={onFundChange}
            placeholder="All Funding Sources (Consolidated)"
            testId="filter-fund"
          />
        </div>
      )}

      {showPeriodSelector && onPeriodTypeChange && (
        <div className="space-y-1">
          <Label className="text-xs">Period</Label>
          <Select value={periodType} onValueChange={(v) => onPeriodTypeChange(v as PeriodType)}>
            <SelectTrigger className="w-32" data-testid="filter-period">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="monthly">Monthly</SelectItem>
              <SelectItem value="quarterly">Quarterly</SelectItem>
              <SelectItem value="ytd">YTD</SelectItem>
              <SelectItem value="annual">Annual</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <Button onClick={handleApply} data-testid="filter-apply-btn">
        Apply
      </Button>
    </div>
  )
}
