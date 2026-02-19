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
import { vendorColumns } from './columns'
import { CreateVendorDialog } from './create-vendor-dialog'
import type { VendorRow } from './actions'

interface VendorsClientProps {
  initialVendors: VendorRow[]
  accountOptions: { id: number; name: string; code: string }[]
  fundOptions: { id: number; name: string }[]
}

export function VendorsClient({
  initialVendors,
  accountOptions,
  fundOptions,
}: VendorsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [eligibleFilter, setEligibleFilter] = useState('all')
  const [w9Filter, setW9Filter] = useState('all')
  const [showActive, setShowActive] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = initialVendors.filter((vendor) => {
    if (showActive === 'active' && !vendor.isActive) return false
    if (eligibleFilter === 'yes' && !vendor.is1099Eligible) return false
    if (eligibleFilter === 'no' && vendor.is1099Eligible) return false
    if (w9Filter !== 'all' && vendor.w9Status !== w9Filter) return false
    if (search) {
      const q = search.toLowerCase()
      return vendor.name.toLowerCase().includes(q)
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Vendors</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-vendor-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Vendor
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search vendors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="vendors-search-input"
        />
        <Select value={eligibleFilter} onValueChange={setEligibleFilter}>
          <SelectTrigger
            className="w-[160px]"
            data-testid="vendors-1099-filter"
          >
            <SelectValue placeholder="1099 Eligible" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="yes">Yes</SelectItem>
            <SelectItem value="no">No</SelectItem>
          </SelectContent>
        </Select>
        <Select value={w9Filter} onValueChange={setW9Filter}>
          <SelectTrigger
            className="w-[160px]"
            data-testid="vendors-w9-filter"
          >
            <SelectValue placeholder="W-9 Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="COLLECTED">Collected</SelectItem>
            <SelectItem value="PENDING">Pending</SelectItem>
            <SelectItem value="NOT_REQUIRED">Not Required</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={showActive}
          onValueChange={(v) => setShowActive(v as 'all' | 'active')}
        >
          <SelectTrigger
            className="w-[140px]"
            data-testid="vendors-active-filter"
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
        columns={vendorColumns}
        data={filtered}
        onRowClick={(row) => router.push(`/vendors/${row.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        emptyMessage="No vendors found."
        testIdPrefix="vendors"
      />

      <CreateVendorDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        accountOptions={accountOptions}
        fundOptions={fundOptions}
      />
    </div>
  )
}
