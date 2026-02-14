'use client'

import { Badge } from '@/components/ui/badge'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import type { GlEntryRow } from '@/lib/bank-rec/gl-only-categories'

const formatCurrency = (val: string | null) => {
  if (!val) return ''
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(val))
}

interface OutstandingItemsPanelProps {
  items: GlEntryRow[]
}

export function OutstandingItemsPanel({ items }: OutstandingItemsPanelProps) {
  const outstanding = items.filter((i) => !i.isMatched && !i.isGlOnly)

  if (outstanding.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4">
        No outstanding items. All GL entries are matched or classified as
        GL-only.
      </p>
    )
  }

  return (
    <div data-testid="outstanding-items">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium">
          Outstanding Items ({outstanding.length})
        </p>
        <HelpTooltip term="outstanding-item" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Memo</TableHead>
            <TableHead>Debit</TableHead>
            <TableHead>Credit</TableHead>
            <TableHead>Type</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {outstanding.map((item) => (
            <TableRow key={item.lineId}>
              <TableCell>{item.date}</TableCell>
              <TableCell className="truncate max-w-[200px]">
                {item.memo}
              </TableCell>
              <TableCell className="font-mono">
                {formatCurrency(item.debit)}
              </TableCell>
              <TableCell className="font-mono">
                {formatCurrency(item.credit)}
              </TableCell>
              <TableCell>
                <Badge variant="outline">
                  {item.debit ? 'Outstanding Check' : 'Outstanding Deposit'}
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
