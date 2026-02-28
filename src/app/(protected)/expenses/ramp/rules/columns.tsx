'use client'

import { ColumnDef } from '@tanstack/react-table'
import { Badge } from '@/components/ui/badge'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { CategorizationRuleRow } from './actions'

type Criteria = { merchantPattern?: string; descriptionKeywords?: string[] }

export const ruleColumns: ColumnDef<CategorizationRuleRow, unknown>[] = [
  {
    id: 'merchantPattern',
    header: 'Merchant Pattern',
    cell: ({ row }) => {
      const criteria = row.original.criteria as Criteria
      return criteria.merchantPattern ? (
        <span className="font-mono text-sm">{criteria.merchantPattern}</span>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
  },
  {
    id: 'descriptionKeywords',
    header: 'Description Keywords',
    cell: ({ row }) => {
      const criteria = row.original.criteria as Criteria
      const keywords = criteria.descriptionKeywords
      return keywords && keywords.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {keywords.map((kw) => (
            <Badge key={kw} variant="outline" className="text-xs">
              {kw}
            </Badge>
          ))}
        </div>
      ) : (
        <span className="text-muted-foreground">-</span>
      )
    },
    enableSorting: false,
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
    header: 'Funding Source',
    cell: ({ row }) =>
      row.original.fundName ?? (
        <span className="text-muted-foreground">-</span>
      ),
    enableSorting: false,
  },
  {
    accessorKey: 'autoApply',
    header: 'Auto-Apply',
    cell: ({ row }) => {
      const active = row.getValue('autoApply') as boolean
      return (
        <Badge
          variant="outline"
          className={
            active
              ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
              : 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200'
          }
        >
          {active ? 'On' : 'Off'}
        </Badge>
      )
    },
    enableSorting: false,
  },
  {
    accessorKey: 'hitCount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Hits" />
    ),
    cell: ({ row }) => {
      const count = row.getValue('hitCount') as number
      return <span className="font-mono text-sm">{count}</span>
    },
  },
  {
    accessorKey: 'createdBy',
    header: 'Created By',
    enableSorting: false,
  },
]
