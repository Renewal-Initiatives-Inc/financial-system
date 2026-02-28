'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import Link from 'next/link'
import type { CashSnapshotData } from '@/lib/dashboard/queries'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function CashSnapshot({ data }: { data: CashSnapshotData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Cash Snapshot</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1.5">
          {data.bankBalances.map((b) => (
            <div key={b.name} className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground truncate mr-2">{b.name}</span>
              <span className="font-medium tabular-nums">{fmt(b.balance)}</span>
            </div>
          ))}
        </div>
        <div className="border-t pt-2">
          <div className="flex items-center justify-between text-sm font-semibold">
            <span>Net Available Cash</span>
            <span className="tabular-nums">{fmt(data.netAvailableCash)}</span>
          </div>
        </div>
        <Link
          href="/reports/cash-position"
          className="block text-xs text-primary hover:underline pt-1"
          data-testid="dashboard-cash-report-link"
        >
          View Full Report &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
