'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import { createPledge, recordPledgePayment } from '../actions'
import type { PledgeWithDonor } from '../actions'

function formatCurrency(value: string) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(parseFloat(value))
}

const statusColors: Record<string, string> = {
  PLEDGED: 'bg-yellow-100 text-yellow-800',
  RECEIVED: 'bg-green-100 text-green-800',
  WRITTEN_OFF: 'bg-gray-100 text-gray-800',
}

interface Props {
  donors: { id: number; name: string; email: string | null }[]
  funds: { id: number; name: string; restrictionType: string }[]
  pledges: PledgeWithDonor[]
}

export function PledgesClient({ donors, funds, pledges }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [donorId, setDonorId] = useState('')
  const [amount, setAmount] = useState('')
  const [expectedDate, setExpectedDate] = useState('')
  const [fundId, setFundId] = useState('')
  const [paymentPledge, setPaymentPledge] = useState<PledgeWithDonor | null>(null)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState(
    new Date().toISOString().split('T')[0]
  )

  const handleCreatePledge = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await createPledge(
          {
            donorId: parseInt(donorId),
            amount,
            expectedDate: expectedDate || null,
            fundId: parseInt(fundId),
          },
          'system'
        )
        toast.success('Pledge recorded')
        setDonorId('')
        setAmount('')
        setExpectedDate('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record pledge')
      }
    })
  }

  const handleRecordPayment = () => {
    if (!paymentPledge) return
    startTransition(async () => {
      try {
        await recordPledgePayment(
          paymentPledge.id,
          paymentAmount || paymentPledge.amount,
          paymentDate,
          'system'
        )
        toast.success('Pledge payment recorded')
        setPaymentPledge(null)
        setPaymentAmount('')
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record payment')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue">
          <Button variant="ghost" size="icon" data-testid="pledges-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-1">
          Pledges <HelpTooltip term="pledge" />
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Record New Pledge</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreatePledge} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Donor</Label>
                <Select value={donorId} onValueChange={setDonorId}>
                  <SelectTrigger data-testid="pledge-donor-select">
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
                  data-testid="pledge-amount"
                />
              </div>
              <div>
                <Label>Expected Date</Label>
                <Input
                  type="date"
                  value={expectedDate}
                  onChange={(e) => setExpectedDate(e.target.value)}
                  data-testid="pledge-expected-date"
                />
              </div>
              <div>
                <Label>Fund</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="pledge-fund-select">
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
              disabled={isPending || !donorId || !amount || !fundId}
              data-testid="pledge-submit"
            >
              {isPending ? 'Recording...' : 'Record Pledge'}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Pledge List</CardTitle>
        </CardHeader>
        <CardContent>
          {pledges.length === 0 ? (
            <p className="text-sm text-muted-foreground">No pledges recorded yet.</p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/50">
                    <th className="px-4 py-3 text-left font-medium">Donor</th>
                    <th className="px-4 py-3 text-left font-medium">Amount</th>
                    <th className="px-4 py-3 text-left font-medium">Expected</th>
                    <th className="px-4 py-3 text-left font-medium">Fund</th>
                    <th className="px-4 py-3 text-left font-medium">Status</th>
                    <th className="px-4 py-3 text-left font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pledges.map((p) => (
                    <tr key={p.id} className="border-b">
                      <td className="px-4 py-3">{p.donorName}</td>
                      <td className="px-4 py-3">{formatCurrency(p.amount)}</td>
                      <td className="px-4 py-3">{p.expectedDate ?? '-'}</td>
                      <td className="px-4 py-3">{p.fundName}</td>
                      <td className="px-4 py-3">
                        <Badge
                          variant="outline"
                          className={statusColors[p.status] ?? ''}
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'PLEDGED' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setPaymentPledge(p)
                              setPaymentAmount(p.amount)
                            }}
                            data-testid={`pledge-pay-${p.id}`}
                          >
                            Record Payment
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment Dialog */}
      <Dialog
        open={!!paymentPledge}
        onOpenChange={(open) => !open && setPaymentPledge(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Pledge Payment</DialogTitle>
            <DialogDescription>
              Record payment for pledge from {paymentPledge?.donorName} (
              {paymentPledge ? formatCurrency(paymentPledge.amount) : ''})
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Amount</Label>
              <Input
                type="number"
                step="0.01"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
                data-testid="pledge-payment-amount"
              />
            </div>
            <div>
              <Label>Date</Label>
              <Input
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
                data-testid="pledge-payment-date"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPaymentPledge(null)}
              data-testid="revenue-pledge-payment-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleRecordPayment}
              disabled={isPending || !paymentAmount}
              data-testid="pledge-payment-submit"
            >
              {isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
