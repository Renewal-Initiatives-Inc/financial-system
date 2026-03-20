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

export type AccountOption = {
  id: number
  name: string
  code: string
  type: string
}

const TYPE_LABELS: Record<string, string> = {
  ASSET: 'Assets',
  LIABILITY: 'Liabilities',
  NET_ASSET: 'Net Assets',
  REVENUE: 'Revenue',
  EXPENSE: 'Expenses',
}

const TYPE_ORDER = ['ASSET', 'LIABILITY', 'NET_ASSET', 'REVENUE', 'EXPENSE']

interface GroupedAccountSelectProps {
  accounts: AccountOption[]
  value: string
  onValueChange: (value: string) => void
  placeholder?: string
  testId?: string
}

export function GroupedAccountSelect({
  accounts,
  value,
  onValueChange,
  placeholder = 'Select account...',
  testId,
}: GroupedAccountSelectProps) {
  const [open, setOpen] = useState(false)

  // Group accounts by type
  const grouped = TYPE_ORDER
    .map((type) => ({
      type,
      label: TYPE_LABELS[type] ?? type,
      accounts: accounts.filter((a) => a.type === type),
    }))
    .filter((g) => g.accounts.length > 0)

  const selected = accounts.find((a) => String(a.id) === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-full justify-between font-normal"
          data-testid={testId}
        >
          {selected ? (
            <span className="flex items-center gap-2 truncate">
              <span className="font-mono text-xs">{selected.code}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start" onWheel={(e) => e.stopPropagation()}>
        <Command>
          <CommandInput placeholder="Search by code or name..." />
          <CommandList className="max-h-[min(400px,60vh)]">
            <CommandEmpty>No accounts found.</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.type} heading={group.label}>
                {group.accounts.map((a) => (
                  <CommandItem
                    key={a.id}
                    value={`${a.code} ${a.name}`}
                    onSelect={() => {
                      onValueChange(String(a.id))
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === String(a.id) ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-xs mr-2">{a.code}</span>
                    <span className="truncate">{a.name}</span>
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
