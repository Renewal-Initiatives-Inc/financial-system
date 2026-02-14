'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, ArrowLeft, CheckCircle } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AccountSelector } from '@/components/shared/account-selector'
import { FundSelector } from '@/components/shared/fund-selector'
import { SpreadModeSelector } from '@/components/budgets/spread-mode-selector'
import { MonthlyAmountsEditor } from '@/components/budgets/monthly-amounts-editor'
import { recalculateSpread } from '@/lib/budget/spread'
import type { BudgetWithLines } from '@/lib/budget/queries'
import {
  saveBudgetLineAction,
  updateBudgetLineAction,
  deleteBudgetLineAction,
  approveBudgetAction,
} from '../../actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface BudgetEditClientProps {
  budget: BudgetWithLines
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
}

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

export function BudgetEditClient({ budget, accounts, funds }: BudgetEditClientProps) {
  const router = useRouter()
  const [lines, setLines] = useState(budget.lines)
  const [addDialogOpen, setAddDialogOpen] = useState(false)
  const [newAccountId, setNewAccountId] = useState<number | null>(null)
  const [newFundId, setNewFundId] = useState<number | null>(null)
  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [fundFilter, setFundFilter] = useState<string>('all')
  const [saving, setSaving] = useState<number | null>(null)

  const currentMonth = new Date().getMonth() + 1 // 1-indexed
  const isDraft = budget.status === 'DRAFT'

  const filteredLines = lines.filter((line) => {
    if (typeFilter !== 'all' && line.accountType !== typeFilter) return false
    if (fundFilter !== 'all' && line.fundId !== parseInt(fundFilter)) return false
    return true
  })

  const totalBudget = lines.reduce((sum, l) => sum + Number(l.annualAmount), 0)

  const handleAddLine = async () => {
    if (!newAccountId || !newFundId) return

    // Check for duplicate
    const exists = lines.find(
      (l) => l.accountId === newAccountId && l.fundId === newFundId
    )
    if (exists) {
      toast.error('A budget line for this account + fund already exists')
      return
    }

    const monthlyAmounts = recalculateSpread('EVEN', 0)
    const result = await saveBudgetLineAction(
      {
        budgetId: budget.id,
        accountId: newAccountId,
        fundId: newFundId,
        annualAmount: 0,
        spreadMethod: 'EVEN',
        monthlyAmounts,
      },
      'system'
    )

    if ('error' in result) {
      toast.error(result.error)
      return
    }

    // Refresh
    router.refresh()
    setAddDialogOpen(false)
    setNewAccountId(null)
    setNewFundId(null)
    toast.success('Budget line added')
  }

  const handleAnnualAmountChange = useCallback(
    async (lineId: number, value: string, spreadMethod: string) => {
      const amount = parseFloat(value)
      if (isNaN(amount)) return

      let monthlyAmounts: number[]
      try {
        monthlyAmounts = recalculateSpread(
          spreadMethod as 'EVEN' | 'SEASONAL' | 'ONE_TIME' | 'CUSTOM',
          amount,
          spreadMethod === 'ONE_TIME' ? { targetMonth: 1 } : undefined
        )
      } catch {
        monthlyAmounts = Array(12).fill(0)
      }

      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? { ...l, annualAmount: amount.toFixed(2), monthlyAmounts }
            : l
        )
      )

      setSaving(lineId)
      const result = await updateBudgetLineAction(
        lineId,
        { annualAmount: amount, spreadMethod: spreadMethod as any, monthlyAmounts },
        budget.id,
        'system'
      )
      setSaving(null)

      if ('error' in result) {
        toast.error(result.error)
      }
    },
    [budget.id]
  )

  const handleSpreadMethodChange = useCallback(
    async (lineId: number, method: string, annualAmount: number) => {
      let monthlyAmounts: number[]
      try {
        monthlyAmounts = recalculateSpread(
          method as 'EVEN' | 'SEASONAL' | 'ONE_TIME' | 'CUSTOM',
          annualAmount,
          method === 'ONE_TIME' ? { targetMonth: 1 } : undefined
        )
      } catch {
        // Custom requires user input — keep existing
        const line = lines.find((l) => l.id === lineId)
        monthlyAmounts = (line?.monthlyAmounts as number[]) ?? Array(12).fill(0)
      }

      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? { ...l, spreadMethod: method as any, monthlyAmounts }
            : l
        )
      )

      setSaving(lineId)
      const result = await updateBudgetLineAction(
        lineId,
        { spreadMethod: method as any, monthlyAmounts },
        budget.id,
        'system'
      )
      setSaving(null)

      if ('error' in result) toast.error(result.error)
    },
    [budget.id, lines]
  )

  const handleMonthlyAmountsChange = useCallback(
    async (lineId: number, amounts: number[]) => {
      const annualAmount = amounts.reduce((a, b) => a + b, 0)

      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId
            ? { ...l, monthlyAmounts: amounts, annualAmount: annualAmount.toFixed(2) }
            : l
        )
      )

      setSaving(lineId)
      const result = await updateBudgetLineAction(
        lineId,
        { annualAmount, monthlyAmounts: amounts },
        budget.id,
        'system'
      )
      setSaving(null)

      if ('error' in result) toast.error(result.error)
    },
    [budget.id]
  )

  const handleDeleteLine = async (lineId: number) => {
    const result = await deleteBudgetLineAction(lineId, budget.id, 'system')
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    setLines((prev) => prev.filter((l) => l.id !== lineId))
    toast.success('Budget line removed')
  }

  const handleApprove = async () => {
    const result = await approveBudgetAction(budget.id, 'system')
    if ('error' in result) {
      toast.error(result.error)
      return
    }
    toast.success('Budget approved')
    router.push(`/budgets/${budget.id}`)
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push(`/budgets/${budget.id}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">
              FY {budget.fiscalYear} Budget
            </h1>
            <p className="text-sm text-muted-foreground">
              Total:{' '}
              <span className="font-mono font-semibold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(totalBudget)}
              </span>
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              isDraft
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                : 'bg-green-100 text-green-800 border-green-200'
            }
          >
            {isDraft ? 'Draft' : 'Approved'}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => setAddDialogOpen(true)}
            data-testid="add-line-btn"
          >
            <Plus className="mr-2 h-4 w-4" />
            Add Line
          </Button>
          {isDraft && (
            <Button onClick={handleApprove} data-testid="approve-budget-btn">
              <CheckCircle className="mr-2 h-4 w-4" />
              Approve Budget
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4">
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Account Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="REVENUE">Revenue</SelectItem>
            <SelectItem value="EXPENSE">Expense</SelectItem>
            <SelectItem value="ASSET">Asset</SelectItem>
            <SelectItem value="LIABILITY">Liability</SelectItem>
          </SelectContent>
        </Select>
        <Select value={fundFilter} onValueChange={setFundFilter}>
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
      </div>

      {/* Budget Lines Table */}
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[100px]">Code</TableHead>
              <TableHead className="w-[180px]">Account</TableHead>
              <TableHead className="w-[120px]">Fund</TableHead>
              <TableHead className="w-[130px]">Annual Amount</TableHead>
              <TableHead className="w-[130px]">Spread</TableHead>
              <TableHead>Monthly Amounts</TableHead>
              <TableHead className="w-[60px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredLines.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  No budget lines. Click &quot;Add Line&quot; to start entering budget amounts.
                </TableCell>
              </TableRow>
            ) : (
              filteredLines.map((line) => (
                <TableRow key={line.id}>
                  <TableCell className="font-mono text-sm">{line.accountCode}</TableCell>
                  <TableCell className="text-sm">{line.accountName}</TableCell>
                  <TableCell className="text-sm">{line.fundName}</TableCell>
                  <TableCell>
                    <Input
                      type="number"
                      step="0.01"
                      value={Number(line.annualAmount)}
                      onChange={(e) =>
                        handleAnnualAmountChange(line.id, e.target.value, line.spreadMethod)
                      }
                      className="h-8 w-[120px] font-mono text-sm [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      data-testid={`annual-amount-${line.id}`}
                    />
                    {saving === line.id && (
                      <span className="text-xs text-muted-foreground">Saving...</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <SpreadModeSelector
                      value={line.spreadMethod}
                      onChange={(method) =>
                        handleSpreadMethodChange(line.id, method, Number(line.annualAmount))
                      }
                    />
                  </TableCell>
                  <TableCell>
                    <MonthlyAmountsEditor
                      amounts={line.monthlyAmounts as number[]}
                      onChange={(amounts) => handleMonthlyAmountsChange(line.id, amounts)}
                      lockedMonths={isDraft ? 0 : currentMonth}
                      editable={line.spreadMethod === 'CUSTOM'}
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteLine(line.id)}
                      className="h-8 w-8 text-destructive"
                      data-testid={`delete-line-${line.id}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Add Line Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Budget Line</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Account</label>
              <AccountSelector
                accounts={accounts}
                value={newAccountId}
                onSelect={setNewAccountId}
                testId="add-line-account"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Fund</label>
              <FundSelector
                funds={funds}
                value={newFundId}
                onSelect={setNewFundId}
                testId="add-line-fund"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddLine}
              disabled={!newAccountId || !newFundId}
              data-testid="confirm-add-line-btn"
            >
              Add Line
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
