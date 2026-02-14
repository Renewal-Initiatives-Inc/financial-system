'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import { recordAhpLoanForgivenessAction } from '../actions'
import type { AhpLoanStatus } from '@/lib/revenue/ahp-loan'

function formatCurrency(value: string | number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof value === 'string' ? parseFloat(value) : value)
}

interface Props {
  loanStatus: AhpLoanStatus | null
}

export function AhpForgivenessClient({ loanStatus }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const drawnAmount = loanStatus
    ? parseFloat(loanStatus.currentDrawnAmount)
    : 0
  const parsedAmount = parseFloat(amount) || 0
  const exceedsDrawn = parsedAmount > drawnAmount

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await recordAhpLoanForgivenessAction({ amount, date }, 'system')
        toast.success('AHP loan forgiveness recorded')
        setAmount('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue">
          <Button variant="ghost" size="icon" data-testid="ahp-forgiveness-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-1">
          AHP Loan Forgiveness <HelpTooltip term="ahp-loan-forgiveness" />
        </h1>
      </div>

      {loanStatus && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-1">
              Current Loan Status <HelpTooltip term="ahp-loan" />
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label className="text-muted-foreground">Credit Limit</Label>
              <p className="text-lg font-medium">
                {formatCurrency(loanStatus.creditLimit)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Current Drawn</Label>
              <p className="text-lg font-medium">
                {formatCurrency(loanStatus.currentDrawnAmount)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Available Credit</Label>
              <p className="text-lg font-medium">
                {formatCurrency(
                  parseFloat(loanStatus.creditLimit) -
                    parseFloat(loanStatus.currentDrawnAmount)
                )}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Interest Rate</Label>
              <p>{(parseFloat(loanStatus.currentInterestRate) * 100).toFixed(3)}%</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Annual Payment Date</Label>
              <p>{loanStatus.annualPaymentDate}</p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Record Forgiveness</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Amount to Forgive</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="ahp-forgiveness-amount"
                />
                {exceedsDrawn && (
                  <p className="text-xs text-destructive mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    Amount exceeds current drawn amount
                  </p>
                )}
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="ahp-forgiveness-date"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              GL: DR AHP Loan Payable (2100), CR Donation Income (4200).
              Permanently reduces maximum credit.
            </p>
            <Button
              type="submit"
              disabled={isPending || !amount || exceedsDrawn}
              data-testid="ahp-forgiveness-submit"
            >
              {isPending ? 'Recording...' : 'Record Forgiveness'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
