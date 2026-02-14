'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, ArrowLeft } from 'lucide-react'
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import { getBudgetVarianceAction } from '../actions'
import type { BudgetWithLines } from '@/lib/budget/queries'
import type { BudgetVarianceRow } from '@/lib/budget/variance'

const MONTHS = [
  { value: 'ytd', label: 'Year-to-Date' },
  { value: '1', label: 'January' },
  { value: '2', label: 'February' },
  { value: '3', label: 'March' },
  { value: '4', label: 'April' },
  { value: '5', label: 'May' },
  { value: '6', label: 'June' },
  { value: '7', label: 'July' },
  { value: '8', label: 'August' },
  { value: '9', label: 'September' },
  { value: '10', label: 'October' },
  { value: '11', label: 'November' },
  { value: '12', label: 'December' },
]

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount)

interface BudgetReviewClientProps {
  budget: BudgetWithLines
  initialVariance: BudgetVarianceRow[]
  funds: { id: number; name: string; isActive: boolean }[]
}

export function BudgetReviewClient({
  budget,
  initialVariance,
  funds,
}: BudgetReviewClientProps) {
  const router = useRouter()
  const [variance, setVariance] = useState(initialVariance)
  const [period, setPeriod] = useState('ytd')
  const [fundFilter, setFundFilter] = useState('all')
  const [loading, setLoading] = useState(false)

  const handleFilterChange = async (newPeriod: string, newFund: string) => {
    setLoading(true)
    const month = newPeriod === 'ytd' ? undefined : parseInt(newPeriod)
    const fund = newFund === 'all' ? undefined : parseInt(newFund)
    const data = await getBudgetVarianceAction(budget.id, month, fund)
    setVariance(data)
    setLoading(false)
  }

  const totalBudget = variance.reduce((sum, r) => sum + r.budgetAmount, 0)
  const totalActual = variance.reduce((sum, r) => sum + r.actualAmount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/budgets')}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              FY {budget.fiscalYear} Budget Review
            </h1>
            <p className="text-sm text-muted-foreground">
              Budget: {formatCurrency(totalBudget)} | Actual: {formatCurrency(totalActual)}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              budget.status === 'APPROVED'
                ? 'bg-green-100 text-green-800 border-green-200'
                : 'bg-yellow-100 text-yellow-800 border-yellow-200'
            }
          >
            {budget.status === 'APPROVED' ? 'Approved' : 'Draft'}
          </Badge>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/budgets/${budget.id}/edit`)}
          data-testid="edit-budget-btn"
        >
          <Pencil className="mr-2 h-4 w-4" />
          Edit Budget
        </Button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select
          value={period}
          onValueChange={(v) => {
            setPeriod(v)
            handleFilterChange(v, fundFilter)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent>
            {MONTHS.map((m) => (
              <SelectItem key={m.value} value={m.value}>
                {m.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={fundFilter}
          onValueChange={(v) => {
            setFundFilter(v)
            handleFilterChange(period, v)
          }}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Fund" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funds</SelectItem>
            {funds.filter((f) => f.isActive).map((fund) => (
              <SelectItem key={fund.id} value={fund.id.toString()}>
                {fund.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {loading && <span className="text-sm text-muted-foreground">Loading...</span>}
      </div>

      {/* Variance Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Code</TableHead>
              <TableHead>Account</TableHead>
              <TableHead>Fund</TableHead>
              <TableHead className="text-right">Budget</TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">Variance</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {variance.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                  No budget lines to compare. Add budget lines first.
                </TableCell>
              </TableRow>
            ) : (
              variance.map((row, i) => (
                <TableRow key={`${row.accountId}-${row.fundId}-${i}`}>
                  <TableCell className="font-mono text-sm">{row.accountCode}</TableCell>
                  <TableCell>{row.accountName}</TableCell>
                  <TableCell>{row.fundName}</TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.budgetAmount)}
                  </TableCell>
                  <TableCell className="text-right font-mono">
                    {formatCurrency(row.actualAmount)}
                  </TableCell>
                  <TableCell className="text-right">
                    <VarianceIndicator
                      dollarVariance={row.dollarVariance}
                      percentVariance={row.percentVariance}
                      severity={row.severity}
                    />
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
