'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { DonorRow } from './actions'

const typeColors: Record<string, string> = {
  INDIVIDUAL: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  CORPORATE: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  FOUNDATION: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  GOVERNMENT: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

const typeLabels: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  CORPORATE: 'Corporate',
  FOUNDATION: 'Foundation',
  GOVERNMENT: 'Government',
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const donorColumns: ColumnDef<DonorRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.getValue('type') as string
      return (
        <Badge variant="outline" className={typeColors[type] ?? ''}>
          {typeLabels[type] ?? type}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'email',
    header: 'Email',
    cell: ({ row }) => {
      const email = row.getValue('email') as string | null
      if (!email) return <span className="text-muted-foreground">-</span>
      return (
        <span className="text-sm truncate max-w-[200px] block">
          {email}
        </span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'firstGiftDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="First Gift" />
    ),
    cell: ({ row }) => formatDate(row.getValue('firstGiftDate')),
  },
  {
    id: 'totalGiving',
    header: 'Total Giving',
    cell: () => (
      <span className="text-muted-foreground">$0</span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'isActive',
    header: 'Active',
    cell: ({ row }) => {
      const active = row.getValue('isActive') as boolean
      return (
        <Badge variant={active ? 'default' : 'secondary'}>
          {active ? 'Active' : 'Inactive'}
        </Badge>
      )
    },
    enableSorting: false,
  },
]
