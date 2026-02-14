import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { auditLog } from '@/lib/db/schema'
import { insertAuditLogSchema, type InsertAuditLog } from '@/lib/validators'

/**
 * Append-only audit log writer.
 *
 * Design: The audit logger participates in the caller's DB transaction.
 * If audit INSERT fails, the entire transaction rolls back (INV-012).
 * The `tx` parameter is the Drizzle transaction context from the caller.
 */
export async function logAudit(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NeonHttpDatabase<any>,
  params: InsertAuditLog
): Promise<void> {
  const validated = insertAuditLogSchema.parse(params)

  await tx.insert(auditLog).values({
    userId: validated.userId,
    action: validated.action,
    entityType: validated.entityType,
    entityId: validated.entityId,
    beforeState: validated.beforeState ?? null,
    afterState: validated.afterState,
    metadata: validated.metadata ?? null,
  })
}
