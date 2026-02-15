'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { toast } from 'sonner'
import { createBudgetAction, getBudgetListAction, copyBudgetFromPriorYearAction } from '../actions'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i)

export default function NewBudgetPage() {
  const router = useRouter()
  const [fiscalYear, setFiscalYear] = useState<string>('')
  const [mode, setMode] = useState<'blank' | 'copy'>('blank')
  const [adjustmentPercent, setAdjustmentPercent] = useState(0)
  const [priorBudgets, setPriorBudgets] = useState<{ id: number; fiscalYear: number; totalAmount: string }[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    getBudgetListAction().then((budgets) => {
      setPriorBudgets(budgets.map((b) => ({ id: b.id, fiscalYear: b.fiscalYear, totalAmount: b.totalAmount })))
    })
  }, [])

  const selectedYear = fiscalYear ? parseInt(fiscalYear) : null
  const priorYearBudget = selectedYear
    ? priorBudgets.find((b) => b.fiscalYear === selectedYear - 1)
    : null

  async function handleCreate() {
    if (!fiscalYear) return
    setLoading(true)

    if (mode === 'copy' && priorYearBudget) {
      const result = await copyBudgetFromPriorYearAction(
        priorYearBudget.id,
        parseInt(fiscalYear),
        adjustmentPercent
      )
      if ('error' in result) {
        toast.error(result.error)
        setLoading(false)
        return
      }
      toast.success(`Budget for FY ${fiscalYear} created from FY ${priorYearBudget.fiscalYear}`)
      router.push(`/budgets/${result.id}/edit`)
    } else {
      const result = await createBudgetAction(parseInt(fiscalYear))
      if ('error' in result) {
        toast.error(result.error)
        setLoading(false)
        return
      }
      toast.success(`Budget for FY ${fiscalYear} created`)
      router.push(`/budgets/${result.id}/edit`)
    }
  }

  return (
    <div className="max-w-md mx-auto mt-8">
      <Card>
        <CardHeader>
          <CardTitle>Create New Budget</CardTitle>
          <CardDescription>
            Start a new annual budget. Only one budget per fiscal year is allowed.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Fiscal Year</Label>
            <Select value={fiscalYear} onValueChange={setFiscalYear}>
              <SelectTrigger data-testid="fiscal-year-select">
                <SelectValue placeholder="Select fiscal year..." />
              </SelectTrigger>
              <SelectContent>
                {yearOptions.map((year) => (
                  <SelectItem key={year} value={year.toString()}>
                    FY {year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {selectedYear && priorYearBudget && (
            <div className="space-y-3">
              <Label>Starting Point</Label>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as 'blank' | 'copy')}
                data-testid="budget-mode-select"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="blank" id="blank" />
                  <Label htmlFor="blank" className="font-normal">Start blank</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="copy" id="copy" />
                  <Label htmlFor="copy" className="font-normal flex items-center gap-1">
                    <Copy className="h-3.5 w-3.5" />
                    Copy from FY {priorYearBudget.fiscalYear} budget
                    <span className="text-muted-foreground ml-1">
                      (${Number(priorYearBudget.totalAmount).toLocaleString()})
                    </span>
                  </Label>
                </div>
              </RadioGroup>

              {mode === 'copy' && (
                <div className="ml-6 space-y-2">
                  <Label>Adjustment (%)</Label>
                  <div className="flex items-center gap-3">
                    <Input
                      type="number"
                      min={-50}
                      max={50}
                      step={1}
                      value={adjustmentPercent}
                      onChange={(e) => setAdjustmentPercent(Number(e.target.value))}
                      className="w-24 font-mono"
                      data-testid="adjustment-percent"
                    />
                    <span className="text-sm text-muted-foreground">
                      {adjustmentPercent >= 0 ? '+' : ''}{adjustmentPercent}% from prior year
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
        <CardFooter className="flex justify-between">
          <Button variant="outline" onClick={() => router.push('/budgets')}>
            Cancel
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!fiscalYear || loading}
            data-testid="create-budget-btn"
          >
            {loading ? 'Creating...' : 'Create Budget'}
          </Button>
        </CardFooter>
      </Card>
    </div>
  )
}
