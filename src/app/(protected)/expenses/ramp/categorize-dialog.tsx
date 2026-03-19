'use client'

import { useState, useEffect, useTransition } from 'react'
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
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { categorizeRampTransaction, findMatchingRule } from './actions'
import { toast } from 'sonner'
import type { RampTransactionRow, AiSuggestion } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

interface CategorizeDialogProps {
  open: boolean
  onClose: () => void
  transaction: RampTransactionRow | null
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
  aiSuggestion?: AiSuggestion | null
}

function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

export function CategorizeDialog({
  open,
  onClose,
  transaction,
  accounts,
  funds,
  aiSuggestion,
}: CategorizeDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [glAccountId, setGlAccountId] = useState<number | null>(null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [createRule, setCreateRule] = useState(false)

  // Pre-fill from AI suggestion or matching rule when transaction changes
  useEffect(() => {
    if (!transaction || !open) return

    let cancelled = false

    // If AI suggestion is available, prefer it; otherwise look up matching rule
    const prefill = aiSuggestion
      ? Promise.resolve({ glAccountId: aiSuggestion.accountId, fundId: aiSuggestion.fundId })
      : findMatchingRule(transaction.merchantName)

    prefill.then((match) => {
      if (cancelled) return
      if (match) {
        setGlAccountId(match.glAccountId)
        setFundId(match.fundId)
      } else {
        setGlAccountId(null)
        setFundId(null)
      }
      setCreateRule(false)
    })

    return () => {
      cancelled = true
    }
  }, [transaction, open, aiSuggestion])

  const handleSubmit = () => {
    if (!transaction || !glAccountId || !fundId) return

    startTransition(async () => {
      try {
        await categorizeRampTransaction(
          {
            rampTransactionId: transaction.id,
            glAccountId,
            fundId,
            createRule,
          },
          aiSuggestion
            ? {
                accountId: aiSuggestion.accountId,
                fundId: aiSuggestion.fundId,
                confidence: aiSuggestion.confidence,
              }
            : null
        )
        toast.success('Transaction categorized and posted to GL')
        onClose()
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        }
      }
    })
  }

  if (!transaction) return null

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) onClose()
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            Categorize Ramp Transaction
            <HelpTooltip term="categorization" />
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Merchant</span>
              <p className="font-medium">{transaction.merchantName}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Amount</span>
              <p className="font-medium font-mono">
                {formatCurrency(transaction.amount)}
              </p>
            </div>
            <div>
              <span className="text-muted-foreground">Date</span>
              <p className="font-medium">{transaction.date}</p>
            </div>
            <div>
              <span className="text-muted-foreground">Cardholder</span>
              <p className="font-medium">{transaction.cardholder}</p>
            </div>
          </div>

          {transaction.description && (
            <div className="text-sm">
              <span className="text-muted-foreground">Description</span>
              <p>{transaction.description}</p>
            </div>
          )}

          {/* AI Suggestion Banner */}
          {aiSuggestion && (
            <div
              className="flex items-start gap-2 p-3 rounded-lg border bg-purple-50/50 dark:bg-purple-900/10"
              data-testid="categorize-ai-suggestion"
            >
              <Sparkles className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
              <div className="text-sm">
                <div className="flex items-center gap-2">
                  <span className="font-medium">AI Suggestion</span>
                  <Badge
                    variant="outline"
                    className={`text-xs ${
                      aiSuggestion.confidence === 'high'
                        ? 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400'
                        : aiSuggestion.confidence === 'medium'
                          ? 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400'
                          : 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400'
                    }`}
                  >
                    {aiSuggestion.confidence}
                  </Badge>
                </div>
                <p className="text-muted-foreground mt-1">
                  {aiSuggestion.accountName}, {aiSuggestion.fundName}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  &ldquo;{aiSuggestion.reasoning}&rdquo;
                </p>
              </div>
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
              testId="categorize-gl-account"
            />
          </div>

          <div className="grid gap-2">
            <Label>Funding Source</Label>
            <FundSelector
              funds={funds}
              value={fundId}
              onSelect={setFundId}
              testId="categorize-fund"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="create-rule"
              checked={createRule}
              onChange={(e) => setCreateRule(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="categorize-create-rule"
            />
            <Label htmlFor="create-rule" className="flex items-center gap-1">
              Always categorize &quot;{transaction.merchantName}&quot; as this
              account + fund
              <HelpTooltip term="auto-categorization-rule" />
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="categorize-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending || !glAccountId || !fundId}
            data-testid="categorize-submit-btn"
          >
            Categorize &amp; Post to GL
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
