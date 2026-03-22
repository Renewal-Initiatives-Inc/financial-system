import { eq, and, sql, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { getActiveEmployees } from '@/lib/integrations/people'

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
  /** Map of userId → display name for all users referenced in entries */
  userNames: Record<string, string>
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

/**
 * Build the employee lookup (id ↔ name) once per request.
 * Returns both the full map and a helper to resolve a user filter
 * (which may be a name) to matching user IDs.
 */
async function loadEmployeeLookup() {
  const nameById: Record<string, string> = { system: 'System' }
  const idByName: Record<string, string> = {} // lowercase name → id

  try {
    const employees = await getActiveEmployees()
    for (const emp of employees) {
      nameById[emp.id] = emp.name
      idByName[emp.name.toLowerCase()] = emp.id
    }
  } catch {
    // People DB unavailable — name resolution will degrade gracefully
  }

  return { nameById, idByName }
}

export async function getAuditLogData(
  filters?: AuditLogFilters
): Promise<AuditLogData> {
  const now = new Date().toISOString()
  const page = filters?.page ?? 1
  const pageSize = filters?.pageSize ?? 50
  const offset = (page - 1) * pageSize

  // Load employee lookup early so we can resolve name-based user filters
  const { nameById, idByName } = await loadEmployeeLookup()

  // Build WHERE conditions
  const conditions = []

  if (filters?.startDate) {
    conditions.push(gte(auditLog.timestamp, new Date(filters.startDate)))
  }
  if (filters?.endDate) {
    conditions.push(lte(auditLog.timestamp, new Date(filters.endDate + 'T23:59:59')))
  }
  if (filters?.userId) {
    // Support filtering by user ID or by name
    const resolvedId = idByName[filters.userId.toLowerCase()] ?? filters.userId
    conditions.push(eq(auditLog.userId, resolvedId))
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
    userNames: nameById,
    totalCount,
    page,
    pageSize,
    totalPages: Math.ceil(totalCount / pageSize),
    generatedAt: now,
  }
}
