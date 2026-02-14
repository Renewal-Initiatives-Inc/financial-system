'use client'

import { useState } from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import { Badge } from '@/components/ui/badge'

interface FundRow {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

interface FundSelectorProps {
  funds: FundRow[]
  value: number | null
  onSelect: (fundId: number | null) => void
  placeholder?: string
  disabled?: boolean
  testId?: string
}

const restrictionBadgeVariant: Record<string, 'default' | 'secondary' | 'outline'> = {
  RESTRICTED: 'default',
  UNRESTRICTED: 'secondary',
}

export function FundSelector({
  funds,
  value,
  onSelect,
  placeholder = 'Select fund...',
  disabled = false,
  testId = 'fund-selector',
}: FundSelectorProps) {
  const [open, setOpen] = useState(false)

  const activeFunds = funds.filter((f) => f.isActive)
  const selected = funds.find((f) => f.id === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          disabled={disabled}
          data-testid={testId}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="truncate">{selected.name}</span>
              <Badge
                variant={restrictionBadgeVariant[selected.restrictionType] ?? 'outline'}
                className={cn(
                  'text-[10px] ml-auto',
                  selected.restrictionType === 'RESTRICTED'
                    ? 'bg-amber-100 text-amber-800 border-amber-200'
                    : 'bg-green-100 text-green-800 border-green-200'
                )}
              >
                {selected.restrictionType === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
              </Badge>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search funds..." />
          <CommandList>
            <CommandEmpty>No funds found.</CommandEmpty>
            <CommandGroup>
              {activeFunds.map((fund) => (
                <CommandItem
                  key={fund.id}
                  value={fund.name}
                  onSelect={() => {
                    onSelect(fund.id === value ? null : fund.id)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      value === fund.id ? 'opacity-100' : 'opacity-0'
                    )}
                  />
                  <span className="truncate">{fund.name}</span>
                  <Badge
                    variant="outline"
                    className={cn(
                      'ml-auto text-[10px]',
                      fund.restrictionType === 'RESTRICTED'
                        ? 'bg-amber-100 text-amber-800 border-amber-200'
                        : 'bg-green-100 text-green-800 border-green-200'
                    )}
                  >
                    {fund.restrictionType === 'RESTRICTED' ? 'Restricted' : 'Unrestricted'}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
