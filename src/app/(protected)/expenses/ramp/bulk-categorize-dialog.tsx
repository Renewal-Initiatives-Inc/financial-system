'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { AccountSelector } from '@/components/shared/account-selector'
import { FundSelector } from '@/components/shared/fund-selector'
import { bulkCategorizeRampTransactions } from './actions'
import { toast } from 'sonner'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface BulkCategorizeDialogProps {
  open: boolean
  onClose: () => void
  selectedIds: number[]
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
}

export function BulkCategorizeDialog({
  open,
  onClose,
  selectedIds,
  accounts,
  funds,
}: BulkCategorizeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [glAccountId, setGlAccountId] = useState<number | null>(null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [createRule, setCreateRule] = useState(false)

  const handleSubmit = () => {
    if (!glAccountId || !fundId || selectedIds.length === 0) return

    startTransition(async () => {
      try {
        const result = await bulkCategorizeRampTransactions(
          {
            rampTransactionIds: selectedIds,
            glAccountId,
            fundId,
            createRule,
          },
          'system' // TODO: replace with actual user ID from session
        )
        toast.success(
          `${result.succeeded} categorized${result.failed > 0 ? `, ${result.failed} failed` : ''}`
        )
        setGlAccountId(null)
        setFundId(null)
        setCreateRule(false)
        onClose()
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        }
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>
            Categorize {selectedIds.length} Transaction
            {selectedIds.length !== 1 ? 's' : ''}
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <p className="text-sm text-muted-foreground">
            All selected transactions will be assigned the same GL account and
            fund, then posted to the general ledger.
          </p>

          <div className="grid gap-2">
            <Label>GL Account</Label>
            <AccountSelector
              accounts={accounts}
              value={glAccountId}
              onSelect={setGlAccountId}
              placeholder="Select expense account..."
              filterType={['EXPENSE']}
              testId="bulk-categorize-gl-account"
            />
          </div>

          <div className="grid gap-2">
            <Label>Fund</Label>
            <FundSelector
              funds={funds}
              value={fundId}
              onSelect={setFundId}
              testId="bulk-categorize-fund"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="bulk-create-rule"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="bulk-categorize-create-rule"
            />
            <Label htmlFor="bulk-create-rule">
              Create auto-categorization rule from first transaction
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="bulk-categorize-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !glAccountId || !fundId}
            data-testid="bulk-categorize-submit-btn"
          >
            Categorize &amp; Post ({selectedIds.length})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
