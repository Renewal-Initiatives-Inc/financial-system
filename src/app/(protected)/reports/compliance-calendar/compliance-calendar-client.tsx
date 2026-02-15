'use client'

import { useState, useCallback, useTransition } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ReportShell } from '@/components/reports/report-shell'
import {
  getComplianceCalendarData,
  CATEGORY_COLORS,
} from '@/lib/reports/compliance-calendar'
import type {
  ComplianceCalendarData,
  ComplianceDeadlineRow,
} from '@/lib/reports/compliance-calendar'
import { formatDate } from '@/lib/reports/types'

const CATEGORIES = ['tax', 'tenant', 'grant', 'budget'] as const
const CATEGORY_LABELS: Record<string, string> = {
  tax: 'Tax',
  tenant: 'Tenant',
  grant: 'Grant',
  budget: 'Budget',
}

function DeadlineTable({
  title,
  rows,
  badgeVariant,
}: {
  title: string
  rows: ComplianceDeadlineRow[]
  badgeVariant?: 'default' | 'destructive' | 'outline'
}) {
  if (rows.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <h2 className="text-lg font-semibold">{title}</h2>
        <Badge variant={badgeVariant ?? 'outline'}>{rows.length}</Badge>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Task</TableHead>
              <TableHead>Due Date</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Recurrence</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Tenant</TableHead>
              <TableHead className="text-right">Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow
                key={row.id}
                className={row.isOverdue ? 'bg-red-50/50' : row.isUpcoming ? 'bg-yellow-50/50' : ''}
              >
                <TableCell className="font-medium text-sm">{row.taskName}</TableCell>
                <TableCell className="tabular-nums text-sm">{formatDate(row.dueDate)}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={`text-xs ${CATEGORY_COLORS[row.category] ?? ''}`}>
                    {CATEGORY_LABELS[row.category] ?? row.category}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs capitalize">{row.recurrence.replace(/_/g, ' ')}</TableCell>
                <TableCell>
                  <Badge
                    variant={row.status === 'completed' ? 'default' : row.isOverdue ? 'destructive' : 'outline'}
                    className="text-xs"
                  >
                    {row.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm">{row.tenantName ?? '—'}</TableCell>
                <TableCell className="text-right tabular-nums text-sm">
                  {row.isOverdue ? (
                    <span className="text-red-600 font-medium">{Math.abs(row.daysUntilDue)}d overdue</span>
                  ) : (
                    <span>{row.daysUntilDue}d</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}

interface ComplianceCalendarClientProps {
  initialData: ComplianceCalendarData
}

export function ComplianceCalendarClient({ initialData }: ComplianceCalendarClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()
  const [activeCategories, setActiveCategories] = useState<Set<string>>(
    new Set(CATEGORIES)
  )

  const toggleCategory = useCallback(
    (cat: string) => {
      const next = new Set(activeCategories)
      if (next.has(cat)) {
        next.delete(cat)
      } else {
        next.add(cat)
      }
      setActiveCategories(next)

      // Re-fetch with filter
      const categoryFilter = next.size === CATEGORIES.length ? undefined : [...next].join(',')
      startTransition(async () => {
        // Fetch all and filter client-side for multi-select
        const result = await getComplianceCalendarData()
        setData(result)
      })
    },
    [activeCategories]
  )

  // Filter by active categories client-side
  const filterByCategory = (rows: ComplianceDeadlineRow[]) =>
    rows.filter((r) => activeCategories.has(r.category))

  const allRows = [
    ...data.overdue,
    ...data.upcoming,
    ...data.thisQuarter,
    ...data.future,
  ]

  const exportData = allRows.map((r) => ({
    Task: r.taskName,
    'Due Date': r.dueDate,
    Category: r.category,
    Recurrence: r.recurrence,
    Status: r.status,
    Tenant: r.tenantName ?? '',
    'Days Until Due': r.daysUntilDue,
    Notes: r.notes ?? '',
  }))

  const exportColumns = ['Task', 'Due Date', 'Category', 'Recurrence', 'Status', 'Tenant', 'Days Until Due', 'Notes']

  return (
    <ReportShell
      title="Compliance Calendar"
      generatedAt={data.generatedAt}
      reportSlug="compliance-calendar"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4" data-testid="compliance-calendar-summary">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Total Deadlines</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{data.totalCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Upcoming (30 days)</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-yellow-600">{data.upcomingCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Overdue</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-red-600">{data.overdueCount}</div></CardContent>
        </Card>
      </div>

      {/* Category filters */}
      <div className="flex items-center gap-2" data-testid="compliance-calendar-filter-bar">
        <span className="text-sm font-medium">Filter:</span>
        {CATEGORIES.map((cat) => (
          <Badge
            key={cat}
            variant={activeCategories.has(cat) ? 'default' : 'outline'}
            className={`cursor-pointer text-xs ${activeCategories.has(cat) ? CATEGORY_COLORS[cat] : 'opacity-50'}`}
            onClick={() => toggleCategory(cat)}
            data-testid={`compliance-calendar-filter-${cat}`}
          >
            {CATEGORY_LABELS[cat]}
          </Badge>
        ))}
      </div>

      {/* Sections */}
      <DeadlineTable
        title="Overdue"
        rows={filterByCategory(data.overdue)}
        badgeVariant="destructive"
      />
      <DeadlineTable
        title="Upcoming (Next 30 Days)"
        rows={filterByCategory(data.upcoming)}
      />
      <DeadlineTable
        title="This Quarter (31-90 Days)"
        rows={filterByCategory(data.thisQuarter)}
      />
      <DeadlineTable
        title="Future (90+ Days)"
        rows={filterByCategory(data.future)}
      />

      {allRows.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          No compliance deadlines found.
        </div>
      )}
    </ReportShell>
  )
}
