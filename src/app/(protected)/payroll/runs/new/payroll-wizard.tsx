'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ArrowRight, Check, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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

  // Step 1: Create draft
  const handleCreateDraft = () => {
    startTransition(async () => {
      try {
        const result = await createPayrollRun(
          { payPeriodStart, payPeriodEnd },
          'system'
        )
        setRunId(result.id)
        setStep(2)
        toast.success('Draft payroll run created')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Failed to create run'
        )
      }
    })
  }

  // Step 2: Calculate
  const handleCalculate = () => {
    if (!runId) return
    startTransition(async () => {
      try {
        const result = await calculatePayroll(runId, 'system')
        setCalculation(result)
        setStep(3)
        toast.success('Payroll calculated successfully')
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : 'Calculation failed'
        )
      }
    })
  }

  // Step 3: Post
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
        {[1, 2, 3].map((s) => (
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
              {s === 1
                ? 'Select Period'
                : s === 2
                  ? 'Review & Calculate'
                  : 'Review & Post'}
            </span>
            {s < 3 && (
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
                    (#{existingRun.id}, status: {existingRun.status}).
                  </p>
                )}
              </div>
            )}

            <Button
              onClick={handleCreateDraft}
              disabled={isPending || stagingCount === null}
              data-testid="create-draft-btn"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Create Draft
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Review & Calculate */}
      {step === 2 && runId && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Calculate</CardTitle>
            <CardDescription>
              Click Calculate to compute withholdings for all employees in this
              pay period.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              Pay Period: {MONTHS[selectedMonth]} {selectedYear}
            </p>
            <p className="text-sm">Run ID: #{runId}</p>
            <p className="text-sm">Status: <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">DRAFT</Badge></p>

            <Button
              onClick={handleCalculate}
              disabled={isPending}
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

      {/* Step 3: Review & Post */}
      {step === 3 && calculation && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Calculation Results</CardTitle>
              <CardDescription>
                Review the results below, then post to the General Ledger.
              </CardDescription>
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
                    <TableHead className="text-right">Gross Pay</TableHead>
                    <TableHead className="text-right">Federal Tax</TableHead>
                    <TableHead className="text-right">State Tax</TableHead>
                    <TableHead className="text-right">SS (EE)</TableHead>
                    <TableHead className="text-right">Medicare (EE)</TableHead>
                    <TableHead className="text-right">Net Pay</TableHead>
                    <TableHead className="text-right">Employer SS+Med</TableHead>
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

          <div className="flex gap-2">
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
