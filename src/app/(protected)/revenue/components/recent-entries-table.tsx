'use client'

import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

export interface RecentEntry {
  id: number
  date: string
  memo: string
  sourceType: string
  createdAt: Date
  amount: string | null
  accountName: string
  accountCode: string
}

const formatCurrency = (amount: string | null) => {
  if (!amount) return '—'
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

const sourceLabel: Record<string, string> = {
  MANUAL: 'Manual',
  BANK_FEED: 'Bank Feed',
  SYSTEM: 'System',
  FY25_IMPORT: 'Import',
}

interface RecentEntriesTableProps {
  entries: RecentEntry[]
  emptyMessage?: string
}

export function RecentEntriesTable({
  entries,
  emptyMessage = 'No entries recorded yet.',
}: RecentEntriesTableProps) {
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>
  }

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Account</TableHead>
            <TableHead className="text-right">Amount</TableHead>
            <TableHead>Source</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {entries.map((entry) => (
            <TableRow key={`${entry.id}-${entry.accountCode}`}>
              <TableCell className="text-sm">{entry.date}</TableCell>
              <TableCell className="text-sm truncate max-w-[200px]">
                {entry.memo}
              </TableCell>
              <TableCell className="text-sm">
                <span className="font-mono text-xs">{entry.accountCode}</span>{' '}
                {entry.accountName}
              </TableCell>
              <TableCell className="text-sm text-right font-mono">
                {formatCurrency(entry.amount)}
              </TableCell>
              <TableCell>
                <Badge variant="outline" className="text-xs">
                  {sourceLabel[entry.sourceType] ?? entry.sourceType}
                </Badge>
              </TableCell>
              <TableCell className="text-right">
                <Button variant="ghost" size="sm" asChild>
                  <Link href={`/transactions/${entry.id}`}>
                    <Pencil className="h-3 w-3" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
