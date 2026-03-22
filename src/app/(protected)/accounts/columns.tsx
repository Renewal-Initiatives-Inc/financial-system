'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import { formatCurrency } from '@/lib/reports/types'
import type { AccountRowWithBalance } from './actions'

const typeColors: Record<string, string> = {
  ASSET: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  LIABILITY: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  NET_ASSET: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  REVENUE: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  EXPENSE: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
}

const typeLabels: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  NET_ASSET: 'Retained Earnings',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
}

export const accountColumns: ColumnDef<AccountRowWithBalance, unknown>[] = [
  {
    accessorKey: 'code',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Code" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">{row.getValue('code')}</span>
    ),
  },
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'type',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue('type') as string
      return (
        <Badge variant="outline" className={typeColors[type] ?? ''}>
          {typeLabels[type] ?? type}
        </Badge>
      )
    },
    filterFn: (row, id, value) => {
      return value === '' || row.getValue(id) === value
    },
  },
  {
    accessorKey: 'subType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Sub-Type" />
    ),
    cell: ({ row }) => {
      const subType = row.getValue('subType') as string | null
      return subType ? <span className="text-sm">{subType}</span> : <span className="text-muted-foreground">-</span>
    },
  },
  {
    accessorKey: 'balance',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Balance" />
    ),
    cell: ({ row }) => {
      const balance = row.getValue('balance') as number
      return (
        <span className={`text-sm tabular-nums font-medium ${balance < 0 ? 'text-red-600' : ''}`}>
          {formatCurrency(balance)}
        </span>
      )
    },
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
  {
    accessorKey: 'isSystemLocked',
    header: 'Locked',
    cell: ({ row }) => {
      const locked = row.getValue('isSystemLocked') as boolean
      return locked ? (
        <Lock className="h-4 w-4 text-muted-foreground" />
      ) : null
    },
    enableSorting: false,
  },
  {
    accessorKey: 'form990Line',
    header: '990 Line',
    cell: ({ row }) => {
      const line = row.getValue('form990Line') as string | null
      return line ? <span className="text-sm font-mono">{line}</span> : null
    },
    enableSorting: false,
  },
]
