'use client'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

const MONTH_LABELS = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

interface MonthlyAmountsEditorProps {
  amounts: number[]
  onChange: (amounts: number[]) => void
  lockedMonths?: number // Months 1..lockedMonths are locked (1-indexed)
  editable?: boolean
  testId?: string
}

export function MonthlyAmountsEditor({
  amounts,
  onChange,
  lockedMonths = 0,
  editable = true,
  testId = 'monthly-amounts',
}: MonthlyAmountsEditorProps) {
  const handleChange = (index: number, value: string) => {
    const num = value === '' ? 0 : parseFloat(value)
    if (isNaN(num)) return
    const updated = [...amounts]
    updated[index] = Math.round(num * 100) / 100
    onChange(updated)
  }

  return (
    <div className="grid grid-cols-12 gap-1" data-testid={testId}>
      {MONTH_LABELS.map((label, i) => {
        const isLocked = i + 1 <= lockedMonths
        return (
          <div key={label} className="text-center">
            <div className="text-[10px] text-muted-foreground mb-0.5">{label}</div>
            <Input
              type="number"
              step="0.01"
              value={amounts[i] ?? 0}
              onChange={(e) => handleChange(i, e.target.value)}
              disabled={!editable || isLocked}
              className={cn(
                'h-7 text-xs text-center px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                isLocked && 'bg-muted text-muted-foreground'
              )}
              data-testid={`${testId}-${i}`}
            />
          </div>
        )
      })}
    </div>
  )
}
