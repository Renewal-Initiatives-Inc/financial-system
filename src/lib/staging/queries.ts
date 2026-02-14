import { eq, and, sql, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { stagingRecords, accounts, funds } from '@/lib/db/schema'
import type { StagingSourceApp, StagingStatus } from '@/lib/validators/staging-records'

// --- Types ---

export type StagingRecord = typeof stagingRecords.$inferSelect

export type StagingRecordWithRelations = StagingRecord & {
  fundName: string | null
  glAccountCode: string | null
  glAccountName: string | null
}

// --- Queries ---

export async function getStagingRecords(filters?: {
  status?: StagingStatus
  sourceApp?: StagingSourceApp
  limit?: number
  offset?: number
}): Promise<StagingRecordWithRelations[]> {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(stagingRecords.status, filters.status))
  }
  if (filters?.sourceApp) {
    conditions.push(eq(stagingRecords.sourceApp, filters.sourceApp))
  }

  const rows = await db
    .select({
      id: stagingRecords.id,
      sourceApp: stagingRecords.sourceApp,
      sourceRecordId: stagingRecords.sourceRecordId,
      recordType: stagingRecords.recordType,
      employeeId: stagingRecords.employeeId,
      referenceId: stagingRecords.referenceId,
      dateIncurred: stagingRecords.dateIncurred,
      amount: stagingRecords.amount,
      fundId: stagingRecords.fundId,
      glAccountId: stagingRecords.glAccountId,
      metadata: stagingRecords.metadata,
      status: stagingRecords.status,
      glTransactionId: stagingRecords.glTransactionId,
      createdAt: stagingRecords.createdAt,
      processedAt: stagingRecords.processedAt,
      fundName: funds.name,
      glAccountCode: accounts.code,
      glAccountName: accounts.name,
    })
    .from(stagingRecords)
    .leftJoin(funds, eq(stagingRecords.fundId, funds.id))
    .leftJoin(accounts, eq(stagingRecords.glAccountId, accounts.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(stagingRecords.createdAt))
    .limit(filters?.limit ?? 500)
    .offset(filters?.offset ?? 0)

  return rows
}

export async function getStagingRecordsByReference(
  sourceApp: string,
  referenceId: string
): Promise<StagingRecord[]> {
  return db
    .select()
    .from(stagingRecords)
    .where(
      and(
        eq(stagingRecords.sourceApp, sourceApp),
        eq(stagingRecords.referenceId, referenceId)
      )
    )
    .orderBy(stagingRecords.createdAt)
}

export async function getStagingRecordCounts(): Promise<Record<string, number>> {
  const rows = await db
    .select({
      status: stagingRecords.status,
      count: sql<number>`count(*)::int`,
    })
    .from(stagingRecords)
    .groupBy(stagingRecords.status)

  const counts: Record<string, number> = {}
  for (const row of rows) {
    counts[row.status] = row.count
  }
  return counts
}

export async function getUnprocessedRecords(): Promise<StagingRecord[]> {
  return db
    .select()
    .from(stagingRecords)
    .where(eq(stagingRecords.status, 'received'))
    .orderBy(stagingRecords.createdAt)
}
