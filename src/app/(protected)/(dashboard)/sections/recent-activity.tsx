'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { RecentActivityRow } from '@/lib/dashboard/queries'

function fmt(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const sourceLabels: Record<string, string> = {
  MANUAL: 'Manual',
  TIMESHEET: 'Timesheet',
  EXPENSE_REPORT: 'Expense',
  RAMP: 'Ramp',
  BANK_FEED: 'Bank',
  SYSTEM: 'System',
  FY25_IMPORT: 'Import',
}

export function RecentActivity({ data }: { data: RecentActivityRow[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground">No recent transactions.</p>
        ) : (
          <div className="space-y-2">
            {data.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-sm border-b last:border-0 pb-1.5 last:pb-0"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-xs text-muted-foreground w-12 shrink-0">
                    {formatDate(t.date)}
                  </span>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {sourceLabels[t.sourceType] ?? t.sourceType}
                  </Badge>
                  <span className="truncate">{t.memo}</span>
                </div>
                <span className="font-medium tabular-nums ml-2 shrink-0">
                  {fmt(t.totalAmount)}
                </span>
              </div>
            ))}
          </div>
        )}
        <Link
          href="/transactions"
          className="block text-xs text-primary hover:underline pt-2"
          data-testid="dashboard-transactions-link"
        >
          View All Transactions &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
