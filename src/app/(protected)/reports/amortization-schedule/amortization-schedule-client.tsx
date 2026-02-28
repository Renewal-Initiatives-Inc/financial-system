'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
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
import type {
  LoanSummary,
  AmortizationScheduleData,
} from '@/lib/reports/amortization-schedule'

function formatCurrency(value: number): string {
  if (value < 0) {
    return `(${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(value))})`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value + 'T00:00:00').toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/reports">
          <Button variant="ghost" size="icon" data-testid="amort-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Amortization Schedule
          </h1>
          <p className="text-sm text-muted-foreground">
            Projected payment schedule for loan funding sources
          </p>
        </div>
      </div>

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
              <p>{formatDate(selectedLoan.startDate)}</p>
            </div>
            <div>
              <Label className="text-muted-foreground">End Date</Label>
              <p>{formatDate(selectedLoan.endDate)}</p>
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
                          <td className="py-2 pr-4">{formatDate(row.date)}</td>
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
    </div>
  )
}
