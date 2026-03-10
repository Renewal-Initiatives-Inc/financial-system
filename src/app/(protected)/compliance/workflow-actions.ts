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
} from '@/lib/compliance/workflow-types'

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
      .set({ workflowState: change.newState })
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
