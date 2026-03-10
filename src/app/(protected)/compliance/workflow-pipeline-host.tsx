'use client'

import { useState, useEffect } from 'react'
import { WorkflowPipeline } from '@/components/compliance/workflow'
import {
  getDeadlineWithWorkflow,
  advanceWorkflowState,
  getWorkflowClientConfig,
} from './workflow-actions'
import type {
  WorkflowStateData,
  WorkflowStateChange,
  WorkflowConfig,
} from '@/lib/compliance/workflow-types'
import type { WorkflowClientConfig } from './workflow-actions'

interface WorkflowPipelineHostProps {
  deadlineId: number
  workflowType: string | null
  userId: string
}

function buildRuntimeConfig(clientConfig: WorkflowClientConfig): WorkflowConfig {
  return {
    workflowType: clientConfig.workflowType,
    displayName: clientConfig.displayName,
    cluster: clientConfig.cluster,
    requiresWarningDialog: clientConfig.requiresWarningDialog,
    simplified: clientConfig.simplified,
    steps: {
      checklist: {
        autoChecks: [], // Auto-checks run server-side only
        manualChecks: clientConfig.manualChecks,
      },
      scan: {
        reportSlugs: [],
        aiPromptTemplate: clientConfig.workflowType,
        citations: clientConfig.citations,
      },
      draft: {
        artifactType: clientConfig.artifactType,
        generatorFn: clientConfig.workflowType,
      },
      delivery: {
        blobPrefix: clientConfig.blobPrefix,
      },
    },
  }
}

export function WorkflowPipelineHost({
  deadlineId,
  workflowType,
  userId,
}: WorkflowPipelineHostProps) {
  const [stateData, setStateData] = useState<WorkflowStateData | null>(null)
  const [runtimeConfig, setRuntimeConfig] = useState<WorkflowConfig | null>(null)
  const [scanContent, setScanContent] = useState<string | null>(null)
  const [isScanLoading, setIsScanLoading] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [row, clientConfig] = await Promise.all([
        getDeadlineWithWorkflow(deadlineId),
        workflowType ? getWorkflowClientConfig(workflowType) : Promise.resolve(null),
      ])
      if (!cancelled) {
        if (row) {
          setStateData({ deadlineId: row.id, currentState: row.workflowState })
        }
        if (clientConfig) {
          setRuntimeConfig(buildRuntimeConfig(clientConfig))
        }
        setIsLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [deadlineId, workflowType])

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

  // Fall back to a minimal config if registry lookup failed
  const config: WorkflowConfig = runtimeConfig ?? {
    workflowType,
    displayName: workflowType.replace(/_/g, ' '),
    cluster: 'A',
    requiresWarningDialog: false,
    steps: {
      checklist: { autoChecks: [], manualChecks: [] },
      scan: { reportSlugs: [], aiPromptTemplate: '', citations: [] },
      draft: { artifactType: 'pdf', generatorFn: '' },
      delivery: { blobPrefix: 'compliance-artifacts/' },
    },
  }

  return (
    <WorkflowPipeline
      config={config}
      stateData={stateData}
      scanContent={scanContent}
      isScanLoading={isScanLoading}
      isSubmitting={isSubmitting}
      onStateChange={handleStateChange}
      onRequestScan={handleRequestScan}
    />
  )
}
