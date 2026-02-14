import Link from 'next/link'
import { ArrowLeft, DollarSign, Percent } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { getRentAccruals } from '../actions'

export default async function RentOverviewPage() {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1
  const accruals = await getRentAccruals(year, month)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue">
          <Button variant="ghost" size="icon" data-testid="rent-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Rent</h1>
          <p className="text-muted-foreground mt-1">
            Accruals, payments, and adjustments.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Current Month Accruals <HelpTooltip term="rent-accrual" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          {accruals.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                {accruals.length} accrual(s) for {year}-{String(month).padStart(2, '0')}
              </p>
              <div className="space-y-1">
                {accruals.map((a) => (
                  <div key={a.id} className="text-sm flex justify-between">
                    <span>{a.memo}</span>
                    <span className="text-muted-foreground">#{a.id}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No accruals for the current month yet.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link href="/revenue/rent/payment">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <DollarSign className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Record Payment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Record a rent payment received from a tenant.
              </p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/revenue/rent/adjustment">
          <Card className="hover:border-primary/50 transition-colors cursor-pointer h-full">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Percent className="h-5 w-5 text-muted-foreground" />
              <CardTitle className="text-base">Record Adjustment</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Proration, hardship, or vacate adjustment.
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
