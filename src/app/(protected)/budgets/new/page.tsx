'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
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
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { toast } from 'sonner'
import { createBudgetAction } from '../actions'

const currentYear = new Date().getFullYear()
const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear + i)

export default function NewBudgetPage() {
  const router = useRouter()
  const [fiscalYear, setFiscalYear] = useState<string>('')
  const [loading, setLoading] = useState(false)

  async function handleCreate() {
    if (!fiscalYear) return
    setLoading(true)

    const result = await createBudgetAction(parseInt(fiscalYear), 'system')

    if ('error' in result) {
      toast.error(result.error)
      setLoading(false)
      return
    }

    toast.success(`Budget for FY ${fiscalYear} created`)
    router.push(`/budgets/${result.id}/edit`)
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
        <CardContent>
          <div className="space-y-2">
            <label className="text-sm font-medium">Fiscal Year</label>
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
