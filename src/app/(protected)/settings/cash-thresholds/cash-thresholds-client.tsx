'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Save } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { updateCashThresholdSettings } from './actions'
import type { CashThresholdSettings } from './actions'

interface Props {
  initialSettings: CashThresholdSettings
}

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

export function CashThresholdsClient({ initialSettings }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [form, setForm] = useState(initialSettings)
  const [error, setError] = useState<string | null>(null)

  const handleSave = () => {
    setError(null)
    startTransition(async () => {
      const result = await updateCashThresholdSettings(form)
      if ('error' in result) {
        setError(result.error)
      } else {
        toast.success('Cash thresholds updated')
        router.refresh()
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Cash Forecast Thresholds
        </h1>
        <Button
          onClick={handleSave}
          disabled={isPending}
          data-testid="cash-thresholds-save-btn"
        >
          <Save className="mr-2 h-4 w-4" />
          Save
        </Button>
      </div>

      {error && (
        <p className="text-sm text-destructive" data-testid="cash-thresholds-error">
          {error}
        </p>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Unrestricted Cash Alerts</CardTitle>
          <CardDescription>
            The 13-week cash forecast will flag weeks where unrestricted cash
            drops below these levels. Restricted fund balances are excluded from
            these thresholds since restricted cash cannot be used for operating
            expenses.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="cashThresholdWarning">
                Warning Threshold ($)
              </Label>
              <Input
                id="cashThresholdWarning"
                type="number"
                step="1000"
                min={0}
                value={form.cashThresholdWarning}
                onChange={(e) =>
                  setForm({ ...form, cashThresholdWarning: e.target.value })
                }
                data-testid="cash-thresholds-warning-input"
              />
              <p className="text-xs text-muted-foreground">
                Shows ⚠ warning when unrestricted cash falls below{' '}
                {formatCurrency(Number(form.cashThresholdWarning) || 0)}
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cashThresholdCritical">
                Critical Threshold ($)
              </Label>
              <Input
                id="cashThresholdCritical"
                type="number"
                step="1000"
                min={0}
                value={form.cashThresholdCritical}
                onChange={(e) =>
                  setForm({ ...form, cashThresholdCritical: e.target.value })
                }
                data-testid="cash-thresholds-critical-input"
              />
              <p className="text-xs text-muted-foreground">
                Shows critical alert when unrestricted cash falls below{' '}
                {formatCurrency(Number(form.cashThresholdCritical) || 0)}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">How It Works</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            <strong>Unrestricted balance</strong> = Total ending cash &minus;
            Restricted fund inflows + Restricted fund outflows
          </p>
          <p>
            Restricted funds are identified by the fund&apos;s restriction type
            (RESTRICTED). Lines tied to restricted funds reduce the
            unrestricted balance.
          </p>
          <p>
            If no restricted funds are active, unrestricted balance equals total
            balance.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
