'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface SpreadModeSelectorProps {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  testId?: string
}

const spreadMethods = [
  { value: 'EVEN', label: 'Even' },
  { value: 'SEASONAL', label: 'Seasonal' },
  { value: 'ONE_TIME', label: 'One-Time' },
  { value: 'CUSTOM', label: 'Custom' },
]

export function SpreadModeSelector({
  value,
  onChange,
  disabled = false,
  testId = 'spread-mode-selector',
}: SpreadModeSelectorProps) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-[130px]" data-testid={testId}>
        <SelectValue placeholder="Spread..." />
      </SelectTrigger>
      <SelectContent>
        {spreadMethods.map((method) => (
          <SelectItem key={method.value} value={method.value}>
            {method.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
