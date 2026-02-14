'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Pencil, Save, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
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
import { updateDonor, toggleDonorActive } from '../actions'
import type { DonorRow, GivingGift } from '../actions'
import { toast } from 'sonner'

const typeLabels: Record<string, string> = {
  INDIVIDUAL: 'Individual',
  CORPORATE: 'Corporate',
  FOUNDATION: 'Foundation',
  GOVERNMENT: 'Government',
}

const typeColors: Record<string, string> = {
  INDIVIDUAL: 'bg-blue-100 text-blue-800',
  CORPORATE: 'bg-purple-100 text-purple-800',
  FOUNDATION: 'bg-green-100 text-green-800',
  GOVERNMENT: 'bg-orange-100 text-orange-800',
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface DonorDetailClientProps {
  donor: DonorRow
  givingSummary: {
    totalGiving: number
    giftCount: number
    recentGifts: GivingGift[]
  }
}

export function DonorDetailClient({ donor, givingSummary }: DonorDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(donor.name)
  const [address, setAddress] = useState(donor.address ?? '')
  const [email, setEmail] = useState(donor.email ?? '')
  const [type, setType] = useState(donor.type)
  const [firstGiftDate, setFirstGiftDate] = useState(
    donor.firstGiftDate ?? ''
  )
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateDonor(
          donor.id,
          {
            ...(name !== donor.name ? { name } : {}),
            ...(address !== (donor.address ?? '')
              ? { address: address || null }
              : {}),
            ...(email !== (donor.email ?? '')
              ? { email: email || null }
              : {}),
            ...(type !== donor.type ? { type } : {}),
            ...(firstGiftDate !== (donor.firstGiftDate ?? '')
              ? { firstGiftDate: firstGiftDate || null }
              : {}),
          },
          'system'
        )
        setIsEditing(false)
        toast.success('Donor updated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update donor'
        )
      }
    })
  }

  const handleToggleActive = (active: boolean) => {
    if (!active) {
      setIsConfirmDeactivateOpen(true)
      return
    }
    startTransition(async () => {
      try {
        await toggleDonorActive(donor.id, true, 'system')
        toast.success('Donor reactivated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to reactivate'
        )
      }
    })
  }

  const confirmDeactivation = () => {
    startTransition(async () => {
      try {
        await toggleDonorActive(donor.id, false, 'system')
        setIsConfirmDeactivateOpen(false)
        toast.success('Donor deactivated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to deactivate'
        )
        setIsConfirmDeactivateOpen(false)
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/donors">
          <Button
            variant="ghost"
            size="icon"
            data-testid="donor-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {donor.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={typeColors[donor.type] ?? ''}
            >
              {typeLabels[donor.type] ?? donor.type}
            </Badge>
            <Badge variant={donor.isActive ? 'default' : 'secondary'}>
              {donor.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Donor Details</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-donor-btn"
            >
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Name</Label>
              {isEditing ? (
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  data-testid="edit-donor-name"
                />
              ) : (
                <p>{donor.name}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Type</Label>
              {isEditing ? (
                <Select
                  value={type}
                  onValueChange={setType as (v: string) => void}
                >
                  <SelectTrigger data-testid="edit-donor-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="INDIVIDUAL">Individual</SelectItem>
                    <SelectItem value="CORPORATE">Corporate</SelectItem>
                    <SelectItem value="FOUNDATION">Foundation</SelectItem>
                    <SelectItem value="GOVERNMENT">Government</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p>{typeLabels[donor.type] ?? donor.type}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Address</Label>
              {isEditing ? (
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="edit-donor-address"
                />
              ) : (
                <p className="whitespace-pre-line">
                  {donor.address || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Email</Label>
              {isEditing ? (
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  data-testid="edit-donor-email"
                />
              ) : (
                <p>{donor.email || '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">First Gift Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={firstGiftDate}
                  onChange={(e) => setFirstGiftDate(e.target.value)}
                  data-testid="edit-donor-first-gift"
                />
              ) : (
                <p>{formatDate(donor.firstGiftDate)}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isPending}
                data-testid="save-donor-btn"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setName(donor.name)
                  setAddress(donor.address ?? '')
                  setEmail(donor.email ?? '')
                  setType(donor.type)
                  setFirstGiftDate(donor.firstGiftDate ?? '')
                }}
                data-testid="donor-edit-cancel-btn"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Giving History Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Giving History <HelpTooltip term="donor" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Total Giving</Label>
              <p className="text-lg font-medium">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: 'USD',
                }).format(givingSummary.totalGiving)}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground">Gift Count</Label>
              <p className="text-lg font-medium">{givingSummary.giftCount}</p>
            </div>
          </div>
          {givingSummary.recentGifts.length > 0 ? (
            <div className="space-y-2">
              <p className="text-sm font-medium">Recent Gifts</p>
              {givingSummary.recentGifts.map((gift, i) => (
                <div
                  key={i}
                  className="flex justify-between text-sm border-b pb-2"
                >
                  <span>{gift.memo}</span>
                  <span className="text-muted-foreground">
                    {new Intl.NumberFormat('en-US', {
                      style: 'currency',
                      currency: 'USD',
                    }).format(parseFloat(gift.amount))}{' '}
                    &middot; {gift.date}
                  </span>
                </div>
              ))}
              <Link
                href="/revenue/donations"
                className="text-sm text-primary hover:underline"
              >
                View all donations
              </Link>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No giving history recorded yet.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Active Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Active Status <HelpTooltip term="deactivation" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={donor.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isPending}
              data-testid="donor-active-toggle"
            />
            <span className="text-sm">
              {donor.isActive ? 'Active' : 'Inactive'}
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Deactivation Confirmation Dialog */}
      <Dialog
        open={isConfirmDeactivateOpen}
        onOpenChange={setIsConfirmDeactivateOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate Donor</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{donor.name}</strong>? It will be hidden from
              selection dropdowns but preserved for historical reporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              data-testid="donor-deactivate-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-donor-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
