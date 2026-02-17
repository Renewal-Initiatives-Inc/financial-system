'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Card,
  CardContent,
  CardDescription,
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
  createPayrollRun,
  calculatePayroll,
  postPayroll,
  getStagingRecordsForPeriod,
  checkExistingRun,
} from '../../actions'
import type { PayrollCalculation } from '@/lib/payroll/engine'

function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

function getLastDayOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}

export function PayrollWizard() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [step, setStep] = useState(1)

  // Step 1 state
  const currentYear = new Date().getFullYear()
  const currentMonth = new Date().getMonth()
  const [selectedYear, setSelectedYear] = useState(currentYear)
  const [selectedMonth, setSelectedMonth] = useState(currentMonth)
  const [stagingCount, setStagingCount] = useState<number | null>(null)
  const [existingRun, setExistingRun] = useState<{ id: number; status: string } | null>(null)
  const [runId, setRunId] = useState<number | null>(null)

  // Step 2 state
  const [calculation, setCalculation] = useState<PayrollCalculation | null>(null)

  const payPeriodStart = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-01`
  const lastDay = getLastDayOfMonth(selectedYear, selectedMonth)
  const payPeriodEnd = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`

  // Check staging records when period changes
  const handleCheckPeriod = () => {
    startTransition(async () => {
      const [records, existing] = await Promise.all([
        getStagingRecordsForPeriod(payPeriodStart, payPeriodEnd),
        checkExistingRun(payPeriodStart, payPeriodEnd),
      ])
      setStagingCount(records.length)
      setExistingRun(existing)
    })
  }

  // Step 1: Create draft and immediately calculate
  const handleCreateAndCalculate = () => {
    startTransition(async () => {
      try {
        const result = await createPayrollRun(
          { payPeriodStart, payPeriodEnd },
          'system'
        )
        setRunId(result.id)
        const calc = await calculatePayroll(result.id, 'system')
        setCalculation(calc)
        setStep(2)
        toast.success('Payroll calculated successfully')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to calculate payroll'
        )
      }
    })
  }

  // Step 2: Post
  const handlePost = () => {
    if (!runId) return
    startTransition(async () => {
      try {
        await postPayroll(runId, 'system')
        toast.success('Payroll posted to GL')
        router.push(`/payroll/runs/${runId}`)
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Posting failed'
        )
      }
    })
  }

  return (
    <div className="space-y-6">
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
          New Payroll Run
        </h1>
        <HelpTooltip term="payroll-run" />
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2">
        {[1, 2].map((s) => (
          <div key={s} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                s < step
                  ? 'bg-green-100 text-green-700'
                  : s === step
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
              }`}
            >
              {s < step ? <Check className="h-4 w-4" /> : s}
            </div>
            <span
              className={`text-sm ${s === step ? 'font-medium' : 'text-muted-foreground'}`}
            >
              {s === 1 ? 'Select Period' : 'Review & Post'}
            </span>
            {s < 2 && (
              <ArrowRight className="mx-2 h-4 w-4 text-muted-foreground" />
            )}
          </div>
        ))}
      </div>

      {/* Step 1: Select Pay Period */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Select Pay Period</CardTitle>
            <CardDescription>
              Choose the monthly pay period for this payroll run.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-4">
              <Select
                value={String(selectedMonth)}
                onValueChange={(v) => {
                  setSelectedMonth(parseInt(v, 10))
                  setStagingCount(null)
                  setExistingRun(null)
                }}
              >
                <SelectTrigger
                  className="w-[180px]"
                  data-testid="month-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {MONTHS.map((name, idx) => (
                    <SelectItem key={idx} value={String(idx)}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select
                value={String(selectedYear)}
                onValueChange={(v) => {
                  setSelectedYear(parseInt(v, 10))
                  setStagingCount(null)
                  setExistingRun(null)
                }}
              >
                <SelectTrigger
                  className="w-[120px]"
                  data-testid="year-select"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                    <SelectItem key={y} value={String(y)}>
                      {y}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                onClick={handleCheckPeriod}
                disabled={isPending}
                data-testid="check-period-btn"
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Check Period
              </Button>
            </div>

            <p className="text-sm text-muted-foreground">
              Period: {payPeriodStart} to {payPeriodEnd}
            </p>

            {stagingCount !== null && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium">{stagingCount}</span> staging
                  record{stagingCount !== 1 ? 's' : ''} found for this period.
                </p>
                {stagingCount === 0 && (
                  <p className="text-sm text-yellow-600">
                    Warning: No timesheet data found. You can still create a
                    draft, but calculation will produce no entries.
                  </p>
                )}
                {existingRun && (
                  <p className="text-sm text-yellow-600">
                    Warning: A payroll run already exists for this period
                    (#{existingRun.id}
                    {existingRun.status === 'POSTED'
                      ? ' — already posted to GL'
                      : ' — not yet posted to GL'}
                    ).{' '}
                    {existingRun.status !== 'POSTED' && (
                      <a
                        href={`/payroll/runs/${existingRun.id}`}
                        className="underline hover:text-yellow-800"
                      >
                        Open existing run
                      </a>
                    )}
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleCreateAndCalculate}
              disabled={isPending || stagingCount === null}
              data-testid="calculate-btn"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Calculate Payroll
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Post */}
      {step === 2 && calculation && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Payroll Calculation Results</h2>
              <p className="text-sm text-muted-foreground">
                Review the results below, then post to the General Ledger.
              </p>
            </div>
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
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Employee Payroll Entries</CardTitle>
            </CardHeader>
            <CardContent>
              {/* Summary cards */}
              <div className="grid grid-cols-4 gap-4 mb-6">
                <SummaryCard
                  label="Total Gross"
                  value={formatCurrency(calculation.totals.grossPay)}
                />
                <SummaryCard
                  label="Total Net"
                  value={formatCurrency(calculation.totals.netPay)}
                />
                <SummaryCard
                  label="Employer Cost"
                  value={formatCurrency(calculation.totals.totalEmployerCost)}
                />
                <SummaryCard
                  label="Employees"
                  value={String(calculation.entries.length)}
                />
              </div>

              {/* Per-employee table */}
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead className="text-right">Gross Pay <HelpTooltip term="gross-pay" /></TableHead>
                    <TableHead className="text-right">Federal Tax <HelpTooltip term="federal-withholding" /></TableHead>
                    <TableHead className="text-right">State Tax <HelpTooltip term="ma-state-withholding" /></TableHead>
                    <TableHead className="text-right">SS (EE) <HelpTooltip term="fica" /></TableHead>
                    <TableHead className="text-right">Medicare (EE) <HelpTooltip term="fica" /></TableHead>
                    <TableHead className="text-right">Net Pay <HelpTooltip term="net-pay" /></TableHead>
                    <TableHead className="text-right">Employer SS+Med <HelpTooltip term="employer-fica" /></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculation.entries.map((entry) => (
                    <TableRow key={entry.employeeId}>
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
                          entry.socialSecurityEmployer +
                            entry.medicareEmployer
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-bold">Totals</TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.grossPay)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.federalWithholding)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.stateWithholding)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.socialSecurityEmployee)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.medicareEmployee)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(calculation.totals.netPay)}
                    </TableCell>
                    <TableCell className="text-right font-bold">
                      {formatCurrency(
                        calculation.totals.socialSecurityEmployer +
                          calculation.totals.medicareEmployer
                      )}
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Fund allocation summary */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Fund Allocation Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <FundAllocationSummary entries={calculation.entries} />
            </CardContent>
          </Card>

        </div>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  value,
}: {
  label: string
  value: string
}) {
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
  entries: PayrollCalculation['entries']
}) {
  // Aggregate fund allocations across all employees
  const fundTotals = new Map<number, { name: string; amount: number; hours: number }>()

  for (const entry of entries) {
    for (const alloc of entry.fundAllocations) {
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

  if (fundTotals.size === 0) {
    return <p className="text-sm text-muted-foreground">No fund allocations.</p>
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
            <TableCell className="text-right">{data.hours.toFixed(2)}</TableCell>
            <TableCell className="text-right">
              {formatCurrency(data.amount)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}
