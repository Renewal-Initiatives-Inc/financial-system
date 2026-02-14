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
import { createDonor } from './actions'
import { toast } from 'sonner'

const DONOR_TYPES = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'CORPORATE', label: 'Corporate' },
  { value: 'FOUNDATION', label: 'Foundation' },
  { value: 'GOVERNMENT', label: 'Government' },
] as const

interface CreateDonorDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateDonorDialog({
  open,
  onClose,
}: CreateDonorDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [email, setEmail] = useState('')
  const [type, setType] = useState('')
  const [firstGiftDate, setFirstGiftDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setAddress('')
    setEmail('')
    setType('')
    setFirstGiftDate('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Donor name is required'
    if (!type) newErrors.type = 'Donor type is required'
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      newErrors.email = 'Invalid email format'
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await createDonor(
          {
            name: name.trim(),
            address: address.trim() || null,
            email: email.trim() || null,
            type: type as
              | 'INDIVIDUAL'
              | 'CORPORATE'
              | 'FOUNDATION'
              | 'GOVERNMENT',
            firstGiftDate: firstGiftDate || null,
          },
          'system' // TODO: replace with actual user ID from session
        )
        toast.success('Donor created')
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
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create Donor</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <Label htmlFor="donor-name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="donor-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setFieldErrors((prev) => ({ ...prev, name: '' }))
              }}
              placeholder="Donor name"
              data-testid="create-donor-name"
            />
            {fieldErrors.name && (
              <p className="text-sm text-destructive">{fieldErrors.name}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label htmlFor="donor-address">Address</Label>
            <Textarea
              id="donor-address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Street address"
              data-testid="create-donor-address"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="donor-email">Email</Label>
            <Input
              id="donor-email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setFieldErrors((prev) => ({ ...prev, email: '' }))
              }}
              placeholder="donor@example.com"
              data-testid="create-donor-email"
            />
            {fieldErrors.email && (
              <p className="text-sm text-destructive">{fieldErrors.email}</p>
            )}
          </div>

          <div className="grid gap-2">
            <Label>
              Type <span className="text-destructive">*</span>
            </Label>
            <Select
              value={type}
              onValueChange={(v) => {
                setType(v)
                setFieldErrors((prev) => ({ ...prev, type: '' }))
              }}
            >
              <SelectTrigger data-testid="create-donor-type">
                <SelectValue placeholder="Select type" />
              </SelectTrigger>
              <SelectContent>
                {DONOR_TYPES.map((t) => (
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
            <Label>First Gift Date</Label>
            <Input
              type="date"
              value={firstGiftDate}
              onChange={(e) => setFirstGiftDate(e.target.value)}
              data-testid="create-donor-first-gift"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="create-donor-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="create-donor-submit"
          >
            Create Donor
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
