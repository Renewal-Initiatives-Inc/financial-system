'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calculator } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import { recordRentAdjustment } from '../../actions'
import { calculateProratedRent } from '@/lib/revenue/rent-proration'

const adjustmentTypes = [
  { value: 'PRORATION', label: 'Proration' },
  { value: 'HARDSHIP', label: 'Hardship' },
  { value: 'VACATE', label: 'Vacate' },
] as const

interface Props {
  tenants: { id: number; name: string; unitNumber: string; monthlyRent: string }[]
  funds: { id: number; name: string; restrictionType: string }[]
}

export function RentAdjustmentClient({ tenants, funds }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tenantId, setTenantId] = useState('')
  const [adjustmentType, setAdjustmentType] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [fundId, setFundId] = useState('')
  const [note, setNote] = useState('')
  const [moveDate, setMoveDate] = useState('')
  const [isMoveIn, setIsMoveIn] = useState(true)

  const selectedTenant = tenants.find((t) => String(t.id) === tenantId)
  const generalFund = funds.find((f) => f.name === 'General Fund')
  if (!fundId && generalFund) {
    setFundId(String(generalFund.id))
  }

  const handleCalculateProration = () => {
    if (!selectedTenant || !moveDate) return
    const d = new Date(moveDate)
    const result = calculateProratedRent(
      parseFloat(selectedTenant.monthlyRent),
      d.getFullYear(),
      d.getMonth() + 1,
      d,
      isMoveIn
    )
    setAmount(result.amount.toFixed(2))
    setNote(
      `${isMoveIn ? 'Move-in' : 'Move-out'} proration: ${result.daysOccupied} days @ $${result.dailyRate}/day`
    )
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!note.trim()) {
      toast.error('Explanatory note is required for rent adjustments')
      return
    }
    startTransition(async () => {
      try {
        await recordRentAdjustment(
          {
            tenantId: parseInt(tenantId),
            adjustmentType: adjustmentType as 'PRORATION' | 'HARDSHIP' | 'VACATE',
            amount,
            date,
            fundId: parseInt(fundId),
            note,
          },
          'system'
        )
        toast.success('Rent adjustment recorded')
        router.push('/revenue/rent')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record adjustment')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue/rent">
          <Button variant="ghost" size="icon" data-testid="rent-adjustment-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Record Rent Adjustment
        </h1>
        <HelpTooltip term="rent-adjustment" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Adjustment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger data-testid="rent-adjustment-tenant-select">
                    <SelectValue placeholder="Select tenant" />
                  </SelectTrigger>
                  <SelectContent>
                    {tenants.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name} (Unit {t.unitNumber})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Adjustment Type</Label>
                <Select value={adjustmentType} onValueChange={setAdjustmentType}>
                  <SelectTrigger data-testid="rent-adjustment-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {adjustmentTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="rent-adjustment-amount"
                />
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="rent-adjustment-date"
                />
              </div>

              <div>
                <Label>Funding Source</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="rent-adjustment-fund-select">
                    <SelectValue placeholder="Select funding source" />
                  </SelectTrigger>
                  <SelectContent>
                    {funds.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {adjustmentType === 'PRORATION' && selectedTenant && (
              <Card className="bg-muted/50">
                <CardContent className="pt-4">
                  <p className="text-sm font-medium mb-2 flex items-center gap-1">
                    MA Proration Calculator <HelpTooltip term="rent-proration" />
                  </p>
                  <div className="grid gap-3 sm:grid-cols-3">
                    <div>
                      <Label>Move Date</Label>
                      <Input
                        type="date"
                        value={moveDate}
                        onChange={(e) => setMoveDate(e.target.value)}
                        data-testid="proration-move-date"
                      />
                    </div>
                    <div>
                      <Label>Direction</Label>
                      <Select
                        value={isMoveIn ? 'in' : 'out'}
                        onValueChange={(v) => setIsMoveIn(v === 'in')}
                      >
                        <SelectTrigger data-testid="proration-direction">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="in">Move-in</SelectItem>
                          <SelectItem value="out">Move-out</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleCalculateProration}
                        disabled={!moveDate}
                        data-testid="proration-calculate-btn"
                      >
                        <Calculator className="mr-2 h-4 w-4" />
                        Calculate
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            <div>
              <Label>
                Explanatory Note{' '}
                <span className="text-destructive">*</span>
              </Label>
              <Textarea
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Required — explain the reason for this adjustment"
                data-testid="rent-adjustment-note"
              />
            </div>

            <Button
              type="submit"
              disabled={
                isPending || !tenantId || !adjustmentType || !amount || !fundId || !note.trim()
              }
              data-testid="rent-adjustment-submit"
            >
              {isPending ? 'Recording...' : 'Record Adjustment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
