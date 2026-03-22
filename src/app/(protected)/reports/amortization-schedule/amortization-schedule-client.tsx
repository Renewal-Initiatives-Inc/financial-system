'use client'

import { useState, useTransition } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ReportShell } from '@/components/reports/report-shell'
import { formatCurrency, formatDate } from '@/lib/reports/types'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'
import type {
  LoanSummary,
  AmortizationScheduleData,
} from '@/lib/reports/amortization-schedule'

// ---------------------------------------------------------------------------
// Typed CSV columns
// ---------------------------------------------------------------------------

const AMORT_CSV_COLUMNS: CSVColumnDef[] = [
  { key: 'period', label: 'Period', format: 'count' },
  { key: 'date', label: 'Date', format: 'date' },
  { key: 'beginningBalance', label: 'Beginning Balance', format: 'currency' },
  { key: 'payment', label: 'Payment', format: 'currency' },
  { key: 'principal', label: 'Principal', format: 'currency' },
  { key: 'interest', label: 'Interest', format: 'currency' },
  { key: 'endingBalance', label: 'Ending Balance', format: 'currency' },
]

/** Null-safe date formatter for display */
function displayDate(value: string | null): string {
  if (!value) return '-'
  return formatDate(value)
}

interface Props {
  loans: LoanSummary[]
}

export function AmortizationScheduleClient({ loans }: Props) {
  const [selectedLoanId, setSelectedLoanId] = useState<string>('')
  const [scheduleData, setScheduleData] =
    useState<AmortizationScheduleData | null>(null)
  const [isPending, startTransition] = useTransition()

  const selectedLoan = loans.find(
    (l) => l.fundId === parseInt(selectedLoanId, 10)
  )

  const handleGenerate = () => {
    if (!selectedLoanId) return
    startTransition(async () => {
      const res = await fetch(
        `/api/reports/amortization-schedule?fundId=${selectedLoanId}`
      )
      if (res.ok) {
        const data = await res.json()
        setScheduleData(data)
      }
    })
  }

  const exportData = scheduleData?.schedule.map((row) => ({
    period: row.period,
    date: row.date,
    beginningBalance: row.beginningBalance,
    payment: row.payment,
    principal: row.principal,
    interest: row.interest,
    endingBalance: row.endingBalance,
  }))

  return (
    <ReportShell
      title="Amortization Schedule"
      reportSlug="amortization-schedule"
      exportData={exportData}
      csvColumns={AMORT_CSV_COLUMNS}
      filters={selectedLoanId ? { fundId: selectedLoanId } : undefined}
    >
      {/* Loan Selector */}
      <Card>
        <CardHeader>
          <CardTitle>Select Loan</CardTitle>
        </CardHeader>
        <CardContent>
          {loans.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No loan funding sources found. Create a LOAN funding source first.
            </p>
          ) : (
            <div className="flex items-end gap-4">
              <div className="flex-1 max-w-sm">
                <Label>Loan Funding Source</Label>
                <Select
                  value={selectedLoanId}
                  onValueChange={setSelectedLoanId}
                >
                  <SelectTrigger data-testid="amort-loan-select">
                    <SelectValue placeholder="Choose a loan..." />
                  </SelectTrigger>
                  <SelectContent>
                    {loans.map((loan) => (
                      <SelectItem
                        key={loan.fundId}
                        value={String(loan.fundId)}
                      >
                        {loan.fundName}
                        {loan.lenderName ? ` (${loan.lenderName})` : ''}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleGenerate}
                disabled={!selectedLoanId || isPending}
                data-testid="amort-generate-btn"
              >
                {isPending ? 'Generating...' : 'Generate Schedule'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Loan Summary */}
      {selectedLoan && (
        <Card>
          <CardHeader>
            <CardTitle>Loan Summary</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <Label className="text-muted-foreground">Lender</Label>
              <p className="font-medium">{selectedLoan.lenderName ?? '-'}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">Principal</Label>
              <p className="font-medium">
                {formatCurrency(selectedLoan.principalAmount)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Interest Rate</Label>
              <p className="font-medium">
                {selectedLoan.currentRate !== null
                  ? `${(selectedLoan.currentRate * 100).toFixed(2)}%`
                  : '-'}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">
                Outstanding Balance
              </Label>
              <p className="font-medium">
                {formatCurrency(selectedLoan.outstandingBalance)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Start Date</Label>
              <p>{displayDate(selectedLoan.startDate)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">End Date</Label>
              <p>{displayDate(selectedLoan.endDate)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Table */}
      {scheduleData && (
        <>
          {/* Totals */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Payments</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(scheduleData.totalPayments)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Principal</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(scheduleData.totalPrincipal)}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-sm text-muted-foreground">Total Interest</p>
                <p className="text-2xl font-bold">
                  {formatCurrency(scheduleData.totalInterest)}
                </p>
              </CardContent>
            </Card>
          </div>

          {scheduleData.schedule.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                Unable to generate schedule. Ensure the loan has a start date,
                end date, principal amount, and interest rate.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Payment Schedule</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm" data-testid="amort-schedule-table">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="pb-2 pr-4">#</th>
                        <th className="pb-2 pr-4">Date</th>
                        <th className="pb-2 pr-4 text-right">
                          Beginning Balance
                        </th>
                        <th className="pb-2 pr-4 text-right">Payment</th>
                        <th className="pb-2 pr-4 text-right">Principal</th>
                        <th className="pb-2 pr-4 text-right">Interest</th>
                        <th className="pb-2 text-right">Ending Balance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {scheduleData.schedule.map((row) => (
                        <tr key={row.period} className="border-b last:border-0">
                          <td className="py-2 pr-4 text-muted-foreground">
                            {row.period}
                          </td>
                          <td className="py-2 pr-4">{displayDate(row.date)}</td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {formatCurrency(row.beginningBalance)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {formatCurrency(row.payment)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {formatCurrency(row.principal)}
                          </td>
                          <td className="py-2 pr-4 text-right font-mono">
                            {formatCurrency(row.interest)}
                          </td>
                          <td className="py-2 text-right font-mono">
                            {formatCurrency(row.endingBalance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </ReportShell>
  )
}
