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
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportShell } from '@/components/reports/report-shell'
import type { AuditLogData } from '@/lib/reports/audit-log'
import { getAuditLogData } from '../actions'

const AUDIT_ACTIONS = [
  'created', 'updated', 'voided', 'reversed',
  'deactivated', 'signed_off', 'imported', 'posted',
] as const

const AUDIT_ENTITY_TYPES = [
  'TRANSACTION', 'ACCOUNT', 'FUND', 'VENDOR', 'TENANT',
  'BUDGET', 'RECONCILIATION', 'PAYROLL_RUN', 'DONOR', 'GRANT', 'FIXED_ASSET',
] as const
import { formatDateTime } from '@/lib/reports/types'
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react'

// ---------------------------------------------------------------------------
// Expandable JSON viewer
// ---------------------------------------------------------------------------

function JsonViewer({ label, data }: { label: string; data: unknown }) {
  const [isExpanded, setIsExpanded] = useState(false)
  if (!data) return <span className="text-muted-foreground text-xs">—</span>

  return (
    <div>
      <button
        onClick={(e) => { e.stopPropagation(); setIsExpanded(!isExpanded) }}
        className="text-xs text-blue-600 hover:underline"
        data-testid={`audit-log-toggle-${label}-btn`}
      >
        {isExpanded ? `Hide ${label}` : `Show ${label}`}
      </button>
      {isExpanded && (
        <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-auto max-h-40 max-w-md">
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Action badge colors
// ---------------------------------------------------------------------------

const ACTION_COLORS: Record<string, string> = {
  created: 'bg-green-100 text-green-800',
  updated: 'bg-blue-100 text-blue-800',
  voided: 'bg-red-100 text-red-800',
  reversed: 'bg-orange-100 text-orange-800',
  deactivated: 'bg-gray-100 text-gray-800',
  signed_off: 'bg-purple-100 text-purple-800',
  imported: 'bg-cyan-100 text-cyan-800',
  posted: 'bg-emerald-100 text-emerald-800',
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface AuditLogClientProps {
  initialData: AuditLogData
}

export function AuditLogClient({ initialData }: AuditLogClientProps) {
  const [data, setData] = useState(initialData)
  const [isPending, startTransition] = useTransition()

  // Filters
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [userId, setUserId] = useState('')
  const [action, setAction] = useState<string>('')
  const [entityType, setEntityType] = useState<string>('')
  const [pageSize, setPageSize] = useState(50)

  const fetchPage = useCallback(
    (page: number) => {
      startTransition(async () => {
        const result = await getAuditLogData({
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          userId: userId || undefined,
          action: action || undefined,
          entityType: entityType || undefined,
          page,
          pageSize,
        })
        setData(result)
      })
    },
    [startDate, endDate, userId, action, entityType, pageSize]
  )

  const handleApply = useCallback(() => fetchPage(1), [fetchPage])

  const handleReset = useCallback(() => {
    setStartDate('')
    setEndDate('')
    setUserId('')
    setAction('')
    setEntityType('')
    startTransition(async () => {
      const result = await getAuditLogData({ page: 1, pageSize })
      setData(result)
    })
  }, [pageSize])

  // Export data
  const exportData = data.entries.map((e) => ({
    Timestamp: formatDateTime(e.timestamp),
    User: e.userId,
    Action: e.action,
    'Entity Type': e.entityType,
    'Entity ID': e.entityId,
  }))

  const exportColumns = ['Timestamp', 'User', 'Action', 'Entity Type', 'Entity ID']

  return (
    <ReportShell
      title="Audit Log Viewer"
      generatedAt={data.generatedAt}
      reportSlug="audit-log"
      exportData={exportData}
      exportColumns={exportColumns}
    >
      {/* Filters */}
      <div className="flex flex-wrap items-end gap-3" data-testid="audit-log-filter-bar">
        <div className="space-y-1">
          <Label className="text-xs">Start Date</Label>
          <Input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-36 h-8 text-sm"
            data-testid="audit-log-start-date-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">End Date</Label>
          <Input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-36 h-8 text-sm"
            data-testid="audit-log-end-date-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">User ID</Label>
          <Input
            placeholder="Filter by user..."
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="w-40 h-8 text-sm"
            data-testid="audit-log-user-id-input"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Action</Label>
          <Select value={action} onValueChange={setAction}>
            <SelectTrigger className="w-36 h-8 text-sm" data-testid="audit-log-action-select">
              <SelectValue placeholder="All actions" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All actions</SelectItem>
              {AUDIT_ACTIONS.map((a) => (
                <SelectItem key={a} value={a}>
                  {a.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Entity Type</Label>
          <Select value={entityType} onValueChange={setEntityType}>
            <SelectTrigger className="w-40 h-8 text-sm" data-testid="audit-log-entity-type-select">
              <SelectValue placeholder="All entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All entities</SelectItem>
              {AUDIT_ENTITY_TYPES.map((t) => (
                <SelectItem key={t} value={t}>
                  {t.replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button size="sm" onClick={handleApply} disabled={isPending} data-testid="audit-log-apply-btn">
          {isPending ? 'Loading...' : 'Apply'}
        </Button>
        <Button size="sm" variant="outline" onClick={handleReset} data-testid="audit-log-reset-btn">
          Reset
        </Button>
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {data.totalCount.toLocaleString()} entries found
        {data.totalPages > 1 && ` — Page ${data.page} of ${data.totalPages}`}
      </p>

      {/* Table */}
      <div className="rounded-md border" data-testid="audit-log-table">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-44">Timestamp</TableHead>
              <TableHead>User</TableHead>
              <TableHead>Action</TableHead>
              <TableHead>Entity</TableHead>
              <TableHead>Before</TableHead>
              <TableHead>After</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.entries.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No audit log entries found.
                </TableCell>
              </TableRow>
            ) : (
              data.entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="text-xs tabular-nums">
                    {formatDateTime(entry.timestamp)}
                  </TableCell>
                  <TableCell className="text-sm">{entry.userId}</TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={`text-xs ${ACTION_COLORS[entry.action] ?? ''}`}
                    >
                      {entry.action.replace(/_/g, ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    <span className="font-mono text-xs">{entry.entityType}</span>
                    <span className="text-muted-foreground"> #{entry.entityId}</span>
                  </TableCell>
                  <TableCell>
                    <JsonViewer label="before" data={entry.beforeState} />
                  </TableCell>
                  <TableCell>
                    <JsonViewer label="after" data={entry.afterState} />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {data.totalPages > 1 && (
        <div className="flex items-center justify-between" data-testid="audit-log-pagination">
          <div className="flex items-center gap-2">
            <Label className="text-xs">Page size:</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => { setPageSize(Number(v)); fetchPage(1) }}
            >
              <SelectTrigger className="w-20 h-8 text-sm" data-testid="audit-log-page-size-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => fetchPage(1)}
              disabled={data.page === 1 || isPending}
              data-testid="audit-log-first-page-btn"
            >
              <ChevronsLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => fetchPage(data.page - 1)}
              disabled={data.page === 1 || isPending}
              data-testid="audit-log-prev-page-btn"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm px-2 tabular-nums">
              {data.page} / {data.totalPages}
            </span>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => fetchPage(data.page + 1)}
              disabled={data.page === data.totalPages || isPending}
              data-testid="audit-log-next-page-btn"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="outline"
              className="h-8 w-8"
              onClick={() => fetchPage(data.totalPages)}
              disabled={data.page === data.totalPages || isPending}
              data-testid="audit-log-last-page-btn"
            >
              <ChevronsRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </ReportShell>
  )
}
