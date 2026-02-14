'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { type ColumnDef } from '@tanstack/react-table'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import type { PayrollRunRow } from './actions'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatPeriod(start: string, end: string): string {
  const endDate = new Date(end + 'T00:00:00')
  return endDate.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CALCULATED: 'bg-blue-50 text-blue-700 border-blue-200',
  POSTED: 'bg-green-50 text-green-700 border-green-200',
}

const columns: ColumnDef<PayrollRunRow, unknown>[] = [
  {
    accessorKey: 'payPeriodStart',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Pay Period" />
    ),
    cell: ({ row }) => {
      const start = row.original.payPeriodStart
      const end = row.original.payPeriodEnd
      return formatPeriod(start, end)
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge
          variant="outline"
          className={statusColors[status] ?? ''}
          data-testid={`payroll-status-${row.original.id}`}
        >
          {status}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'entryCount',
    header: 'Employees',
    cell: ({ row }) => row.original.entryCount,
    enableSorting: false,
  },
  {
    id: 'totalGross',
    header: 'Total Gross',
    cell: ({ row }) => formatCurrency(row.original.totalGross),
    enableSorting: false,
  },
  {
    id: 'totalNet',
    header: 'Total Net',
    cell: ({ row }) => formatCurrency(row.original.totalNet),
    enableSorting: false,
  },
  {
    accessorKey: 'postedAt',
    header: 'Posted At',
    cell: ({ row }) => {
      const posted = row.original.postedAt
      if (!posted) return '—'
      return new Date(posted).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    },
    enableSorting: false,
  },
]

interface PayrollRunsClientProps {
  initialRuns: PayrollRunRow[]
}

export function PayrollRunsClient({ initialRuns }: PayrollRunsClientProps) {
  const router = useRouter()
  const [statusFilter, setStatusFilter] = useState<string>('all')

  const filtered =
    statusFilter === 'all'
      ? initialRuns
      : initialRuns.filter((r) => r.status === statusFilter)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Payroll</h1>
          <HelpTooltip term="payroll" />
        </div>
        <Button
          onClick={() => router.push('/payroll/runs/new')}
          data-testid="new-payroll-run-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Payroll Run
        </Button>
      </div>

      <div className="flex gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="CALCULATED">Calculated</SelectItem>
            <SelectItem value="POSTED">Posted</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        onRowClick={(row) => router.push(`/payroll/runs/${row.id}`)}
        emptyMessage="No payroll runs yet. Create your first payroll run to get started."
        initialSorting={[{ id: 'payPeriodStart', desc: true }]}
        testIdPrefix="payroll-runs"
      />
    </div>
  )
}
