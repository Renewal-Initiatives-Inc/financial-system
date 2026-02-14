import { db } from '@/lib/db'
import { auditLog } from '@/lib/db/schema'
import { and, desc, eq, gte, lte } from 'drizzle-orm'
import type { CopilotToolDefinition } from '../types'

export const searchAuditLogDefinition: CopilotToolDefinition = {
  name: 'searchAuditLog',
  description:
    'Search the audit log for changes to accounts, transactions, funds, and other entities.',
  input_schema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'Filter by entity type (e.g., "account", "transaction", "fund", "vendor")',
      },
      entityId: { type: 'number', description: 'Filter by specific entity ID' },
      action: {
        type: 'string',
        description: 'Filter by action: created, updated, voided, reversed, deactivated, signed_off, imported, posted',
      },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
  },
}

export async function handleSearchAuditLog(input: {
  entityType?: string
  entityId?: number
  action?: string
  dateFrom?: string
  dateTo?: string
  limit?: number
}): Promise<{
  entries: Array<{
    id: number
    timestamp: string
    userId: string
    action: string
    entityType: string
    entityId: number
    summary: string
  }>
}> {
  const maxResults = Math.min(input.limit || 20, 50)
  const conditions = []

  if (input.entityType) {
    conditions.push(eq(auditLog.entityType, input.entityType))
  }
  if (input.entityId) {
    conditions.push(eq(auditLog.entityId, input.entityId))
  }
  if (input.action) {
    conditions.push(
      eq(auditLog.action, input.action as 'created' | 'updated' | 'voided' | 'reversed' | 'deactivated' | 'signed_off' | 'imported' | 'posted')
    )
  }
  if (input.dateFrom) {
    conditions.push(gte(auditLog.timestamp, new Date(input.dateFrom)))
  }
  if (input.dateTo) {
    conditions.push(lte(auditLog.timestamp, new Date(input.dateTo + 'T23:59:59')))
  }

  const rows = await db
    .select()
    .from(auditLog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(auditLog.timestamp))
    .limit(maxResults)

  return {
    entries: rows.map((row) => {
      // Generate a human-readable summary from the afterState
      const after = row.afterState as Record<string, unknown> | null
      let summary = `${row.action} ${row.entityType} #${row.entityId}`
      if (after) {
        if ('name' in after) summary += ` — ${after.name}`
        else if ('memo' in after) summary += ` — ${after.memo}`
        else if ('code' in after) summary += ` — ${after.code}`
      }

      return {
        id: row.id,
        timestamp: row.timestamp.toISOString(),
        userId: row.userId,
        action: row.action,
        entityType: row.entityType,
        entityId: row.entityId,
        summary,
      }
    }),
  }
}
