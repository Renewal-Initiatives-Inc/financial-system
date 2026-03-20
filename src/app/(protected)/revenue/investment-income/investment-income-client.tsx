'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import { recordInvestmentIncome } from '../actions'
import { RecentEntriesTable, type RecentEntry } from '../components/recent-entries-table'

interface Props {
  recentEntries: RecentEntry[]
}

export function InvestmentIncomeClient({ recentEntries }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await recordInvestmentIncome({ amount, date }, 'system')
        toast.success('Investment income recorded')
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
          <Button variant="ghost" size="icon" data-testid="investment-income-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-1">
          Investment Income <HelpTooltip term="investment-income" />
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record Investment Income</CardTitle>
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
                  data-testid="investment-income-amount"
                />
              </div>
              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="investment-income-date"
                />
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              GL: DR Cash (1000), CR Investment Income (4400). Coded to General Fund.
            </p>
            <Button
              type="submit"
              disabled={isPending || !amount}
              data-testid="investment-income-submit"
            >
              {isPending ? 'Recording...' : 'Record Investment Income'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Entries</CardTitle>
        </CardHeader>
        <CardContent>
          <RecentEntriesTable
            entries={recentEntries}
            emptyMessage="No investment income recorded yet."
          />
        </CardContent>
      </Card>
    </div>
  )
}
