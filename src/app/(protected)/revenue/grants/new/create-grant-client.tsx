'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createGrant } from '../../actions'

interface Props {
  vendors: { id: number; name: string }[]
  funds: { id: number; name: string; restrictionType: string }[]
}

export function CreateGrantClient({ vendors, funds }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [funderId, setFunderId] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'CONDITIONAL' | 'UNCONDITIONAL'>('UNCONDITIONAL')
  const [conditions, setConditions] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [fundId, setFundId] = useState('')
  const [isUnusualGrant, setIsUnusualGrant] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        const result = await createGrant(
          {
            funderId: parseInt(funderId),
            amount,
            type,
            conditions: type === 'CONDITIONAL' ? conditions : null,
            startDate: startDate || null,
            endDate: endDate || null,
            fundId: parseInt(fundId),
            isUnusualGrant,
          },
          'system'
        )
        toast.success(`Grant #${result.id} created`)
        router.push('/revenue/grants')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create grant')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue/grants">
          <Button variant="ghost" size="icon" data-testid="create-grant-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Grant</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Grant Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Funder (Vendor)</Label>
                <Select value={funderId} onValueChange={setFunderId}>
                  <SelectTrigger data-testid="grant-funder-select">
                    <SelectValue placeholder="Select funder" />
                  </SelectTrigger>
                  <SelectContent>
                    {vendors.map((v) => (
                      <SelectItem key={v.id} value={String(v.id)}>
                        {v.name}
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
                  data-testid="grant-amount"
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  Type <HelpTooltip term="grant-conditional" />
                </Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as 'CONDITIONAL' | 'UNCONDITIONAL')}
                >
                  <SelectTrigger data-testid="grant-type-select">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNCONDITIONAL">Unconditional</SelectItem>
                    <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Fund (Restricted)</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="grant-fund-select">
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
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="grant-start-date"
                />
              </div>

              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="grant-end-date"
                />
              </div>
            </div>

            {type === 'CONDITIONAL' && (
              <div>
                <Label>
                  Conditions <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  value={conditions}
                  onChange={(e) => setConditions(e.target.value)}
                  placeholder="Describe the conditions for revenue recognition"
                  data-testid="grant-conditions"
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <Switch
                checked={isUnusualGrant}
                onCheckedChange={setIsUnusualGrant}
                data-testid="grant-unusual-toggle"
              />
              <Label className="flex items-center gap-1">
                Unusual Grant <HelpTooltip term="unusual-grant" />
              </Label>
            </div>

            <Button
              type="submit"
              disabled={
                isPending ||
                !funderId ||
                !amount ||
                !fundId ||
                (type === 'CONDITIONAL' && !conditions.trim())
              }
              data-testid="grant-submit"
            >
              {isPending ? 'Creating...' : 'Create Grant'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
