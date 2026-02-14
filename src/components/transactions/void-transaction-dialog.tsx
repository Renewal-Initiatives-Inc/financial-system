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
import { voidTransactionAction } from '@/app/(protected)/transactions/actions'

interface VoidTransactionDialogProps {
  transactionId: number
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function VoidTransactionDialog({
  transactionId,
  open,
  onOpenChange,
}: VoidTransactionDialogProps) {
  const router = useRouter()
  const [pending, setPending] = useState(false)

  const handleVoid = async () => {
    setPending(true)
    try {
      await voidTransactionAction(
        transactionId,
        'system' // TODO: replace with session user
      )
      toast.success('Transaction voided')
      onOpenChange(false)
      router.refresh()
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to void transaction'
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>
            Void Transaction #{transactionId}?
          </AlertDialogTitle>
          <AlertDialogDescription>
            This transaction will be excluded from all GL calculations and
            financial statements. It will remain visible in the transaction
            history with a VOID badge. This action cannot be undone — to reverse
            the effect, create a new entry instead.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleVoid}
            disabled={pending}
            data-testid="txn-void-confirm"
          >
            {pending ? 'Voiding...' : 'Void Transaction'}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
