'use client'

import React from 'react'
import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { RampTransactionRow } from './actions'

const statusColors: Record<string, string> = {
  pending:
    'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  uncategorized:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  categorized:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  posted:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
}

const statusLabels: Record<string, string> = {
  pending: 'Pending',
  uncategorized: 'Uncategorized',
  categorized: 'Categorized',
  posted: 'Posted',
}

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

export const rampColumns: ColumnDef<RampTransactionRow, unknown>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={
          table.getIsAllPageRowsSelected() ||
          (table.getIsSomePageRowsSelected() && 'indeterminate')
        }
        onCheckedChange={(value: boolean | 'indeterminate') =>
          table.toggleAllPageRowsSelected(!!value)
        }
        aria-label="Select all"
        data-testid="ramp-select-all"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value: boolean | 'indeterminate') =>
          row.toggleSelected(!!value)
        }
        aria-label="Select row"
        data-testid={`ramp-select-row-${row.index}`}
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      />
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
  },
  {
    accessorKey: 'merchantName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Merchant" />
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = row.getValue('amount') as string
      return <span className="font-mono">{formatCurrency(amount)}</span>
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
      const desc = row.getValue('description') as string | null
      return desc ? (
        <span className="max-w-[200px] truncate block" title={desc}>
          {desc}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'cardholder',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cardholder" />
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const isPending = row.original.isPending
      const displayStatus = isPending ? 'pending' : (row.getValue('status') as string)
      return (
        <Badge variant="outline" className={statusColors[displayStatus] ?? ''}>
          {statusLabels[displayStatus] ?? displayStatus}
        </Badge>
      )
    },
  },
  {
    id: 'glAccount',
    header: 'GL Account',
    cell: ({ row }) => {
      const code = row.original.glAccountCode
      const name = row.original.glAccountName
      return code ? (
        <span className="text-sm">
          <span className="font-mono text-xs">{code}</span> {name}
        </span>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
    enableSorting: false,
  },
  {
    id: 'fund',
    header: 'Fund',
    cell: ({ row }) => {
      const name = row.original.fundName
      return name ?? <span className="text-muted-foreground">-</span>
    },
    enableSorting: false,
  },
]
