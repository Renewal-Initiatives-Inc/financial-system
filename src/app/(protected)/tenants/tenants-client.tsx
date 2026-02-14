'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { tenantColumns } from './columns'
import { CreateTenantDialog } from './create-tenant-dialog'
import type { TenantRow } from './actions'

interface TenantsClientProps {
  initialTenants: TenantRow[]
}

export function TenantsClient({ initialTenants }: TenantsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [fundingFilter, setFundingFilter] = useState('')
  const [showActive, setShowActive] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = initialTenants.filter((tenant) => {
    if (showActive === 'active' && !tenant.isActive) return false
    if (fundingFilter && tenant.fundingSourceType !== fundingFilter)
      return false
    if (search) {
      const q = search.toLowerCase()
      return (
        tenant.name.toLowerCase().includes(q) ||
        tenant.unitNumber.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Tenants</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-tenant-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Tenant
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search tenants..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="tenants-search-input"
        />
        <Select value={fundingFilter} onValueChange={setFundingFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="tenants-funding-filter"
          >
            <SelectValue placeholder="Funding Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All</SelectItem>
            <SelectItem value="TENANT_DIRECT">Self-Pay</SelectItem>
            <SelectItem value="VASH">VASH</SelectItem>
            <SelectItem value="MRVP">MRVP</SelectItem>
            <SelectItem value="SECTION_8">Section 8</SelectItem>
            <SelectItem value="OTHER_VOUCHER">Other Voucher</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={showActive}
          onValueChange={(v) => setShowActive(v as 'all' | 'active')}
        >
          <SelectTrigger
            className="w-[140px]"
            data-testid="tenants-active-filter"
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={tenantColumns}
        data={filtered}
        onRowClick={(row) => router.push(`/tenants/${row.id}`)}
        initialSorting={[{ id: 'unitNumber', desc: false }]}
        emptyMessage="No tenants found."
        testIdPrefix="tenants"
      />

      <CreateTenantDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
