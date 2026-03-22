'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, BookOpen, Lock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DataTable } from '@/components/shared/data-table'
import { accountColumns } from './columns'
import { CreateAccountDialog } from './create-account-dialog'
import { AccountTree } from './account-tree'
import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'
import type { AccountRowWithBalance } from './actions'

interface AccountsClientProps {
  initialAccounts: AccountRowWithBalance[]
}

export function AccountsClient({ initialAccounts }: AccountsClientProps) {
  const router = useRouter()
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [showActive, setShowActive] = useState<'all' | 'active'>('active')
  const [createOpen, setCreateOpen] = useState(false)

  // Client-side filtering (69 accounts is small enough)
  const filtered = initialAccounts.filter((account) => {
    if (typeFilter !== 'all' && account.type !== typeFilter) return false
    if (showActive === 'active' && !account.isActive) return false
    if (search) {
      const q = search.toLowerCase()
      return (
        account.name.toLowerCase().includes(q) ||
        account.code.toLowerCase().includes(q)
      )
    }
    return true
  })

  return (
    <div className="space-y-4">
      <CopilotContextSetter pageId="accounts" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Chart of Accounts
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push('/transactions/new')}
            data-testid="journal-entry-btn"
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Make Journal Entry
          </Button>
          <Button
            variant="outline"
            onClick={() => router.push('/accounts/close-books')}
            data-testid="close-books-btn"
          >
            <Lock className="mr-2 h-4 w-4" />
            Close the Books
          </Button>
          <Button onClick={() => setCreateOpen(true)} data-testid="create-account-btn">
            <Plus className="mr-2 h-4 w-4" />
            Create Account
          </Button>
        </div>
      </div>

      <Tabs defaultValue="table">
        <TabsList>
          <TabsTrigger value="table" data-testid="accounts-tab-table">Table</TabsTrigger>
          <TabsTrigger value="tree" data-testid="accounts-tab-tree">Tree</TabsTrigger>
        </TabsList>

        <TabsContent value="table" className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              placeholder="Search accounts..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-sm"
              data-testid="accounts-search-input"
            />
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[180px]" data-testid="accounts-type-filter">
                <SelectValue placeholder="All Types" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="ASSET">Asset</SelectItem>
                <SelectItem value="LIABILITY">Liability</SelectItem>
                <SelectItem value="NET_ASSET">Retained Earnings</SelectItem>
                <SelectItem value="REVENUE">Revenue</SelectItem>
                <SelectItem value="EXPENSE">Expense</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={showActive}
              onValueChange={(v) => setShowActive(v as 'all' | 'active')}
            >
              <SelectTrigger className="w-[140px]" data-testid="accounts-active-filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active Only</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <DataTable
            columns={accountColumns}
            data={filtered}
            onRowClick={(row) => router.push(`/accounts/${row.id}`)}
            initialSorting={[{ id: 'code', desc: false }]}
            emptyMessage="No accounts found."
            testIdPrefix="accounts"
          />
        </TabsContent>

        <TabsContent value="tree">
          <AccountTree accounts={initialAccounts} />
        </TabsContent>
      </Tabs>

      <CreateAccountDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        existingAccounts={initialAccounts}
      />
    </div>
  )
}
