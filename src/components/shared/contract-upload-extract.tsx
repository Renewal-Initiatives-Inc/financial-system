'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Upload, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'

// --- Types ---

export interface ContractExtractionData {
  contractPdfUrl: string | null
  extractedMilestones: string | null
  extractedTerms: string | null
  extractedCovenants: string | null
  revenueClassification: 'GRANT_REVENUE' | 'EARNED_INCOME' | null
  classificationRationale: string | null
  fundingCategory: 'GRANT' | 'CONTRACT' | 'LOAN' | null
}

interface ContractUploadExtractProps {
  onChange: (data: ContractExtractionData) => void
  testIdPrefix?: string
}

// --- Component ---

export function ContractUploadExtract({
  onChange,
  testIdPrefix = 'contract',
}: ContractUploadExtractProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [contractPdfUrl, setContractPdfUrl] = useState<string | null>(null)
  const [contractFileName, setContractFileName] = useState<string | null>(null)
  const [isUploading, setIsUploading] = useState(false)

  const [isExtracting, setIsExtracting] = useState(false)
  const [extractedMilestones, setExtractedMilestones] = useState<string | null>(null)
  const [extractedTerms, setExtractedTerms] = useState<string | null>(null)
  const [extractedCovenants, setExtractedCovenants] = useState<string | null>(null)
  const [milestonesOpen, setMilestonesOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [covenantsOpen, setCovenantsOpen] = useState(false)

  const [revenueClassification, setRevenueClassification] = useState<'GRANT_REVENUE' | 'EARNED_INCOME' | null>(null)
  const [classificationRationale, setClassificationRationale] = useState<string | null>(null)
  const [fundingCategory, setFundingCategory] = useState<'GRANT' | 'CONTRACT' | 'LOAN' | null>(null)

  const emitChange = (overrides: Partial<ContractExtractionData> = {}) => {
    onChange({
      contractPdfUrl: overrides.contractPdfUrl ?? contractPdfUrl,
      extractedMilestones: overrides.extractedMilestones ?? extractedMilestones,
      extractedTerms: overrides.extractedTerms ?? extractedTerms,
      extractedCovenants: overrides.extractedCovenants ?? extractedCovenants,
      revenueClassification: overrides.revenueClassification ?? revenueClassification,
      classificationRationale: overrides.classificationRationale ?? classificationRationale,
      fundingCategory: overrides.fundingCategory ?? fundingCategory,
    })
  }

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
      emitChange({ contractPdfUrl: data.url })
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
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error ||
            'Failed to extract contract terms. You can enter terms manually or retry your upload.'
        )
      }

      const data = await res.json()

      const newMilestones = data.milestones
        ? JSON.stringify(data.milestones, null, 2)
        : null
      const newTerms = data.terms ?? data.paymentTerms
        ? JSON.stringify(data.terms ?? data.paymentTerms, null, 2)
        : null
      const newCovenants = data.covenants
        ? JSON.stringify(data.covenants, null, 2)
        : null

      if (newMilestones) {
        setExtractedMilestones(newMilestones)
        setMilestonesOpen(true)
      }
      if (newTerms) {
        setExtractedTerms(newTerms)
        setTermsOpen(true)
      }
      if (newCovenants) {
        setExtractedCovenants(newCovenants)
        setCovenantsOpen(true)
      }

      const newClassification = data.revenueClassification ?? null
      const newRationale = data.classificationRationale ?? null
      const newCategory = data.fundingCategory ?? null
      if (newClassification) setRevenueClassification(newClassification)
      if (newRationale) setClassificationRationale(newRationale)
      if (newCategory) setFundingCategory(newCategory)

      emitChange({
        extractedMilestones: newMilestones,
        extractedTerms: newTerms,
        extractedCovenants: newCovenants,
        revenueClassification: newClassification,
        classificationRationale: newRationale,
        fundingCategory: newCategory,
      })

      toast.success('Contract terms extracted')
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : 'Failed to extract contract terms. You can enter terms manually or retry your upload.'
      )
    } finally {
      setIsExtracting(false)
    }
  }

  const handleMilestonesChange = (value: string) => {
    setExtractedMilestones(value)
    emitChange({ extractedMilestones: value })
  }

  const handleTermsChange = (value: string) => {
    setExtractedTerms(value)
    emitChange({ extractedTerms: value })
  }

  const handleCovenantsChange = (value: string) => {
    setExtractedCovenants(value)
    emitChange({ extractedCovenants: value })
  }

  return (
    <>
      {/* Upload section */}
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
            data-testid={`${testIdPrefix}-upload`}
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

        {contractPdfUrl && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            className="w-fit mt-1"
            onClick={handleExtractTerms}
            disabled={isExtracting}
            data-testid={`${testIdPrefix}-extract-terms-btn`}
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

      {/* Extracted milestones */}
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
                onChange={(e) => handleMilestonesChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Extracted terms */}
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
                onChange={(e) => handleTermsChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}

      {/* Extracted covenants */}
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
                onChange={(e) => handleCovenantsChange(e.target.value)}
                rows={6}
                className="font-mono text-xs"
              />
            </div>
          )}
        </div>
      )}
    </>
  )
}
