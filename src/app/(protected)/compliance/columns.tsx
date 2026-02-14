'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { ComplianceDeadlineRow } from './actions'

const categoryColors: Record<string, string> = {
  tax: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  tenant: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  grant: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  budget: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

function getStatusBadge(status: string, dueDate: string) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)

  if (status === 'completed') {
    return (
      <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
        Completed
      </Badge>
    )
  }

  const daysUntil = Math.ceil((due.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (daysUntil < 0) {
    return (
      <Badge variant="destructive">
        Overdue
      </Badge>
    )
  }

  if (daysUntil <= 7) {
    return (
      <Badge className="bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200">
        Due in {daysUntil}d
      </Badge>
    )
  }

  if (daysUntil <= 30) {
    return (
      <Badge className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
        Due in {daysUntil}d
      </Badge>
    )
  }

  return (
    <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      Upcoming
    </Badge>
  )
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const complianceColumns: ColumnDef<ComplianceDeadlineRow, unknown>[] = [
  {
    accessorKey: 'taskName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Task" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">{row.getValue('taskName')}</span>
    ),
  },
  {
    accessorKey: 'dueDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Due Date" />
    ),
    cell: ({ row }) => formatDate(row.getValue('dueDate')),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => {
      const cat = row.getValue('category') as string
      return (
        <Badge variant="outline" className={categoryColors[cat] ?? ''}>
          {cat}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) =>
      getStatusBadge(
        row.getValue('status') as string,
        row.original.dueDate
      ),
    enableSorting: false,
  },
  {
    accessorKey: 'recurrence',
    header: 'Recurrence',
    cell: ({ row }) => {
      const r = row.getValue('recurrence') as string
      return <span className="text-muted-foreground text-sm capitalize">{r.replace('_', ' ')}</span>
    },
    enableSorting: false,
  },
  {
    accessorKey: 'notes',
    header: 'Notes',
    cell: ({ row }) => {
      const notes = row.getValue('notes') as string | null
      return notes ? (
        <span className="text-sm text-muted-foreground truncate max-w-[200px] block">
          {notes}
        </span>
      ) : (
        <span className="text-sm text-muted-foreground">-</span>
      )
    },
    enableSorting: false,
  },
]
