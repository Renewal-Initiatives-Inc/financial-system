'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  type ColumnFiltersState,
} from '@tanstack/react-table'
import { purchaseOrderColumns } from './columns'
import type { PurchaseOrderRow } from '../actions'

interface POListClientProps {
  purchaseOrders: PurchaseOrderRow[]
  vendors: { id: number; name: string }[]
  funds: { id: number; name: string }[]
}

export function POListClient({
  purchaseOrders,
  vendors,
  funds,
}: POListClientProps) {
  const router = useRouter()
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'createdAt', desc: true },
  ])
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([])
  const [search, setSearch] = useState('')

  const table = useReactTable({
    data: purchaseOrders,
    columns: purchaseOrderColumns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    state: { sorting, columnFilters, globalFilter: search },
    onGlobalFilterChange: setSearch,
    initialState: { pagination: { pageSize: 25 } },
    globalFilterFn: (row, _columnId, filterValue) => {
      const q = String(filterValue).toLowerCase()
      const po = row.original
      return (
        `PO-${po.id}`.toLowerCase().includes(q) ||
        po.vendorName.toLowerCase().includes(q) ||
        po.description.toLowerCase().includes(q) ||
        po.accountCode.toLowerCase().includes(q) ||
        po.accountName.toLowerCase().includes(q)
      )
    },
  })

  const handleVendorFilter = (value: string) => {
    table.getColumn('vendorName')?.setFilterValue(value === 'all' ? undefined : value)
  }

  const handleStatusFilter = (value: string) => {
    table.getColumn('status')?.setFilterValue(value === 'all' ? undefined : value)
  }

  const handleFundFilter = (value: string) => {
    table.getColumn('fundName')?.setFilterValue(value === 'all' ? undefined : value)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Purchase Orders
        </h1>
        <Button asChild data-testid="po-new-btn">
          <Link href="/expenses/purchase-orders/new">
            <Plus className="mr-2 h-4 w-4" />
            New Purchase Order
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-4 flex-wrap">
        <Input
          placeholder="Search PO#, vendor, description..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
          data-testid="po-search-input"
        />
        <Select onValueChange={handleVendorFilter} defaultValue="all">
          <SelectTrigger className="w-[180px]" data-testid="po-vendor-filter">
            <SelectValue placeholder="All Vendors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Vendors</SelectItem>
            {vendors.map((v) => (
              <SelectItem key={v.id} value={String(v.id)}>
                {v.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select onValueChange={handleStatusFilter} defaultValue="all">
          <SelectTrigger className="w-[160px]" data-testid="po-status-filter">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="COMPLETED">Completed</SelectItem>
            <SelectItem value="CANCELLED">Cancelled</SelectItem>
          </SelectContent>
        </Select>
        <Select onValueChange={handleFundFilter} defaultValue="all">
          <SelectTrigger className="w-[180px]" data-testid="po-fund-filter">
            <SelectValue placeholder="All Funding Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Funding Sources</SelectItem>
            {funds.map((f) => (
              <SelectItem key={f.id} value={String(f.id)}>
                {f.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div data-testid="po-table">
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
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() =>
                      router.push(
                        `/expenses/purchase-orders/${row.original.id}`
                      )
                    }
                    data-testid={`po-table-row-${row.index}`}
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
                    colSpan={purchaseOrderColumns.length}
                    className="h-24 text-center"
                    data-testid="po-table-empty"
                  >
                    No purchase orders found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DataTablePagination table={table} testIdPrefix="po" />
      </div>
    </div>
  )
}
