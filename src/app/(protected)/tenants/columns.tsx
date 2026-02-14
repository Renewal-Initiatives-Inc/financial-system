'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { TenantRow } from './actions'

const fundingColors: Record<string, string> = {
  TENANT_DIRECT: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  VASH: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  MRVP: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  SECTION_8: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  OTHER_VOUCHER: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const fundingLabels: Record<string, string> = {
  TENANT_DIRECT: 'Self-Pay',
  VASH: 'VASH',
  MRVP: 'MRVP',
  SECTION_8: 'Section 8',
  OTHER_VOUCHER: 'Other Voucher',
}

function formatCurrency(value: string | null): string {
  if (!value) return '-'
  const num = parseFloat(value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

function isDatePast(value: string | null): boolean {
  if (!value) return false
  return new Date(value) < new Date()
}

export const tenantColumns: ColumnDef<TenantRow, unknown>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'unitNumber',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Unit #" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-sm">
        {row.getValue('unitNumber')}
      </span>
    ),
  },
  {
    accessorKey: 'monthlyRent',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Monthly Rent" />
    ),
    cell: ({ row }) => formatCurrency(row.getValue('monthlyRent')),
  },
  {
    accessorKey: 'fundingSourceType',
    header: 'Funding Source',
    cell: ({ row }) => {
      const type = row.getValue('fundingSourceType') as string
      return (
        <Badge variant="outline" className={fundingColors[type] ?? ''}>
          {fundingLabels[type] ?? type}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'leaseEnd',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Lease End" />
    ),
    cell: ({ row }) => {
      const val = row.getValue('leaseEnd') as string | null
      const past = isDatePast(val)
      return (
        <span className={past ? 'text-destructive font-medium' : ''}>
          {formatDate(val)}
        </span>
      )
    },
  },
  {
    accessorKey: 'securityDepositAmount',
    header: 'Sec. Deposit',
    cell: ({ row }) =>
      formatCurrency(row.getValue('securityDepositAmount')),
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
