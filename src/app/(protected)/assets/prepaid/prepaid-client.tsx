'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { AlertTriangle, Play, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { createPrepaidSchedule, runPrepaidAmortization } from '../prepaid-actions'
import type { PrepaidScheduleRow } from '../prepaid-actions'
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
        await createPrepaidSchedule(
          {
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
          },
          'current-user'
        )

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
                  const result = await runPrepaidAmortization(today, 'current-user')
                  if (result.entriesCreated === 0) {
                    toast.info('No amortization entries needed for this month')
                  } else {
                    toast.success(
                      `Created ${result.entriesCreated} amortization ${result.entriesCreated === 1 ? 'entry' : 'entries'} totaling $${result.totalAmount.toFixed(2)}`
                    )
                  }
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
                  <TableHead>Description</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Monthly</TableHead>
                  <TableHead className="text-right">Amortized</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((schedule) => {
                  const total = Number(schedule.totalAmount)
                  const amortized = Number(schedule.amountAmortized)
                  const pct = total > 0 ? (amortized / total) * 100 : 0
                  return (
                    <TableRow key={schedule.id}>
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
                        <Badge
                          variant={schedule.isActive ? 'default' : 'secondary'}
                        >
                          {schedule.isActive ? 'Active' : 'Completed'}
                        </Badge>
                      </TableCell>
                    </TableRow>
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
    </div>
  )
}
