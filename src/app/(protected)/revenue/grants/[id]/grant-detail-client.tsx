'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import {
  recordGrantCashReceiptAction,
  recognizeConditionalGrantRevenue,
} from '../../actions'
import type { GrantWithFunder } from '../../actions'

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(value))
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface Props {
  grant: GrantWithFunder
  transactions: Array<{
    id: number
    date: string
    memo: string
    createdAt: Date
  }>
}

export function GrantDetailClient({ grant, transactions }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [receiptAmount, setReceiptAmount] = useState('')
  const [receiptDate, setReceiptDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [recognitionAmount, setRecognitionAmount] = useState('')
  const [recognitionDate, setRecognitionDate] = useState(
    new Date().toISOString().split('T')[0]
  )
  const [recognitionNote, setRecognitionNote] = useState('')

  const handleCashReceipt = () => {
    startTransition(async () => {
      try {
        await recordGrantCashReceiptAction(
          { grantId: grant.id, amount: receiptAmount, date: receiptDate },
          'system'
        )
        toast.success('Cash receipt recorded')
        setReceiptAmount('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record receipt')
      }
    })
  }

  const handleRecognizeRevenue = () => {
    startTransition(async () => {
      try {
        await recognizeConditionalGrantRevenue(
          {
            grantId: grant.id,
            amount: recognitionAmount,
            date: recognitionDate,
            note: recognitionNote,
          },
          'system'
        )
        toast.success('Revenue recognized')
        setRecognitionAmount('')
        setRecognitionNote('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to recognize revenue')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue/grants">
          <Button variant="ghost" size="icon" data-testid="grant-detail-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Grant #{grant.id}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge variant="outline">
              {grant.type === 'CONDITIONAL' ? 'Conditional' : 'Unconditional'}
            </Badge>
            <Badge variant="outline">{grant.status}</Badge>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label className="text-muted-foreground">Funder</Label>
            <p>{grant.funderName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Amount</Label>
            <p>{formatCurrency(grant.amount)}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Fund</Label>
            <p>{grant.fundName}</p>
          </div>
          <div>
            <Label className="text-muted-foreground">Period</Label>
            <p>
              {formatDate(grant.startDate)} — {formatDate(grant.endDate)}
            </p>
          </div>
          {grant.conditions && (
            <div className="sm:col-span-2">
              <Label className="text-muted-foreground">Conditions</Label>
              <p className="whitespace-pre-line">{grant.conditions}</p>
            </div>
          )}
          {grant.isUnusualGrant && (
            <div>
              <Badge variant="outline" className="bg-yellow-100 text-yellow-800">
                Unusual Grant
              </Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Funding History */}
      <Card>
        <CardHeader>
          <CardTitle>Funding History</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No transactions yet.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((txn) => (
                <div
                  key={txn.id}
                  className="flex justify-between text-sm border-b pb-2"
                >
                  <div>
                    <span className="text-muted-foreground">#{txn.id}</span>{' '}
                    {txn.memo}
                  </div>
                  <span className="text-muted-foreground">{formatDate(txn.date)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-1">
              Record Cash Receipt <HelpTooltip term="grant-cash-receipt" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                data-testid="grant-receipt-amount"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
                data-testid="grant-receipt-date"
              />
            </div>
            <Button
              onClick={handleCashReceipt}
              disabled={isPending || !receiptAmount}
              data-testid="grant-receipt-submit"
            >
              {isPending ? 'Recording...' : 'Record Receipt'}
            </Button>
          </CardContent>
        </Card>

        {grant.type === 'CONDITIONAL' && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-1">
                Recognize Revenue <HelpTooltip term="refundable-advance" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={recognitionAmount}
                  onChange={(e) => setRecognitionAmount(e.target.value)}
                  data-testid="grant-recognition-amount"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={recognitionDate}
                  onChange={(e) => setRecognitionDate(e.target.value)}
                  data-testid="grant-recognition-date"
                />
              </div>
              <div>
                <Label>Note</Label>
                <Textarea
                  value={recognitionNote}
                  onChange={(e) => setRecognitionNote(e.target.value)}
                  placeholder="Describe condition met"
                  data-testid="grant-recognition-note"
                />
              </div>
              <Button
                onClick={handleRecognizeRevenue}
                disabled={
                  isPending || !recognitionAmount || !recognitionNote.trim()
                }
                data-testid="grant-recognition-submit"
              >
                {isPending ? 'Recognizing...' : 'Recognize Revenue'}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
