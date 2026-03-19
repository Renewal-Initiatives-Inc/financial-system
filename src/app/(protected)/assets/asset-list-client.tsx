'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { DataTable } from '@/components/shared/data-table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { Plus } from 'lucide-react'
import { assetColumns } from './columns'
import { CreateAssetDialog } from './create-asset-dialog'
import type { FixedAssetRow } from './actions'

interface AssetListClientProps {
  initialAssets: FixedAssetRow[]
  accountOptions: { id: number; name: string; code: string; subType: string | null }[]
  fundOptions: { id: number; name: string }[]
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function AssetListClient({
  initialAssets,
  accountOptions,
  fundOptions: _fundOptions,
}: AssetListClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  // Client-side filtering
  const filtered = initialAssets.filter((asset) => {
    if (statusFilter === 'active' && !asset.isActive) return false
    if (
      search &&
      !asset.name.toLowerCase().includes(search.toLowerCase())
    ) {
      return false
    }
    return true
  })

  // Summary calculations
  const totalCost = filtered.reduce((sum, a) => sum + Number(a.cost), 0)
  const totalAccumDepr = filtered.reduce(
    (sum, a) => sum + Number(a.accumulatedDepreciation),
    0
  )
  const totalNBV = filtered.reduce(
    (sum, a) => sum + Number(a.netBookValue),
    0
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Fixed Assets
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage fixed assets, depreciation, and CIP conversions
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-asset-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Asset
        </Button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Cost
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Accumulated Depreciation
              <HelpTooltip term="depreciation" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(totalAccumDepr)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              Net Book Value
              <HelpTooltip term="net-book-value" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(totalNBV)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Input
          placeholder="Search assets..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="asset-search"
        />
        <Select
          value={statusFilter}
          onValueChange={(v) => setStatusFilter(v as 'all' | 'active')}
        >
          <SelectTrigger className="w-[150px]" data-testid="asset-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="all">All Assets</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Data Table */}
      <DataTable
        columns={assetColumns}
        data={filtered}
        onRowClick={(row) => router.push(`/assets/${row.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        emptyMessage="No fixed assets found."
        testIdPrefix="assets"
      />

      <CreateAssetDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accountOptions={accountOptions}
        parentAssetOptions={initialAssets
          .filter((a) => !a.parentAssetId && a.isActive)
          .map((a) => ({ id: a.id, name: a.name }))}
      />
    </div>
  )
}
