'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
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
import type { AiSuggestion } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface BulkCategorizeDialogProps {
  open: boolean
  onClose: () => void
  selectedIds: number[]
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
  aiSuggestions?: Record<number, AiSuggestion>
}

export function BulkCategorizeDialog({
  open,
  onClose,
  selectedIds,
  accounts,
  funds,
  aiSuggestions,
}: BulkCategorizeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [glAccountId, setGlAccountId] = useState<number | null>(null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [createRule, setCreateRule] = useState(false)

  // Count how many selected items have AI suggestions
  const aiSuggestedCount = aiSuggestions
    ? selectedIds.filter((id) => aiSuggestions[id]).length
    : 0

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
          }
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

          {aiSuggestedCount > 0 && (
            <div className="flex items-center gap-2 p-2 rounded border bg-purple-50/50 dark:bg-purple-900/10 text-sm">
              <Sparkles className="h-4 w-4 text-purple-500" />
              <span>
                {aiSuggestedCount} of {selectedIds.length} have AI suggestions
              </span>
            </div>
          )}

          {/* Show per-item AI suggestions if available */}
          {aiSuggestions && aiSuggestedCount > 0 && (
            <div className="max-h-[150px] overflow-y-auto space-y-1">
              {selectedIds
                .filter((id) => aiSuggestions[id])
                .map((id) => {
                  const s = aiSuggestions[id]
                  return (
                    <div
                      key={id}
                      className="flex items-center gap-2 text-xs text-muted-foreground"
                      data-testid={`bulk-ai-suggestion-${id}`}
                    >
                      <Sparkles className="h-3 w-3 text-purple-400" />
                      <span>
                        #{id}: {s.accountName}, {s.fundName}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {s.confidence}
                      </Badge>
                    </div>
                  )
                })}
            </div>
          )}

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
            <Label>Funding Source</Label>
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
