'use client'

import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { ChecklistStep } from './checklist-step'
import { AIScanStep } from './ai-scan-step'
import { DraftStep } from './draft-step'
import { DeliveryStep } from './delivery-step'
import type {
  WorkflowConfig,
  WorkflowState,
  WorkflowStateData,
  WorkflowStateChange,
  WorkflowStep,
} from '@/lib/compliance/workflow-types'

interface WorkflowPipelineProps {
  config: WorkflowConfig
  stateData: WorkflowStateData
  scanContent: string | null
  isScanLoading: boolean
  isSubmitting: boolean
  onStateChange: (change: WorkflowStateChange) => Promise<void>
  onRequestScan: () => void
}

const STEP_TO_STATE: Record<string, WorkflowState> = {
  checklist: 'checklist',
  scan: 'scan',
  draft: 'draft',
}

const ALL_STEPS: { id: WorkflowStep | 'delivery'; label: string }[] = [
  { id: 'checklist', label: 'Checklist' },
  { id: 'scan', label: 'AI Scan' },
  { id: 'draft', label: 'Draft' },
  { id: 'delivery', label: 'Delivery' },
]

const STATE_TO_STEP_INDEX: Record<string, number> = {
  not_started: -1,
  checklist: 0,
  scan: 1,
  draft: 2,
  delivered: 3,
}

export function WorkflowPipeline({
  config,
  stateData,
  scanContent,
  isScanLoading,
  isSubmitting,
  onStateChange,
  onRequestScan,
}: WorkflowPipelineProps) {
  const { currentState, checklistResponses, scanAcknowledged, draftAccepted, artifactUrl, artifactFileName } = stateData

  const visibleSteps = config.simplified
    ? ALL_STEPS.filter((s) => s.id !== 'scan')
    : ALL_STEPS

  // When delivered, treat as past the last step so all circles show complete
  const currentStepIndex = currentState === 'delivered'
    ? ALL_STEPS.length
    : (STATE_TO_STEP_INDEX[currentState] ?? -1)

  // Trigger scan fetch when entering scan state
  useEffect(() => {
    if (currentState === 'scan' && scanContent === null && !isScanLoading) {
      onRequestScan()
    }
  }, [currentState]) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleChecklistComplete(
    responses: Record<string, { checked: boolean; explanation?: string }>
  ) {
    await onStateChange({
      newState: 'scan',
      logEntry: {
        step: 'checklist',
        action: 'checklist_accepted',
        data: { responses },
      },
    })
  }

  async function handleScanAcknowledge() {
    await onStateChange({
      newState: 'draft',
      logEntry: {
        step: 'scan',
        action: 'scan_acknowledged',
        data: {},
      },
    })
  }

  async function handleDraftAccept() {
    await onStateChange({
      newState: 'delivered',
      logEntry: {
        step: 'draft',
        action: 'draft_accepted',
        data: {},
      },
    })
  }

  // For simplified workflows (no scan step), checklist goes directly to draft
  async function handleChecklistCompleteSimplified(
    responses: Record<string, { checked: boolean; explanation?: string }>
  ) {
    await onStateChange({
      newState: 'draft',
      logEntry: {
        step: 'checklist',
        action: 'checklist_accepted',
        data: { responses },
      },
    })
  }

  return (
    <div data-testid="workflow-pipeline" className="space-y-6">
      {/* Step indicator */}
      <div data-testid="workflow-step-indicator" className="flex items-center gap-0">
        {visibleSteps.map((step, idx) => {
          const stepIndex = ALL_STEPS.findIndex((s) => s.id === step.id)
          const isComplete = currentStepIndex > stepIndex
          const isActive = currentStepIndex === stepIndex

          const canGoBack = isComplete && currentState !== 'delivered' && STEP_TO_STATE[step.id]

          return (
            <div key={step.id} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1">
                {canGoBack ? (
                  <button
                    onClick={() => onStateChange({
                      newState: STEP_TO_STATE[step.id],
                      logEntry: { step: step.id as WorkflowStep, action: 'navigated_back', data: {} },
                    })}
                    title={`Go back to ${step.label}`}
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2 cursor-pointer hover:opacity-75 transition-opacity',
                      'bg-primary border-primary text-primary-foreground'
                    )}
                  >
                    ✓
                  </button>
                ) : (
                  <div
                    className={cn(
                      'h-7 w-7 rounded-full flex items-center justify-center text-xs font-medium border-2',
                      isComplete
                        ? 'bg-primary border-primary text-primary-foreground'
                        : isActive
                          ? 'border-primary text-primary bg-background'
                          : 'border-muted-foreground/30 text-muted-foreground bg-background'
                    )}
                  >
                    {isComplete ? '✓' : idx + 1}
                  </div>
                )}
                <span
                  className={cn(
                    'text-xs whitespace-nowrap',
                    isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                  )}
                >
                  {step.label}
                </span>
              </div>
              {idx < visibleSteps.length - 1 && (
                <div
                  className={cn(
                    'h-0.5 flex-1 mx-1 mb-4',
                    currentStepIndex > stepIndex ? 'bg-primary' : 'bg-muted-foreground/20'
                  )}
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Step content */}
      <div>
        {currentState === 'not_started' && (
          <div className="text-center py-4">
            <p className="text-sm text-muted-foreground mb-4">
              Ready to start the {config.displayName} workflow.
            </p>
            <Button
              onClick={() =>
                onStateChange({
                  newState: 'checklist',
                  logEntry: { step: 'checklist', action: 'workflow_started', data: {} },
                })
              }
              disabled={isSubmitting}
            >
              Start Workflow
            </Button>
          </div>
        )}

        {currentState === 'checklist' && (
          <ChecklistStep
            checks={config.steps.checklist.manualChecks}
            initialResponses={checklistResponses}
            onComplete={config.simplified ? handleChecklistCompleteSimplified : handleChecklistComplete}
            isSubmitting={isSubmitting}
          />
        )}

        {currentState === 'scan' && !config.simplified && (
          <AIScanStep
            scanContent={scanContent}
            citations={config.steps.scan.citations}
            isLoading={isScanLoading}
            isAcknowledged={!!scanAcknowledged}
            onAcknowledge={handleScanAcknowledge}
            isSubmitting={isSubmitting}
          />
        )}

        {currentState === 'draft' && (
          <DraftStep
            artifactType={config.steps.draft.artifactType}
            fileName={artifactFileName ?? null}
            previewUrl={artifactUrl ?? null}
            scanContent={scanContent}
            isGenerating={false}
            isDraftAccepted={!!draftAccepted}
            requiresWarningDialog={config.requiresWarningDialog}
            onAccept={handleDraftAccept}
            isSubmitting={isSubmitting}
          />
        )}

        {currentState === 'delivered' && (
          <DeliveryStep
            artifactUrl={artifactUrl ?? null}
            fileName={artifactFileName ?? null}
            deliveredAt={null}
          />
        )}
      </div>
    </div>
  )
}
