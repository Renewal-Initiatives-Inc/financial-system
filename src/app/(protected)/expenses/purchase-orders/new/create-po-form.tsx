'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Card,
  CardContent,
} from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  ContractUploadExtract,
  type ContractExtractionData,
} from '@/components/shared/contract-upload-extract'
import { GroupedAccountSelect } from '@/app/(protected)/bank-rec/components/grouped-account-select'
import { createPurchaseOrder } from '../../actions'
import { toast } from 'sonner'

// --- Props ---

interface CreatePOFormProps {
  vendors: { id: number; name: string }[]
  accounts: { id: number; code: string; name: string; type: string; subType: string | null }[]
  funds: { id: number; name: string; restrictionType: string }[]
  cipCostCodes: { id: number; code: string; name: string; category: string }[]
}

// --- Component ---

export function CreatePOForm({
  vendors,
  accounts,
  funds,
  cipCostCodes,
}: CreatePOFormProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  // Form state
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [vendorOpen, setVendorOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [totalAmount, setTotalAmount] = useState('')
  const [glAccountId, setGlAccountId] = useState<string>('')
  const [fundId, setFundId] = useState<string>('')
  const [cipCostCodeId, setCipCostCodeId] = useState<string>('')

  // Contract extraction state (managed by shared component)
  const [contractData, setContractData] = useState<ContractExtractionData>({
    contractPdfUrl: null,
    extractedMilestones: null,
    extractedTerms: null,
    extractedCovenants: null,
    revenueClassification: null,
    classificationRationale: null,
    fundingCategory: null,
  })

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Derived: does the selected GL account have CIP subType?
  const selectedAccount = accounts.find((a) => a.id === Number(glAccountId))
  const showCipCostCode = selectedAccount?.subType?.includes('CIP') ?? false

  // --- Handlers ---

  const handleAmountChange = (value: string) => {
    // Allow digits, decimal point, and commas; strip everything else
    const cleaned = value.replace(/[^0-9.,]/g, '')
    setTotalAmount(cleaned)
    setFieldErrors((prev) => ({ ...prev, totalAmount: '' }))
  }

  const parseAmount = (raw: string): number => {
    // Remove commas, parse as float
    return parseFloat(raw.replace(/,/g, ''))
  }

  const validate = (): boolean => {
    const errors: Record<string, string> = {}

    if (!vendorId) errors.vendor = 'Vendor is required'
    if (!description.trim()) errors.description = 'Description is required'
    if (!totalAmount.trim()) {
      errors.totalAmount = 'Total amount is required'
    } else if (isNaN(parseAmount(totalAmount)) || parseAmount(totalAmount) <= 0) {
      errors.totalAmount = 'Enter a valid amount greater than zero'
    }
    if (!glAccountId) errors.glAccount = 'GL destination account is required'
    if (!fundId) errors.fund = 'Fund is required'
    if (showCipCostCode && !cipCostCodeId) {
      errors.cipCostCode = 'CIP cost code is required for CIP accounts'
    }

    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = (status: 'DRAFT' | 'ACTIVE') => {
    if (!validate()) return

    // Parse extracted JSON, falling back to null
    let milestones: unknown = null
    let terms: unknown = null
    let covenants: unknown = null

    try {
      if (contractData.extractedMilestones) milestones = JSON.parse(contractData.extractedMilestones)
    } catch {
      /* user may have edited JSON incorrectly — skip */
    }
    try {
      if (contractData.extractedTerms) terms = JSON.parse(contractData.extractedTerms)
    } catch {
      /* skip */
    }
    try {
      if (contractData.extractedCovenants) covenants = JSON.parse(contractData.extractedCovenants)
    } catch {
      /* skip */
    }

    startTransition(async () => {
      try {
        const result = await createPurchaseOrder(
          {
            vendorId: vendorId!,
            description: description.trim(),
            contractPdfUrl: contractData.contractPdfUrl,
            totalAmount: parseAmount(totalAmount),
            glDestinationAccountId: parseInt(glAccountId, 10),
            fundId: parseInt(fundId, 10),
            cipCostCodeId: showCipCostCode && cipCostCodeId
              ? parseInt(cipCostCodeId, 10)
              : null,
            status,
            extractedMilestones: milestones,
            extractedTerms: terms,
            extractedCovenants: covenants,
          }
        )

        toast.success(
          status === 'DRAFT'
            ? 'Purchase order saved as draft'
            : 'Purchase order created and activated'
        )
        router.push(`/expenses/purchase-orders/${result.id}`)
      } catch (err) {
        if (err instanceof Error) {
          toast.error(err.message)
        }
      }
    })
  }

  // --- Render ---

  const selectedVendor = vendors.find((v) => v.id === vendorId)

  return (
    <Card className="max-w-2xl">
      <CardContent className="pt-6">
        <div className="grid gap-6">
          {/* 1. Vendor — Searchable Combobox */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Vendor <span className="text-destructive">*</span>
            </Label>
            <Popover open={vendorOpen} onOpenChange={setVendorOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={vendorOpen}
                  className="w-full justify-between font-normal"
                  data-testid="po-vendor-select"
                >
                  {selectedVendor ? (
                    <span className="truncate">{selectedVendor.name}</span>
                  ) : (
                    <span className="text-muted-foreground">
                      Select vendor...
                    </span>
                  )}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[350px] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Search vendors..." />
                  <CommandList>
                    <CommandEmpty>No vendors found.</CommandEmpty>
                    <CommandGroup>
                      {vendors.map((vendor) => (
                        <CommandItem
                          key={vendor.id}
                          value={vendor.name}
                          onSelect={() => {
                            setVendorId(
                              vendor.id === vendorId ? null : vendor.id
                            )
                            setVendorOpen(false)
                            setFieldErrors((prev) => ({
                              ...prev,
                              vendor: '',
                            }))
                          }}
                        >
                          <Check
                            className={cn(
                              'mr-2 h-4 w-4',
                              vendorId === vendor.id
                                ? 'opacity-100'
                                : 'opacity-0'
                            )}
                          />
                          <span className="truncate">{vendor.name}</span>
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
            {fieldErrors.vendor && (
              <p className="text-sm text-destructive">{fieldErrors.vendor}</p>
            )}
          </div>

          {/* 2. Description */}
          <div className="grid gap-2">
            <Label htmlFor="po-description">
              Description <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="po-description"
              value={description}
              onChange={(e) => {
                setDescription(e.target.value)
                setFieldErrors((prev) => ({ ...prev, description: '' }))
              }}
              placeholder="Describe the purchase order scope..."
              rows={3}
              data-testid="po-description"
            />
            {fieldErrors.description && (
              <p className="text-sm text-destructive">
                {fieldErrors.description}
              </p>
            )}
          </div>

          {/* 3. Contract PDF Upload + AI Extraction */}
          <ContractUploadExtract
            onChange={setContractData}
            testIdPrefix="po"
          />

          {/* 4. Total Amount */}
          <div className="grid gap-2">
            <Label htmlFor="po-total-amount">
              Total Amount <span className="text-destructive">*</span>
            </Label>
            <Input
              id="po-total-amount"
              value={totalAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
              inputMode="decimal"
              placeholder="0.00"
              data-testid="po-total-amount"
            />
            {fieldErrors.totalAmount && (
              <p className="text-sm text-destructive">
                {fieldErrors.totalAmount}
              </p>
            )}
          </div>

          {/* 5. GL Destination Account — Searchable combobox grouped by type */}
          <div className="grid gap-2">
            <Label>
              GL Destination Account{' '}
              <span className="text-destructive">*</span>
            </Label>
            <GroupedAccountSelect
              accounts={accounts}
              value={glAccountId}
              onValueChange={(v) => {
                setGlAccountId(v)
                setFieldErrors((prev) => ({ ...prev, glAccount: '' }))
                // Reset CIP cost code when account changes
                const acct = accounts.find((a) => a.id === Number(v))
                if (!acct?.subType?.includes('CIP')) {
                  setCipCostCodeId('')
                }
              }}
              placeholder="Search GL accounts..."
              testId="po-gl-account"
            />
            {fieldErrors.glAccount && (
              <p className="text-sm text-destructive">
                {fieldErrors.glAccount}
              </p>
            )}
          </div>

          {/* 6. Fund */}
          <div className="grid gap-2">
            <Label>
              Funding Source <span className="text-destructive">*</span>
            </Label>
            <Select
              value={fundId}
              onValueChange={(v) => {
                setFundId(v)
                setFieldErrors((prev) => ({ ...prev, fund: '' }))
              }}
            >
              <SelectTrigger data-testid="po-fund">
                <SelectValue placeholder="Select funding source..." />
              </SelectTrigger>
              <SelectContent>
                {funds.map((fund) => (
                  <SelectItem key={fund.id} value={String(fund.id)}>
                    {fund.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.fund && (
              <p className="text-sm text-destructive">{fieldErrors.fund}</p>
            )}
          </div>

          {/* 7. CIP Cost Code — only when GL account has CIP subType */}
          {showCipCostCode && (
            <div className="grid gap-2">
              <Label className="flex items-center gap-1">
                CIP Cost Code{' '}
                <span className="text-destructive">*</span>
                <HelpTooltip term="cip-cost-code-inheritance" />
              </Label>
              <Select
                value={cipCostCodeId}
                onValueChange={(v) => {
                  setCipCostCodeId(v)
                  setFieldErrors((prev) => ({ ...prev, cipCostCode: '' }))
                }}
              >
                <SelectTrigger data-testid="po-cip-cost-code">
                  <SelectValue placeholder="Select CIP cost code..." />
                </SelectTrigger>
                <SelectContent>
                  {(() => {
                    const hardCosts = cipCostCodes.filter(
                      (c) => c.category === 'HARD_COST'
                    )
                    const softCosts = cipCostCodes.filter(
                      (c) => c.category === 'SOFT_COST'
                    )
                    return (
                      <>
                        {hardCosts.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Hard Costs</SelectLabel>
                            {hardCosts.map((code) => (
                              <SelectItem
                                key={code.id}
                                value={String(code.id)}
                              >
                                <span className="font-mono text-xs mr-2">
                                  {code.code}
                                </span>
                                {code.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                        {softCosts.length > 0 && (
                          <SelectGroup>
                            <SelectLabel>Soft Costs</SelectLabel>
                            {softCosts.map((code) => (
                              <SelectItem
                                key={code.id}
                                value={String(code.id)}
                              >
                                <span className="font-mono text-xs mr-2">
                                  {code.code}
                                </span>
                                {code.name}
                              </SelectItem>
                            ))}
                          </SelectGroup>
                        )}
                      </>
                    )
                  })()}
                </SelectContent>
              </Select>
              {fieldErrors.cipCostCode && (
                <p className="text-sm text-destructive">
                  {fieldErrors.cipCostCode}
                </p>
              )}
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex items-center gap-3 pt-4 border-t">
            <Button
              variant="outline"
              onClick={() => handleSubmit('DRAFT')}
              disabled={isPending}
              data-testid="po-save-draft-btn"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save as Draft
            </Button>
            <Button
              onClick={() => handleSubmit('ACTIVE')}
              disabled={isPending}
              data-testid="po-save-activate-btn"
            >
              {isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Save &amp; Activate
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
