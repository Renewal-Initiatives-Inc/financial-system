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
import type { BankTransactionRow } from '../actions'

const formatCurrency = (amount: string) => {
  const num = parseFloat(amount)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(num))
}

interface PendingTransactionsProps {
  transactions: BankTransactionRow[]
}

export function PendingTransactions({
  transactions,
}: PendingTransactionsProps) {
  const pending = transactions.filter((t) => t.isPending)

  if (pending.length === 0) return null

  return (
    <div data-testid="pending-transactions" className="opacity-60">
      <div className="flex items-center gap-2 mb-2">
        <p className="text-sm font-medium text-muted-foreground">
          Pending Transactions ({pending.length})
        </p>
        <HelpTooltip term="pending-transaction" />
      </div>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Date</TableHead>
            <TableHead>Description</TableHead>
            <TableHead>Amount</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {pending.map((txn) => (
            <TableRow key={txn.id} className="opacity-60">
              <TableCell>{txn.date}</TableCell>
              <TableCell className="italic">
                {txn.merchantName ?? 'Unknown'}
              </TableCell>
              <TableCell className="font-mono text-muted-foreground">
                {parseFloat(txn.amount) > 0 ? '-' : '+'}
                {formatCurrency(txn.amount)}
              </TableCell>
              <TableCell>
                <Badge
                  variant="outline"
                  className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200"
                >
                  Pending
                </Badge>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
