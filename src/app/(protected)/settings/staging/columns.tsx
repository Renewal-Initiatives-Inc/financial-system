'use client'

import { ColumnDef } from '@tanstack/react-table'
import Link from 'next/link'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { StagingRecordWithRelations } from '@/lib/staging/queries'

const statusColors: Record<string, string> = {
  received:
    'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  posted:
    'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
  matched_to_payment:
    'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  paid: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
}

const statusLabels: Record<string, string> = {
  received: 'Received',
  posted: 'Posted',
  matched_to_payment: 'Matched',
  paid: 'Paid',
}

const sourceAppLabels: Record<string, string> = {
  timesheets: 'Timesheets',
  expense_reports: 'Expense Reports',
}

const recordTypeLabels: Record<string, string> = {
  timesheet_fund_summary: 'Timesheet',
  expense_line_item: 'Expense',
}

export const stagingColumns: ColumnDef<StagingRecordWithRelations, unknown>[] = [
  {
    accessorKey: 'id',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="ID" />
    ),
    cell: ({ row }) => (
      <span className="font-mono text-xs">{row.getValue('id')}</span>
    ),
  },
  {
    accessorKey: 'sourceApp',
    header: 'Source',
    cell: ({ row }) => {
      const app = row.getValue('sourceApp') as string
      return (
        <Badge variant="outline">
          {sourceAppLabels[app] ?? app}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'recordType',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.getValue('recordType') as string
      return recordTypeLabels[type] ?? type
    },
    enableSorting: false,
  },
  {
    accessorKey: 'employeeId',
    header: 'Employee',
  },
  {
    accessorKey: 'referenceId',
    header: 'Reference',
    cell: ({ row }) => (
      <span className="font-mono text-xs">
        {row.getValue('referenceId') as string}
      </span>
    ),
  },
  {
    accessorKey: 'dateIncurred',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
  },
  {
    accessorKey: 'amount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('amount') as string)
      return (
        <span className="font-mono">
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      )
    },
  },
  {
    accessorKey: 'fundName',
    header: 'Funding Source',
    cell: ({ row }) =>
      row.getValue('fundName') ?? (
        <span className="text-muted-foreground">-</span>
      ),
    enableSorting: false,
  },
  {
    accessorKey: 'glAccountCode',
    header: 'GL Account',
    cell: ({ row }) => {
      const code = row.original.glAccountCode
      const name = row.original.glAccountName
      if (!code) return <span className="text-muted-foreground">-</span>
      return `${code} — ${name}`
    },
    enableSorting: false,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge
          variant="outline"
          className={statusColors[status] ?? ''}
          data-testid={`staging-status-${row.original.id}`}
        >
          {statusLabels[status] ?? status}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'glTransactionId',
    header: 'GL Txn',
    cell: ({ row }) => {
      const txnId = row.getValue('glTransactionId') as number | null
      if (!txnId) return <span className="text-muted-foreground">-</span>
      return (
        <Link
          href={`/transactions/${txnId}`}
          className="text-primary underline-offset-4 hover:underline"
          data-testid={`staging-gl-link-${row.original.id}`}
        >
          #{txnId}
        </Link>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = row.getValue('createdAt') as Date | null
      if (!date) return '-'
      return new Date(date).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    },
  },
]
