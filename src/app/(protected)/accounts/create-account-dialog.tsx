'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { createAccount } from './actions'
import type { AccountRow } from './actions'
import { toast } from 'sonner'

const ACCOUNT_TYPES = [
  { value: 'ASSET', label: 'Asset' },
  { value: 'LIABILITY', label: 'Liability' },
  { value: 'NET_ASSET', label: 'Net Asset' },
  { value: 'REVENUE', label: 'Revenue' },
  { value: 'EXPENSE', label: 'Expense' },
] as const

function deriveNormalBalance(type: string): 'DEBIT' | 'CREDIT' {
  return type === 'ASSET' || type === 'EXPENSE' ? 'DEBIT' : 'CREDIT'
}

interface CreateAccountDialogProps {
  open: boolean
  onClose: () => void
  existingAccounts: AccountRow[]
}

export function CreateAccountDialog({
  open,
  onClose,
  existingAccounts,
}: CreateAccountDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState('')
  const [subType, setSubType] = useState('')
  const [parentAccountId, setParentAccountId] = useState<string>('none')
  const [form990Line, setForm990Line] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const normalBalance = type ? deriveNormalBalance(type) : ''

  // Filter parent accounts to same type
  const parentOptions = existingAccounts.filter(
    (a) => a.type === type && a.isActive
  )

  const resetForm = () => {
    setCode('')
    setName('')
    setType('')
    setSubType('')
    setParentAccountId('')
    setForm990Line('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!code.trim()) newErrors.code = 'Code is required'
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!type) newErrors.type = 'Type is required'

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await createAccount(
          {
            code: code.trim(),
            name: name.trim(),
            type: type as 'ASSET' | 'LIABILITY' | 'NET_ASSET' | 'REVENUE' | 'EXPENSE',
            normalBalance: deriveNormalBalance(type),
            subType: subType.trim() || null,
            parentAccountId: parentAccountId !== 'none' ? parseInt(parentAccountId, 10) : null,
            form990Line: form990Line.trim() || null,
          }
        )
        toast.success('Account created')
        resetForm()
        onClose()
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          // Check for unique constraint violation
          if (err.message.includes('unique') || err.message.includes('duplicate')) {
            setFieldErrors({ code: 'Account code already exists' })
          } else {
            toast.error(err.message)
          }
        }
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          resetForm()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Account</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="code">
              Code <span className="text-destructive">*</span>
            </Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value)
                setFieldErrors((prev) => ({ ...prev, code: '' }))
              }}
              placeholder="e.g., 1000"
              data-testid="create-account-code"
            />
            {fieldErrors.code && (
              <p className="text-sm text-destructive">{fieldErrors.code}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              placeholder="e.g., Operating Cash"
              data-testid="create-account-name"
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Type <span className="text-destructive">*</span>{' '}
              <HelpTooltip term="account-type" />
            </Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v)
                setParentAccountId('')
                setFieldErrors((prev) => ({ ...prev, type: '' }))
              }}
            >
              <SelectTrigger data-testid="create-account-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {ACCOUNT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.type && (
              <p className="text-sm text-destructive">{fieldErrors.type}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Normal Balance <HelpTooltip term="normal-balance" />
            </Label>
            <Input
              value={normalBalance ? (normalBalance === 'DEBIT' ? 'Debit' : 'Credit') : ''}
              readOnly
              className="bg-muted"
              data-testid="create-account-normal-balance"
            />
            <p className="text-xs text-muted-foreground">
              Auto-derived from account type
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Sub-Type</Label>
            <Input
              value={subType}
              onChange={(e) => setSubType(e.target.value)}
              placeholder="Optional (e.g., Cash, Receivable, Prepaid)"
              data-testid="create-account-subtype"
            />
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Parent Account <HelpTooltip term="parent-account" />
            </Label>
            <Select
              value={parentAccountId}
              onValueChange={setParentAccountId}
              disabled={!type}
            >
              <SelectTrigger data-testid="create-account-parent">
                <SelectValue placeholder={type ? 'None (top-level)' : 'Select type first'} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None (top-level)</SelectItem>
                {parentOptions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Form 990 Line <HelpTooltip term="form-990-line" />
            </Label>
            <Input
              value={form990Line}
              onChange={(e) => setForm990Line(e.target.value)}
              placeholder="Optional"
              data-testid="create-account-990-line"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="create-account-cancel-btn">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="create-account-submit">
            Create Account
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
