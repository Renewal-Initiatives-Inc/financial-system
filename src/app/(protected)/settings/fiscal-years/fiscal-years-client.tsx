'use client'

import { useState } from 'react'
import { format } from 'date-fns'
import { LockOpen, Lock } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { reopenFiscalYear } from './actions'
import type { FiscalYearLock } from '@/lib/db/schema/fiscal-year-locks'

interface FiscalYearsClientProps {
  locks: FiscalYearLock[]
}

export function FiscalYearsClient({ locks }: FiscalYearsClientProps) {
  const [reopenDialogOpen, setReopenDialogOpen] = useState(false)
  const [selectedYear, setSelectedYear] = useState<number | null>(null)
  const [reason, setReason] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
  const [pending, setPending] = useState(false)

  const handleOpenReopen = (year: number) => {
    setSelectedYear(year)
    setReason('')
    setFieldErrors({})
    setReopenDialogOpen(true)
  }

  const handleReopen = async () => {
    if (!selectedYear) return

    if (!reason.trim()) {
      setFieldErrors({ reason: 'A reason is required to reopen a fiscal year' })
      return
    }

    setPending(true)
    try {
      await reopenFiscalYear(selectedYear, reason)
      toast.success(`Fiscal year ${selectedYear} reopened`)
      setReopenDialogOpen(false)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to reopen fiscal year'
      toast.error(message)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Fiscal Years</h1>
        <p className="text-muted-foreground mt-2">
          Manage fiscal year lock status. Locked years prevent accidental edits to closed periods.
        </p>
      </div>

      {locks.length === 0 ? (
        <div className="rounded-md border p-8 text-center text-muted-foreground">
          No fiscal years have been locked yet. Use the Close the Books wizard from the Chart of Accounts page to close a fiscal year.
        </div>
      ) : (
        <Table data-testid="fiscal-years-table">
          <TableHeader>
            <TableRow>
              <TableHead>Fiscal Year</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Locked</TableHead>
              <TableHead>Locked By</TableHead>
              <TableHead>Reopened</TableHead>
              <TableHead>Reopened By</TableHead>
              <TableHead>Reopen Reason</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {locks.map((lock) => (
              <TableRow key={lock.id} data-testid={`fiscal-year-row-${lock.fiscalYear}`}>
                <TableCell className="font-medium">{lock.fiscalYear}</TableCell>
                <TableCell>
                  {lock.status === 'LOCKED' ? (
                    <Badge variant="default" className="gap-1">
                      <Lock className="h-3 w-3" />
                      Locked
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1">
                      <LockOpen className="h-3 w-3" />
                      Reopened
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lock.lockedAt
                    ? format(new Date(lock.lockedAt), 'MMM dd, yyyy h:mm a')
                    : '—'}
                </TableCell>
                <TableCell className="text-sm">{lock.lockedBy}</TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {lock.reopenedAt
                    ? format(new Date(lock.reopenedAt), 'MMM dd, yyyy h:mm a')
                    : '—'}
                </TableCell>
                <TableCell className="text-sm">{lock.reopenedBy ?? '—'}</TableCell>
                <TableCell className="text-sm max-w-[200px] truncate">
                  {lock.reopenReason ?? '—'}
                </TableCell>
                <TableCell className="text-right">
                  {lock.status === 'LOCKED' && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenReopen(lock.fiscalYear)}
                      data-testid={`fiscal-year-reopen-btn-${lock.fiscalYear}`}
                    >
                      <LockOpen className="h-4 w-4 mr-1" />
                      Reopen
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <Dialog open={reopenDialogOpen} onOpenChange={setReopenDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen Fiscal Year {selectedYear}</DialogTitle>
            <DialogDescription>
              Reopening a fiscal year allows new transactions to be posted without
              a warning. Provide a reason for the audit trail.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="reopen-reason">
              Reason <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="reopen-reason"
              value={reason}
              onChange={(e) => {
                setReason(e.target.value)
                if (e.target.value.trim()) {
                  setFieldErrors({})
                }
              }}
              placeholder="e.g., Audit adjustment required for Q4 accrual..."
              rows={3}
              data-testid="fiscal-year-reopen-reason"
            />
            {fieldErrors.reason && (
              <p className="text-sm text-destructive">{fieldErrors.reason}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReopenDialogOpen(false)}
              disabled={pending}
              data-testid="fiscal-year-reopen-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              onClick={handleReopen}
              disabled={pending}
              data-testid="fiscal-year-reopen-confirm-btn"
            >
              {pending ? 'Reopening...' : 'Reopen Year'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
