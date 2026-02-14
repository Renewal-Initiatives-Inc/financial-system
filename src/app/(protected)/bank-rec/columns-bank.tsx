'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { BankTransactionRow } from './actions'

const formatCurrency = (amount: string) => {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(num))
}

export const bankColumns: ColumnDef<BankTransactionRow, unknown>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => (
      <span className={row.original.isPending ? 'text-muted-foreground' : ''}>
        {row.original.date}
      </span>
    ),
  },
  {
    accessorKey: 'merchantName',
    header: 'Description',
    cell: ({ row }) => (
      <span
        className={`truncate max-w-[200px] block ${row.original.isPending ? 'text-muted-foreground italic' : ''}`}
      >
        {row.original.merchantName ?? 'Unknown'}
      </span>
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.original.amount)
      const isOutflow = amount > 0
      return (
        <span
          className={`font-mono ${
            row.original.isPending
              ? 'text-muted-foreground'
              : isOutflow
                ? 'text-red-600 dark:text-red-400'
                : 'text-green-600 dark:text-green-400'
          }`}
        >
          {isOutflow ? '-' : '+'}
          {formatCurrency(row.original.amount)}
        </span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.isPending) {
        return (
          <Badge
            variant="outline"
            className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
          >
            Pending
          </Badge>
        )
      }
      if (row.original.isMatched) {
        return (
          <Badge
            variant="outline"
            className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
          >
            Matched
          </Badge>
        )
      }
      return (
        <Badge
          variant="outline"
          className="bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
        >
          Unmatched
        </Badge>
      )
    },
    enableSorting: false,
  },
]
