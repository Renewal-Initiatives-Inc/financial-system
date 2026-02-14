'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { GlEntryRow } from '@/lib/bank-rec/gl-only-categories'

const formatCurrency = (val: string | null) => {
  if (!val) return ''
  const num = parseFloat(val)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

export const glColumns: ColumnDef<GlEntryRow, unknown>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
  },
  {
    accessorKey: 'memo',
    header: 'Memo',
    cell: ({ row }) => (
      <span className="truncate max-w-[200px] block">
        {row.original.memo}
      </span>
    ),
  },
  {
    accessorKey: 'debit',
    header: 'Debit',
    cell: ({ row }) => (
      <span className="font-mono text-red-600 dark:text-red-400">
        {formatCurrency(row.original.debit)}
      </span>
    ),
  },
  {
    accessorKey: 'credit',
    header: 'Credit',
    cell: ({ row }) => (
      <span className="font-mono text-green-600 dark:text-green-400">
        {formatCurrency(row.original.credit)}
      </span>
    ),
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      if (row.original.isGlOnly) {
        return (
          <Badge
            variant="outline"
            className="bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          >
            GL-Only
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
          Outstanding
        </Badge>
      )
    },
    enableSorting: false,
  },
]
