'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, AlertTriangle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import {
  ContractUploadExtract,
  type ContractExtractionData,
} from '@/components/shared/contract-upload-extract'
import { toast } from 'sonner'
import { createFundingSource } from '../../actions'

type FundingCategory = 'GRANT' | 'CONTRACT' | 'LOAN'

interface Props {
  vendors: { id: number; name: string }[]
}

export function CreateFundingSourceClient({ vendors }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
  const [fundingCategory, setFundingCategory] = useState<FundingCategory | ''>('')
  const [restrictionType, setRestrictionType] = useState<'RESTRICTED' | 'UNRESTRICTED' | ''>('')
  const [description, setDescription] = useState('')
  const [funderId, setFunderId] = useState('')
  const [amount, setAmount] = useState('')
  const [type, setType] = useState<'CONDITIONAL' | 'UNCONDITIONAL' | ''>('')
  const [conditions, setConditions] = useState('')
  const [startDate, setStartDate] = useState('')
  const [endDate, setEndDate] = useState('')
  const [isUnusualGrant, setIsUnusualGrant] = useState(false)
  const [matchRequirementPercent, setMatchRequirementPercent] = useState('')
  const [retainagePercent, setRetainagePercent] = useState('')
  const [reportingFrequency, setReportingFrequency] = useState('')
  const [interestRate, setInterestRate] = useState('')

  // Revenue classification
  const [revenueClassification, setRevenueClassification] = useState<'GRANT_REVENUE' | 'EARNED_INCOME' | ''>('')
  const [classificationRationale, setClassificationRationale] = useState('')
  const [aiRecommended, setAiRecommended] = useState(false)

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

  const handleCategoryChange = (cat: FundingCategory) => {
    setFundingCategory(cat)
    // Always update revenue classification when category changes
    if (cat === 'GRANT') {
      setRevenueClassification('GRANT_REVENUE')
    } else if (cat === 'CONTRACT') {
      setRevenueClassification('EARNED_INCOME')
    } else if (cat === 'LOAN') {
      setRevenueClassification('')
    }
  }

  const handleContractDataChange = (data: ContractExtractionData) => {
    setContractData(data)
    // If AI returned a classification, pre-fill it
    if (data.revenueClassification && !revenueClassification) {
      setRevenueClassification(data.revenueClassification)
      setClassificationRationale(data.classificationRationale ?? '')
      setAiRecommended(true)
    }
    // If AI returned a category, pre-fill it
    if (data.fundingCategory && !fundingCategory) {
      handleCategoryChange(data.fundingCategory)
    }
  }

  const isGrantOrContract = fundingCategory === 'GRANT' || fundingCategory === 'CONTRACT'
  const isGrant = fundingCategory === 'GRANT'
  const isLoan = fundingCategory === 'LOAN'
  const hasCategory = fundingCategory !== ''

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Parse extracted JSON, falling back to null
    let milestones: unknown = null
    let terms: unknown = null
    let covenants: unknown = null

    try {
      if (contractData.extractedMilestones) milestones = JSON.parse(contractData.extractedMilestones)
    } catch { /* user may have edited JSON incorrectly — skip */ }
    try {
      if (contractData.extractedTerms) terms = JSON.parse(contractData.extractedTerms)
    } catch { /* skip */ }
    try {
      if (contractData.extractedCovenants) covenants = JSON.parse(contractData.extractedCovenants)
    } catch { /* skip */ }

    startTransition(async () => {
      try {
        const result = await createFundingSource(
          {
            name,
            fundingCategory: fundingCategory as FundingCategory,
            restrictionType: restrictionType as 'RESTRICTED' | 'UNRESTRICTED',
            description: description || null,
            funderId: funderId ? parseInt(funderId) : 0, // validator requires positive int
            amount: amount || null,
            type: (isGrantOrContract && type ? type : null) as 'CONDITIONAL' | 'UNCONDITIONAL' | null,
            conditions: type === 'CONDITIONAL' ? conditions : null,
            startDate: startDate || null,
            endDate: endDate || null,
            isUnusualGrant: isGrant ? isUnusualGrant : false,
            matchRequirementPercent: isGrant ? matchRequirementPercent || null : null,
            retainagePercent: isGrant ? retainagePercent || null : null,
            reportingFrequency: reportingFrequency || null,
            interestRate: isLoan && interestRate
              ? (parseFloat(interestRate) / 100).toFixed(4)
              : null,
            contractPdfUrl: contractData.contractPdfUrl,
            extractedMilestones: milestones,
            extractedTerms: terms,
            extractedCovenants: covenants,
            revenueClassification: isGrantOrContract ? revenueClassification || null : null,
            classificationRationale: isGrantOrContract ? classificationRationale || null : null,
          },
          'system'
        )
        toast.success(`Funding source created`)
        router.push(`/revenue/funding-sources/${result.id}`)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Failed to create funding source')
      }
    })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/revenue/funding-sources">
          <Button variant="ghost" size="icon" data-testid="create-funding-source-back-btn">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">New Funding Source</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Funding Source Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row 1: Name */}
            <div>
              <Label>Name <span className="text-destructive">*</span></Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., CPA Grant, MassDev Contract, AHP Loan"
                data-testid="funding-source-name"
              />
            </div>

            {/* Row 2: Category + Restriction */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label className="flex items-center gap-1">
                  Category <span className="text-destructive">*</span>
                  <HelpTooltip term="funding-category" />
                </Label>
                <Select
                  value={fundingCategory}
                  onValueChange={(v) => handleCategoryChange(v as FundingCategory)}
                >
                  <SelectTrigger data-testid="funding-source-category-select">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GRANT">Grant</SelectItem>
                    <SelectItem value="CONTRACT">Contract</SelectItem>
                    <SelectItem value="LOAN">Loan</SelectItem>
                  </SelectContent>
                </Select>
                {contractData.categoryWasDefaulted && aiRecommended && (
                  <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-1" data-testid="funding-source-category-defaulted-warning">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    AI could not confidently determine this — please verify.
                  </p>
                )}
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  Restriction <span className="text-destructive">*</span>
                  <HelpTooltip term="restriction-type" />
                </Label>
                <Select
                  value={restrictionType}
                  onValueChange={(v) => setRestrictionType(v as 'RESTRICTED' | 'UNRESTRICTED')}
                >
                  <SelectTrigger data-testid="funding-source-restriction-select">
                    <SelectValue placeholder="Select restriction type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="UNRESTRICTED">Unrestricted</SelectItem>
                    <SelectItem value="RESTRICTED">Restricted</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <Label>Description</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                data-testid="funding-source-description"
              />
            </div>

            {/* Detail fields — shown once a category is selected */}
            {hasCategory && (
              <>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">
                    {isLoan ? 'Lender & Loan Details' : 'Funder & Contract Details'}
                  </h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label className="flex items-center gap-1">
                      {isLoan ? 'Lender' : 'Funder'} (Vendor){' '}
                      <span className="text-destructive">*</span>
                      <HelpTooltip term="funding-source-funder" />
                    </Label>
                    <Select value={funderId} onValueChange={setFunderId}>
                      <SelectTrigger data-testid="funding-source-funder-select">
                        <SelectValue placeholder={isLoan ? 'Select lender' : 'Select funder'} />
                      </SelectTrigger>
                      <SelectContent>
                        {vendors.map((v) => (
                          <SelectItem key={v.id} value={String(v.id)}>
                            {v.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="flex items-center gap-1">
                      {isLoan ? 'Principal Amount' : 'Award Amount'}
                      <HelpTooltip term="funding-source-amount" />
                    </Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      data-testid="funding-source-amount"
                    />
                  </div>

                  {/* Conditional/Unconditional — GRANT + CONTRACT only */}
                  {isGrantOrContract && (
                    <div>
                      <Label className="flex items-center gap-1">
                        Type <HelpTooltip term="grant-conditional" />
                      </Label>
                      <Select
                        value={type}
                        onValueChange={(v) => setType(v as 'CONDITIONAL' | 'UNCONDITIONAL')}
                      >
                        <SelectTrigger data-testid="funding-source-type-select">
                          <SelectValue placeholder="Select type" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="UNCONDITIONAL">Unconditional</SelectItem>
                          <SelectItem value="CONDITIONAL">Conditional</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Interest Rate — LOAN only */}
                  {isLoan && (
                    <div>
                      <Label className="flex items-center gap-1">
                        Interest Rate (%)
                        <HelpTooltip term="interest-rate" />
                      </Label>
                      <Input
                        type="number"
                        step="0.0001"
                        min="0"
                        max="100"
                        value={interestRate}
                        onChange={(e) => setInterestRate(e.target.value)}
                        placeholder="e.g., 4.75"
                        data-testid="funding-source-interest-rate"
                      />
                    </div>
                  )}

                  <div>
                    <Label className="flex items-center gap-1">
                      Reporting Frequency
                      <HelpTooltip term="reporting-frequency" />
                    </Label>
                    <Select value={reportingFrequency} onValueChange={setReportingFrequency}>
                      <SelectTrigger data-testid="funding-source-reporting-select">
                        <SelectValue placeholder="Select frequency" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="semi-annual">Semi-Annual</SelectItem>
                        <SelectItem value="annual">Annual</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="flex items-center gap-1">
                      Start Date
                      <HelpTooltip term="funding-start-date" />
                    </Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="funding-source-start-date"
                    />
                  </div>

                  <div>
                    <Label className="flex items-center gap-1">
                      End Date
                      <HelpTooltip term="funding-end-date" />
                    </Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="funding-source-end-date"
                    />
                  </div>

                  {/* Match + Retainage — GRANT only */}
                  {isGrant && (
                    <>
                      <div>
                        <Label className="flex items-center gap-1">
                          Match Requirement %
                          <HelpTooltip term="match-requirement" />
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={matchRequirementPercent}
                          onChange={(e) => setMatchRequirementPercent(e.target.value)}
                          data-testid="funding-source-match-pct"
                        />
                      </div>

                      <div>
                        <Label className="flex items-center gap-1">
                          Retainage %
                          <HelpTooltip term="retainage-percent" />
                        </Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          max="100"
                          value={retainagePercent}
                          onChange={(e) => setRetainagePercent(e.target.value)}
                          data-testid="funding-source-retainage-pct"
                        />
                      </div>
                    </>
                  )}
                </div>

                {/* Conditions — shown when CONDITIONAL selected */}
                {type === 'CONDITIONAL' && (
                  <div>
                    <Label>
                      Conditions <span className="text-destructive">*</span>
                    </Label>
                    <Textarea
                      value={conditions}
                      onChange={(e) => setConditions(e.target.value)}
                      placeholder="Describe the conditions for revenue recognition"
                      data-testid="funding-source-conditions"
                    />
                  </div>
                )}

                {/* Contract PDF Upload + AI Extraction — all categories */}
                <ContractUploadExtract
                  onChange={handleContractDataChange}
                  testIdPrefix="funding-source"
                />

                {/* Revenue Classification — GRANT + CONTRACT only */}
                {isGrantOrContract && (
                  <div className="border-t pt-4">
                    <h3 className="text-sm font-medium mb-3 flex items-center gap-1">
                      Revenue Classification
                      <HelpTooltip term="revenue-classification" />
                    </h3>
                    <RadioGroup
                      value={revenueClassification}
                      onValueChange={(v) => {
                        setRevenueClassification(v as 'GRANT_REVENUE' | 'EARNED_INCOME')
                        if (aiRecommended && v !== contractData.revenueClassification) {
                          setClassificationRationale(
                            (contractData.classificationRationale ?? '') +
                              '\n[User override]'
                          )
                        }
                      }}
                      className="flex gap-6"
                      data-testid="funding-source-revenue-classification"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="GRANT_REVENUE" id="rc-grant" />
                        <Label htmlFor="rc-grant">Grant Revenue</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="EARNED_INCOME" id="rc-earned" />
                        <Label htmlFor="rc-earned">Earned Income</Label>
                      </div>
                    </RadioGroup>
                    {contractData.classificationWasDefaulted && aiRecommended && (
                      <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mt-2" data-testid="funding-source-classification-defaulted-warning">
                        <AlertTriangle className="h-3 w-3 shrink-0" />
                        AI could not confidently determine this — please verify.
                      </p>
                    )}
                    {classificationRationale && (
                      <p className="text-sm text-muted-foreground mt-2">
                        {classificationRationale}
                      </p>
                    )}
                  </div>
                )}

                {/* Unusual Grant toggle — GRANT only */}
                {isGrant && (
                  <div className="flex items-center gap-3">
                    <Switch
                      checked={isUnusualGrant}
                      onCheckedChange={setIsUnusualGrant}
                      data-testid="funding-source-unusual-toggle"
                    />
                    <Label className="flex items-center gap-1">
                      Unusual Grant <HelpTooltip term="unusual-grant" />
                    </Label>
                  </div>
                )}
              </>
            )}

            <Button
              type="submit"
              disabled={
                isPending ||
                !name.trim() ||
                !fundingCategory ||
                !restrictionType ||
                !funderId ||
                (type === 'CONDITIONAL' && !conditions.trim())
              }
              data-testid="funding-source-submit"
            >
              {isPending ? 'Creating...' : 'Create Funding Source'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
