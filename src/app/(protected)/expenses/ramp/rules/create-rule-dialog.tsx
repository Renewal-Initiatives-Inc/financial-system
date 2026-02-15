'use client'

import { useState, useEffect, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
import {
  createCategorizationRule,
  updateCategorizationRule,
} from './actions'
import { toast } from 'sonner'
import type { CategorizationRuleRow } from './actions'
import type { AccountRow } from '@/app/(protected)/accounts/actions'

type Criteria = { merchantPattern?: string; descriptionKeywords?: string[] }

interface CreateRuleDialogProps {
  open: boolean
  onClose: () => void
  rule?: CategorizationRuleRow | null
  accounts: AccountRow[]
  funds: { id: number; name: string; restrictionType: string; isActive: boolean }[]
}

export function CreateRuleDialog({
  open,
  onClose,
  rule,
  accounts,
  funds,
}: CreateRuleDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [merchantPattern, setMerchantPattern] = useState('')
  const [keywords, setKeywords] = useState<string[]>([])
  const [keywordInput, setKeywordInput] = useState('')
  const [glAccountId, setGlAccountId] = useState<number | null>(null)
  const [fundId, setFundId] = useState<number | null>(null)
  const [autoApply, setAutoApply] = useState(true)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const isEditing = !!rule

  useEffect(() => {
    if (!open) {
      // Reset handled by Dialog onOpenChange — no-op here
      return
    }
    if (rule) {
      const criteria = rule.criteria as Criteria
      // Batch in a microtask to avoid cascading render warnings
      queueMicrotask(() => {
        setMerchantPattern(criteria.merchantPattern ?? '')
        setKeywords(criteria.descriptionKeywords ?? [])
        setGlAccountId(rule.glAccountId)
        setFundId(rule.fundId)
        setAutoApply(rule.autoApply)
      })
    } else {
      queueMicrotask(() => {
        setMerchantPattern('')
        setKeywords([])
        setKeywordInput('')
        setGlAccountId(null)
        setFundId(null)
        setAutoApply(true)
        setFieldErrors({})
      })
    }
  }, [rule, open])

  const addKeyword = () => {
    const kw = keywordInput.trim()
    if (kw && !keywords.includes(kw)) {
      setKeywords([...keywords, kw])
    }
    setKeywordInput('')
  }

  const removeKeyword = (kw: string) => {
    setKeywords(keywords.filter((k) => k !== kw))
  }

  const handleSubmit = () => {
    const errors: Record<string, string> = {}
    if (!merchantPattern.trim() && keywords.length === 0) {
      errors.criteria = 'At least one criterion required'
    }
    if (!glAccountId) errors.glAccountId = 'GL account is required'
    if (!fundId) errors.fundId = 'Fund is required'

    if (Object.keys(errors).length > 0) {
      setFieldErrors(errors)
      return
    }

    startTransition(async () => {
      try {
        const criteria: Criteria = {}
        if (merchantPattern.trim()) criteria.merchantPattern = merchantPattern.trim()
        if (keywords.length > 0) criteria.descriptionKeywords = keywords

        if (isEditing && rule) {
          await updateCategorizationRule(rule.id, {
            criteria,
            glAccountId: glAccountId!,
            fundId: fundId!,
            autoApply,
          })
          toast.success('Rule updated')
        } else {
          await createCategorizationRule({
            criteria,
            glAccountId: glAccountId!,
            fundId: fundId!,
            autoApply,
          })
          toast.success('Rule created')
        }
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isEditing ? 'Edit' : 'Create'} Categorization Rule
            <HelpTooltip term="auto-categorization-rule" />
          </DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="merchant-pattern">Merchant Pattern</Label>
            <Input
              id="merchant-pattern"
              value={merchantPattern}
              onChange={(e) => {
                setMerchantPattern(e.target.value)
                setFieldErrors((prev) => ({ ...prev, criteria: '' }))
              }}
              placeholder="e.g. Home Depot"
              data-testid="rule-merchant-pattern"
            />
            <p className="text-xs text-muted-foreground">
              Matches transactions with this text in the merchant name
              (case-insensitive)
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Description Keywords</Label>
            <div className="flex gap-2">
              <Input
                value={keywordInput}
                onChange={(e) => setKeywordInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addKeyword()
                  }
                }}
                placeholder="Add keyword..."
                data-testid="rule-keyword-input"
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={addKeyword}
                data-testid="rule-add-keyword-btn"
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
            {keywords.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {keywords.map((kw) => (
                  <Badge key={kw} variant="secondary" className="gap-1">
                    {kw}
                    <button
                      onClick={() => removeKeyword(kw)}
                      className="ml-1 rounded-full hover:bg-muted"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            {fieldErrors.criteria && (
              <p className="text-sm text-destructive">{fieldErrors.criteria}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>GL Account</Label>
            <AccountSelector
              accounts={accounts}
              value={glAccountId}
              onSelect={setGlAccountId}
              placeholder="Select expense account..."
              filterType={['EXPENSE']}
              testId="rule-gl-account"
            />
            {fieldErrors.glAccountId && (
              <p className="text-sm text-destructive">
                {fieldErrors.glAccountId}
              </p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>Fund</Label>
            <FundSelector
              funds={funds}
              value={fundId}
              onSelect={setFundId}
              testId="rule-fund"
            />
            {fieldErrors.fundId && (
              <p className="text-sm text-destructive">{fieldErrors.fundId}</p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="rule-auto-apply"
              checked={autoApply}
              onChange={(e) => setAutoApply(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="rule-auto-apply"
            />
            <Label htmlFor="rule-auto-apply">
              Auto-apply to new transactions
            </Label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="rule-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="rule-submit-btn"
          >
            {isEditing ? 'Update Rule' : 'Save Rule'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
