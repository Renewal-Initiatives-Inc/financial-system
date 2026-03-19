'use client'

import { useState, useTransition, useMemo, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Tag, History, Sparkles, CheckCircle2, Clock, Hand } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { SummaryCard } from '@/components/smart-dashboard/summary-card'
import { StatusBadge } from '@/components/smart-dashboard/status-badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { DataTablePagination } from '@/components/shared/data-table-pagination'
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type RowSelectionState,
} from '@tanstack/react-table'
import { rampColumns } from './columns'
import { CategorizeDialog } from './categorize-dialog'
import { BulkCategorizeDialog } from './bulk-categorize-dialog'
import {
  triggerRampSync,
  getAiCategorization,
  batchAiCategorize,
  categorizeRampTransaction,
} from './actions'
import { toast } from 'sonner'
import type { RampTransactionRow, RampStats, AiSuggestion } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface RampQueueClientProps {
  initialTransactions: RampTransactionRow[]
  stats: RampStats
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
}

const formatCurrency = (amount: string | number) => {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Math.abs(num))
}

export function RampQueueClient({
  initialTransactions,
  stats,
  accounts,
  funds,
}: RampQueueClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [tab, setTab] = useState('uncategorized')
  const [search, setSearch] = useState('')
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'date', desc: true },
  ])
  const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
  const [categorizeOpen, setCategorizeOpen] = useState(false)
  const [bulkCategorizeOpen, setBulkCategorizeOpen] = useState(false)
  const [selectedTransaction, setSelectedTransaction] =
    useState<RampTransactionRow | null>(null)

  // AI suggestion state
  const [aiSuggestions, setAiSuggestions] = useState<Record<number, AiSuggestion>>({})
  const [loadingAi, setLoadingAi] = useState<Set<number>>(new Set())
  const [suggestingAll, setSuggestingAll] = useState(false)

  const filtered = useMemo(() => {
    let data = initialTransactions
    if (tab === 'pending') {
      data = data.filter((t) => t.isPending)
    } else if (tab !== 'all') {
      data = data.filter((t) => !t.isPending && t.status === tab)
    }
    if (search) {
      const q = search.toLowerCase()
      data = data.filter(
        (t) =>
          t.merchantName.toLowerCase().includes(q) ||
          t.cardholder.toLowerCase().includes(q) ||
          (t.description && t.description.toLowerCase().includes(q))
      )
    }
    return data
  }, [initialTransactions, tab, search])

  const table = useReactTable({
    data: filtered,
    columns: rampColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onRowSelectionChange: setRowSelection,
    state: { sorting, rowSelection },
    initialState: { pagination: { pageSize: 25 } },
    enableRowSelection: (row) => !row.original.isPending && row.original.status === 'uncategorized',
  })

  const selectedIds = table
    .getSelectedRowModel()
    .rows.map((r) => r.original.id)

  const handleSync = (fullHistory = false) => {
    startTransition(async () => {
      try {
        const result = await triggerRampSync(fullHistory ? { fullHistory: true } : undefined)
        if (fullHistory) {
          toast.success(
            `Full history sync: ${result.synced} transactions imported (uncategorized)`
          )
        } else {
          toast.success(
            `Synced ${result.synced} transactions, ${result.autoCategorized} auto-categorized`
          )
        }
        setRowSelection({})
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        }
      }
    })
  }

  const handleCategorize = (row: RampTransactionRow) => {
    if (row.isPending || row.status !== 'uncategorized') return
    setSelectedTransaction(row)
    setCategorizeOpen(true)
  }

  const handleAcceptAi = useCallback(
    (txn: RampTransactionRow, suggestion: AiSuggestion, createRule: boolean) => {
      startTransition(async () => {
        try {
          await categorizeRampTransaction(
            {
              rampTransactionId: txn.id,
              glAccountId: suggestion.accountId,
              fundId: suggestion.fundId,
              createRule,
            },
            {
              accountId: suggestion.accountId,
              fundId: suggestion.fundId,
              confidence: suggestion.confidence,
            }
          )
          toast.success('AI suggestion accepted and posted to GL')
          router.refresh()
        } catch (err) {
          toast.error(err instanceof Error ? err.message : 'Accept failed')
        }
      })
    },
    [router] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const handleSuggestAll = async () => {
    const uncategorized = initialTransactions.filter(
      (t) => !t.isPending && t.status === 'uncategorized' && !aiSuggestions[t.id]
    )
    if (uncategorized.length === 0) return

    setSuggestingAll(true)
    const ids = uncategorized.map((t) => t.id)
    setLoadingAi(new Set(ids))

    try {
      const results = await batchAiCategorize(ids)
      setAiSuggestions((prev) => ({ ...prev, ...results }))
      const count = Object.keys(results).length
      toast.success(`AI suggested ${count} categorization${count !== 1 ? 's' : ''}`)
    } catch {
      toast.error('AI suggestion failed')
    } finally {
      setLoadingAi(new Set())
      setSuggestingAll(false)
    }
  }

  // Fetch AI suggestion for a single transaction
  const fetchAiSuggestion = async (txnId: number) => {
    setLoadingAi((prev) => new Set([...prev, txnId]))
    try {
      const suggestion = await getAiCategorization(txnId)
      if (suggestion) {
        setAiSuggestions((prev) => ({ ...prev, [txnId]: suggestion }))
      }
    } finally {
      setLoadingAi((prev) => {
        const next = new Set(prev)
        next.delete(txnId)
        return next
      })
    }
  }

  const uncategorizedWithAi = filtered.filter(
    (t) => !t.isPending && t.status === 'uncategorized' && aiSuggestions[t.id]
  )
  const uncategorizedWithoutAi = filtered.filter(
    (t) => !t.isPending && t.status === 'uncategorized' && !aiSuggestions[t.id]
  )

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Ramp Credit Card
        </h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => handleSync(true)}
            disabled={isPending}
            data-testid="ramp-full-sync-btn"
          >
            <History
              className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
            />
            Full History Sync
          </Button>
          <Button
            variant="outline"
            onClick={() => handleSync(false)}
            disabled={isPending}
            data-testid="ramp-sync-btn"
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isPending ? 'animate-spin' : ''}`}
            />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4" data-testid="ramp-summary-cards">
        <SummaryCard
          icon={CheckCircle2}
          label="Auto-Categorized"
          count={stats.autoCategorized}
          variant="success"
          testId="ramp-auto-categorized-card"
        />
        <SummaryCard
          icon={Sparkles}
          label="AI Suggested"
          count={uncategorizedWithAi.length}
          variant="info"
          testId="ramp-ai-suggested-card"
        />
        <SummaryCard
          icon={Hand}
          label="Manual Required"
          count={uncategorizedWithoutAi.length}
          variant="warning"
          testId="ramp-manual-required-card"
        />
        <SummaryCard
          icon={Clock}
          label="Posted Today"
          count={stats.postedToday}
          variant="info"
          testId="ramp-posted-today-card"
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => { setTab(v); setRowSelection({}) }}>
        <TabsList>
          <TabsTrigger value="uncategorized" data-testid="ramp-tab-uncategorized">
            Uncategorized
            {stats.uncategorized > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.uncategorized}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categorized" data-testid="ramp-tab-categorized">
            Categorized
          </TabsTrigger>
          <TabsTrigger value="posted" data-testid="ramp-tab-posted">
            Posted
          </TabsTrigger>
          <TabsTrigger value="pending" data-testid="ramp-tab-pending">
            Pending
            {stats.pending > 0 && (
              <Badge variant="secondary" className="ml-2">
                {stats.pending}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="ramp-tab-all">
            All
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <div className="flex items-center gap-4">
        <Input
          placeholder="Search merchant, cardholder..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="ramp-search-input"
        />
        {tab === 'uncategorized' && stats.uncategorized > 0 && (
          <Button
            variant="outline"
            onClick={handleSuggestAll}
            disabled={suggestingAll || isPending}
            data-testid="ramp-suggest-all-btn"
          >
            <Sparkles className={`mr-2 h-4 w-4 ${suggestingAll ? 'animate-pulse' : ''}`} />
            {suggestingAll ? 'Suggesting...' : 'Suggest All'}
          </Button>
        )}
        {selectedIds.length > 0 && (
          <Button
            onClick={() => setBulkCategorizeOpen(true)}
            data-testid="ramp-bulk-categorize-btn"
          >
            <Tag className="mr-2 h-4 w-4" />
            Categorize Selected ({selectedIds.length})
          </Button>
        )}
      </div>

      {/* AI Suggestions Section (shown in uncategorized tab) */}
      {tab === 'uncategorized' && uncategorizedWithAi.length > 0 && (
        <Card data-testid="ramp-ai-suggestions-section">
          <CardContent className="pt-4">
            <p className="text-sm font-medium mb-3">
              AI Suggestions ({uncategorizedWithAi.length})
            </p>
            <div className="space-y-2">
              {uncategorizedWithAi.map((txn) => {
                const suggestion = aiSuggestions[txn.id]
                if (!suggestion) return null
                return (
                  <div
                    key={txn.id}
                    className="flex items-center justify-between border rounded-lg p-3"
                    data-testid={`ramp-ai-suggestion-${txn.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-sm">
                        <span className="font-medium truncate">
                          {formatCurrency(txn.amount)} {txn.merchantName}
                        </span>
                        <span className="text-muted-foreground">{txn.date}</span>
                        <span className="text-muted-foreground">{txn.cardholder}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <Sparkles className="h-3 w-3 text-purple-500" />
                        <span>
                          Suggested: {suggestion.accountName}, {suggestion.fundName}
                        </span>
                        <StatusBadge type="confidence" value={suggestion.confidence} />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        &ldquo;{suggestion.reasoning}&rdquo;
                      </p>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Button
                        size="sm"
                        onClick={() => handleAcceptAi(txn, suggestion, false)}
                        disabled={isPending}
                        data-testid={`ramp-accept-ai-btn-${txn.id}`}
                      >
                        Accept
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCategorize(txn)}
                        data-testid={`ramp-override-ai-btn-${txn.id}`}
                      >
                        Override
                      </Button>
                      <label className="flex items-center gap-1 text-xs text-muted-foreground whitespace-nowrap">
                        <input
                          type="checkbox"
                          className="h-3 w-3 rounded border-gray-300"
                          onChange={(e) => {
                            if (e.target.checked) {
                              handleAcceptAi(txn, suggestion, true)
                            }
                          }}
                          data-testid={`ramp-create-rule-${txn.id}`}
                        />
                        Create Rule
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div data-testid="ramp-table">
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <TableHead key={header.id}>
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext()
                          )}
                    </TableHead>
                  ))}
                </TableRow>
              ))}
            </TableHeader>
            <TableBody>
              {table.getRowModel().rows?.length ? (
                table.getRowModel().rows.map((row) => (
                  <TableRow
                    key={row.id}
                    data-state={row.getIsSelected() && 'selected'}
                    className={
                      row.original.isPending
                        ? 'opacity-60'
                        : row.original.status === 'uncategorized'
                          ? 'cursor-pointer hover:bg-muted/50'
                          : ''
                    }
                    onClick={() => handleCategorize(row.original)}
                    data-testid={`ramp-table-row-${row.index}`}
                  >
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext()
                        )}
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={rampColumns.length}
                    className="h-24 text-center"
                    data-testid="ramp-table-empty"
                  >
                    No transactions found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} testIdPrefix="ramp" />
      </div>

      <CategorizeDialog
        open={categorizeOpen}
        onClose={() => {
          setCategorizeOpen(false)
          setSelectedTransaction(null)
          setRowSelection({})
        }}
        transaction={selectedTransaction}
        accounts={accounts}
        funds={funds}
        aiSuggestion={selectedTransaction ? aiSuggestions[selectedTransaction.id] ?? null : null}
      />

      <BulkCategorizeDialog
        open={bulkCategorizeOpen}
        onClose={() => {
          setBulkCategorizeOpen(false)
          setRowSelection({})
        }}
        selectedIds={selectedIds}
        accounts={accounts}
        funds={funds}
        aiSuggestions={aiSuggestions}
      />
    </div>
  )
}
