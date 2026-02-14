'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { VendorRow } from './actions'

const w9Colors: Record<string, string> = {
  COLLECTED: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  NOT_REQUIRED: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const w9Labels: Record<string, string> = {
  COLLECTED: 'Collected',
  PENDING: 'Pending',
  NOT_REQUIRED: 'Not Required',
}

const entityTypeLabels: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  SOLE_PROPRIETOR: 'Sole Proprietor',
  LLC: 'LLC',
  S_CORP: 'S-Corp',
  C_CORP: 'C-Corp',
  PARTNERSHIP: 'Partnership',
  GOVERNMENT: 'Government',
}

export const vendorColumns: ColumnDef<VendorRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'entityType',
    header: 'Entity Type',
    cell: ({ row }) => {
      const type = row.getValue('entityType') as string | null
      return type ? (
        <Badge variant="outline">{entityTypeLabels[type] ?? type}</Badge>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'is1099Eligible',
    header: '1099 Eligible',
    cell: ({ row }) => {
      const eligible = row.getValue('is1099Eligible') as boolean
      return (
        <Badge
          variant="outline"
          className={
            eligible
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          }
        >
          {eligible ? 'Yes' : 'No'}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'w9Status',
    header: 'W-9 Status',
    cell: ({ row }) => {
      const status = row.getValue('w9Status') as string
      return (
        <Badge variant="outline" className={w9Colors[status] ?? ''}>
          {w9Labels[status] ?? status}
        </Badge>
      )
    },
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
