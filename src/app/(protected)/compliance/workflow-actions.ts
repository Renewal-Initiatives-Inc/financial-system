'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  complianceDeadlines,
  complianceWorkflowLogs,
  complianceArtifacts,
} from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'
import type {
  WorkflowStep,
  WorkflowStateChange,
  ManualCheck,
  Citation,
} from '@/lib/compliance/workflow-types'
import { getWorkflowConfig } from '@/lib/compliance/workflow-registry'

// Serializable subset of WorkflowConfig — safe to return from a server action
export interface WorkflowClientConfig {
  workflowType: string
  displayName: string
  cluster: 'A' | 'B' | 'C' | 'D' | 'E'
  requiresWarningDialog: boolean
  simplified: boolean
  manualChecks: ManualCheck[]
  citations: Citation[]
  artifactType: 'pdf' | 'docx' | 'csv'
  blobPrefix: string
}

export async function getWorkflowClientConfig(
  workflowType: string,
  slug?: string
): Promise<WorkflowClientConfig | null> {
  const config = getWorkflowConfig(workflowType, slug)
  if (!config) return null
  return {
    workflowType: config.workflowType,
    displayName: config.displayName,
    cluster: config.cluster,
    requiresWarningDialog: config.requiresWarningDialog,
    simplified: config.simplified ?? false,
    manualChecks: config.steps.checklist.manualChecks,
    citations: config.steps.scan.citations,
    artifactType: config.steps.draft.artifactType,
    blobPrefix: config.steps.delivery.blobPrefix,
  }
}

export async function getWorkflowState(deadlineId: number) {
  const [row] = await db
    .select({
      workflowState: complianceDeadlines.workflowState,
      workflowType: complianceDeadlines.workflowType,
    })
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.id, deadlineId))
  return row ?? null
}

export async function advanceWorkflowState(
  deadlineId: number,
  userId: string,
  change: WorkflowStateChange
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(complianceDeadlines)
      .set({
        workflowState: change.newState,
        ...(change.newState === 'delivered' ? { status: 'completed' } : {}),
      })
      .where(eq(complianceDeadlines.id, deadlineId))

    await tx.insert(complianceWorkflowLogs).values({
      deadlineId,
      step: change.logEntry.step as WorkflowStep,
      action: change.logEntry.action,
      userId,
      data: change.logEntry.data,
    })
  })
  revalidatePath('/compliance')
}

export async function recordArtifactDelivery(
  deadlineId: number,
  userId: string,
  artifact: {
    artifactType: string
    blobUrl: string
    fileName: string
    fileSize?: number
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(complianceDeadlines)
      .set({ workflowState: 'delivered', status: 'completed' })
      .where(eq(complianceDeadlines.id, deadlineId))

    await tx.insert(complianceArtifacts).values({
      deadlineId,
      ...artifact,
      createdBy: userId,
    })

    await tx.insert(complianceWorkflowLogs).values({
      deadlineId,
      step: 'delivery',
      action: 'artifact_delivered',
      userId,
      data: { blobUrl: artifact.blobUrl, fileName: artifact.fileName },
    })
  })
  revalidatePath('/compliance')
}

export async function getWorkflowLogs(deadlineId: number) {
  return db
    .select()
    .from(complianceWorkflowLogs)
    .where(eq(complianceWorkflowLogs.deadlineId, deadlineId))
    .orderBy(complianceWorkflowLogs.createdAt)
}

export async function getDeadlineWithWorkflow(deadlineId: number) {
  const [row] = await db
    .select()
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.id, deadlineId))
  return row ?? null
}
