'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
import { recordDonation } from '../actions'

const sourceTypes = [
  { value: 'GOVERNMENT', label: 'Government' },
  { value: 'PUBLIC', label: 'Public' },
  { value: 'RELATED_PARTY', label: 'Related Party' },
] as const

interface Props {
  donors: { id: number; name: string; email: string | null }[]
  funds: { id: number; name: string; restrictionType: string }[]
  recentDonations: Array<{
    id: number
    date: string
    memo: string
    createdAt: Date
  }>
}

export function DonationsClient({ donors, funds, recentDonations }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [donorId, setDonorId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [fundId, setFundId] = useState('')
  const [contributionSourceType, setContributionSourceType] = useState('')
  const [isUnusualGrant, setIsUnusualGrant] = useState(false)
  const [showAdvanced, setShowAdvanced] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const result = await recordDonation(
          {
            donorId: parseInt(donorId),
            amount,
            date,
            fundId: parseInt(fundId),
            contributionSourceType: contributionSourceType as
              | 'GOVERNMENT'
              | 'PUBLIC'
              | 'RELATED_PARTY',
            isUnusualGrant,
          },
          'system'
        )
        const msg = result.acknowledgmentSent
          ? 'Donation recorded. Acknowledgment email sent.'
          : 'Donation recorded'
        toast.success(msg)
        setDonorId('')
        setAmount('')
        setContributionSourceType('')
        setIsUnusualGrant(false)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record donation')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue">
          <Button variant="ghost" size="icon" data-testid="donations-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">Donations</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Donation</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Donor</Label>
                <Select value={donorId} onValueChange={setDonorId}>
                  <SelectTrigger data-testid="donation-donor-select">
                    <SelectValue placeholder="Select donor" />
                  </SelectTrigger>
                  <SelectContent>
                    {donors.map((d) => (
                      <SelectItem key={d.id} value={String(d.id)}>
                        {d.name}
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
                  data-testid="donation-amount"
                />
                {parseFloat(amount) > 250 && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    Acknowledgment letter will be sent{' '}
                    <HelpTooltip term="donor-acknowledgment" />
                  </p>
                )}
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="donation-date"
                />
              </div>

              <div>
                <Label>Fund</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="donation-fund-select">
                    <SelectValue placeholder="Select fund" />
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

              <div>
                <Label className="flex items-center gap-1">
                  Contribution Source Type{' '}
                  <HelpTooltip term="contribution-source-type" />
                </Label>
                <Select
                  value={contributionSourceType}
                  onValueChange={setContributionSourceType}
                >
                  <SelectTrigger data-testid="donation-source-type-select">
                    <SelectValue placeholder="Select source type" />
                  </SelectTrigger>
                  <SelectContent>
                    {sourceTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="text-xs text-muted-foreground underline"
              >
                {showAdvanced ? 'Hide advanced' : 'Show advanced'}
              </button>
              {showAdvanced && (
                <div className="flex items-center gap-3 mt-2">
                  <Switch
                    checked={isUnusualGrant}
                    onCheckedChange={setIsUnusualGrant}
                    data-testid="donation-unusual-toggle"
                  />
                  <Label className="flex items-center gap-1">
                    Unusual Grant <HelpTooltip term="unusual-grant" />
                  </Label>
                </div>
              )}
            </div>

            <Button
              type="submit"
              disabled={
                isPending ||
                !donorId ||
                !amount ||
                !fundId ||
                !contributionSourceType
              }
              data-testid="donation-submit"
            >
              {isPending ? 'Recording...' : 'Record Donation'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Donations</CardTitle>
        </CardHeader>
        <CardContent>
          {recentDonations.length === 0 ? (
            <p className="text-sm text-muted-foreground">No donations recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentDonations.map((d) => (
                <div key={d.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{d.memo}</span>
                  <span className="text-muted-foreground">{d.date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
