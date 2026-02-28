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
import { toast } from 'sonner'
import { recordRentPayment } from '../../actions'

interface Props {
  tenants: { id: number; name: string; unitNumber: string; monthlyRent: string }[]
  funds: { id: number; name: string; restrictionType: string }[]
}

export function RentPaymentClient({ tenants, funds }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tenantId, setTenantId] = useState('')
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [fundId, setFundId] = useState('')

  const selectedTenant = tenants.find((t) => String(t.id) === tenantId)

  // Auto-select General Fund
  const generalFund = funds.find((f) => f.name === 'General Fund')
  if (!fundId && generalFund) {
    setFundId(String(generalFund.id))
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    startTransition(async () => {
      try {
        await recordRentPayment(
          {
            tenantId: parseInt(tenantId),
            amount,
            date,
            fundId: parseInt(fundId),
          },
          'system'
        )
        toast.success('Rent payment recorded')
        router.push('/revenue/rent')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to record payment')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue/rent">
          <Button variant="ghost" size="icon" data-testid="rent-payment-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          Record Rent Payment
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Payment Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Tenant</Label>
                <Select value={tenantId} onValueChange={setTenantId}>
                  <SelectTrigger data-testid="rent-payment-tenant-select">
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
                <Label>Amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={selectedTenant?.monthlyRent ?? '0.00'}
                  data-testid="rent-payment-amount"
                />
                {selectedTenant && (
                  <p className="text-xs text-muted-foreground mt-1">
                    Monthly rent: ${selectedTenant.monthlyRent}
                  </p>
                )}
              </div>

              <div>
                <Label>Date</Label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  data-testid="rent-payment-date"
                />
              </div>

              <div>
                <Label>Funding Source</Label>
                <Select value={fundId} onValueChange={setFundId}>
                  <SelectTrigger data-testid="rent-payment-fund-select">
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

            <Button
              type="submit"
              disabled={isPending || !tenantId || !amount || !fundId}
              data-testid="rent-payment-submit"
            >
              {isPending ? 'Recording...' : 'Record Payment'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
