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
import { recordEarnedIncome } from '../actions'

interface Props {
  funds: { id: number; name: string; restrictionType: string }[]
  revenueAccounts: { id: number; name: string; code: string }[]
  recentEntries: Array<{ id: number; date: string; memo: string; createdAt: Date }>
}

export function EarnedIncomeClient({ funds, revenueAccounts, recentEntries }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [accountId, setAccountId] = useState('')
  const [fundId, setFundId] = useState('')

  const generalFund = funds.find((f) => f.name === 'General Fund')
  if (!fundId && generalFund) setFundId(String(generalFund.id))

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await recordEarnedIncome(
          {
            amount,
            description,
            date,
            accountId: parseInt(accountId),
            fundId: parseInt(fundId),
          },
          'system'
        )
        toast.success('Earned income recorded')
        setAmount('')
        setDescription('')
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
          <Button variant="ghost" size="icon" data-testid="earned-income-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-1">
          Earned Income <HelpTooltip term="earned-income" />
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Earned Income</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  data-testid="earned-income-amount"
                />
              </div>
              <div>
                <Label>Description</Label>
                <Input
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="e.g., Farm lease payment"
                  data-testid="earned-income-description"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="earned-income-date"
                />
              </div>
              <div>
                <Label>Revenue Account</Label>
                <Select value={accountId} onValueChange={setAccountId}>
                  <SelectTrigger data-testid="earned-income-account-select">
                    <SelectValue placeholder="Select account" />
                  </SelectTrigger>
                  <SelectContent>
                    {revenueAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Fund</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="earned-income-fund-select">
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
            </div>
            <Button
              type="submit"
              disabled={isPending || !amount || !description || !accountId || !fundId}
              data-testid="earned-income-submit"
            >
              {isPending ? 'Recording...' : 'Record Earned Income'}
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
            <p className="text-sm text-muted-foreground">No earned income recorded yet.</p>
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
