'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Lock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { FundWithBalance } from './actions'

export const fundColumns: ColumnDef<FundWithBalance, unknown>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Name" />
    ),
  },
  {
    accessorKey: 'restrictionType',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Restriction Type" />
    ),
    cell: ({ row }) => {
      const type = row.getValue('restrictionType') as string
      return (
        <Badge
          variant="outline"
          className={
            type === 'RESTRICTED'
              ? 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200'
              : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
          }
        >
          {type === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
        </Badge>
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
    accessorKey: 'balance',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Balance" className="justify-end" />
    ),
    cell: ({ row }) => {
      const balance = parseFloat(row.getValue('balance') as string)
      return (
        <div className="text-right font-mono text-sm">
          ${Math.abs(balance).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          {balance < 0 ? ' CR' : balance > 0 ? ' DR' : ''}
        </div>
      )
    },
    sortingFn: (rowA, rowB) => {
      return (
        parseFloat(rowA.getValue('balance') as string) -
        parseFloat(rowB.getValue('balance') as string)
      )
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => {
      const desc = row.getValue('description') as string | null
      if (!desc) return null

      const truncated = desc.length > 60 ? desc.slice(0, 60) + '...' : desc
      if (desc.length <= 60) {
        return <span className="text-sm text-muted-foreground">{desc}</span>
      }

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="text-sm text-muted-foreground cursor-help">
                {truncated}
              </span>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p>{desc}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )
    },
    enableSorting: false,
  },
]
