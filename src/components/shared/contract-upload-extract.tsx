'use client'

import { useState, useRef } from 'react'
import { ChevronDown, ChevronRight, Upload, FileText, Loader2, X, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { HelpTooltip } from '@/components/shared/help-tooltip'
import { toast } from 'sonner'
import {
  parseMilestones,
  parseTerms,
  parseCovenants,
  formatDate,
  formatCurrency,
  type MilestoneItem,
  type TermItem,
  type CovenantItem,
} from '@/components/shared/contract-terms-card'

// --- Types ---

export interface ContractExtractionData {
  contractPdfUrl: string | null
  extractedMilestones: string | null
  extractedTerms: string | null
  extractedCovenants: string | null
  revenueClassification: 'GRANT_REVENUE' | 'EARNED_INCOME' | null
  classificationRationale: string | null
  fundingCategory: 'GRANT' | 'CONTRACT' | 'LOAN' | null
  classificationWasDefaulted?: boolean
  categoryWasDefaulted?: boolean
}

interface ContractUploadExtractProps {
  onChange: (data: ContractExtractionData) => void
  testIdPrefix?: string
}

// --- Inline Add Forms ---

function MilestoneAddForm({ onAdd, onCancel }: { onAdd: (item: MilestoneItem) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [date, setDate] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="mt-2 space-y-2 border rounded-md p-3 bg-muted/30">
      <Input placeholder="Milestone name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <Input placeholder="Description (optional)" value={description} onChange={(e) => setDescription(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onAdd({ name, date: date || undefined, description: description || undefined })} disabled={!name}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function TermAddForm({ onAdd, onCancel }: { onAdd: (item: TermItem) => void; onCancel: () => void }) {
  const [name, setName] = useState('')
  const [schedule, setSchedule] = useState('')
  const [amount, setAmount] = useState('')
  const [conditions, setConditions] = useState('')

  return (
    <div className="mt-2 space-y-2 border rounded-md p-3 bg-muted/30">
      <Input placeholder="Term name" value={name} onChange={(e) => setName(e.target.value)} />
      <Input placeholder="Schedule (e.g., Monthly, Upon completion)" value={schedule} onChange={(e) => setSchedule(e.target.value)} />
      <Input placeholder="Amount (optional)" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <Input placeholder="Conditions (optional)" value={conditions} onChange={(e) => setConditions(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onAdd({ name, schedule: schedule || undefined, amount: amount || undefined, conditions: conditions || undefined })} disabled={!name}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
}

function CovenantAddForm({ onAdd, onCancel }: { onAdd: (item: CovenantItem) => void; onCancel: () => void }) {
  const [type, setType] = useState('')
  const [description, setDescription] = useState('')
  const [deadline, setDeadline] = useState('')

  return (
    <div className="mt-2 space-y-2 border rounded-md p-3 bg-muted/30">
      <Input placeholder="Type (e.g., Insurance, Reporting)" value={type} onChange={(e) => setType(e.target.value)} />
      <Input placeholder="Description" value={description} onChange={(e) => setDescription(e.target.value)} />
      <Input type="date" placeholder="Deadline (optional)" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => onAdd({ type: type || undefined, description, deadline: deadline || undefined })} disabled={!description}>
          Add
        </Button>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  )
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
  const [milestoneItems, setMilestoneItems] = useState<MilestoneItem[]>([])
  const [termItems, setTermItems] = useState<TermItem[]>([])
  const [covenantItems, setCovenantItems] = useState<CovenantItem[]>([])
  const [milestonesOpen, setMilestonesOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [covenantsOpen, setCovenantsOpen] = useState(false)

  const [addingMilestone, setAddingMilestone] = useState(false)
  const [addingTerm, setAddingTerm] = useState(false)
  const [addingCovenant, setAddingCovenant] = useState(false)

  const [revenueClassification, setRevenueClassification] = useState<'GRANT_REVENUE' | 'EARNED_INCOME' | null>(null)
  const [classificationRationale, setClassificationRationale] = useState<string | null>(null)
  const [fundingCategory, setFundingCategory] = useState<'GRANT' | 'CONTRACT' | 'LOAN' | null>(null)

  const serializeItems = (m: MilestoneItem[], t: TermItem[], c: CovenantItem[]) => ({
    extractedMilestones: m.length > 0 ? JSON.stringify(m) : null,
    extractedTerms: t.length > 0 ? JSON.stringify(t) : null,
    extractedCovenants: c.length > 0 ? JSON.stringify(c) : null,
  })

  const emitChange = (overrides: Partial<ContractExtractionData> & {
    milestones?: MilestoneItem[]
    terms?: TermItem[]
    covenants?: CovenantItem[]
  } = {}) => {
    const m = overrides.milestones ?? milestoneItems
    const t = overrides.terms ?? termItems
    const c = overrides.covenants ?? covenantItems
    const serialized = serializeItems(m, t, c)

    onChange({
      contractPdfUrl: overrides.contractPdfUrl ?? contractPdfUrl,
      extractedMilestones: overrides.extractedMilestones ?? serialized.extractedMilestones,
      extractedTerms: overrides.extractedTerms ?? serialized.extractedTerms,
      extractedCovenants: overrides.extractedCovenants ?? serialized.extractedCovenants,
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

      const newMilestones = parseMilestones(data.milestones)
      const newTerms = parseTerms(data.terms ?? data.paymentTerms)
      const newCovenants = parseCovenants(data.covenants)

      setMilestoneItems(newMilestones)
      setTermItems(newTerms)
      setCovenantItems(newCovenants)

      if (newMilestones.length > 0) setMilestonesOpen(true)
      if (newTerms.length > 0) setTermsOpen(true)
      if (newCovenants.length > 0) setCovenantsOpen(true)

      const newClassification = data.revenueClassification ?? null
      const newRationale = data.classificationRationale ?? null
      const newCategory = data.fundingCategory ?? null
      if (newClassification) setRevenueClassification(newClassification)
      if (newRationale) setClassificationRationale(newRationale)
      if (newCategory) setFundingCategory(newCategory)

      emitChange({
        milestones: newMilestones,
        terms: newTerms,
        covenants: newCovenants,
        revenueClassification: newClassification,
        classificationRationale: newRationale,
        fundingCategory: newCategory,
        classificationWasDefaulted: data.classificationWasDefaulted ?? false,
        categoryWasDefaulted: data.categoryWasDefaulted ?? false,
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

  const removeMilestone = (idx: number) => {
    const updated = milestoneItems.filter((_, i) => i !== idx)
    setMilestoneItems(updated)
    emitChange({ milestones: updated })
  }

  const addMilestone = (item: MilestoneItem) => {
    const updated = [...milestoneItems, item]
    setMilestoneItems(updated)
    emitChange({ milestones: updated })
    setAddingMilestone(false)
  }

  const removeTerm = (idx: number) => {
    const updated = termItems.filter((_, i) => i !== idx)
    setTermItems(updated)
    emitChange({ terms: updated })
  }

  const addTerm = (item: TermItem) => {
    const updated = [...termItems, item]
    setTermItems(updated)
    emitChange({ terms: updated })
    setAddingTerm(false)
  }

  const removeCovenant = (idx: number) => {
    const updated = covenantItems.filter((_, i) => i !== idx)
    setCovenantItems(updated)
    emitChange({ covenants: updated })
  }

  const addCovenant = (item: CovenantItem) => {
    const updated = [...covenantItems, item]
    setCovenantItems(updated)
    emitChange({ covenants: updated })
    setAddingCovenant(false)
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
      {milestoneItems.length > 0 && (
        <div className="border rounded-md">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
            onClick={() => setMilestonesOpen(!milestonesOpen)}
          >
            <span className="flex items-center gap-2">
              {milestonesOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Extracted Milestones
              <Badge variant="secondary">{milestoneItems.length}</Badge>
            </span>
          </button>
          {milestonesOpen && (
            <div className="border-t px-3 pb-3">
              <ul className="space-y-2 pt-3">
                {milestoneItems.map((m, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 text-sm rounded-md border p-2">
                    <div>
                      <span className="font-medium">
                        {m.name || m.description || `Milestone ${idx + 1}`}
                      </span>
                      {(m.date || m.dueDate) && (
                        <span className="ml-2 text-muted-foreground">
                          Due: {formatDate(m.date || m.dueDate!)}
                        </span>
                      )}
                      {m.description && m.name && (
                        <p className="text-muted-foreground text-xs mt-0.5">{m.description}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                      onClick={() => removeMilestone(idx)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {addingMilestone ? (
                <MilestoneAddForm onAdd={addMilestone} onCancel={() => setAddingMilestone(false)} />
              ) : (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAddingMilestone(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Milestone
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Extracted terms */}
      {termItems.length > 0 && (
        <div className="border rounded-md">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
            onClick={() => setTermsOpen(!termsOpen)}
          >
            <span className="flex items-center gap-2">
              {termsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Extracted Payment Terms
              <Badge variant="secondary">{termItems.length}</Badge>
            </span>
          </button>
          {termsOpen && (
            <div className="border-t px-3 pb-3">
              <ul className="space-y-2 pt-3">
                {termItems.map((t, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 text-sm rounded-md border p-2">
                    <div>
                      <span className="font-medium">
                        {t.name || t.description || `Term ${idx + 1}`}
                      </span>
                      {(t.paymentSchedule || t.schedule) && (
                        <span className="ml-2 text-muted-foreground">
                          Schedule: {t.paymentSchedule || t.schedule}
                        </span>
                      )}
                      {t.amount && (
                        <span className="ml-2 text-muted-foreground">
                          Amount: {formatCurrency(t.amount)}
                        </span>
                      )}
                      {t.description && t.name && (
                        <p className="text-muted-foreground text-xs mt-0.5">{t.description}</p>
                      )}
                      {t.conditions && (
                        <p className="text-muted-foreground text-xs mt-0.5">{t.conditions}</p>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                      onClick={() => removeTerm(idx)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {addingTerm ? (
                <TermAddForm onAdd={addTerm} onCancel={() => setAddingTerm(false)} />
              ) : (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAddingTerm(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Term
                </Button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Extracted covenants */}
      {covenantItems.length > 0 && (
        <div className="border rounded-md">
          <button
            type="button"
            className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
            onClick={() => setCovenantsOpen(!covenantsOpen)}
          >
            <span className="flex items-center gap-2">
              {covenantsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              Extracted Covenants
              <Badge variant="secondary">{covenantItems.length}</Badge>
            </span>
          </button>
          {covenantsOpen && (
            <div className="border-t px-3 pb-3">
              <ul className="space-y-2 pt-3">
                {covenantItems.map((c, idx) => (
                  <li key={idx} className="flex items-start justify-between gap-2 text-sm rounded-md border p-2">
                    <div>
                      <span className="font-medium">
                        {c.name || c.type || c.description || `Covenant ${idx + 1}`}
                      </span>
                      {c.requirement && (
                        <p className="text-muted-foreground text-xs mt-0.5">{c.requirement}</p>
                      )}
                      {c.description && (c.name || c.type) && (
                        <p className="text-muted-foreground text-xs mt-0.5">{c.description}</p>
                      )}
                      {c.deadline && (
                        <span className="text-muted-foreground text-xs">
                          Deadline: {c.deadline}
                        </span>
                      )}
                    </div>
                    <button
                      type="button"
                      className="text-muted-foreground hover:text-destructive shrink-0 mt-0.5"
                      onClick={() => removeCovenant(idx)}
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
              {addingCovenant ? (
                <CovenantAddForm onAdd={addCovenant} onCancel={() => setAddingCovenant(false)} />
              ) : (
                <Button type="button" variant="ghost" size="sm" className="mt-2" onClick={() => setAddingCovenant(true)}>
                  <Plus className="h-3 w-3 mr-1" /> Add Covenant
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </>
  )
}
