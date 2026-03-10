'use client'

import { useState, useEffect } from 'react'
import { WorkflowPipeline } from '@/components/compliance/workflow'
import { getDeadlineWithWorkflow, advanceWorkflowState } from './workflow-actions'
import type { WorkflowStateData, WorkflowStateChange } from '@/lib/compliance/workflow-types'

interface WorkflowPipelineHostProps {
  deadlineId: number
  workflowType: string | null
  userId: string
}

export function WorkflowPipelineHost({
  deadlineId,
  workflowType,
  userId,
}: WorkflowPipelineHostProps) {
  const [stateData, setStateData] = useState<WorkflowStateData | null>(null)
  const [scanContent, setScanContent] = useState<string | null>(null)
  const [isScanLoading, setIsScanLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const row = await getDeadlineWithWorkflow(deadlineId)
      if (!cancelled && row) {
        setStateData({
          deadlineId: row.id,
          currentState: row.workflowState,
        })
      }
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [deadlineId])

  async function handleStateChange(change: WorkflowStateChange) {
    setIsSubmitting(true)
    try {
      await advanceWorkflowState(deadlineId, userId, change)
      setStateData((prev) =>
        prev ? { ...prev, currentState: change.newState } : prev
      )
      if (change.newState === 'scan' && scanContent === null) {
        handleRequestScan()
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestScan() {
    setIsScanLoading(true)
    try {
      const res = await fetch('/api/compliance/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deadlineId, workflowType }),
      })
      if (res.ok) {
        const { content } = (await res.json()) as { content: string }
        setScanContent(content)
      }
    } finally {
      setIsScanLoading(false)
    }
  }

  if (!workflowType) {
    return (
      <p className="text-muted-foreground text-sm">
        No workflow configured for this item.
      </p>
    )
  }

  if (isLoading || !stateData) {
    return <p className="text-sm text-muted-foreground">Loading workflow...</p>
  }

  // Minimal stub config — real configs wired in Phase 2
  const stubConfig = {
    workflowType,
    displayName: workflowType.replace(/_/g, ' '),
    cluster: 'A' as const,
    requiresWarningDialog: false,
    steps: {
      checklist: { autoChecks: [], manualChecks: [] },
      scan: { reportSlugs: [], aiPromptTemplate: '', citations: [] },
      draft: { artifactType: 'pdf' as const, generatorFn: '' },
      delivery: { blobPrefix: 'compliance-artifacts/' },
    },
  }

  return (
    <WorkflowPipeline
      config={stubConfig}
      stateData={stateData}
      scanContent={scanContent}
      isScanLoading={isScanLoading}
      isSubmitting={isSubmitting}
      onStateChange={handleStateChange}
      onRequestScan={handleRequestScan}
    />
  )
}
