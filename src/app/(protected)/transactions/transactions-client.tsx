'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { DataTable } from '@/components/shared/data-table'
import { transactionColumns } from './columns'
import { getTransactions } from './actions'
import type { TransactionListRow } from './actions'

interface TransactionsClientProps {
  initialRows: TransactionListRow[]
}

export function TransactionsClient({
  initialRows,
}: TransactionsClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const [rows, setRows] = useState(initialRows)
  const [search, setSearch] = useState('')
  const [includeVoided, setIncludeVoided] = useState(false)

  const refetch = (overrides: {
    search?: string
    includeVoided?: boolean
  } = {}) => {
    const s = overrides.search ?? search
    const v = overrides.includeVoided ?? includeVoided

    startTransition(async () => {
      const result = await getTransactions({
        search: s || undefined,
        includeVoided: v,
        pageSize: 0,
      })
      setRows(result.rows)
    })
  }

  const handleSearchChange = (value: string) => {
    setSearch(value)
    refetch({ search: value })
  }

  const handleVoidedToggle = (checked: boolean) => {
    setIncludeVoided(checked)
    refetch({ includeVoided: checked })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
        <Button
          onClick={() => router.push('/transactions/new')}
          data-testid="new-entry-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Entry
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search transactions..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
          className="max-w-sm"
          data-testid="txn-search-input"
        />
        <div className="flex items-center gap-2">
          <Switch
            id="show-voided"
            checked={includeVoided}
            onCheckedChange={handleVoidedToggle}
            data-testid="txn-show-voided"
          />
          <Label htmlFor="show-voided" className="text-sm">
            Include voided
          </Label>
        </div>
        {isPending && (
          <span className="text-sm text-muted-foreground">Loading...</span>
        )}
      </div>

      <DataTable
        columns={transactionColumns}
        data={rows}
        onRowClick={(row) => router.push(`/transactions/${row.id}`)}
        initialSorting={[{ id: 'date', desc: true }]}
        emptyMessage="No transactions found. Create your first journal entry."
        testIdPrefix="transactions"
      />
    </div>
  )
}
