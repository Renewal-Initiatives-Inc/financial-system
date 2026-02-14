'use client'

import { useState } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { complianceColumns } from './columns'
import { markDeadlineComplete, type ComplianceDeadlineRow } from './actions'

interface ComplianceCalendarClientProps {
  initialDeadlines: ComplianceDeadlineRow[]
}

export function ComplianceCalendarClient({
  initialDeadlines,
}: ComplianceCalendarClientProps) {
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<number | null>(null)

  const filtered = initialDeadlines.filter((d) => {
    if (categoryFilter && d.category !== categoryFilter) return false
    if (statusFilter && d.status !== statusFilter) return false
    return true
  })

  async function handleComplete() {
    if (selected == null) return
    await markDeadlineComplete(selected, 'current-user')
    setSelected(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Compliance Calendar
        </h1>
        {selected != null && (
          <Button
            onClick={handleComplete}
            data-testid="compliance-mark-complete-btn"
          >
            Mark Complete
          </Button>
        )}
      </div>

      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="compliance-category-filter"
          >
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Categories</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="budget">Budget</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="compliance-status-filter"
          >
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="reminded">Reminded</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={complianceColumns}
        data={filtered}
        onRowClick={(row) =>
          setSelected(row.id === selected ? null : row.id)
        }
        initialSorting={[{ id: 'dueDate', desc: false }]}
        emptyMessage="No compliance deadlines found."
        testIdPrefix="compliance"
      />
    </div>
  )
}
