'use client'

import { useState, useTransition } from 'react'
import { Play } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { toast } from 'sonner'
import { stagingColumns } from './columns'
import { triggerStagingProcessor } from './actions'
import type { StagingRecordWithRelations } from '@/lib/staging/queries'
import type { StagingSourceApp, StagingStatus } from '@/lib/validators/staging-records'

interface StagingTableProps {
  initialRecords: StagingRecordWithRelations[]
  counts: Record<string, number>
}

export function StagingTable({ initialRecords, counts }: StagingTableProps) {
  const [statusFilter, setStatusFilter] = useState('')
  const [sourceFilter, setSourceFilter] = useState('')
  const [isPending, startTransition] = useTransition()

  const filtered = initialRecords.filter((record) => {
    if (statusFilter && record.status !== statusFilter) return false
    if (sourceFilter && record.sourceApp !== sourceFilter) return false
    return true
  })

  const totalCount = Object.values(counts).reduce((a, b) => a + b, 0)

  function handleRunProcessor() {
    startTransition(async () => {
      try {
        const result = await triggerStagingProcessor()
        toast.success('Processor completed', {
          description: `Processed ${result.processed} records: ${result.expenseReportsPosted} expense reports posted, ${result.timesheetsReceived} timesheets acknowledged.${result.errors.length > 0 ? ` ${result.errors.length} errors.` : ''}`,
        })
      } catch (err) {
        toast.error('Processor failed', {
          description: err instanceof Error ? err.message : 'Unknown error',
        })
      }
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            Staging Records
          </h1>
          <p className="text-muted-foreground text-sm">
            {totalCount} total records
            {counts.received ? ` — ${counts.received} pending` : ''}
          </p>
        </div>
        <Button
          onClick={handleRunProcessor}
          disabled={isPending}
          data-testid="run-processor-btn"
        >
          <Play className="mr-2 h-4 w-4" />
          {isPending ? 'Processing...' : 'Run Processor'}
        </Button>
      </div>

      <div className="flex items-center gap-4">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="staging-status-filter"
          >
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Statuses</SelectItem>
            <SelectItem value="received">Received</SelectItem>
            <SelectItem value="posted">Posted</SelectItem>
            <SelectItem value="matched_to_payment">Matched</SelectItem>
            <SelectItem value="paid">Paid</SelectItem>
          </SelectContent>
        </Select>

        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="staging-source-filter"
          >
            <SelectValue placeholder="All Sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">All Sources</SelectItem>
            <SelectItem value="timesheets">Timesheets</SelectItem>
            <SelectItem value="expense_reports">Expense Reports</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={stagingColumns}
        data={filtered}
        initialSorting={[{ id: 'createdAt', desc: true }]}
        emptyMessage="No staging records found."
        testIdPrefix="staging"
      />
    </div>
  )
}
