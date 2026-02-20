'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Switch } from '@/components/ui/switch'
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

interface Props {
  vendors: { id: number; name: string }[]
}

export function CreateFundingSourceClient({ vendors }: Props) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [name, setName] = useState('')
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

  // Contract extraction state (managed by shared component)
  const [contractData, setContractData] = useState<ContractExtractionData>({
    contractPdfUrl: null,
    extractedMilestones: null,
    extractedTerms: null,
    extractedCovenants: null,
  })

  const isRestricted = restrictionType === 'RESTRICTED'

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
            restrictionType: restrictionType as 'RESTRICTED' | 'UNRESTRICTED',
            description: description || null,
            funderId: funderId ? parseInt(funderId) : null,
            amount: amount || null,
            type: (type as 'CONDITIONAL' | 'UNCONDITIONAL') || null,
            conditions: type === 'CONDITIONAL' ? conditions : null,
            startDate: startDate || null,
            endDate: endDate || null,
            isUnusualGrant,
            matchRequirementPercent: matchRequirementPercent || null,
            retainagePercent: retainagePercent || null,
            reportingFrequency: reportingFrequency || null,
            contractPdfUrl: contractData.contractPdfUrl,
            extractedMilestones: milestones,
            extractedTerms: terms,
            extractedCovenants: covenants,
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>Name <span className="text-destructive">*</span></Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g., AHP Fund, General Fund"
                  data-testid="funding-source-name"
                />
              </div>

              <div>
                <Label className="flex items-center gap-1">
                  Restriction <HelpTooltip term="restriction-type" /> <span className="text-destructive">*</span>
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

            {isRestricted && (
              <>
                <div className="border-t pt-4">
                  <h3 className="text-sm font-medium mb-3">Funder & Contract Details</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <Label>Funder (Vendor) <span className="text-destructive">*</span></Label>
                    <Select value={funderId} onValueChange={setFunderId}>
                      <SelectTrigger data-testid="funding-source-funder-select">
                        <SelectValue placeholder="Select funder" />
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
                    <Label>Award Amount</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      data-testid="funding-source-amount"
                    />
                  </div>

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

                  <div>
                    <Label>Reporting Frequency</Label>
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
                    <Label>Start Date</Label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      data-testid="funding-source-start-date"
                    />
                  </div>

                  <div>
                    <Label>End Date</Label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      data-testid="funding-source-end-date"
                    />
                  </div>

                  <div>
                    <Label>Match Requirement %</Label>
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
                    <Label>Retainage %</Label>
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
                </div>

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

                {/* Contract PDF Upload + AI Extraction */}
                <ContractUploadExtract
                  onChange={setContractData}
                  testIdPrefix="funding-source"
                />

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
              </>
            )}

            <Button
              type="submit"
              disabled={
                isPending ||
                !name.trim() ||
                !restrictionType ||
                (isRestricted && !funderId) ||
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
