import { z } from 'zod'

const auditActions = [
  'created',
  'updated',
  'voided',
  'reversed',
  'deactivated',
  'signed_off',
  'imported',
  'posted',
] as const

export const insertAuditLogSchema = z.object({
  userId: z.string().min(1, 'User ID is required'),
  action: z.enum(auditActions),
  entityType: z.string().min(1, 'Entity type is required').max(50),
  entityId: z.number().int().positive('Entity ID is required'),
  beforeState: z.record(z.string(), z.unknown()).nullable().optional(),
  afterState: z.record(z.string(), z.unknown()),
  metadata: z.record(z.string(), z.unknown()).nullable().optional(),
})

export type InsertAuditLog = z.infer<typeof insertAuditLogSchema>
