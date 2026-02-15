'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import Link from 'next/link'
import type { AlertsData } from '@/lib/dashboard/queries'

const urgencyColors = {
  green: 'bg-green-100 text-green-800',
  yellow: 'bg-yellow-100 text-yellow-800',
  red: 'bg-red-100 text-red-800',
  overdue: 'bg-red-200 text-red-900',
} as const

export function AlertsAttention({ data }: { data: AlertsData }) {
  const hasItems = data.items.length > 0 || data.upcomingDeadlines.length > 0

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium">Alerts &amp; Attention</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {!hasItems && (
          <p className="text-sm text-muted-foreground">All clear — nothing requires attention.</p>
        )}

        {data.items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="flex items-center justify-between text-sm hover:bg-muted/50 rounded px-1 py-0.5 -mx-1"
            data-testid={`dashboard-alert-${item.label.toLowerCase().replace(/\s+/g, '-')}-link`}
          >
            <span className="text-muted-foreground">{item.label}</span>
            <Badge
              variant={item.urgency === 'danger' ? 'destructive' : 'secondary'}
              className="ml-2"
            >
              {item.count}
            </Badge>
          </Link>
        ))}

        {data.upcomingDeadlines.length > 0 && (
          <div className="border-t pt-2 space-y-1.5">
            <p className="text-xs text-muted-foreground font-medium">Upcoming Deadlines</p>
            {data.upcomingDeadlines.slice(0, 5).map((d) => (
              <div key={d.taskName} className="flex items-center justify-between text-xs">
                <span className="truncate mr-2">{d.taskName}</span>
                <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${urgencyColors[d.urgency]}`}>
                  {d.daysRemaining < 0
                    ? `${Math.abs(d.daysRemaining)}d overdue`
                    : `${d.daysRemaining}d`}
                </span>
              </div>
            ))}
          </div>
        )}

        <Link
          href="/compliance"
          className="block text-xs text-primary hover:underline pt-1"
          data-testid="dashboard-compliance-link"
        >
          View Compliance Calendar &rarr;
        </Link>
      </CardContent>
    </Card>
  )
}
