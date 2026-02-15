'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import Link from 'next/link'
import type { RentSnapshotData } from '@/lib/dashboard/queries'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

export function RentCollection({ data }: { data: RentSnapshotData }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Rent Collection — {data.month}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Collection Rate</span>
            <span className="font-semibold">{data.collectionRate.toFixed(1)}%</span>
          </div>
          <Progress value={data.collectionRate} className="h-2" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-xs text-muted-foreground">Billed</p>
            <p className="text-sm font-medium tabular-nums">{fmt(data.totalBilled)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Collected</p>
            <p className="text-sm font-medium tabular-nums">{fmt(data.totalCollected)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Outstanding</p>
            <p className="text-sm font-medium tabular-nums text-red-600">{fmt(data.totalOutstanding)}</p>
          </div>
        </div>

        {data.unitSummary.length > 0 && (
          <div className="border-t pt-2 space-y-1">
            {data.unitSummary.map((u) => (
              <div key={u.unitNumber} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Unit {u.unitNumber}</span>
                <span className="tabular-nums">
                  {fmt(u.collected)} / {fmt(u.billed)}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/reports/rent-collection"
          className="block text-xs text-primary hover:underline pt-1"
          data-testid="dashboard-rent-report-link"
        >
          View Full Report &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
