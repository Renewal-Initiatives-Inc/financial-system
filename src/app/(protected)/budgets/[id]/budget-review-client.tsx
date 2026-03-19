'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Pencil, ArrowLeft, ChevronDown, ChevronRight } from 'lucide-react'
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { VarianceIndicator } from '@/components/budgets/variance-indicator'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { getBudgetVarianceAction, getCIPVarianceAction, getFundingBudgetSummaryAction } from '../actions'
import type { BudgetWithLines } from '@/lib/budget/queries'
import type { BudgetVarianceRow } from '@/lib/budget/variance'
import type { CIPSubAccountVariance } from '@/lib/budget/cip-budget'

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
  initialCIPVariance: CIPSubAccountVariance[]
  fundingBudgetContext: { fundName: string; totalBudgeted: number; totalSpent: number; remaining: number } | null
  funds: { id: number; name: string; isActive: boolean }[]
}

export function BudgetReviewClient({
  budget,
  initialVariance,
  initialCIPVariance,
  fundingBudgetContext,
  funds,
}: BudgetReviewClientProps) {
  const router = useRouter()
  const [variance, setVariance] = useState(initialVariance)
  const [cipVariance, setCipVariance] = useState(initialCIPVariance)
  const [period, setPeriod] = useState('ytd')
  const [fundFilter, setFundFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [expandedCIP, setExpandedCIP] = useState<Set<number>>(new Set())
  const [fundingContext, setFundingContext] = useState(fundingBudgetContext)

  const handleFilterChange = async (newPeriod: string, newFund: string) => {
    setLoading(true)
    const month = newPeriod === 'ytd' ? undefined : parseInt(newPeriod)
    const fund = newFund === 'all' ? undefined : parseInt(newFund)
    const [data, cipData] = await Promise.all([
      getBudgetVarianceAction(budget.id, month, fund),
      getCIPVarianceAction(budget.id, fund),
    ])
    setVariance(data)
    setCipVariance(cipData)

    // Fetch funding context when filtering to a specific fund
    if (fund) {
      const summary = await getFundingBudgetSummaryAction(fund)
      setFundingContext(summary ? {
        fundName: summary.fundName,
        totalBudgeted: summary.totalBudgeted,
        totalSpent: summary.totalSpent,
        remaining: summary.remaining,
      } : null)
    } else {
      setFundingContext(null)
    }

    setLoading(false)
  }

  const toggleCIPExpand = (accountId: number) => {
    setExpandedCIP((prev) => {
      const next = new Set(prev)
      if (next.has(accountId)) next.delete(accountId)
      else next.add(accountId)
      return next
    })
  }

  const totalBudget = variance.reduce((sum, r) => sum + r.budgetAmount, 0)
  const totalActual = variance.reduce((sum, r) => sum + r.actualAmount, 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push('/budgets')} data-testid="budget-review-back-btn">
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

      {/* Funding Source Budget Context Banner */}
      {fundingContext && (
        <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-sm" data-testid="funding-budget-context">
          <span className="font-medium">{fundingContext.fundName} — Funding Total:</span>{' '}
          {formatCurrency(fundingContext.totalBudgeted)} budgeted across fiscal years |{' '}
          {formatCurrency(fundingContext.totalSpent)} spent |{' '}
          <span className="font-semibold">{formatCurrency(fundingContext.remaining)} remaining</span>
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select
          value={period}
          onValueChange={(v) => {
            setPeriod(v)
            handleFilterChange(v, fundFilter)
          }}
        >
          <SelectTrigger className="w-[180px]" data-testid="budget-review-period-filter">
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
          <SelectTrigger className="w-[180px]" data-testid="budget-review-fund-filter">
            <SelectValue placeholder="Funding Source" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funding Sources</SelectItem>
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
              <TableHead>Funding Source</TableHead>
              <TableHead className="text-right">
                Budget <HelpTooltip term="budget" />
              </TableHead>
              <TableHead className="text-right">Actual</TableHead>
              <TableHead className="text-right">
                Variance <HelpTooltip term="budget-variance" />
              </TableHead>
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

      {/* CIP Budget Detail */}
      {cipVariance.length > 0 && (
        <div className="space-y-2" data-testid="cip-budget-detail">
          <h2 className="text-lg font-semibold">
            CIP Budget Detail <HelpTooltip term="cip" />
          </h2>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[40px]"></TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Sub-Account</TableHead>
                  <TableHead className="text-right">Budget</TableHead>
                  <TableHead className="text-right">Actual</TableHead>
                  <TableHead className="text-right">Variance</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cipVariance.map((sub) => (
                  <Collapsible key={sub.accountId} asChild open={expandedCIP.has(sub.accountId)}>
                    <>
                      <CollapsibleTrigger asChild>
                        <TableRow
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => toggleCIPExpand(sub.accountId)}
                        >
                          <TableCell>
                            {sub.costCodes.length > 0 ? (
                              expandedCIP.has(sub.accountId) ? (
                                <ChevronDown className="h-4 w-4" />
                              ) : (
                                <ChevronRight className="h-4 w-4" />
                              )
                            ) : null}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{sub.accountCode}</TableCell>
                          <TableCell className="font-medium">{sub.accountName}</TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(sub.budgetAmount)}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {formatCurrency(sub.actualAmount)}
                          </TableCell>
                          <TableCell className="text-right">
                            <VarianceIndicator
                              dollarVariance={sub.dollarVariance}
                              percentVariance={sub.percentVariance}
                              severity={sub.severity}
                            />
                          </TableCell>
                        </TableRow>
                      </CollapsibleTrigger>
                      <CollapsibleContent asChild>
                        <>
                          {sub.costCodes.map((cc) => (
                            <TableRow key={cc.costCodeId} className="bg-muted/30">
                              <TableCell></TableCell>
                              <TableCell className="text-xs text-muted-foreground pl-6">
                                {cc.costCodeCategory}
                              </TableCell>
                              <TableCell className="text-sm pl-6">{cc.costCodeName}</TableCell>
                              <TableCell className="text-right font-mono text-sm text-muted-foreground">
                                —
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                {formatCurrency(cc.actual)}
                              </TableCell>
                              <TableCell></TableCell>
                            </TableRow>
                          ))}
                        </>
                      </CollapsibleContent>
                    </>
                  </Collapsible>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}
    </div>
  )
}
