'use client'

import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface CipCostCode {
  id: number
  code: string
  name: string
  category: string
  isActive: boolean
  sortOrder: number
}

interface CipCostCodeSelectorProps {
  costCodes: CipCostCode[]
  value: number | null
  onSelect: (costCodeId: number | null) => void
  disabled?: boolean
  testId?: string
}

export function CipCostCodeSelector({
  costCodes,
  value,
  onSelect,
  disabled = false,
  testId = 'cip-cost-code-selector',
}: CipCostCodeSelectorProps) {
  const activeCodes = costCodes
    .filter((c) => c.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder)

  const hardCosts = activeCodes.filter((c) => c.category === 'HARD_COST')
  const softCosts = activeCodes.filter((c) => c.category === 'SOFT_COST')

  return (
    <Select
      value={value?.toString() ?? ''}
      onValueChange={(v) => onSelect(v ? parseInt(v, 10) : null)}
      disabled={disabled}
    >
      <SelectTrigger data-testid={testId} className="w-full">
        <SelectValue placeholder="Select cost code (optional)" />
      </SelectTrigger>
      <SelectContent>
        {hardCosts.length > 0 && (
          <SelectGroup>
            <SelectLabel>Hard Costs</SelectLabel>
            {hardCosts.map((code) => (
              <SelectItem key={code.id} value={code.id.toString()}>
                <span className="font-mono text-xs mr-2">{code.code}</span>
                {code.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
        {softCosts.length > 0 && (
          <SelectGroup>
            <SelectLabel>Soft Costs</SelectLabel>
            {softCosts.map((code) => (
              <SelectItem key={code.id} value={code.id.toString()}>
                <span className="font-mono text-xs mr-2">{code.code}</span>
                {code.name}
              </SelectItem>
            ))}
          </SelectGroup>
        )}
      </SelectContent>
    </Select>
  )
}
