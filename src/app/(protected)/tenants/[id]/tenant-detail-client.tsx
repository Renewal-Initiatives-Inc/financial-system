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
import { updateTenant, toggleTenantActive } from '../actions'
import type { TenantRow } from '../actions'
import { toast } from 'sonner'

const fundingLabels: Record<string, string> = {
  TENANT_DIRECT: 'Self-Pay',
  VASH: 'VASH',
  MRVP: 'MRVP',
  SECTION_8: 'Section 8',
  OTHER_VOUCHER: 'Other Voucher',
}

const fundingColors: Record<string, string> = {
  TENANT_DIRECT: 'bg-blue-100 text-blue-800',
  VASH: 'bg-purple-100 text-purple-800',
  MRVP: 'bg-green-100 text-green-800',
  SECTION_8: 'bg-orange-100 text-orange-800',
  OTHER_VOUCHER: 'bg-gray-100 text-gray-800',
}

function formatCurrency(value: string | null): string {
  if (!value) return '-'
  const num = parseFloat(value)
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(num)
}

function formatDate(value: string | null): string {
  if (!value) return '-'
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

interface TenantDetailClientProps {
  tenant: TenantRow
}

export function TenantDetailClient({ tenant }: TenantDetailClientProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isEditing, setIsEditing] = useState(false)
  const [name, setName] = useState(tenant.name)
  const [unitNumber, setUnitNumber] = useState(tenant.unitNumber)
  const [leaseStart, setLeaseStart] = useState(tenant.leaseStart ?? '')
  const [leaseEnd, setLeaseEnd] = useState(tenant.leaseEnd ?? '')
  const [monthlyRent, setMonthlyRent] = useState(tenant.monthlyRent)
  const [fundingSourceType, setFundingSourceType] = useState(
    tenant.fundingSourceType
  )
  const [moveInDate, setMoveInDate] = useState(tenant.moveInDate ?? '')
  const [securityDepositAmount, setSecurityDepositAmount] = useState(
    tenant.securityDepositAmount ?? ''
  )
  const [escrowBankRef, setEscrowBankRef] = useState(
    tenant.escrowBankRef ?? ''
  )
  const [depositDate, setDepositDate] = useState(tenant.depositDate ?? '')
  const [interestRate, setInterestRate] = useState(
    tenant.interestRate ?? ''
  )
  const [statementOfConditionDate, setStatementOfConditionDate] = useState(
    tenant.statementOfConditionDate ?? ''
  )
  const [isConfirmDeactivateOpen, setIsConfirmDeactivateOpen] = useState(false)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const handleSave = () => {
    const newErrors: Record<string, string> = {}
    if (
      securityDepositAmount &&
      monthlyRent &&
      parseFloat(securityDepositAmount) > parseFloat(monthlyRent)
    ) {
      newErrors.securityDepositAmount =
        "Security deposit cannot exceed first month's rent per MA G.L. c. 186 § 15B."
    }
    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await updateTenant(
          tenant.id,
          {
            ...(name !== tenant.name ? { name } : {}),
            ...(unitNumber !== tenant.unitNumber ? { unitNumber } : {}),
            ...(leaseStart !== (tenant.leaseStart ?? '')
              ? { leaseStart: leaseStart || null }
              : {}),
            ...(leaseEnd !== (tenant.leaseEnd ?? '')
              ? { leaseEnd: leaseEnd || null }
              : {}),
            ...(monthlyRent !== tenant.monthlyRent ? { monthlyRent } : {}),
            ...(fundingSourceType !== tenant.fundingSourceType
              ? { fundingSourceType }
              : {}),
            ...(moveInDate !== (tenant.moveInDate ?? '')
              ? { moveInDate: moveInDate || null }
              : {}),
            ...(securityDepositAmount !==
            (tenant.securityDepositAmount ?? '')
              ? {
                  securityDepositAmount:
                    securityDepositAmount || null,
                }
              : {}),
            ...(escrowBankRef !== (tenant.escrowBankRef ?? '')
              ? { escrowBankRef: escrowBankRef || null }
              : {}),
            ...(depositDate !== (tenant.depositDate ?? '')
              ? { depositDate: depositDate || null }
              : {}),
            ...(interestRate !== (tenant.interestRate ?? '')
              ? { interestRate: interestRate || null }
              : {}),
            ...(statementOfConditionDate !==
            (tenant.statementOfConditionDate ?? '')
              ? {
                  statementOfConditionDate:
                    statementOfConditionDate || null,
                }
              : {}),
          },
          'system'
        )
        setIsEditing(false)
        setFieldErrors({})
        toast.success('Tenant updated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to update tenant'
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
        await toggleTenantActive(tenant.id, true, 'system')
        toast.success('Tenant reactivated')
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
        await toggleTenantActive(tenant.id, false, 'system')
        setIsConfirmDeactivateOpen(false)
        toast.success('Tenant deactivated')
        router.refresh()
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : 'Failed to deactivate'
        )
        setIsConfirmDeactivateOpen(false)
      }
    })
  }

  const cancelEdit = () => {
    setIsEditing(false)
    setFieldErrors({})
    setName(tenant.name)
    setUnitNumber(tenant.unitNumber)
    setLeaseStart(tenant.leaseStart ?? '')
    setLeaseEnd(tenant.leaseEnd ?? '')
    setMonthlyRent(tenant.monthlyRent)
    setFundingSourceType(tenant.fundingSourceType)
    setMoveInDate(tenant.moveInDate ?? '')
    setSecurityDepositAmount(tenant.securityDepositAmount ?? '')
    setEscrowBankRef(tenant.escrowBankRef ?? '')
    setDepositDate(tenant.depositDate ?? '')
    setInterestRate(tenant.interestRate ?? '')
    setStatementOfConditionDate(tenant.statementOfConditionDate ?? '')
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href="/tenants">
          <Button
            variant="ghost"
            size="icon"
            data-testid="tenant-detail-back-btn"
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold tracking-tight">
            {tenant.name} (Unit {tenant.unitNumber})
          </h1>
          <div className="mt-1 flex items-center gap-2">
            <Badge
              variant="outline"
              className={fundingColors[tenant.fundingSourceType] ?? ''}
            >
              {fundingLabels[tenant.fundingSourceType] ??
                tenant.fundingSourceType}
            </Badge>
            <Badge variant={tenant.isActive ? 'default' : 'secondary'}>
              {tenant.isActive ? 'Active' : 'Inactive'}
            </Badge>
          </div>
        </div>
      </div>

      {/* Lease Details Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Lease Details</CardTitle>
          {!isEditing && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              data-testid="edit-tenant-btn"
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
                  data-testid="edit-tenant-name"
                />
              ) : (
                <p>{tenant.name}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Unit Number</Label>
              {isEditing ? (
                <Input
                  value={unitNumber}
                  onChange={(e) => setUnitNumber(e.target.value)}
                  data-testid="edit-tenant-unit"
                />
              ) : (
                <p className="font-mono">{tenant.unitNumber}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Monthly Rent</Label>
              {isEditing ? (
                <Input
                  value={monthlyRent}
                  onChange={(e) => setMonthlyRent(e.target.value)}
                  data-testid="edit-tenant-rent"
                />
              ) : (
                <p>{formatCurrency(tenant.monthlyRent)}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Funding Source <HelpTooltip term="funding-source-type" />
              </Label>
              {isEditing ? (
                <Select
                  value={fundingSourceType}
                  onValueChange={
                    setFundingSourceType as (v: string) => void
                  }
                >
                  <SelectTrigger data-testid="edit-tenant-funding">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TENANT_DIRECT">Self-Pay</SelectItem>
                    <SelectItem value="VASH">VASH</SelectItem>
                    <SelectItem value="MRVP">MRVP</SelectItem>
                    <SelectItem value="SECTION_8">Section 8</SelectItem>
                    <SelectItem value="OTHER_VOUCHER">
                      Other Voucher
                    </SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <p>
                  {fundingLabels[tenant.fundingSourceType] ??
                    tenant.fundingSourceType}
                </p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Lease Start</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={leaseStart}
                  onChange={(e) => setLeaseStart(e.target.value)}
                  data-testid="edit-tenant-lease-start"
                />
              ) : (
                <p>{formatDate(tenant.leaseStart)}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Lease End</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={leaseEnd}
                  onChange={(e) => setLeaseEnd(e.target.value)}
                  data-testid="edit-tenant-lease-end"
                />
              ) : (
                <p>{formatDate(tenant.leaseEnd)}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Move-In Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={moveInDate}
                  onChange={(e) => setMoveInDate(e.target.value)}
                  data-testid="edit-tenant-move-in"
                />
              ) : (
                <p>{formatDate(tenant.moveInDate)}</p>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="flex gap-2">
              <Button
                onClick={handleSave}
                disabled={isPending}
                data-testid="save-tenant-btn"
              >
                <Save className="mr-2 h-4 w-4" />
                Save
              </Button>
              <Button
                variant="outline"
                onClick={cancelEdit}
                data-testid="tenant-edit-cancel-btn"
              >
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Security Deposit Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-1">
            Security Deposit <HelpTooltip term="security-deposit" />
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground">Amount</Label>
              {isEditing ? (
                <>
                  <Input
                    value={securityDepositAmount}
                    onChange={(e) => {
                      setSecurityDepositAmount(e.target.value)
                      setFieldErrors((prev) => ({
                        ...prev,
                        securityDepositAmount: '',
                      }))
                    }}
                    placeholder="0.00"
                    data-testid="edit-tenant-deposit"
                  />
                  {fieldErrors.securityDepositAmount && (
                    <p className="text-sm text-destructive">
                      {fieldErrors.securityDepositAmount}
                    </p>
                  )}
                </>
              ) : (
                <p>
                  {formatCurrency(tenant.securityDepositAmount)}
                </p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Escrow Bank <HelpTooltip term="escrow-bank-ref" />
              </Label>
              {isEditing ? (
                <Input
                  value={escrowBankRef}
                  onChange={(e) => setEscrowBankRef(e.target.value)}
                  data-testid="edit-tenant-escrow"
                />
              ) : (
                <p>{tenant.escrowBankRef || '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">Deposit Date</Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  data-testid="edit-tenant-deposit-date"
                />
              ) : (
                <p>{formatDate(tenant.depositDate)}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">
                Interest Rate (%)
              </Label>
              {isEditing ? (
                <Input
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  data-testid="edit-tenant-interest"
                />
              ) : (
                <p>{tenant.interestRate ? `${tenant.interestRate}%` : '-'}</p>
              )}
            </div>
            <div>
              <Label className="text-muted-foreground">
                Statement of Condition
              </Label>
              {isEditing ? (
                <Input
                  type="date"
                  value={statementOfConditionDate}
                  onChange={(e) =>
                    setStatementOfConditionDate(e.target.value)
                  }
                  data-testid="edit-tenant-condition"
                />
              ) : (
                <p>{formatDate(tenant.statementOfConditionDate)}</p>
              )}
            </div>
            <div>
              <Label className="flex items-center gap-1 text-muted-foreground">
                Tenancy Anniversary{' '}
                <HelpTooltip term="tenancy-anniversary" />
              </Label>
              <p>{formatDate(tenant.tenancyAnniversary)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rent & AR Card (placeholder) */}
      <Card>
        <CardHeader>
          <CardTitle>Rent & AR</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Rent tracking available after Phase 7.
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
              checked={tenant.isActive}
              onCheckedChange={handleToggleActive}
              disabled={isPending}
              data-testid="tenant-active-toggle"
            />
            <span className="text-sm">
              {tenant.isActive ? 'Active' : 'Inactive'}
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
            <DialogTitle>Deactivate Tenant</DialogTitle>
            <DialogDescription>
              Are you sure you want to deactivate{' '}
              <strong>
                {tenant.name} (Unit {tenant.unitNumber})
              </strong>
              ? It will be hidden from selection dropdowns but preserved for
              historical reporting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsConfirmDeactivateOpen(false)}
              data-testid="tenant-deactivate-cancel-btn"
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={confirmDeactivation}
              disabled={isPending}
              data-testid="confirm-deactivate-tenant-btn"
            >
              Deactivate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
