'use client'

import { useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { FileText } from 'lucide-react'
import { confirmInvoiceMatch, dismissInvoiceSuggestion } from '../actions'
import { toast } from 'sonner'

const formatCurrency = (amount: string | number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)

export interface InvoiceMatchData {
  bankTransactionId: number
  invoiceId: number
  invoiceNumber: string | null
  poNumber: string | null
  vendorName: string
  invoiceAmount: string
  invoiceDate: string
  confidence: number
  isPaid: boolean
  // Bank transaction details
  bankDate: string
  bankMerchant: string | null
  bankAmount: string
}

interface InvoiceMatchCardProps {
  match: InvoiceMatchData
  onSettled: () => void
}

export function InvoiceMatchCard({ match, onSettled }: InvoiceMatchCardProps) {
  const [isPending, startTransition] = useTransition()

  const handleConfirm = () => {
    startTransition(async () => {
      try {
        const result = await confirmInvoiceMatch(
          match.bankTransactionId,
          match.invoiceId
        )

        if (!result.success) {
          toast.error(result.error ?? 'Failed to confirm invoice match')
          return
        }

        if (result.lockedYearWarning) {
          toast.warning(result.lockedYearWarning.message)
        }

        toast.success(
          `Invoice matched — clearing JE created (GL-${result.glTransactionId})`
        )
        onSettled()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to confirm match'
        )
      }
    })
  }

  const handleDismiss = () => {
    startTransition(async () => {
      try {
        await dismissInvoiceSuggestion(match.bankTransactionId)
        toast.success('Invoice suggestion dismissed')
        onSettled()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to dismiss suggestion'
        )
      }
    })
  }

  const bankAmountNum = parseFloat(match.bankAmount)

  return (
    <Card
      className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30"
      data-testid="invoice-match-card"
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium">Invoice Match Suggested</span>
            <Badge
              variant="outline"
              className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
            >
              {match.confidence}% confidence
            </Badge>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {match.isPaid ? (
              <Badge variant="outline" className="bg-gray-100 text-gray-600">
                Already paid
              </Badge>
            ) : (
              <>
                <Button
                  size="sm"
                  onClick={handleConfirm}
                  disabled={isPending}
                  data-testid="confirm-invoice-match-btn"
                >
                  Confirm Match
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleDismiss}
                  disabled={isPending}
                  data-testid="dismiss-invoice-match-btn"
                >
                  Dismiss
                </Button>
              </>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          {/* Bank transaction side */}
          <div className="rounded-md border border-blue-200 dark:border-blue-800 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Bank Transaction</p>
            <p className="font-medium">{match.bankMerchant ?? 'Unknown'}</p>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{match.bankDate}</span>
              <span className={`font-mono font-medium ${bankAmountNum > 0 ? 'text-red-600 dark:text-red-400' : 'text-green-600 dark:text-green-400'}`}>
                {bankAmountNum > 0 ? '-' : '+'}{formatCurrency(Math.abs(bankAmountNum))}
              </span>
            </div>
          </div>

          {/* Invoice side */}
          <div className="rounded-md border border-blue-200 dark:border-blue-800 p-3 space-y-1">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Matching Invoice</p>
            <p className="font-medium">
              {match.invoiceNumber ?? `INV-${match.invoiceId}`}
              {match.poNumber && <span className="text-muted-foreground"> on {match.poNumber}</span>}
            </p>
            <div className="flex items-center gap-3 text-muted-foreground">
              <span>{match.vendorName}</span>
              <span className="font-mono font-medium">{formatCurrency(match.invoiceAmount)}</span>
              <span>{match.invoiceDate}</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
