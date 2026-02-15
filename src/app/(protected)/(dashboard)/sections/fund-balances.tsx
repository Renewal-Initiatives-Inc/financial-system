'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import type { FundBalancesData } from '@/lib/dashboard/queries'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function FundBalances({ data }: { data: FundBalancesData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Fund Balances</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Restricted</p>
            <p className="text-sm font-semibold tabular-nums">{fmt(data.restrictedTotal)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Unrestricted</p>
            <p className="text-sm font-semibold tabular-nums">{fmt(data.unrestrictedTotal)}</p>
          </div>
        </div>

        <div className="border-t pt-2 space-y-1.5">
          {data.funds.map((f) => (
            <div key={f.name} className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground truncate mr-2">
                {f.name}
                <span className="ml-1 text-[10px]">
                  ({f.restrictionType === 'RESTRICTED' ? 'R' : 'U'})
                </span>
              </span>
              <span className="tabular-nums font-medium">{fmt(f.balance)}</span>
            </div>
          ))}
        </div>

        <Link
          href="/reports/fund-drawdown"
          className="block text-xs text-primary hover:underline pt-1"
          data-testid="dashboard-fund-report-link"
        >
          View Full Report &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
