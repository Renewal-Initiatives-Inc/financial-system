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
import { donorColumns } from './columns'
import { CreateDonorDialog } from './create-donor-dialog'
import type { DonorRow } from './actions'

interface DonorsClientProps {
  initialDonors: DonorRow[]
}

export function DonorsClient({ initialDonors }: DonorsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showActive, setShowActive] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  const filtered = initialDonors.filter((donor) => {
    if (showActive === 'active' && !donor.isActive) return false
    if (typeFilter !== 'all' && donor.type !== typeFilter) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        donor.name.toLowerCase().includes(q) ||
        (donor.email?.toLowerCase().includes(q) ?? false)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Donors</h1>
        <Button
          onClick={() => setCreateOpen(true)}
          data-testid="create-donor-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          Create Donor
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search donors..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="donors-search-input"
        />
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-[160px]"
            data-testid="donors-type-filter"
          >
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="INDIVIDUAL">Individual</SelectItem>
            <SelectItem value="CORPORATE">Corporate</SelectItem>
            <SelectItem value="FOUNDATION">Foundation</SelectItem>
            <SelectItem value="GOVERNMENT">Government</SelectItem>
          </SelectContent>
        </Select>
        <Select
          value={showActive}
          onValueChange={(v) => setShowActive(v as 'all' | 'active')}
        >
          <SelectTrigger
            className="w-[140px]"
            data-testid="donors-active-filter"
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
        columns={donorColumns}
        data={filtered}
        onRowClick={(row) => router.push(`/donors/${row.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        emptyMessage="No donors found."
        testIdPrefix="donors"
      />

      <CreateDonorDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
      />
    </div>
  )
}
