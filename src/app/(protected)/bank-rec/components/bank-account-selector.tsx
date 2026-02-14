'use client'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { BankAccountOption } from '../actions'

interface BankAccountSelectorProps {
  accounts: BankAccountOption[]
  value: string
  onValueChange: (value: string) => void
}

export function BankAccountSelector({
  accounts,
  value,
  onValueChange,
}: BankAccountSelectorProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className="w-[280px]" data-testid="bank-account-selector">
        <SelectValue placeholder="Select bank account" />
      </SelectTrigger>
      <SelectContent>
        {accounts.map((account) => (
          <SelectItem key={account.id} value={String(account.id)}>
            {account.name} ({account.institution} ****{account.last4})
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
