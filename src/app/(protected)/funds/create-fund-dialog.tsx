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
import { createFund } from './actions'
import { toast } from 'sonner'

interface CreateFundDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateFundDialog({ open, onClose }: CreateFundDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [restrictionType, setRestrictionType] = useState('')
  const [description, setDescription] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setRestrictionType('')
    setDescription('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Name is required'
    if (!restrictionType) newErrors.restrictionType = 'Restriction type is required'

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await createFund(
          {
            name: name.trim(),
            restrictionType: restrictionType as 'RESTRICTED' | 'UNRESTRICTED',
            description: description.trim() || null,
          },
          'system'
        )
        toast.success('Fund created')
        resetForm()
        onClose()
        router.refresh()
      } catch (err) {
        if (err instanceof Error) {
          if (err.message.includes('unique') || err.message.includes('duplicate')) {
            setFieldErrors({ name: 'Fund name already exists' })
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
      <DialogContent className="sm:max-w-[450px]">
        <DialogHeader>
          <DialogTitle>Create Fund</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="fund-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="fund-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              placeholder="e.g., AHP Fund"
              data-testid="create-fund-name"
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Restriction Type <span className="text-destructive">*</span>{' '}
              <HelpTooltip term="restriction-type" />
            </Label>
            <Select
              value={restrictionType}
              onValueChange={(v) => {
                setRestrictionType(v)
                setFieldErrors((prev) => ({ ...prev, restrictionType: '' }))
              }}
            >
              <SelectTrigger data-testid="create-fund-restriction">
                <SelectValue placeholder="Select restriction type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="RESTRICTED">Restricted</SelectItem>
                <SelectItem value="UNRESTRICTED">Unrestricted</SelectItem>
              </SelectContent>
            </Select>
            {fieldErrors.restrictionType && (
              <p className="text-sm text-destructive">
                {fieldErrors.restrictionType}
              </p>
            )}
            <p className="text-xs text-amber-600 font-medium">
              Cannot be changed after creation
            </p>
          </div>

          <div className="grid gap-2">
            <Label>Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional description"
              data-testid="create-fund-description"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} data-testid="create-fund-cancel-btn">
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending} data-testid="create-fund-submit">
            Create Fund
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
