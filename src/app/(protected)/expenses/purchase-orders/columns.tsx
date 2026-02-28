'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { PurchaseOrderRow } from '../actions'

const statusColors: Record<string, string> = {
  DRAFT:
    'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
  ACTIVE:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  COMPLETED:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  CANCELLED:
    'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
}

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  ACTIVE: 'Active',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
}

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(date))
}

export const purchaseOrderColumns: ColumnDef<PurchaseOrderRow, unknown>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="PO#" />
    ),
    cell: ({ row }) => {
      const id = row.getValue('id') as number
      return (
        <span className="text-blue-600 font-medium">
          PO-{id}
        </span>
      )
    },
  },
  {
    accessorKey: 'vendorName',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Vendor" />
    ),
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.original.vendorId === Number(filterValue)
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
    accessorKey: 'totalAmount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Amount" />
    ),
    cell: ({ row }) => {
      const amount = row.getValue('totalAmount') as string
      return <span className="font-mono">{formatCurrency(amount)}</span>
    },
  },
  {
    accessorKey: 'invoicedAmount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Invoiced" />
    ),
    cell: ({ row }) => {
      const amount = row.getValue('invoicedAmount') as string
      return <span className="font-mono">{formatCurrency(amount)}</span>
    },
  },
  {
    id: 'remaining',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Remaining" />
    ),
    accessorFn: (row) =>
      parseFloat(row.totalAmount) - parseFloat(row.invoicedAmount),
    cell: ({ row }) => {
      const total = parseFloat(row.original.totalAmount)
      const invoiced = parseFloat(row.original.invoicedAmount)
      const remaining = total - invoiced
      return (
        <span
          className={`font-mono ${remaining < 0 ? 'text-red-600' : ''}`}
        >
          {formatCurrency(remaining)}
        </span>
      )
    },
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge variant="outline" className={statusColors[status] ?? ''}>
          {statusLabels[status] ?? status}
        </Badge>
      )
    },
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.original.status === filterValue
    },
  },
  {
    accessorKey: 'fundName',
    header: 'Funding Source',
    filterFn: (row, _columnId, filterValue) => {
      if (!filterValue || filterValue === 'all') return true
      return row.original.fundId === Number(filterValue)
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as Date
      return <span>{formatDate(date)}</span>
    },
  },
]
