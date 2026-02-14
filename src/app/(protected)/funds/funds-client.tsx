'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DataTable } from '@/components/shared/data-table'
import { fundColumns } from './columns'
import { CreateFundDialog } from './create-fund-dialog'
import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'
import type { FundWithBalance } from './actions'

interface FundsClientProps {
  initialFunds: FundWithBalance[]
}

export function FundsClient({ initialFunds }: FundsClientProps) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <div className="space-y-4">
      <CopilotContextSetter pageId="funds" />
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Funds</h1>
        <Button onClick={() => setCreateOpen(true)} data-testid="create-fund-btn">
          <Plus className="mr-2 h-4 w-4" />
          Create Fund
        </Button>
      </div>

      <DataTable
        columns={fundColumns}
        data={initialFunds}
        onRowClick={(row) => router.push(`/funds/${row.id}`)}
        initialSorting={[{ id: 'name', desc: false }]}
        emptyMessage="No funds found."
        testIdPrefix="funds"
      />

      <CreateFundDialog open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}
