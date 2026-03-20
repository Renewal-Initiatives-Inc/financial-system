'use client'

import { Fragment, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Pencil,
  Play,
  Plus,
  X,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  createPrepaidSchedule,
  runPrepaidAmortization,
  getAmortizationHistory,
  updatePrepaidSchedule,
  cancelPrepaidSchedule,
} from '../prepaid-actions'
import type { PrepaidScheduleRow, AmortizationHistoryEntry } from '../prepaid-actions'
import { CAPITALIZATION_THRESHOLD } from '@/lib/assets/asset-categories'

interface PrepaidClientProps {
  initialSchedules: PrepaidScheduleRow[]
  accountOptions: {
    id: number
    name: string
    code: string
    subType: string | null
  }[]
  fundOptions: { id: number; name: string }[]
}

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? Number(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(date: string): string {
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getStatusBadge(schedule: PrepaidScheduleRow) {
  if (schedule.cancelledAt) {
    return <Badge variant="destructive">Cancelled</Badge>
  }
  if (!schedule.isActive) {
    return <Badge variant="secondary">Completed</Badge>
  }
  return <Badge variant="default">Active</Badge>
}

export function PrepaidClient({
  initialSchedules,
  accountOptions,
  fundOptions,
}: PrepaidClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [showActive, setShowActive] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  // Create form state
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [glExpenseAccountId, setGlExpenseAccountId] = useState('')
  const [glPrepaidAccountId, setGlPrepaidAccountId] = useState('')
  const [fundId, setFundId] = useState('')

  // Expand/collapse state
  const [expandedScheduleId, setExpandedScheduleId] = useState<number | null>(null)
  const [historyCache, setHistoryCache] = useState<Record<number, AmortizationHistoryEntry[]>>({})
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Edit dialog state
  const [editOpen, setEditOpen] = useState(false)
  const [editSchedule, setEditSchedule] = useState<PrepaidScheduleRow | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [editEndDate, setEditEndDate] = useState('')
  const [editExpenseAccountId, setEditExpenseAccountId] = useState('')
  const [editFundId, setEditFundId] = useState('')

  // Cancel dialog state
  const [cancelOpen, setCancelOpen] = useState(false)
  const [cancelSchedule, setCancelSchedule] = useState<PrepaidScheduleRow | null>(null)

  const expenseAccounts = accountOptions.filter(
    (a) => a.subType && ['Operating', 'Property Ops', 'Financial', 'Non-Cash', 'Payroll'].includes(a.subType)
  )
  const prepaidAccounts = accountOptions.filter(
    (a) => a.code === '1200' || a.subType === 'Prepaid'
  )

  // Default prepaid account to 1200
  const defaultPrepaidAccount = accountOptions.find((a) => a.code === '1200')

  const filtered = initialSchedules.filter((s) => {
    if (showActive === 'active' && !s.isActive) return false
    return true
  })

  // Calculate auto monthly amount
  const autoMonthly = (() => {
    if (!totalAmount || !startDate || !endDate) return null
    const start = new Date(startDate)
    const end = new Date(endDate)
    const months =
      (end.getFullYear() - start.getFullYear()) * 12 +
      (end.getMonth() - start.getMonth())
    if (months <= 0) return null
    return (Number(totalAmount) / months).toFixed(2)
  })()

  const resetForm = () => {
    setDescription('')
    setTotalAmount('')
    setStartDate('')
    setEndDate('')
    setGlExpenseAccountId('')
    setGlPrepaidAccountId(
      defaultPrepaidAccount ? String(defaultPrepaidAccount.id) : ''
    )
    setFundId('')
  }

  const handleCreate = () => {
    startTransition(async () => {
      try {
        await createPrepaidSchedule({
          description: description.trim(),
          totalAmount: Number(totalAmount),
          startDate,
          endDate,
          glExpenseAccountId: Number(glExpenseAccountId),
          glPrepaidAccountId: Number(
            glPrepaidAccountId ||
              (defaultPrepaidAccount ? defaultPrepaidAccount.id : 0)
          ),
          fundId: Number(fundId),
        })

        toast.success('Prepaid schedule created')
        resetForm()
        setCreateOpen(false)
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create schedule'
        )
      }
    })
  }

  const handleToggleExpand = async (scheduleId: number) => {
    if (expandedScheduleId === scheduleId) {
      setExpandedScheduleId(null)
      return
    }

    setExpandedScheduleId(scheduleId)

    // Lazy load history if not cached
    if (!historyCache[scheduleId]) {
      setLoadingHistory(true)
      try {
        const history = await getAmortizationHistory(scheduleId)
        setHistoryCache((prev) => ({ ...prev, [scheduleId]: history }))
      } catch (err) {
        toast.error('Failed to load amortization history')
      } finally {
        setLoadingHistory(false)
      }
    }
  }

  const openEditDialog = (schedule: PrepaidScheduleRow) => {
    setEditSchedule(schedule)
    setEditDescription(schedule.description)
    setEditEndDate(schedule.endDate)
    setEditExpenseAccountId(String(schedule.glExpenseAccountId))
    setEditFundId(String(schedule.fundId))
    setEditOpen(true)
  }

  const handleEdit = () => {
    if (!editSchedule) return
    startTransition(async () => {
      try {
        await updatePrepaidSchedule(editSchedule.id, {
          description: editDescription.trim(),
          endDate: editEndDate,
          glExpenseAccountId: Number(editExpenseAccountId),
          fundId: Number(editFundId),
        })
        toast.success('Schedule updated')
        setEditOpen(false)
        setEditSchedule(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to update schedule')
      }
    })
  }

  const openCancelDialog = (schedule: PrepaidScheduleRow) => {
    setCancelSchedule(schedule)
    setCancelOpen(true)
  }

  const handleCancel = () => {
    if (!cancelSchedule) return
    startTransition(async () => {
      try {
        await cancelPrepaidSchedule(cancelSchedule.id)
        toast.success('Schedule cancelled')
        setCancelOpen(false)
        setCancelSchedule(null)
        router.refresh()
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to cancel schedule')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight flex items-center gap-2">
            Prepaid Expenses
            <HelpTooltip term="prepaid-amortization" />
          </h1>
          <p className="text-muted-foreground mt-1">
            Manage prepaid expense amortization schedules
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => {
              startTransition(async () => {
                try {
                  const today = new Date().toISOString().split('T')[0]
                  const result = await runPrepaidAmortization(today)
                  if (result.entriesCreated === 0) {
                    toast.info('No amortization entries needed')
                  } else {
                    toast.success(
                      `Created ${result.entriesCreated} amortization ${result.entriesCreated === 1 ? 'entry' : 'entries'} totaling ${formatCurrency(result.totalAmount)}`
                    )
                  }
                  // Clear history cache so expanded rows re-fetch
                  setHistoryCache({})
                  router.refresh()
                } catch (err) {
                  toast.error(
                    err instanceof Error ? err.message : 'Failed to run amortization'
                  )
                }
              })
            }}
            disabled={isPending}
            data-testid="run-amortization-btn"
          >
            <Play className="mr-2 h-4 w-4" />
            {isPending ? 'Running...' : 'Run Amortization'}
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="create-prepaid-btn">
            <Plus className="mr-2 h-4 w-4" />
            Create Schedule
          </Button>
        </div>
      </div>

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select
          value={showActive}
          onValueChange={(v) => setShowActive(v as 'all' | 'active')}
        >
          <SelectTrigger className="w-[150px]" data-testid="prepaid-status-filter">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active Only</SelectItem>
            <SelectItem value="all">All Schedules</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Schedules Table */}
      <Card>
        <CardContent className="pt-6">
          {filtered.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No prepaid schedules found.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-8"></TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Amortized / Remaining</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((schedule) => {
                  const total = Number(schedule.totalAmount)
                  const amortized = Number(schedule.amountAmortized)
                  const pct = total > 0 ? (amortized / total) * 100 : 0
                  const isExpanded = expandedScheduleId === schedule.id
                  const history = historyCache[schedule.id]

                  return (
                    <Fragment key={schedule.id}>
                      <TableRow
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => handleToggleExpand(schedule.id)}
                        data-testid={`prepaid-row-${schedule.id}`}
                      >
                        <TableCell>
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </TableCell>
                        <TableCell className="font-medium">
                          {schedule.description}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(schedule.totalAmount)}
                        </TableCell>
                        <TableCell>
                          {formatDate(schedule.startDate)} -{' '}
                          {formatDate(schedule.endDate)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(schedule.monthlyAmount)}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(schedule.amountAmortized)} /{' '}
                          {formatCurrency(schedule.remainingBalance)}
                        </TableCell>
                        <TableCell className="w-32">
                          <Progress value={pct} className="h-2" />
                        </TableCell>
                        <TableCell>
                          {getStatusBadge(schedule)}
                        </TableCell>
                        <TableCell className="text-right">
                          {schedule.isActive && (
                            <div className="flex gap-1 justify-end" onClick={(e) => e.stopPropagation()}>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openEditDialog(schedule)}
                                title="Edit schedule"
                                data-testid={`prepaid-edit-btn-${schedule.id}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openCancelDialog(schedule)}
                                title="Cancel schedule"
                                data-testid={`prepaid-cancel-schedule-btn-${schedule.id}`}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          )}
                        </TableCell>
                      </TableRow>
                      {isExpanded && (
                        <TableRow>
                          <TableCell colSpan={9} className="bg-muted/30 p-0">
                            <div className="px-8 py-4">
                              <h4 className="text-sm font-medium mb-3">Amortization History</h4>
                              {loadingHistory && !history ? (
                                <p className="text-sm text-muted-foreground">Loading...</p>
                              ) : history && history.length > 0 ? (
                                <div className="space-y-2">
                                  <Table>
                                    <TableHeader>
                                      <TableRow>
                                        <TableHead>Date</TableHead>
                                        <TableHead className="text-right">Amount</TableHead>
                                        <TableHead>Memo</TableHead>
                                        <TableHead className="text-right">GL Entry</TableHead>
                                      </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                      {history.map((entry) => (
                                        <TableRow key={entry.transactionId}>
                                          <TableCell className="text-sm">
                                            {formatDate(entry.date)}
                                          </TableCell>
                                          <TableCell className="text-sm text-right font-mono">
                                            {formatCurrency(entry.amount)}
                                          </TableCell>
                                          <TableCell className="text-sm text-muted-foreground truncate max-w-[250px]">
                                            {entry.memo}
                                          </TableCell>
                                          <TableCell className="text-right">
                                            <Link
                                              href={`/transactions/${entry.transactionId}`}
                                              className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline"
                                              onClick={(e) => e.stopPropagation()}
                                              data-testid={`prepaid-history-link-${entry.transactionId}`}
                                            >
                                              View <ExternalLink className="h-3 w-3" />
                                            </Link>
                                          </TableCell>
                                        </TableRow>
                                      ))}
                                    </TableBody>
                                  </Table>
                                  <p className="text-xs text-muted-foreground pt-2">
                                    Total amortized: {formatCurrency(
                                      history.reduce((sum, e) => sum + e.amount, 0)
                                    )}
                                  </p>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">
                                  No amortization entries yet.
                                </p>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </Fragment>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Create Prepaid Schedule</DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Description</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., Annual property insurance"
                data-testid="prepaid-description"
              />
            </div>

            <div>
              <Label>Total Amount ($)</Label>
              <Input
                type="number"
                step="0.01"
                min="0"
                value={totalAmount}
                onChange={(e) => setTotalAmount(e.target.value)}
                placeholder="0.00"
                data-testid="prepaid-total"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  data-testid="prepaid-start-date"
                />
              </div>
              <div>
                <Label>End Date</Label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  data-testid="prepaid-end-date"
                />
              </div>
            </div>

            {autoMonthly && (
              <p className="text-sm text-muted-foreground">
                Monthly amortization: {formatCurrency(autoMonthly)}
              </p>
            )}

            {totalAmount && Number(totalAmount) > 0 && Number(totalAmount) < CAPITALIZATION_THRESHOLD && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200" data-testid="prepaid-threshold-warning">
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                <span>
                  Amount is below the ${CAPITALIZATION_THRESHOLD.toLocaleString()} de minimis safe harbor threshold. Consider expensing immediately instead of capitalizing as a prepaid.
                </span>
              </div>
            )}

            <div>
              <Label>GL Expense Account</Label>
              <Select
                value={glExpenseAccountId}
                onValueChange={setGlExpenseAccountId}
              >
                <SelectTrigger data-testid="prepaid-expense-account-select">
                  <SelectValue placeholder="Select expense account..." />
                </SelectTrigger>
                <SelectContent>
                  {expenseAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>GL Prepaid Account</Label>
              <Select
                value={
                  glPrepaidAccountId ||
                  (defaultPrepaidAccount
                    ? String(defaultPrepaidAccount.id)
                    : '')
                }
                onValueChange={setGlPrepaidAccountId}
              >
                <SelectTrigger data-testid="prepaid-prepaid-account-select">
                  <SelectValue placeholder="Prepaid Expenses (1200)" />
                </SelectTrigger>
                <SelectContent>
                  {prepaidAccounts.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.code} - {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>Funding Source</Label>
              <Select value={fundId} onValueChange={setFundId}>
                <SelectTrigger data-testid="prepaid-fund-select">
                  <SelectValue placeholder="Select funding source..." />
                </SelectTrigger>
                <SelectContent>
                  {fundOptions.map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {f.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setCreateOpen(false)}
              disabled={isPending}
              data-testid="prepaid-cancel-btn"
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={isPending} data-testid="prepaid-create-btn">
              {isPending ? 'Creating...' : 'Create Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={(v) => { if (!v) { setEditOpen(false); setEditSchedule(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit Prepaid Schedule</DialogTitle>
            <DialogDescription>
              Editing this schedule changes future amortization only. Past entries are not adjusted.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200">
            <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
            <span>
              To correct past entries, go to Reports &rarr; Transaction History, filter by source type SYSTEM, and edit or void individual entries.
            </span>
          </div>

          {editSchedule && (
            <div className="space-y-4">
              <div>
                <Label>Description</Label>
                <Input
                  value={editDescription}
                  onChange={(e) => setEditDescription(e.target.value)}
                  data-testid="prepaid-edit-description"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Start Date (locked)</Label>
                  <Input
                    type="date"
                    value={editSchedule.startDate}
                    disabled
                    className="bg-muted"
                  />
                </div>
                <div>
                  <Label>End Date</Label>
                  <Input
                    type="date"
                    value={editEndDate}
                    onChange={(e) => setEditEndDate(e.target.value)}
                    data-testid="prepaid-edit-end-date"
                  />
                </div>
              </div>

              <div>
                <Label>Total Amount (locked)</Label>
                <Input
                  value={formatCurrency(editSchedule.totalAmount)}
                  disabled
                  className="bg-muted"
                />
              </div>

              <div>
                <Label>GL Expense Account</Label>
                <Select
                  value={editExpenseAccountId}
                  onValueChange={setEditExpenseAccountId}
                >
                  <SelectTrigger data-testid="prepaid-edit-expense-account">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Funding Source</Label>
                <Select value={editFundId} onValueChange={setEditFundId}>
                  <SelectTrigger data-testid="prepaid-edit-fund">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {fundOptions.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setEditOpen(false); setEditSchedule(null) }}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={isPending} data-testid="prepaid-edit-save-btn">
              {isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelOpen} onOpenChange={(v) => { if (!v) { setCancelOpen(false); setCancelSchedule(null) } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Cancel Prepaid Schedule</DialogTitle>
          </DialogHeader>

          {cancelSchedule && (
            <div className="space-y-4">
              <p className="text-sm">
                Cancelling stops all future amortization for{' '}
                <span className="font-medium">{cancelSchedule.description}</span>.
                Past amortization entries are not affected.
              </p>

              <div className="rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-200 space-y-3">
                <p className="font-medium">
                  Remaining unamortized balance: {formatCurrency(cancelSchedule.remainingBalance)}
                </p>
                <p>You will need to create a journal entry to handle this balance:</p>
                <ul className="list-disc pl-5 space-y-1">
                  <li>If refundable &rarr; reclassify to Accounts Receivable</li>
                  <li>If non-refundable &rarr; expense the remaining balance immediately</li>
                </ul>
                <p>
                  Go to{' '}
                  <Link href="/transactions/new" className="underline font-medium">
                    Transactions &rarr; New Entry
                  </Link>{' '}
                  to record this adjustment.
                </p>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setCancelOpen(false); setCancelSchedule(null) }}
              disabled={isPending}
            >
              Keep Schedule
            </Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={isPending}
              data-testid="prepaid-cancel-confirm-btn"
            >
              {isPending ? 'Cancelling...' : 'Cancel Schedule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
