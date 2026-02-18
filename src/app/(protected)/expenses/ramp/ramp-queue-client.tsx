'use client'

import { useState, useTransition, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { RefreshCw, Tag, History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
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
import { triggerRampSync } from './actions'
import { toast } from 'sonner'
import type { RampTransactionRow, RampStats } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface RampQueueClientProps {
  initialTransactions: RampTransactionRow[]
  stats: RampStats
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
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
      />
    </div>
  )
}
