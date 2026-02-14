'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { FixedAssetRow } from './actions'

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatUsefulLife(months: number): string {
  const years = Math.floor(months / 12)
  const remainder = months % 12
  if (remainder === 0) return `${years}yr`
  return `${years}yr ${remainder}mo`
}

export const assetColumns: ColumnDef<FixedAssetRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
    cell: ({ row }) => {
      const name = row.getValue('name') as string
      const parentId = row.original.parentAssetId
      return (
        <span className={parentId ? 'pl-6 text-muted-foreground' : 'font-medium'}>
          {parentId ? '└ ' : ''}
          {name}
        </span>
      )
    },
  },
  {
    accessorKey: 'acquisitionDate',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Acquired" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('acquisitionDate') as string
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    },
  },
  {
    accessorKey: 'cost',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Cost" />
    ),
    cell: ({ row }) => formatCurrency(row.getValue('cost') as string),
  },
  {
    accessorKey: 'usefulLifeMonths',
    header: 'Useful Life',
    cell: ({ row }) => formatUsefulLife(row.getValue('usefulLifeMonths') as number),
    enableSorting: false,
  },
  {
    accessorKey: 'monthlyDepreciation',
    header: 'Monthly Depr.',
    cell: ({ row }) => formatCurrency(row.original.monthlyDepreciation),
    enableSorting: false,
  },
  {
    accessorKey: 'accumulatedDepreciation',
    header: 'Accum. Depr.',
    cell: ({ row }) => formatCurrency(row.original.accumulatedDepreciation),
    enableSorting: false,
  },
  {
    accessorKey: 'netBookValue',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Net Book Value" />
    ),
    cell: ({ row }) => (
      <span className="font-medium">
        {formatCurrency(row.original.netBookValue)}
      </span>
    ),
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const { isActive, isFullyDepreciated, datePlacedInService } = row.original
      if (!isActive) {
        return <Badge variant="secondary">Inactive</Badge>
      }
      if (isFullyDepreciated) {
        return (
          <Badge variant="outline" className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
            Fully Depreciated
          </Badge>
        )
      }
      if (!datePlacedInService) {
        return (
          <Badge variant="outline" className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200">
            Not in Service
          </Badge>
        )
      }
      return <Badge variant="default">Active</Badge>
    },
    enableSorting: false,
  },
  {
    accessorKey: 'datePlacedInService',
    header: 'PIS Date',
    cell: ({ row }) => {
      const date = row.getValue('datePlacedInService') as string | null
      if (!date) return <span className="text-muted-foreground">-</span>
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    },
    enableSorting: false,
  },
]
