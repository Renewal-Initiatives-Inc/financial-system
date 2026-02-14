'use client'

import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DataTable } from '@/components/shared/data-table'
import { DataTableColumnHeader } from '@/components/shared/data-table-column-header'
import type { ColumnDef } from '@tanstack/react-table'
import type { BudgetRow } from '@/lib/budget/queries'

type BudgetListRow = BudgetRow & { totalAmount: string }

const columns: ColumnDef<BudgetListRow, unknown>[] = [
  {
    accessorKey: 'fiscalYear',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Fiscal Year" />
    ),
    cell: ({ row }) => (
      <span className="font-semibold">FY {row.getValue('fiscalYear')}</span>
    ),
  },
  {
    accessorKey: 'status',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Status" />
    ),
    cell: ({ row }) => {
      const status = row.getValue('status') as string
      return (
        <Badge
          variant="outline"
          className={
            status === 'APPROVED'
              ? 'bg-green-100 text-green-800 border-green-200'
              : 'bg-yellow-100 text-yellow-800 border-yellow-200'
          }
        >
          {status === 'APPROVED' ? 'Approved' : 'Draft'}
        </Badge>
      )
    },
  },
  {
    accessorKey: 'totalAmount',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Total Budget" />
    ),
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalAmount'))
      return (
        <span className="font-mono">
          {new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
          }).format(amount)}
        </span>
      )
    },
  },
  {
    accessorKey: 'createdBy',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created By" />
    ),
  },
  {
    accessorKey: 'createdAt',
    header: ({ column }) => (
      <DataTableColumnHeader column={column} title="Created" />
    ),
    cell: ({ row }) => {
      const date = new Date(row.getValue('createdAt'))
      return date.toLocaleDateString()
    },
  },
]

interface BudgetsClientProps {
  initialBudgets: BudgetListRow[]
}

export function BudgetsClient({ initialBudgets }: BudgetsClientProps) {
  const router = useRouter()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Budgets</h1>
        <Button
          onClick={() => router.push('/budgets/new')}
          data-testid="new-budget-btn"
        >
          <Plus className="mr-2 h-4 w-4" />
          New Budget
        </Button>
      </div>

      <DataTable
        columns={columns}
        data={initialBudgets}
        onRowClick={(row) => router.push(`/budgets/${row.id}`)}
        emptyMessage="No budgets yet. Create your first budget to get started."
        testIdPrefix="budgets"
      />
    </div>
  )
}
