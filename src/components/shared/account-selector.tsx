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
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface AccountSelectorProps {
  accounts: AccountRow[]
  value: number | null
  onSelect: (accountId: number | null) => void
  placeholder?: string
  filterType?: string[]
  disabled?: boolean
  testId?: string
}

const typeLabels: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  NET_ASSET: 'Net Asset',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
}

const typeOrder = ['ASSET', 'LIABILITY', 'NET_ASSET', 'REVENUE', 'EXPENSE']

export function AccountSelector({
  accounts,
  value,
  onSelect,
  placeholder = 'Select account...',
  filterType,
  disabled = false,
  testId = 'account-selector',
}: AccountSelectorProps) {
  const [open, setOpen] = useState(false)

  // Filter: active only, exclude non-postable parent accounts (those that have children),
  // optionally restrict by type
  const postable = accounts.filter((a) => {
    if (!a.isActive) return false
    if (filterType && !filterType.includes(a.type)) return false
    // Exclude parent accounts that have children (non-postable)
    const hasChildren = accounts.some((child) => child.parentAccountId === a.id)
    if (hasChildren) return false
    return true
  })

  // Group by type
  const grouped = typeOrder
    .map((type) => ({
      type,
      label: typeLabels[type],
      accounts: postable.filter((a) => a.type === type),
    }))
    .filter((g) => g.accounts.length > 0)

  const selected = accounts.find((a) => a.id === value)

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
              <span className="font-mono text-xs">{selected.code}</span>
              <span className="truncate">{selected.name}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search by code or name..." />
          <CommandList>
            <CommandEmpty>No accounts found.</CommandEmpty>
            {grouped.map((group) => (
              <CommandGroup key={group.type} heading={group.label}>
                {group.accounts.map((account) => (
                  <CommandItem
                    key={account.id}
                    value={`${account.code} ${account.name}`}
                    onSelect={() => {
                      onSelect(account.id === value ? null : account.id)
                      setOpen(false)
                    }}
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === account.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    <span className="font-mono text-xs mr-2">{account.code}</span>
                    <span className="truncate">{account.name}</span>
                    <Badge variant="outline" className="ml-auto text-[10px]">
                      {typeLabels[account.type]}
                    </Badge>
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
