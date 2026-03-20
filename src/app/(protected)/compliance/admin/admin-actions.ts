'use server'

import { eq, sql, and, ne } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  complianceArtifacts,
  complianceDeadlines,
  complianceWorkflowLogs,
} from '@/lib/db/schema'

export interface ArtifactRow {
  id: number
  deadlineId: number
  taskName: string
  artifactType: string
  blobUrl: string
  fileName: string
  fileSize: number | null
  createdBy: string
  createdAt: Date
}

export async function getArtifactsByYear(year: number): Promise<ArtifactRow[]> {
  const rows = await db
    .select({
      id: complianceArtifacts.id,
      deadlineId: complianceArtifacts.deadlineId,
      taskName: complianceDeadlines.taskName,
      artifactType: complianceArtifacts.artifactType,
      blobUrl: complianceArtifacts.blobUrl,
      fileName: complianceArtifacts.fileName,
      fileSize: complianceArtifacts.fileSize,
      createdBy: complianceArtifacts.createdBy,
      createdAt: complianceArtifacts.createdAt,
    })
    .from(complianceArtifacts)
    .innerJoin(
      complianceDeadlines,
      eq(complianceArtifacts.deadlineId, complianceDeadlines.id)
    )
    .where(sql`EXTRACT(year FROM ${complianceArtifacts.createdAt}) = ${year}`)
    .orderBy(complianceArtifacts.createdAt)

  return rows
}

export async function getWorkflowLogsByDeadline(deadlineId: number) {
  return db
    .select()
    .from(complianceWorkflowLogs)
    .where(eq(complianceWorkflowLogs.deadlineId, deadlineId))
    .orderBy(complianceWorkflowLogs.createdAt)
}

export async function getCompletedWorkflowCountByYear(year: number): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`COUNT(*)` })
    .from(complianceDeadlines)
    .where(
      and(
        eq(complianceDeadlines.workflowState, 'delivered'),
        sql`EXTRACT(year FROM ${complianceDeadlines.dueDate}) = ${year}`
      )
    )
  return Number(rows[0]?.count ?? 0)
}

export interface DeadlineWithActivityRow {
  id: number
  taskName: string
}

export async function getDeadlinesWithWorkflowActivity(): Promise<DeadlineWithActivityRow[]> {
  const rows = await db
    .selectDistinct({
      id: complianceDeadlines.id,
      taskName: complianceDeadlines.taskName,
    })
    .from(complianceDeadlines)
    .innerJoin(complianceWorkflowLogs, eq(complianceWorkflowLogs.deadlineId, complianceDeadlines.id))
    .where(ne(complianceDeadlines.workflowState, 'not_started'))
    .orderBy(complianceDeadlines.taskName)
  return rows
}

export async function getAllArtifactYears(): Promise<number[]> {
  const rows = await db
    .selectDistinct({
      year: sql<number>`EXTRACT(year FROM ${complianceArtifacts.createdAt})::integer`,
    })
    .from(complianceArtifacts)
    .orderBy(sql`1 DESC`)

  return rows.map((r) => r.year)
}
