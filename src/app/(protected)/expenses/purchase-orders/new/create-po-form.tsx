'use client'

import { useState, useRef, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Check, ChevronsUpDown, ChevronDown, ChevronRight, Upload, FileText, Loader2 } from 'lucide-react'
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
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { createPurchaseOrder } from '../../actions'
import { toast } from 'sonner'

// --- Props ---

interface CreatePOFormProps {
  vendors: { id: number; name: string }[]
  accounts: { id: number; code: string; name: string; subType: string | null }[]
  funds: { id: number; name: string; restrictionType: string }[]
  cipCostCodes: { id: number; code: string; name: string; category: string }[]
}

// --- Account type grouping ---

const typeLabels: Record<string, string> = {
  ASSET: 'Asset',
  LIABILITY: 'Liability',
  NET_ASSET: 'Net Asset',
  REVENUE: 'Revenue',
  EXPENSE: 'Expense',
}

const typeOrder = ['ASSET', 'LIABILITY', 'NET_ASSET', 'REVENUE', 'EXPENSE']

function groupAccountsByType(
  accounts: { id: number; code: string; name: string; subType: string | null }[]
) {
  // Infer account type from code prefix:
  // 1xxx = ASSET, 2xxx = LIABILITY, 3xxx = NET_ASSET, 4xxx = REVENUE, 5xxx-9xxx = EXPENSE
  function inferType(code: string): string {
    const first = code.charAt(0)
    switch (first) {
      case '1':
        return 'ASSET'
      case '2':
        return 'LIABILITY'
      case '3':
        return 'NET_ASSET'
      case '4':
        return 'REVENUE'
      default:
        return 'EXPENSE'
    }
  }

  return typeOrder
    .map((type) => ({
      type,
      label: typeLabels[type],
      accounts: accounts.filter((a) => inferType(a.code) === type),
    }))
    .filter((g) => g.accounts.length > 0)
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
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Form state
  const [vendorId, setVendorId] = useState<number | null>(null)
  const [vendorOpen, setVendorOpen] = useState(false)
  const [description, setDescription] = useState('')
  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null)
  const [contractFileName, setContractFileName] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [totalAmount, setTotalAmount] = useState('')
  const [glAccountId, setGlAccountId] = useState<string>('')
  const [fundId, setFundId] = useState<string>('')
  const [cipCostCodeId, setCipCostCodeId] = useState<string>('')

  // Contract extraction state
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedMilestones, setExtractedMilestones] = useState<string | null>(null)
  const [extractedTerms, setExtractedTerms] = useState<string | null>(null)
  const [extractedCovenants, setExtractedCovenants] = useState<string | null>(null)
  const [milestonesOpen, setMilestonesOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [covenantsOpen, setCovenantsOpen] = useState(false)

  // Validation state
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Derived: does the selected GL account have CIP subType?
  const selectedAccount = accounts.find((a) => a.id === Number(glAccountId))
  const showCipCostCode = selectedAccount?.subType?.includes('CIP') ?? false

  // Grouped accounts for the Select
  const groupedAccounts = groupAccountsByType(accounts)

  // --- Handlers ---

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setIsUploading(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        throw new Error('Upload failed')
      }

      const data = await res.json()
      setContractPdfUrl(data.url)
      setContractFileName(file.name)
      toast.success('Contract uploaded')
    } catch {
      toast.error('Failed to upload contract PDF')
    } finally {
      setIsUploading(false)
    }
  }

  const handleExtractTerms = async () => {
    if (!contractPdfUrl) return

    setIsExtracting(true)
    try {
      // Fetch the uploaded PDF and convert to base64
      const pdfRes = await fetch(contractPdfUrl)
      const pdfBlob = await pdfRes.blob()
      const pdfBase64 = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.readAsDataURL(pdfBlob)
      })

      const res = await fetch('/api/extract-contract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pdfBase64 }),
      })

      if (!res.ok) {
        throw new Error('Extraction failed')
      }

      const data = await res.json()

      if (data.milestones) {
        setExtractedMilestones(JSON.stringify(data.milestones, null, 2))
        setMilestonesOpen(true)
      }
      if (data.terms) {
        setExtractedTerms(JSON.stringify(data.terms, null, 2))
        setTermsOpen(true)
      }
      if (data.covenants) {
        setExtractedCovenants(JSON.stringify(data.covenants, null, 2))
        setCovenantsOpen(true)
      }

      toast.success('Contract terms extracted')
    } catch {
      toast.error('Failed to extract contract terms. You can skip this step.')
    } finally {
      setIsExtracting(false)
    }
  }

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
      if (extractedMilestones) milestones = JSON.parse(extractedMilestones)
    } catch {
      /* user may have edited JSON incorrectly — skip */
    }
    try {
      if (extractedTerms) terms = JSON.parse(extractedTerms)
    } catch {
      /* skip */
    }
    try {
      if (extractedCovenants) covenants = JSON.parse(extractedCovenants)
    } catch {
      /* skip */
    }

    startTransition(async () => {
      try {
        const result = await createPurchaseOrder(
          {
            vendorId: vendorId!,
            description: description.trim(),
            contractPdfUrl,
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

          {/* 3. Contract PDF Upload */}
          <div className="grid gap-2">
            <Label className="flex items-center gap-1">
              Contract PDF{' '}
              <HelpTooltip term="contract-extraction" />
            </Label>
            <div className="flex items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                className="hidden"
                data-testid="po-contract-upload"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="mr-2 h-4 w-4" />
                    Choose File
                  </>
                )}
              </Button>
              {contractFileName && (
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <FileText className="h-4 w-4" />
                  {contractFileName}
                </span>
              )}
            </div>

            {/* Extract Terms button — shown after successful upload */}
            {contractPdfUrl && (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit mt-1"
                onClick={handleExtractTerms}
                disabled={isExtracting}
                data-testid="po-extract-terms-btn"
              >
                {isExtracting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Extracting...
                  </>
                ) : (
                  'Extract Terms'
                )}
              </Button>
            )}
          </div>

          {/* Extracted contract sections — collapsible editable cards */}
          {extractedMilestones && (
            <div className="border rounded-lg">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50"
                onClick={() => setMilestonesOpen(!milestonesOpen)}
              >
                {milestonesOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Extracted Milestones
              </button>
              {milestonesOpen && (
                <div className="px-4 pb-4">
                  <Textarea
                    value={extractedMilestones}
                    onChange={(e) => setExtractedMilestones(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {extractedTerms && (
            <div className="border rounded-lg">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50"
                onClick={() => setTermsOpen(!termsOpen)}
              >
                {termsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Extracted Terms
              </button>
              {termsOpen && (
                <div className="px-4 pb-4">
                  <Textarea
                    value={extractedTerms}
                    onChange={(e) => setExtractedTerms(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}

          {extractedCovenants && (
            <div className="border rounded-lg">
              <button
                type="button"
                className="flex items-center gap-2 w-full px-4 py-3 text-sm font-medium text-left hover:bg-muted/50"
                onClick={() => setCovenantsOpen(!covenantsOpen)}
              >
                {covenantsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
                Extracted Covenants
              </button>
              {covenantsOpen && (
                <div className="px-4 pb-4">
                  <Textarea
                    value={extractedCovenants}
                    onChange={(e) => setExtractedCovenants(e.target.value)}
                    rows={6}
                    className="font-mono text-xs"
                  />
                </div>
              )}
            </div>
          )}

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

          {/* 5. GL Destination Account — Select grouped by type */}
          <div className="grid gap-2">
            <Label>
              GL Destination Account{' '}
              <span className="text-destructive">*</span>
            </Label>
            <Select
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
            >
              <SelectTrigger data-testid="po-gl-account">
                <SelectValue placeholder="Select GL account..." />
              </SelectTrigger>
              <SelectContent>
                {groupedAccounts.map((group) => (
                  <SelectGroup key={group.type}>
                    <SelectLabel>{group.label}</SelectLabel>
                    {group.accounts.map((acct) => (
                      <SelectItem key={acct.id} value={String(acct.id)}>
                        <span className="font-mono text-xs mr-2">
                          {acct.code}
                        </span>
                        {acct.name}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                ))}
              </SelectContent>
            </Select>
            {fieldErrors.glAccount && (
              <p className="text-sm text-destructive">
                {fieldErrors.glAccount}
              </p>
            )}
          </div>

          {/* 6. Fund */}
          <div className="grid gap-2">
            <Label>
              Fund <span className="text-destructive">*</span>
            </Label>
            <Select
              value={fundId}
              onValueChange={(v) => {
                setFundId(v)
                setFieldErrors((prev) => ({ ...prev, fund: '' }))
              }}
            >
              <SelectTrigger data-testid="po-fund">
                <SelectValue placeholder="Select fund..." />
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
