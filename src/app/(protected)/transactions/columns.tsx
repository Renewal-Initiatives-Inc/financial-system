'use client'

import { ColumnDef } from '@tanstack/react-table'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { TransactionListRow } from './actions'

const sourceColors: Record<string, string> = {
  MANUAL: 'bg-blue-100 text-blue-800',
  SYSTEM: 'bg-purple-100 text-purple-800',
  TIMESHEET: 'bg-teal-100 text-teal-800',
  EXPENSE_REPORT: 'bg-amber-100 text-amber-800',
  RAMP: 'bg-orange-100 text-orange-800',
  BANK_FEED: 'bg-cyan-100 text-cyan-800',
  FY25_IMPORT: 'bg-gray-100 text-gray-800',
}

const sourceLabels: Record<string, string> = {
  MANUAL: 'Manual',
  SYSTEM: 'System',
  TIMESHEET: 'Timesheet',
  EXPENSE_REPORT: 'Expense',
  RAMP: 'Ramp',
  BANK_FEED: 'Bank Feed',
  FY25_IMPORT: 'FY25 Import',
}

function getStatusBadges(row: TransactionListRow) {
  const badges: Array<{ label: string; className: string }> = []

  if (row.isVoided) {
    badges.push({
      label: 'Voided',
      className: 'bg-red-100 text-red-800',
    })
  } else if (row.reversedById) {
    badges.push({
      label: 'Reversed',
      className: 'bg-amber-100 text-amber-800',
    })
  } else {
    badges.push({
      label: 'Active',
      className: 'bg-green-100 text-green-800',
    })
  }

  if (row.isSystemGenerated) {
    badges.push({
      label: 'System',
      className: 'bg-purple-100 text-purple-800',
    })
  }

  return badges
}

export const transactionColumns: ColumnDef<TransactionListRow, unknown>[] = [
  {
    accessorKey: 'date',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Date" />
    ),
    cell: ({ row }) => {
      const dateStr = row.getValue('date') as string
      return (
        <span className="text-sm whitespace-nowrap">
          {format(new Date(dateStr + 'T12:00:00'), 'MMM dd, yyyy')}
        </span>
      )
    },
  },
  {
    accessorKey: 'memo',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Memo" />
    ),
    cell: ({ row }) => {
      const memo = row.getValue('memo') as string
      const truncated = memo.length > 50 ? memo.slice(0, 50) + '...' : memo
      return memo.length > 50 ? (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm cursor-default">{truncated}</span>
            </TooltipTrigger>
            <TooltipContent className="max-w-sm">
              <p>{memo}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : (
        <span className="text-sm">{memo}</span>
      )
    },
  },
  {
    accessorKey: 'sourceType',
    header: 'Source',
    cell: ({ row }) => {
      const source = row.getValue('sourceType') as string
      return (
        <Badge variant="outline" className={sourceColors[source] ?? ''}>
          {sourceLabels[source] ?? source}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'totalAmount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Amount" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalAmount') as string)
      return (
        <span className="text-sm font-mono text-right block">
          ${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
        </span>
      )
    },
  },
  {
    id: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const badges = getStatusBadges(row.original)
      return (
        <div className="flex gap-1">
          {badges.map((b) => (
            <Badge key={b.label} variant="outline" className={b.className}>
              {b.label}
            </Badge>
          ))}
        </div>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'createdBy',
    header: 'Created By',
    cell: ({ row }) => (
      <span className="text-sm text-muted-foreground">
        {row.getValue('createdBy')}
      </span>
    ),
    enableSorting: false,
  },
  {
    accessorKey: 'lineCount',
    header: 'Lines',
    cell: ({ row }) => (
      <span className="text-sm text-center block">
        {row.getValue('lineCount')}
      </span>
    ),
    enableSorting: false,
  },
]
