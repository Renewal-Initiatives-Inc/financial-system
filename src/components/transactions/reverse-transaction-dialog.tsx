'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { reverseTransactionAction } from '@/app/(protected)/transactions/actions'
import type { TransactionDetail } from '@/app/(protected)/transactions/actions'

interface ReverseTransactionDialogProps {
  transaction: TransactionDetail
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function ReverseTransactionDialog({
  transaction,
  open,
  onOpenChange,
}: ReverseTransactionDialogProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleReverse = async () => {
    setPending(true)
    try {
      const result = await reverseTransactionAction(
        transaction.id,
        'system' // TODO: replace with session user
      )
      toast.success(
        `Transaction reversed. Reversal entry #${result.reversalId} created.`
      )
      onOpenChange(false)
      router.push(`/transactions/${result.reversalId}`)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reverse transaction'
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="max-w-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle>
            Reverse Transaction #{transaction.id}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            A reversing entry will be created with opposite amounts. The original
            transaction will be marked as reversed. Both entries remain visible
            in the transaction history.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <div className="space-y-4">
          <div>
            <p className="text-sm font-medium mb-2">
              Original Entry
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.lines.map((line) => (
                  <TableRow key={line.id}>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs mr-1">
                        {line.accountCode}
                      </span>
                      {line.accountName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.debit
                        ? `$${parseFloat(line.debit).toFixed(2)}`
                        : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.credit
                        ? `$${parseFloat(line.credit).toFixed(2)}`
                        : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <div>
            <p className="text-sm font-medium mb-2">
              Reversing Entry (will be created)
            </p>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Account</TableHead>
                  <TableHead className="text-right">Debit</TableHead>
                  <TableHead className="text-right">Credit</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transaction.lines.map((line) => (
                  <TableRow key={`rev-${line.id}`}>
                    <TableCell className="text-sm">
                      <span className="font-mono text-xs mr-1">
                        {line.accountCode}
                      </span>
                      {line.accountName}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.credit
                        ? `$${parseFloat(line.credit).toFixed(2)}`
                        : ''}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      {line.debit
                        ? `$${parseFloat(line.debit).toFixed(2)}`
                        : ''}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            onClick={handleReverse}
            disabled={pending}
            data-testid="txn-reverse-confirm"
          >
            {pending ? 'Reversing...' : 'Confirm Reversal'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
