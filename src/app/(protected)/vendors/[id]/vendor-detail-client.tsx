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
import { updateVendor, toggleVendorActive } from '../actions'
import type { VendorDetail } from '../actions'
import { toast } from 'sonner'

const w9Colors: Record<string, string> = {
  COLLECTED: 'bg-green-100 text-green-800',
  PENDING: 'bg-yellow-100 text-yellow-800',
  NOT_REQUIRED: 'bg-gray-100 text-gray-800',
}

const w9Labels: Record<string, string> = {
  COLLECTED: 'Collected',
  PENDING: 'Pending',
  NOT_REQUIRED: 'Not Required',
}

interface VendorDetailClientProps {
  vendor: VendorDetail
  accountOptions: { id: number; name: string; code: string }[]
  fundOptions: { id: number; name: string }[]
}

export function VendorDetailClient({
  vendor,
  accountOptions,
  fundOptions,
}: VendorDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(vendor.name)
  const [address, setAddress] = useState(vendor.address ?? '')
  const [taxId, setTaxId] = useState(vendor.taxId ?? '')
  const [entityType, setEntityType] = useState(vendor.entityType ?? '')
  const [is1099Eligible, setIs1099Eligible] = useState(vendor.is1099Eligible)
  const [defaultAccountId, setDefaultAccountId] = useState(
    vendor.defaultAccountId ? String(vendor.defaultAccountId) : ''
  )
  const [defaultFundId, setDefaultFundId] = useState(
    vendor.defaultFundId ? String(vendor.defaultFundId) : ''
  )
  const [w9Status, setW9Status] = useState(vendor.w9Status)
  const [w9CollectedDate, setW9CollectedDate] = useState(
    vendor.w9CollectedDate ?? ''
  )
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)

  const handleSave = () => {
    startTransition(async () => {
      try {
        await updateVendor(
          vendor.id,
          {
            ...(name !== vendor.name ? { name } : {}),
            ...(address !== (vendor.address ?? '')
              ? { address: address || null }
              : {}),
            ...(taxId !== (vendor.taxId ?? '')
              ? { taxId: taxId || null }
              : {}),
            ...(entityType !== (vendor.entityType ?? '')
              ? { entityType: entityType || null }
              : {}),
            ...(is1099Eligible !== vendor.is1099Eligible
              ? { is1099Eligible }
              : {}),
            ...(defaultAccountId !== (vendor.defaultAccountId ? String(vendor.defaultAccountId) : '')
              ? {
                  defaultAccountId: defaultAccountId
                    ? parseInt(defaultAccountId, 10)
                    : null,
                }
              : {}),
            ...(defaultFundId !== (vendor.defaultFundId ? String(vendor.defaultFundId) : '')
              ? {
                  defaultFundId: defaultFundId
                    ? parseInt(defaultFundId, 10)
                    : null,
                }
              : {}),
            ...(w9Status !== vendor.w9Status ? { w9Status } : {}),
            ...(w9CollectedDate !== (vendor.w9CollectedDate ?? '')
              ? { w9CollectedDate: w9CollectedDate || null }
              : {}),
          },
          'system'
        )
        setIsEditing(false)
        toast.success('Vendor updated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update vendor'
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
        await toggleVendorActive(vendor.id, true, 'system')
        toast.success('Vendor reactivated')
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
        await toggleVendorActive(vendor.id, false, 'system')
        setIsConfirmDeactivateOpen(false)
        toast.success('Vendor deactivated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to deactivate'
        )
        setIsConfirmDeactivateOpen(false)
      }
    })
  }

  const maskedTaxId = vendor.taxId
    ? `***-**-${vendor.taxId.slice(-4)}`
    : '-'

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/vendors">
          <Button
            variant="ghost"
            size="icon"
            data-testid="vendor-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {vendor.name}
          </h1>
          <div className="mt-1 flex items-center gap-2">
            {vendor.entityType && (
              <Badge variant="outline">{vendor.entityType}</Badge>
            )}
            <Badge variant={vendor.isActive ? 'default' : 'secondary'}>
              {vendor.isActive ? 'Active' : 'Inactive'}
            </Badge>
            {vendor.is1099Eligible && (
              <Badge
                variant="outline"
                className="bg-green-100 text-green-800"
              >
                1099 Eligible
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Vendor Details</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-vendor-btn"
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
                  data-testid="edit-vendor-name"
                />
              ) : (
                <p>{vendor.name}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Address</Label>
              {isEditing ? (
                <Textarea
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  data-testid="edit-vendor-address"
                />
              ) : (
                <p className="whitespace-pre-line">
                  {vendor.address || '-'}
                </p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Tax ID</Label>
              {isEditing ? (
                <Input
                  value={taxId}
                  onChange={(e) => setTaxId(e.target.value)}
                  data-testid="edit-vendor-tax-id"
                />
              ) : (
                <p className="font-mono">{maskedTaxId}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Entity Type <HelpTooltip term="entity-type" />
              </Label>
              {isEditing ? (
                <Select value={entityType} onValueChange={setEntityType}>
                  <SelectTrigger data-testid="edit-vendor-entity-type">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    <SelectItem value="individual">Individual</SelectItem>
                    <SelectItem value="sole_proprietor">Sole Proprietor</SelectItem>
                    <SelectItem value="llc">LLC</SelectItem>
                    <SelectItem value="s_corp">S-Corp</SelectItem>
                    <SelectItem value="c_corp">C-Corp</SelectItem>
                    <SelectItem value="partnership">Partnership</SelectItem>
                    <SelectItem value="government">Government</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p>{vendor.entityType || '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Default GL Account</Label>
              {isEditing ? (
                <Select
                  value={defaultAccountId}
                  onValueChange={setDefaultAccountId}
                >
                  <SelectTrigger data-testid="edit-vendor-default-account">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {accountOptions.map((a) => (
                      <SelectItem key={a.id} value={String(a.id)}>
                        {a.code} - {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p>{vendor.defaultAccountName || '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Default Fund</Label>
              {isEditing ? (
                <Select
                  value={defaultFundId}
                  onValueChange={setDefaultFundId}
                >
                  <SelectTrigger data-testid="edit-vendor-default-fund">
                    <SelectValue placeholder="None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">None</SelectItem>
                    {fundOptions.map((f) => (
                      <SelectItem key={f.id} value={String(f.id)}>
                        {f.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p>{vendor.defaultFundName || '-'}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex items-center gap-2 pt-2">
              <input
                type="checkbox"
                id="edit-1099"
                checked={is1099Eligible}
                onChange={(e) => setIs1099Eligible(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
                data-testid="edit-vendor-1099-eligible"
              />
              <Label htmlFor="edit-1099" className="flex items-center gap-1">
                1099 Eligible <HelpTooltip term="1099-eligible" />
              </Label>
            </div>
          )}

          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isPending}
                data-testid="save-vendor-btn"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setIsEditing(false)
                  setName(vendor.name)
                  setAddress(vendor.address ?? '')
                  setTaxId(vendor.taxId ?? '')
                  setEntityType(vendor.entityType ?? '')
                  setIs1099Eligible(vendor.is1099Eligible)
                  setDefaultAccountId(
                    vendor.defaultAccountId
                      ? String(vendor.defaultAccountId)
                      : ''
                  )
                  setDefaultFundId(
                    vendor.defaultFundId
                      ? String(vendor.defaultFundId)
                      : ''
                  )
                }}
                data-testid="vendor-edit-cancel-btn"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* W-9 Tracking Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            W-9 Tracking <HelpTooltip term="w9-status" />
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div>
                <Badge
                  variant="outline"
                  className={w9Colors[vendor.w9Status] ?? ''}
                >
                  {w9Labels[vendor.w9Status] ?? vendor.w9Status}
                </Badge>
              </div>
            </div>
            {vendor.w9CollectedDate && (
              <div>
                <Label className="text-muted-foreground">Collected Date</Label>
                <p>{vendor.w9CollectedDate}</p>
              </div>
            )}
          </div>
          {isEditing && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>W-9 Status</Label>
                <Select value={w9Status} onValueChange={setW9Status as (v: string) => void}>
                  <SelectTrigger data-testid="edit-vendor-w9-status">
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
                <div>
                  <Label>Collected Date</Label>
                  <Input
                    type="date"
                    value={w9CollectedDate}
                    onChange={(e) => setW9CollectedDate(e.target.value)}
                    data-testid="edit-vendor-w9-date"
                  />
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 1099 Tracking Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            1099 Tracking <HelpTooltip term="1099-eligible" />
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            $0 — no payments recorded yet. Payment tracking available after
            Phase 8.
          </p>
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
              checked={vendor.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isPending}
              data-testid="vendor-active-toggle"
            />
            <span className="text-sm">
              {vendor.isActive ? 'Active' : 'Inactive'}
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
            <DialogTitle>Deactivate Vendor</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>{vendor.name}</strong>? It will be hidden from selection
              dropdowns but preserved for historical reporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              data-testid="vendor-deactivate-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-vendor-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
