'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { recordInKindContribution } from '../actions'

const inKindTypes = [
  { value: 'GOODS', label: 'Goods' },
  { value: 'SERVICES', label: 'Services' },
  { value: 'FACILITY_USE', label: 'Facility Use' },
] as const

interface Props {
  funds: { id: number; name: string; restrictionType: string }[]
  recentEntries: Array<{ id: number; date: string; memo: string; createdAt: Date }>
}

export function InKindClient({ funds, recentEntries }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [inKindType, setInKindType] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [fundId, setFundId] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await recordInKindContribution(
          {
            amount,
            description,
            date,
            fundId: parseInt(fundId),
            inKindType: inKindType as 'GOODS' | 'SERVICES' | 'FACILITY_USE',
          },
          'system'
        )
        toast.success('In-kind contribution recorded')
        setAmount('')
        setDescription('')
        setInKindType('')
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
          <Button variant="ghost" size="icon" data-testid="in-kind-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-1">
          In-Kind Contributions <HelpTooltip term="in-kind-contribution" />
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record In-Kind Contribution</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Type</Label>
                <Select value={inKindType} onValueChange={setInKindType}>
                  <SelectTrigger data-testid="in-kind-type-select">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {inKindTypes.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fair Market Value</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="in-kind-amount"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the contribution"
                  data-testid="in-kind-description"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="in-kind-date"
                />
              </div>
              <div>
                <Label>Funding Source</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="in-kind-fund-select">
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

            {inKindType === 'SERVICES' && (
              <p className="text-xs text-muted-foreground">
                Services must meet the ASC 958-605 3-part test: (1) specialized skills,
                (2) provided by individuals possessing those skills, (3) would typically
                be purchased if not donated.
              </p>
            )}

            <Button
              type="submit"
              disabled={
                isPending || !inKindType || !amount || !description || !fundId
              }
              data-testid="in-kind-submit"
            >
              {isPending ? 'Recording...' : 'Record Contribution'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {recentEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No in-kind contributions recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {recentEntries.map((e) => (
                <div key={e.id} className="flex justify-between text-sm border-b pb-2">
                  <span>{e.memo}</span>
                  <span className="text-muted-foreground">{e.date}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
