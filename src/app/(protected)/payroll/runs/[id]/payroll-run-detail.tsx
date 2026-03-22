'use client'

import { useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableFooter,
} from '@/components/ui/table'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import {
  calculatePayroll,
  postPayroll,
  deletePayrollRun,
  type PayrollEntryRow,
} from '../../actions'
import type { payrollRuns } from '@/lib/db/schema'

type PayrollRun = typeof payrollRuns.$inferSelect

function formatCurrency(value: string | number): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

const statusColors: Record<string, string> = {
  DRAFT: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  CALCULATED: 'bg-blue-50 text-blue-700 border-blue-200',
  POSTED: 'bg-green-50 text-green-700 border-green-200',
  REVERSED: 'bg-red-50 text-red-700 border-red-200',
}

interface PayrollRunDetailProps {
  run: PayrollRun
  entries: PayrollEntryRow[]
}

export function PayrollRunDetail({ run, entries }: PayrollRunDetailProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const totalGross = entries.reduce(
    (sum, e) => sum + parseFloat(e.grossPay),
    0
  )
  const totalNet = entries.reduce(
    (sum, e) => sum + parseFloat(e.netPay),
    0
  )
  const totalEmployerSS = entries.reduce(
    (sum, e) => sum + parseFloat(e.socialSecurityEmployer),
    0
  )
  const totalEmployerMed = entries.reduce(
    (sum, e) => sum + parseFloat(e.medicareEmployer),
    0
  )
  const totalEmployerCost = totalGross + totalEmployerSS + totalEmployerMed

  const periodLabel = new Date(run.payPeriodEnd + 'T00:00:00').toLocaleDateString(
    'en-US',
    { month: 'long', year: 'numeric' }
  )

  const handleCalculate = () => {
    startTransition(async () => {
      try {
        await calculatePayroll(run.id, 'system')
        toast.success('Payroll recalculated')
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Calculation failed'
        )
      }
    })
  }

  const handlePost = () => {
    startTransition(async () => {
      try {
        await postPayroll(run.id, 'system')
        toast.success('Payroll posted to GL')
        router.refresh()
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Posting failed'
        )
      }
    })
  }

  const handleDelete = () => {
    if (!confirm('Delete this payroll run? This cannot be undone.')) return
    startTransition(async () => {
      try {
        await deletePayrollRun(run.id, 'system')
        toast.success('Payroll run deleted')
        router.push('/payroll')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Delete failed'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.push('/payroll')}
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            Payroll Run #{run.id} — {periodLabel}
          </h1>
          <Badge
            variant="outline"
            className={statusColors[run.status] ?? ''}
            data-testid="run-status"
          >
            {run.status}
          </Badge>
          <HelpTooltip term="payroll-run" />
        </div>

        <div className="flex gap-2">
          {run.status === 'DRAFT' && (
            <>
              <Button
                onClick={handleCalculate}
                disabled={isPending}
                data-testid="calculate-btn"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Calculate
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
                data-testid="delete-btn"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
          {run.status === 'CALCULATED' && (
            <>
              <Button
                onClick={handlePost}
                disabled={isPending}
                data-testid="post-btn"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Post to GL
              </Button>
              <Button
                variant="outline"
                onClick={handleCalculate}
                disabled={isPending}
              >
                Recalculate
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={isPending}
                data-testid="delete-btn"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Delete
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-4 gap-4">
        <SummaryCard label="Total Gross" value={formatCurrency(totalGross)} />
        <SummaryCard label="Total Net" value={formatCurrency(totalNet)} />
        <SummaryCard
          label="Total Employer Cost"
          value={formatCurrency(totalEmployerCost)}
        />
        <SummaryCard label="Employees" value={String(entries.length)} />
      </div>

      {/* Entries table */}
      <Card>
        <CardHeader>
          <CardTitle>Employee Payroll Entries</CardTitle>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No entries yet. Calculate the payroll to see employee breakdowns.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Employee</TableHead>
                  <TableHead className="text-right">Gross Pay</TableHead>
                  <TableHead className="text-right">Federal</TableHead>
                  <TableHead className="text-right">State</TableHead>
                  <TableHead className="text-right">SS (EE)</TableHead>
                  <TableHead className="text-right">Medicare (EE)</TableHead>
                  <TableHead className="text-right">Net Pay</TableHead>
                  <TableHead className="text-right">ER FICA</TableHead>
                  {run.status === 'POSTED' && (
                    <TableHead>GL Entries</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} data-testid={`entry-${entry.employeeId}`}>
                    <TableCell className="font-medium">
                      {entry.employeeName}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.grossPay)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.federalWithholding)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.stateWithholding)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.socialSecurityEmployee)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(entry.medicareEmployee)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatCurrency(entry.netPay)}
                    </TableCell>
                    <TableCell className="text-right">
                      {formatCurrency(
                        parseFloat(entry.socialSecurityEmployer) +
                          parseFloat(entry.medicareEmployer)
                      )}
                    </TableCell>
                    {run.status === 'POSTED' && (
                      <TableCell>
                        <div className="flex gap-1">
                          {entry.glTransactionId && (
                            <Link
                              href={`/transactions/${entry.glTransactionId}`}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              EE #{entry.glTransactionId}
                            </Link>
                          )}
                          {entry.glEmployerTransactionId && (
                            <Link
                              href={`/transactions/${entry.glEmployerTransactionId}`}
                              className="text-blue-600 hover:underline text-xs"
                            >
                              ER #{entry.glEmployerTransactionId}
                            </Link>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="font-bold">Totals</TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalGross)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      entries.reduce(
                        (s, e) => s + parseFloat(e.federalWithholding),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      entries.reduce(
                        (s, e) => s + parseFloat(e.stateWithholding),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      entries.reduce(
                        (s, e) => s + parseFloat(e.socialSecurityEmployee),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(
                      entries.reduce(
                        (s, e) => s + parseFloat(e.medicareEmployee),
                        0
                      )
                    )}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalNet)}
                  </TableCell>
                  <TableCell className="text-right font-bold">
                    {formatCurrency(totalEmployerSS + totalEmployerMed)}
                  </TableCell>
                  {run.status === 'POSTED' && <TableCell />}
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Fund allocation summary */}
      {entries.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              Fund Allocation Summary
              <HelpTooltip term="fund-allocation-payroll" className="ml-2" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <FundAllocationSummary entries={entries} />
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
    </div>
  )
}

function FundAllocationSummary({
  entries,
}: {
  entries: PayrollEntryRow[]
}) {
  const fundTotals = new Map<
    number,
    { name: string; amount: number; hours: number }
  >()

  for (const entry of entries) {
    const allocs = entry.fundAllocations as Array<{
      fundId: number
      fundName: string
      amount: string
      hours: string
    }>
    for (const alloc of allocs) {
      const existing = fundTotals.get(alloc.fundId) ?? {
        name: alloc.fundName,
        amount: 0,
        hours: 0,
      }
      existing.amount += parseFloat(alloc.amount)
      existing.hours += parseFloat(alloc.hours)
      fundTotals.set(alloc.fundId, existing)
    }
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fund</TableHead>
          <TableHead className="text-right">Hours</TableHead>
          <TableHead className="text-right">Amount</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {Array.from(fundTotals.entries()).map(([fundId, data]) => (
          <TableRow key={fundId}>
            <TableCell>{data.name}</TableCell>
            <TableCell className="text-right">
              {data.hours.toFixed(2)}
            </TableCell>
            <TableCell className="text-right">
              {formatCurrency(data.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
