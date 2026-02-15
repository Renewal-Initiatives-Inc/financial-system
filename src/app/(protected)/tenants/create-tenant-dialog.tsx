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
import { createTenant } from './actions'
import { toast } from 'sonner'

const FUNDING_SOURCES = [
  { value: 'TENANT_DIRECT', label: 'Tenant Direct (Self-Pay)' },
  { value: 'VASH', label: 'VASH' },
  { value: 'MRVP', label: 'MRVP' },
  { value: 'SECTION_8', label: 'Section 8' },
  { value: 'OTHER_VOUCHER', label: 'Other Voucher' },
] as const

interface CreateTenantDialogProps {
  open: boolean
  onClose: () => void
}

export function CreateTenantDialog({
  open,
  onClose,
}: CreateTenantDialogProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [unitNumber, setUnitNumber] = useState('')
  const [leaseStart, setLeaseStart] = useState('')
  const [leaseEnd, setLeaseEnd] = useState('')
  const [monthlyRent, setMonthlyRent] = useState('')
  const [fundingSourceType, setFundingSourceType] = useState('')
  const [moveInDate, setMoveInDate] = useState('')
  const [securityDepositAmount, setSecurityDepositAmount] = useState('')
  const [escrowBankRef, setEscrowBankRef] = useState('')
  const [depositDate, setDepositDate] = useState('')
  const [interestRate, setInterestRate] = useState('')
  const [statementOfConditionDate, setStatementOfConditionDate] = useState('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setUnitNumber('')
    setLeaseStart('')
    setLeaseEnd('')
    setMonthlyRent('')
    setFundingSourceType('')
    setMoveInDate('')
    setSecurityDepositAmount('')
    setEscrowBankRef('')
    setDepositDate('')
    setInterestRate('')
    setStatementOfConditionDate('')
    setFieldErrors({})
  }

  const handleSubmit = () => {
    const newErrors: Record<string, string> = {}
    if (!name.trim()) newErrors.name = 'Tenant name is required'
    if (!unitNumber.trim()) newErrors.unitNumber = 'Unit number is required'
    if (!monthlyRent.trim()) newErrors.monthlyRent = 'Monthly rent is required'
    if (!fundingSourceType)
      newErrors.fundingSourceType = 'Funding source is required'

    // Security deposit validation
    if (securityDepositAmount && monthlyRent) {
      if (
        parseFloat(securityDepositAmount) > parseFloat(monthlyRent)
      ) {
        newErrors.securityDepositAmount =
          "Security deposit cannot exceed first month's rent per MA G.L. c. 186 § 15B."
      }
    }

    if (Object.keys(newErrors).length > 0) {
      setFieldErrors(newErrors)
      return
    }

    startTransition(async () => {
      try {
        await createTenant(
          {
            name: name.trim(),
            unitNumber: unitNumber.trim(),
            leaseStart: leaseStart || null,
            leaseEnd: leaseEnd || null,
            monthlyRent,
            fundingSourceType: fundingSourceType as
              | 'TENANT_DIRECT'
              | 'VASH'
              | 'MRVP'
              | 'SECTION_8'
              | 'OTHER_VOUCHER',
            moveInDate: moveInDate || null,
            securityDepositAmount: securityDepositAmount || null,
            escrowBankRef: escrowBankRef.trim() || null,
            depositDate: depositDate || null,
            interestRate: interestRate || null,
            statementOfConditionDate: statementOfConditionDate || null,
          }
        )
        toast.success('Tenant created')
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
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create Tenant</DialogTitle>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {/* Basic Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tenant-name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, name: '' }))
                }}
                placeholder="Tenant name"
                data-testid="create-tenant-name"
              />
              {fieldErrors.name && (
                <p className="text-sm text-destructive">
                  {fieldErrors.name}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label htmlFor="tenant-unit">
                Unit Number <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-unit"
                value={unitNumber}
                onChange={(e) => {
                  setUnitNumber(e.target.value)
                  setFieldErrors((prev) => ({ ...prev, unitNumber: '' }))
                }}
                placeholder="e.g., 1A"
                data-testid="create-tenant-unit"
              />
              {fieldErrors.unitNumber && (
                <p className="text-sm text-destructive">
                  {fieldErrors.unitNumber}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="tenant-rent">
                Monthly Rent <span className="text-destructive">*</span>
              </Label>
              <Input
                id="tenant-rent"
                value={monthlyRent}
                onChange={(e) => {
                  setMonthlyRent(e.target.value)
                  setFieldErrors((prev) => ({
                    ...prev,
                    monthlyRent: '',
                    securityDepositAmount: '',
                  }))
                }}
                placeholder="0.00"
                data-testid="create-tenant-rent"
              />
              {fieldErrors.monthlyRent && (
                <p className="text-sm text-destructive">
                  {fieldErrors.monthlyRent}
                </p>
              )}
            </div>
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                Funding Source <span className="text-destructive">*</span>
                <HelpTooltip term="funding-source-type" />
              </Label>
              <Select
                value={fundingSourceType}
                onValueChange={(v) => {
                  setFundingSourceType(v)
                  setFieldErrors((prev) => ({
                    ...prev,
                    fundingSourceType: '',
                  }))
                }}
              >
                <SelectTrigger data-testid="create-tenant-funding">
                  <SelectValue placeholder="Select source" />
                </SelectTrigger>
                <SelectContent>
                  {FUNDING_SOURCES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {fieldErrors.fundingSourceType && (
                <p className="text-sm text-destructive">
                  {fieldErrors.fundingSourceType}
                </p>
              )}
            </div>
          </div>

          {/* Lease Dates */}
          <div className="grid grid-cols-3 gap-4">
            <div className="grid gap-2">
              <Label>Lease Start</Label>
              <Input
                type="date"
                value={leaseStart}
                onChange={(e) => setLeaseStart(e.target.value)}
                data-testid="create-tenant-lease-start"
              />
            </div>
            <div className="grid gap-2">
              <Label>Lease End</Label>
              <Input
                type="date"
                value={leaseEnd}
                onChange={(e) => setLeaseEnd(e.target.value)}
                data-testid="create-tenant-lease-end"
              />
            </div>
            <div className="grid gap-2">
              <Label>Move-In Date</Label>
              <Input
                type="date"
                value={moveInDate}
                onChange={(e) => setMoveInDate(e.target.value)}
                data-testid="create-tenant-move-in"
              />
            </div>
          </div>

          {/* Security Deposit Section */}
          <div className="border rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-medium flex items-center gap-1">
              Security Deposit <HelpTooltip term="security-deposit" />
            </h3>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Deposit Amount</Label>
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
                  data-testid="create-tenant-deposit-amount"
                />
                {fieldErrors.securityDepositAmount && (
                  <p className="text-sm text-destructive">
                    {fieldErrors.securityDepositAmount}
                  </p>
                )}
              </div>
              <div className="grid gap-2">
                <Label className="flex items-center gap-1">
                  Escrow Bank Ref <HelpTooltip term="escrow-bank-ref" />
                </Label>
                <Input
                  value={escrowBankRef}
                  onChange={(e) => setEscrowBankRef(e.target.value)}
                  placeholder="Bank account reference"
                  data-testid="create-tenant-escrow-bank"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2">
                <Label>Deposit Date</Label>
                <Input
                  type="date"
                  value={depositDate}
                  onChange={(e) => setDepositDate(e.target.value)}
                  data-testid="create-tenant-deposit-date"
                />
              </div>
              <div className="grid gap-2">
                <Label>Interest Rate (%)</Label>
                <Input
                  value={interestRate}
                  onChange={(e) => setInterestRate(e.target.value)}
                  placeholder="0.0000"
                  data-testid="create-tenant-interest-rate"
                />
                <p className="text-xs text-muted-foreground">
                  Lesser of actual bank rate or 5% per MA G.L. c. 186 § 15B
                </p>
              </div>
              <div className="grid gap-2">
                <Label>Statement of Condition</Label>
                <Input
                  type="date"
                  value={statementOfConditionDate}
                  onChange={(e) =>
                    setStatementOfConditionDate(e.target.value)
                  }
                  data-testid="create-tenant-condition-date"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={onClose}
            data-testid="create-tenant-cancel-btn"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isPending}
            data-testid="create-tenant-submit"
          >
            Create Tenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
