'use client'

import { useState } from 'react'
import { ChevronDown, ChevronRight, ExternalLink, FileText } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

// --- Types ---

export interface MilestoneItem {
  name?: string
  description?: string
  date?: string
  dueDate?: string
}

export interface TermItem {
  name?: string
  description?: string
  paymentSchedule?: string
  schedule?: string
  amount?: string
  conditions?: string
}

export interface CovenantItem {
  name?: string
  description?: string
  requirement?: string
  type?: string
  deadline?: string
}

// --- Parsers (handle various jsonb shapes) ---

export function parseMilestones(data: unknown): MilestoneItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as MilestoneItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.milestones)) return obj.milestones as MilestoneItem[]
    if (Array.isArray(obj.items)) return obj.items as MilestoneItem[]
  }
  return []
}

export function parseTerms(data: unknown): TermItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as TermItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.terms)) return obj.terms as TermItem[]
    if (Array.isArray(obj.paymentTerms)) return obj.paymentTerms as TermItem[]
    if (Array.isArray(obj.items)) return obj.items as TermItem[]
  }
  return []
}

export function parseCovenants(data: unknown): CovenantItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data as CovenantItem[]
  if (typeof data === 'object' && data !== null) {
    const obj = data as Record<string, unknown>
    if (Array.isArray(obj.covenants)) return obj.covenants as CovenantItem[]
    if (Array.isArray(obj.items)) return obj.items as CovenantItem[]
  }
  return []
}

// --- Helpers ---

export function formatCurrency(amount: string | number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(typeof amount === 'string' ? parseFloat(amount) : amount)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'MMM d, yyyy')
}

// --- Component ---

interface ContractTermsCardProps {
  milestones: unknown
  terms: unknown
  covenants: unknown
  contractPdfUrl?: string | null
  title?: string
}

export function ContractTermsCard({
  milestones: rawMilestones,
  terms: rawTerms,
  covenants: rawCovenants,
  contractPdfUrl,
  title = 'Contract Terms',
}: ContractTermsCardProps) {
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({
    milestones: false,
    terms: false,
    covenants: false,
  })

  const milestones = parseMilestones(rawMilestones)
  const terms = parseTerms(rawTerms)
  const covenants = parseCovenants(rawCovenants)
  const hasContractTerms =
    milestones.length > 0 || terms.length > 0 || covenants.length > 0

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {contractPdfUrl && (
          <div className="mb-4">
            <a
              href={contractPdfUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-blue-600 hover:underline"
            >
              <FileText className="h-4 w-4" />
              View Contract PDF
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        )}

        {!hasContractTerms ? (
          <p className="text-sm text-muted-foreground">
            No contract terms extracted
          </p>
        ) : (
          <div className="space-y-3">
            {/* Milestones */}
            <div className="border rounded-md">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                onClick={() => toggleSection('milestones')}
              >
                <span>
                  Milestones{' '}
                  {milestones.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {milestones.length}
                    </Badge>
                  )}
                </span>
                {expandedSections.milestones ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {expandedSections.milestones && (
                <div className="border-t px-3 pb-3">
                  {milestones.length === 0 ? (
                    <p className="pt-3 text-sm text-muted-foreground">
                      No milestones
                    </p>
                  ) : (
                    <ul className="space-y-2 pt-3">
                      {milestones.map((m, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-medium">
                            {m.name || m.description || `Milestone ${idx + 1}`}
                          </span>
                          {(m.date || m.dueDate) && (
                            <span className="ml-2 text-muted-foreground">
                              Due: {formatDate(m.date || m.dueDate!)}
                            </span>
                          )}
                          {m.description && m.name && (
                            <p className="text-muted-foreground">
                              {m.description}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Payment Terms */}
            <div className="border rounded-md">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                onClick={() => toggleSection('terms')}
              >
                <span>
                  Payment Terms{' '}
                  {terms.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {terms.length}
                    </Badge>
                  )}
                </span>
                {expandedSections.terms ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {expandedSections.terms && (
                <div className="border-t px-3 pb-3">
                  {terms.length === 0 ? (
                    <p className="pt-3 text-sm text-muted-foreground">
                      No payment terms
                    </p>
                  ) : (
                    <ul className="space-y-2 pt-3">
                      {terms.map((t, idx) => (
                        <li key={idx} className="text-sm">
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
                            <p className="text-muted-foreground">
                              {t.description}
                            </p>
                          )}
                          {t.conditions && (
                            <p className="text-muted-foreground">
                              {t.conditions}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>

            {/* Covenants */}
            <div className="border rounded-md">
              <button
                type="button"
                className="flex w-full items-center justify-between p-3 text-sm font-medium hover:bg-muted/50"
                onClick={() => toggleSection('covenants')}
              >
                <span>
                  Covenants{' '}
                  {covenants.length > 0 && (
                    <Badge variant="secondary" className="ml-1">
                      {covenants.length}
                    </Badge>
                  )}
                </span>
                {expandedSections.covenants ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
              {expandedSections.covenants && (
                <div className="border-t px-3 pb-3">
                  {covenants.length === 0 ? (
                    <p className="pt-3 text-sm text-muted-foreground">
                      No covenants
                    </p>
                  ) : (
                    <ul className="space-y-2 pt-3">
                      {covenants.map((c, idx) => (
                        <li key={idx} className="text-sm">
                          <span className="font-medium">
                            {c.name || c.type || c.description || `Covenant ${idx + 1}`}
                          </span>
                          {c.requirement && (
                            <p className="text-muted-foreground">
                              {c.requirement}
                            </p>
                          )}
                          {c.description && (c.name || c.type) && (
                            <p className="text-muted-foreground">
                              {c.description}
                            </p>
                          )}
                          {c.deadline && (
                            <span className="text-muted-foreground text-xs">
                              Deadline: {c.deadline}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
