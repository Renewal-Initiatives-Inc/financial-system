'use client'

import { useState, useTransition } from 'react'
import { CheckCircle2, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { getRampCrossCheck } from '../actions'
import { toast } from 'sonner'
import type { CrossCheckResult } from '../actions'

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount)

export function RampCrossCheck() {
  const [isPending, startTransition] = useTransition()
  const [periodStart, setPeriodStart] = useState('')
  const [periodEnd, setPeriodEnd] = useState('')
  const [settlementAmount, setSettlementAmount] = useState('')
  const [result, setResult] = useState<CrossCheckResult | null>(null)

  const handleCheck = () => {
    if (!periodStart || !periodEnd || !settlementAmount) {
      toast.error('All fields are required')
      return
    }

    startTransition(async () => {
      try {
        const data = await getRampCrossCheck(
          periodStart,
          periodEnd,
          parseFloat(settlementAmount)
        )
        setResult(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Cross-check failed')
      }
    })
  }

  return (
    <Card data-testid="ramp-cross-check">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          Ramp Settlement Cross-Check
          <HelpTooltip term="ramp-settlement" />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label className="text-xs">Period Start</Label>
            <Input
              type="date"
              value={periodStart}
              onChange={(e) => setPeriodStart(e.target.value)}
              data-testid="ramp-crosscheck-start"
            />
          </div>
          <div>
            <Label className="text-xs">Period End</Label>
            <Input
              type="date"
              value={periodEnd}
              onChange={(e) => setPeriodEnd(e.target.value)}
              data-testid="ramp-crosscheck-end"
            />
          </div>
          <div>
            <Label className="text-xs">Settlement Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={settlementAmount}
              onChange={(e) => setSettlementAmount(e.target.value)}
              placeholder="0.00"
              data-testid="ramp-crosscheck-amount"
            />
          </div>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={handleCheck}
          disabled={isPending}
          data-testid="ramp-crosscheck-btn"
        >
          Verify Settlement
        </Button>

        {result && (
          <div className="rounded-lg border p-3 space-y-2">
            <div className="flex items-center gap-2">
              {result.isMatched ? (
                <CheckCircle2 className="h-5 w-5 text-green-600" />
              ) : (
                <AlertTriangle className="h-5 w-5 text-yellow-600" />
              )}
              <span
                className={`text-sm font-medium ${
                  result.isMatched ? 'text-green-700' : 'text-yellow-700'
                }`}
              >
                {result.isMatched ? 'Settlement Verified' : 'Variance Detected'}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1 text-sm">
              <span className="text-muted-foreground">Settlement:</span>
              <span className="font-mono">
                {formatCurrency(result.settlementAmount)}
              </span>
              <span className="text-muted-foreground">
                Ramp Total ({result.rampCount} txns):
              </span>
              <span className="font-mono">
                {formatCurrency(result.rampTotal)}
              </span>
              <span className="text-muted-foreground">Variance:</span>
              <span
                className={`font-mono ${
                  result.isMatched ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {formatCurrency(result.variance)}
              </span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
