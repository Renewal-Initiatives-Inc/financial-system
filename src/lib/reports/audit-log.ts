import { eq, and, sql, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuditLogEntry {
  id: number
  timestamp: string
  userId: string
  action: string
  entityType: string
  entityId: number
  beforeState: unknown
  afterState: unknown
  metadata: unknown
}

export interface AuditLogFilters {
  startDate?: string
  endDate?: string
  userId?: string
  action?: string
  entityType?: string
  page?: number
  pageSize?: number
}

export interface AuditLogData {
  entries: AuditLogEntry[]
  totalCount: number
  page: number
  pageSize: number
  totalPages: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = [
  'created',
  'updated',
  'voided',
  'reversed',
  'deactivated',
  'signed_off',
  'imported',
  'posted',
] as const

export const AUDIT_ENTITY_TYPES = [
  'TRANSACTION',
  'ACCOUNT',
  'FUND',
  'VENDOR',
  'TENANT',
  'BUDGET',
  'RECONCILIATION',
  'PAYROLL_RUN',
  'DONOR',
  'GRANT',
  'FIXED_ASSET',
] as const

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getAuditLogData(
  filters?: AuditLogFilters
): Promise<AuditLogData> {
  const now = new Date().toISOString()
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  // Build WHERE conditions
  const conditions = []

  if (filters?.startDate) {
    conditions.push(gte(auditLog.timestamp, new Date(filters.startDate)))
  }
  if (filters?.endDate) {
    conditions.push(lte(auditLog.timestamp, new Date(filters.endDate + 'T23:59:59')))
  }
  if (filters?.userId) {
    conditions.push(eq(auditLog.userId, filters.userId))
  }
  if (filters?.action) {
    conditions.push(sql`${auditLog.action} = ${filters.action}`)
  }
  if (filters?.entityType) {
    conditions.push(eq(auditLog.entityType, filters.entityType))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const countResult = await db
    .select({ count: sql<string>`COUNT(*)` })
    .from(auditLog)
    .where(whereClause)

  const totalCount = parseInt(countResult[0]?.count ?? '0')

  // Get paginated entries
  const rows = await db
    .select()
    .from(auditLog)
    .where(whereClause)
    .orderBy(desc(auditLog.timestamp))
    .limit(pageSize)
    .offset(offset)

  const entries: AuditLogEntry[] = rows.map((r) => ({
    id: r.id,
    timestamp: r.timestamp.toISOString(),
    userId: r.userId,
    action: r.action,
    entityType: r.entityType,
    entityId: r.entityId,
    beforeState: r.beforeState,
    afterState: r.afterState,
    metadata: r.metadata,
  }))

  return {
    entries,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    generatedAt: now,
  }
}
