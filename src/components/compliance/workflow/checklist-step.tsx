'use client'

import { useState } from 'react'
import { Checkbox } from '@/components/ui/checkbox'
import { Textarea } from '@/components/ui/textarea'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'
import type { ManualCheck } from '@/lib/compliance/workflow-types'

interface ChecklistResponse {
  checked: boolean
  explanation?: string
}

interface ChecklistStepProps {
  checks: ManualCheck[]
  initialResponses?: Record<string, ChecklistResponse>
  onComplete: (responses: Record<string, ChecklistResponse>) => void
  isSubmitting: boolean
}

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length
}

export function ChecklistStep({
  checks,
  initialResponses,
  onComplete,
  isSubmitting,
}: ChecklistStepProps) {
  const [responses, setResponses] = useState<Record<string, ChecklistResponse>>(
    initialResponses ??
      Object.fromEntries(checks.map((c) => [c.id, { checked: false }]))
  )

  function setChecked(id: string, checked: boolean) {
    setResponses((prev) => ({
      ...prev,
      [id]: { ...prev[id], checked },
    }))
  }

  function setExplanation(id: string, explanation: string) {
    setResponses((prev) => ({
      ...prev,
      [id]: { ...prev[id], explanation },
    }))
  }

  const canContinue = checks.every((check) => {
    const r = responses[check.id]
    if (!r) return false
    if (r.checked) return true
    if (!check.requiresExplanation) return true
    const words = countWords(r.explanation ?? '')
    return words > 0 && words <= 50
  })

  return (
    <div data-testid="workflow-checklist-step" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review and confirm each item before proceeding.
      </p>
      <div className="space-y-4">
        {checks.map((check) => {
          const r = responses[check.id] ?? { checked: false }
          const wordCount = countWords(r.explanation ?? '')
          const overLimit = wordCount > 50

          return (
            <div key={check.id} data-testid={`workflow-checklist-item-${check.id}`} className="space-y-2">
              <div className="flex items-start gap-3">
                <Checkbox
                  id={`check-${check.id}`}
                  checked={r.checked}
                  onCheckedChange={(val) => setChecked(check.id, !!val)}
                  className="mt-0.5"
                />
                <label
                  htmlFor={`check-${check.id}`}
                  className="text-sm leading-snug cursor-pointer"
                >
                  {check.label}
                </label>
              </div>
              {!r.checked && check.requiresExplanation && (
                <div className="ml-6 space-y-1">
                  <Textarea
                    placeholder="Explain why this doesn't apply (50 words max)"
                    value={r.explanation ?? ''}
                    onChange={(e) => setExplanation(check.id, e.target.value)}
                    maxLength={300}
                    rows={2}
                    className={overLimit ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  />
                  <p className={`text-xs ${overLimit ? 'text-red-500' : 'text-muted-foreground'}`}>
                    {wordCount} / 50 words
                  </p>
                </div>
              )}
            </div>
          )
        })}
      </div>
      <Button
        onClick={() => onComplete(responses)}
        disabled={!canContinue || isSubmitting}
        className="w-full"
      >
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Continue
      </Button>
    </div>
  )
}
