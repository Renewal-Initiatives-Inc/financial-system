'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
import { createVendor } from './actions'
import { toast } from 'sonner'

const ENTITY_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'SOLE_PROPRIETOR', label: 'Sole Proprietor' },
  { value: 'LLC', label: 'LLC' },
  { value: 'S_CORP', label: 'S-Corp' },
  { value: 'C_CORP', label: 'C-Corp' },
  { value: 'PARTNERSHIP', label: 'Partnership' },
  { value: 'GOVERNMENT', label: 'Government' },
] as const

interface CreateVendorDialogProps {
  open: boolean
  onClose: () => void
  accountOptions: { id: number; name: string; code: string }[]
  fundOptions: { id: number; name: string }[]
}

export function CreateVendorDialog({
  open,
  onClose,
  accountOptions,
  fundOptions,
}: CreateVendorDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [taxId, setTaxId] = useState('')
  const [entityType, setEntityType] = useState('none')
  const [is1099Eligible, setIs1099Eligible] = useState(false)
  const [defaultAccountId, setDefaultAccountId] = useState<string>('none')
  const [defaultFundId, setDefaultFundId] = useState<string>('none')
  const [w9Status, setW9Status] = useState('NOT_REQUIRED')
  const [w9CollectedDate, setW9CollectedDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setAddress('')
    setTaxId('')
    setEntityType('')
    setIs1099Eligible(false)
    setDefaultAccountId('')
    setDefaultFundId('')
    setW9Status('NOT_REQUIRED')
    setW9CollectedDate('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Vendor name is required'

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await createVendor(
          {
            name: name.trim(),
            address: address.trim() || null,
            taxId: taxId.trim() || null,
            entityType: entityType !== 'none' ? entityType : null,
            is1099Eligible,
            defaultAccountId: defaultAccountId !== 'none'
              ? parseInt(defaultAccountId, 10)
              : null,
            defaultFundId: defaultFundId !== 'none'
              ? parseInt(defaultFundId, 10)
              : null,
            w9Status: w9Status as 'COLLECTED' | 'PENDING' | 'NOT_REQUIRED',
            w9CollectedDate:
              w9Status === 'COLLECTED' && w9CollectedDate
                ? w9CollectedDate
                : null,
          }
        )
        toast.success('Vendor created')
        resetForm()
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
        if (!v) {
          resetForm()
          onClose()
        }
      }}
    >
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Vendor</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="vendor-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="vendor-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              placeholder="Vendor name"
              data-testid="create-vendor-name"
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vendor-address">Address</Label>
            <Textarea
              id="vendor-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              data-testid="create-vendor-address"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="vendor-tax-id">Tax ID</Label>
            <Input
              id="vendor-tax-id"
              value={taxId}
              onChange={(e) => setTaxId(e.target.value)}
              placeholder="XX-XXXXXXX"
              data-testid="create-vendor-tax-id"
            />
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Entity Type <HelpTooltip term="entity-type" />
            </Label>
            <Select value={entityType} onValueChange={setEntityType}>
              <SelectTrigger data-testid="create-vendor-entity-type">
                <SelectValue placeholder="Select entity type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {ENTITY_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="vendor-1099"
              checked={is1099Eligible}
              onChange={(e) => setIs1099Eligible(e.target.checked)}
              className="h-4 w-4 rounded border-gray-300"
              data-testid="create-vendor-1099-eligible"
            />
            <Label
              htmlFor="vendor-1099"
              className="flex items-center gap-1"
            >
              1099 Eligible <HelpTooltip term="1099-eligible" />
            </Label>
          </div>

          <div className="grid gap-2">
            <Label>Default GL Account</Label>
            <Select
              value={defaultAccountId}
              onValueChange={setDefaultAccountId}
            >
              <SelectTrigger data-testid="create-vendor-default-account">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {accountOptions.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.code} - {a.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Default Funding Source</Label>
            <Select value={defaultFundId} onValueChange={setDefaultFundId}>
              <SelectTrigger data-testid="create-vendor-default-fund">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {fundOptions.map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              W-9 Status <HelpTooltip term="w9-status" />
            </Label>
            <Select value={w9Status} onValueChange={setW9Status}>
              <SelectTrigger data-testid="create-vendor-w9-status">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="NOT_REQUIRED">Not Required</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COLLECTED">Collected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {w9Status === 'COLLECTED' && (
            <div className="grid gap-2">
              <Label htmlFor="vendor-w9-date">W-9 Collected Date</Label>
              <Input
                id="vendor-w9-date"
                type="date"
                value={w9CollectedDate}
                onChange={(e) => setW9CollectedDate(e.target.value)}
                data-testid="create-vendor-w9-date"
              />
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="create-vendor-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="create-vendor-submit"
          >
            Create Vendor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
