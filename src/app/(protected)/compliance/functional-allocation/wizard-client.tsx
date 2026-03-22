'use client'

import { useState, useCallback, Fragment } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Checkbox } from '@/components/ui/checkbox'
import { saveAllAllocations, getBenchmark } from './actions'
import type { AllocationDefault } from '@/lib/compliance/functional-defaults'
import type { BenchmarkComparison } from '@/lib/compliance/functional-allocation-logic'

interface WizardAllocation extends AllocationDefault {
  programPct: number
  adminPct: number
  fundraisingPct: number
  isPermanentRule: boolean
}

export function WizardClient({
  defaults,
  fiscalYear,
}: {
  defaults: AllocationDefault[]
  fiscalYear: number
}) {
  const router = useRouter()
  const [allocations, setAllocations] = useState<WizardAllocation[]>(
    defaults.map((d) => ({ ...d }))
  )
  const [currentStep, setCurrentStep] = useState(0)
  const [phase, setPhase] = useState<'wizard' | 'summary'>('wizard')
  const [benchmark, setBenchmark] = useState<BenchmarkComparison | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [isSaved, setIsSaved] = useState(false)

  // Skip permanent rules in the wizard — they're locked
  const editableIndices = allocations
    .map((a, i) => (a.source === 'permanent' ? -1 : i))
    .filter((i) => i !== -1)

  const editableStep = editableIndices[currentStep]
  const totalEditableSteps = editableIndices.length
  const currentAlloc = editableStep !== undefined ? allocations[editableStep] : null

  const updateAllocation = useCallback(
    (field: 'programPct' | 'adminPct' | 'fundraisingPct', value: number) => {
      if (editableStep === undefined) return
      setAllocations((prev) => {
        const next = [...prev]
        next[editableStep] = { ...next[editableStep], [field]: value }
        return next
      })
    },
    [editableStep]
  )

  const handleTogglePermanent = useCallback(
    (checked: boolean) => {
      if (editableStep === undefined) return
      setAllocations((prev) => {
        const next = [...prev]
        next[editableStep] = { ...next[editableStep], isPermanentRule: checked }
        return next
      })
    },
    [editableStep]
  )

  const sum = currentAlloc
    ? currentAlloc.programPct + currentAlloc.adminPct + currentAlloc.fundraisingPct
    : 0
  const isValid = Math.abs(sum - 100) < 0.01

  const _handleApplyDefaultsToAll = () => {
    // Apply current defaults to all remaining unedited editable accounts
    // (keep what's already been set for accounts already visited)
    setAllocations((prev) => [...prev])
  }

  const handleGoToSummary = async () => {
    const result = await getBenchmark(
      allocations.map((a) => ({
        programPct: a.programPct,
        adminPct: a.adminPct,
        fundraisingPct: a.fundraisingPct,
      }))
    )
    setBenchmark(result)
    setPhase('summary')
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      await saveAllAllocations(
        fiscalYear,
        allocations.map((a) => ({
          accountId: a.accountId,
          programPct: a.programPct,
          adminPct: a.adminPct,
          fundraisingPct: a.fundraisingPct,
          isPermanentRule: a.isPermanentRule,
        }))
      )
      setIsSaved(true)
      // Redirect to the saved year's view after a brief moment
      setTimeout(() => {
        router.push(`/compliance/functional-allocation?year=${fiscalYear}`)
      }, 500)
    } finally {
      setIsSaving(false)
    }
  }

  if (phase === 'summary') {
    return (
      <div className="space-y-6">
        <h2 className="text-lg font-semibold">Allocation Summary — FY{fiscalYear}</h2>

        {benchmark && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Benchmark Comparison</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-4 gap-4 text-center">
                <div>
                  <p className="text-xs text-muted-foreground">Organization</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Program</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">M&G</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Fundraising</p>
                </div>

                <div className="font-semibold text-sm">Renewal Initiatives</div>
                <div className="font-semibold text-sm">{benchmark.riProgram}%</div>
                <div className="font-semibold text-sm">{benchmark.riAdmin}%</div>
                <div className="font-semibold text-sm">{benchmark.riFundraising}%</div>

                {benchmark.peers.map((p) => (
                  <Fragment key={p.name}>
                    <div className="text-sm text-muted-foreground">{p.name}</div>
                    <div className="text-sm">{p.program}%</div>
                    <div className="text-sm">{p.admin}%</div>
                    <div className="text-sm">{p.fundraising}%</div>
                  </Fragment>
                ))}
              </div>

              {benchmark.isBelowMinimum && (
                <div className="bg-red-50 text-red-800 px-3 py-2 rounded text-sm">
                  Program allocation is below the industry minimum of 65%.
                </div>
              )}
              {benchmark.isOutlierHigh && (
                <div className="bg-yellow-50 text-yellow-800 px-3 py-2 rounded text-sm">
                  Program allocation exceeds 90% — unusually high. Please verify.
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm">All Allocations ({allocations.length} accounts)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              <div className="grid grid-cols-5 gap-2 text-xs font-medium text-muted-foreground pb-1 border-b">
                <span className="col-span-2">Account</span>
                <span className="text-right">Program</span>
                <span className="text-right">M&G</span>
                <span className="text-right">Fundraising</span>
              </div>
              {allocations.map((a) => (
                <div key={a.accountId} className="grid grid-cols-5 gap-2 text-sm py-0.5">
                  <span className="col-span-2 truncate">
                    {a.accountCode} — {a.accountName}
                    {a.isPermanentRule && (
                      <Badge variant="outline" className="ml-1 text-[10px]">Perm</Badge>
                    )}
                  </span>
                  <span className="text-right tabular-nums">{a.programPct}%</span>
                  <span className="text-right tabular-nums">{a.adminPct}%</span>
                  <span className="text-right tabular-nums">{a.fundraisingPct}%</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3">
          <Button data-testid="func-alloc-back-btn" variant="outline" onClick={() => setPhase('wizard')}>
            Back to Wizard
          </Button>
          <Button data-testid="func-alloc-save-btn" onClick={handleSave} disabled={isSaving || isSaved}>
            {isSaved ? 'Saved' : isSaving ? 'Saving...' : 'Save All Allocations'}
          </Button>
        </div>
      </div>
    )
  }

  if (!currentAlloc || totalEditableSteps === 0) {
    return (
      <div className="space-y-4">
        <p className="text-muted-foreground">
          All accounts have permanent allocation rules. No wizard steps needed.
        </p>
        <Button data-testid="func-alloc-summary-btn" onClick={handleGoToSummary}>View Summary</Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">
          Functional Allocation Wizard — FY{fiscalYear}
        </h2>
        <span className="text-sm text-muted-foreground">
          Account {currentStep + 1} of {totalEditableSteps}
        </span>
      </div>

      <Progress value={((currentStep + 1) / totalEditableSteps) * 100} className="h-2" />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <span className="text-sm font-mono">{currentAlloc.accountCode}</span>
            <span>{currentAlloc.accountName}</span>
          </CardTitle>
          <div className="flex gap-2">
            {currentAlloc.subType && (
              <Badge variant="outline">{currentAlloc.subType}</Badge>
            )}
            <Badge variant="secondary">Source: {currentAlloc.source}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <Label htmlFor="program">Program %</Label>
              <Input
                id="program"
                data-testid="func-alloc-program-input"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={currentAlloc.programPct}
                onChange={(e) =>
                  updateAllocation('programPct', parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label htmlFor="admin">M&G %</Label>
              <Input
                id="admin"
                data-testid="func-alloc-admin-input"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={currentAlloc.adminPct}
                onChange={(e) =>
                  updateAllocation('adminPct', parseFloat(e.target.value) || 0)
                }
              />
            </div>
            <div>
              <Label htmlFor="fundraising">Fundraising %</Label>
              <Input
                id="fundraising"
                data-testid="func-alloc-fundraising-input"
                type="number"
                min={0}
                max={100}
                step={0.01}
                value={currentAlloc.fundraisingPct}
                onChange={(e) =>
                  updateAllocation('fundraisingPct', parseFloat(e.target.value) || 0)
                }
              />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Checkbox
                id="permanent"
                data-testid="func-alloc-permanent-checkbox"
                checked={currentAlloc.isPermanentRule}
                onCheckedChange={(c) => handleTogglePermanent(c === true)}
              />
              <Label htmlFor="permanent" className="text-sm">
                Mark as permanent rule
              </Label>
            </div>
            <span className={`text-sm font-medium ${isValid ? 'text-green-600' : 'text-red-600'}`}>
              Sum: {sum.toFixed(2)}%
            </span>
          </div>

          {!isValid && (
            <p className="text-sm text-red-600">
              Percentages must sum to exactly 100%.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant="outline"
            data-testid="func-alloc-prev-btn"
            disabled={currentStep === 0}
            onClick={() => setCurrentStep((s) => s - 1)}
          >
            Previous
          </Button>
          {currentStep < totalEditableSteps - 1 ? (
            <Button
              data-testid="func-alloc-next-btn"
              disabled={!isValid}
              onClick={() => setCurrentStep((s) => s + 1)}
            >
              Next
            </Button>
          ) : (
            <Button data-testid="func-alloc-review-btn" disabled={!isValid} onClick={handleGoToSummary}>
              Review Summary
            </Button>
          )}
        </div>
        <Button data-testid="func-alloc-skip-btn" variant="ghost" onClick={handleGoToSummary}>
          Skip to Summary
        </Button>
      </div>
    </div>
  )
}
