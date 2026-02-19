'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import { createFixedAsset } from './actions'

interface CreateAssetDialogProps {
  open: boolean
  onClose: () => void
  accountOptions: { id: number; name: string; code: string; subType: string | null }[]
  parentAssetOptions: { id: number; name: string }[]
}

export function CreateAssetDialog({
  open,
  onClose,
  accountOptions,
  parentAssetOptions,
}: CreateAssetDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form state
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [acquisitionDate, setAcquisitionDate] = useState('')
  const [cost, setCost] = useState('')
  const [salvageValue, setSalvageValue] = useState('0')
  const [usefulLifeMonths, setUsefulLifeMonths] = useState('')
  const [datePlacedInService, setDatePlacedInService] = useState('')
  const [glAssetAccountId, setGlAssetAccountId] = useState('')
  const [glAccumDeprAccountId, setGlAccumDeprAccountId] = useState('')
  const [glExpenseAccountId, setGlExpenseAccountId] = useState('')
  const [parentAssetId, setParentAssetId] = useState('none')

  // Filter accounts by subType for intelligent dropdowns
  const assetAccounts = accountOptions.filter(
    (a) => a.subType === 'Fixed Asset'
  )
  const contraAssetAccounts = accountOptions.filter(
    (a) => a.subType === 'Contra-Asset'
  )
  const expenseAccounts = accountOptions.filter(
    (a) =>
      a.code === '5200' ||
      (a.subType && ['Non-Cash', 'Operating'].includes(a.subType))
  )

  // Default expense account to 5200 (Depreciation Expense)
  const defaultExpenseAccount = accountOptions.find((a) => a.code === '5200')

  const resetForm = () => {
    setName('')
    setDescription('')
    setAcquisitionDate('')
    setCost('')
    setSalvageValue('0')
    setUsefulLifeMonths('')
    setDatePlacedInService('')
    setGlAssetAccountId('')
    setGlAccumDeprAccountId('')
    setGlExpenseAccountId(defaultExpenseAccount ? String(defaultExpenseAccount.id) : '')
    setParentAssetId('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Asset name is required'
    if (!acquisitionDate) newErrors.acquisitionDate = 'Acquisition date is required'
    if (!cost || Number(cost) <= 0) newErrors.cost = 'Cost must be a positive number'
    if (!usefulLifeMonths || Number(usefulLifeMonths) <= 0) {
      newErrors.usefulLifeMonths = 'Useful life must be a positive number'
    }
    if (!glAssetAccountId) newErrors.glAssetAccountId = 'Asset account is required'
    if (!glAccumDeprAccountId) newErrors.glAccumDeprAccountId = 'Accum. depreciation account is required'
    if (!glExpenseAccountId) newErrors.glExpenseAccountId = 'Expense account is required'

    const costNum = Number(cost)
    const salvageNum = Number(salvageValue || '0')
    if (salvageNum >= costNum) {
      newErrors.salvageValue = 'Salvage value must be less than cost'
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        const result = await createFixedAsset(
          {
            name: name.trim(),
            description: description.trim() || null,
            acquisitionDate,
            cost: costNum,
            salvageValue: salvageNum,
            usefulLifeMonths: Number(usefulLifeMonths),
            depreciationMethod: 'STRAIGHT_LINE',
            datePlacedInService: datePlacedInService || null,
            glAssetAccountId: Number(glAssetAccountId),
            glAccumDeprAccountId: Number(glAccumDeprAccountId),
            glExpenseAccountId: Number(glExpenseAccountId),
            parentAssetId: parentAssetId !== 'none' ? Number(parentAssetId) : null,
          },
          'current-user'
        )

        toast.success('Fixed asset created successfully')
        resetForm()
        onClose()
        router.push(`/assets/${result.id}`)
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to create asset'
        )
      }
    })
  }

  const usefulLifeYears = usefulLifeMonths
    ? `(${(Number(usefulLifeMonths) / 12).toFixed(1)} years)`
    : ''

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Fixed Asset</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Name */}
          <div>
            <Label htmlFor="asset-name">Name</Label>
            <Input
              id="asset-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Lodging - Structure"
              data-testid="asset-name-input"
            />
            {fieldErrors.name && (
              <p className="text-sm text-red-500 mt-1">{fieldErrors.name}</p>
            )}
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="asset-description">Description (optional)</Label>
            <Textarea
              id="asset-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              rows={2}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Acquisition Date */}
            <div>
              <Label htmlFor="acquisition-date">Acquisition Date</Label>
              <Input
                id="acquisition-date"
                type="date"
                value={acquisitionDate}
                onChange={(e) => setAcquisitionDate(e.target.value)}
                data-testid="acquisition-date-input"
              />
              {fieldErrors.acquisitionDate && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldErrors.acquisitionDate}
                </p>
              )}
            </div>

            {/* Date Placed in Service */}
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="pis-date">Date Placed in Service</Label>
                <HelpTooltip term="date-placed-in-service" />
              </div>
              <Input
                id="pis-date"
                type="date"
                value={datePlacedInService}
                onChange={(e) => setDatePlacedInService(e.target.value)}
                data-testid="pis-date-input"
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4">
            {/* Cost */}
            <div>
              <Label htmlFor="asset-cost">Cost ($)</Label>
              <Input
                id="asset-cost"
                type="number"
                step="0.01"
                min="0"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                placeholder="0.00"
                data-testid="asset-cost-input"
              />
              {fieldErrors.cost && (
                <p className="text-sm text-red-500 mt-1">{fieldErrors.cost}</p>
              )}
            </div>

            {/* Salvage Value */}
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="salvage-value">Salvage Value ($)</Label>
                <HelpTooltip term="salvage-value" />
              </div>
              <Input
                id="salvage-value"
                type="number"
                step="0.01"
                min="0"
                value={salvageValue}
                onChange={(e) => setSalvageValue(e.target.value)}
                placeholder="0.00"
                data-testid="salvage-value-input"
              />
              {fieldErrors.salvageValue && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldErrors.salvageValue}
                </p>
              )}
            </div>

            {/* Useful Life */}
            <div>
              <div className="flex items-center gap-2">
                <Label htmlFor="useful-life">Useful Life (months)</Label>
                <HelpTooltip term="useful-life" />
              </div>
              <div className="flex items-center gap-2">
                <Input
                  id="useful-life"
                  type="number"
                  min="1"
                  value={usefulLifeMonths}
                  onChange={(e) => setUsefulLifeMonths(e.target.value)}
                  placeholder="480"
                  data-testid="useful-life-input"
                />
                {usefulLifeYears && (
                  <span className="text-sm text-muted-foreground whitespace-nowrap">
                    {usefulLifeYears}
                  </span>
                )}
              </div>
              {fieldErrors.usefulLifeMonths && (
                <p className="text-sm text-red-500 mt-1">
                  {fieldErrors.usefulLifeMonths}
                </p>
              )}
            </div>
          </div>

          {/* GL Accounts */}
          <div className="space-y-3">
            <h3 className="text-sm font-medium">GL Accounts</h3>
            <div className="grid grid-cols-3 gap-4">
              {/* Asset Account */}
              <div>
                <Label>Asset Account</Label>
                <Select
                  value={glAssetAccountId}
                  onValueChange={setGlAssetAccountId}
                >
                  <SelectTrigger data-testid="gl-asset-account-select">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {assetAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.glAssetAccountId && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.glAssetAccountId}
                  </p>
                )}
              </div>

              {/* Accum Depr Account */}
              <div>
                <Label>Accum. Depreciation</Label>
                <Select
                  value={glAccumDeprAccountId}
                  onValueChange={setGlAccumDeprAccountId}
                >
                  <SelectTrigger data-testid="gl-accum-depr-account-select">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {contraAssetAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.glAccumDeprAccountId && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.glAccumDeprAccountId}
                  </p>
                )}
              </div>

              {/* Expense Account */}
              <div>
                <Label>Depreciation Expense</Label>
                <Select
                  value={glExpenseAccountId || (defaultExpenseAccount ? String(defaultExpenseAccount.id) : '')}
                  onValueChange={setGlExpenseAccountId}
                >
                  <SelectTrigger data-testid="gl-expense-account-select">
                    <SelectValue placeholder="Select..." />
                  </SelectTrigger>
                  <SelectContent>
                    {expenseAccounts.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {fieldErrors.glExpenseAccountId && (
                  <p className="text-sm text-red-500 mt-1">
                    {fieldErrors.glExpenseAccountId}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Parent Asset */}
          {parentAssetOptions.length > 0 && (
            <div>
              <Label>Parent Asset (optional)</Label>
              <Select value={parentAssetId} onValueChange={setParentAssetId}>
                <SelectTrigger data-testid="parent-asset-select">
                  <SelectValue placeholder="None (top-level asset)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {parentAssetOptions.map((a) => (
                    <SelectItem key={a.id} value={String(a.id)}>
                      {a.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="create-asset-submit"
          >
            {isPending ? 'Creating...' : 'Create Asset'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
