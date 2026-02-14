import { z } from 'zod'

const w9Statuses = ['COLLECTED', 'PENDING', 'NOT_REQUIRED'] as const

export const insertVendorSchema = z.object({
  name: z.string().min(1, 'Vendor name is required').max(255),
  address: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  entityType: z.string().max(50).nullable().optional(),
  is1099Eligible: z.boolean().optional().default(false),
  defaultAccountId: z.number().int().positive().nullable().optional(),
  defaultFundId: z.number().int().positive().nullable().optional(),
  w9Status: z.enum(w9Statuses).optional().default('NOT_REQUIRED'),
  w9CollectedDate: z.string().date().nullable().optional(),
})

export const updateVendorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().nullable().optional(),
  taxId: z.string().nullable().optional(),
  entityType: z.string().max(50).nullable().optional(),
  is1099Eligible: z.boolean().optional(),
  defaultAccountId: z.number().int().positive().nullable().optional(),
  defaultFundId: z.number().int().positive().nullable().optional(),
  w9Status: z.enum(w9Statuses).optional(),
  w9CollectedDate: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type InsertVendor = z.input<typeof insertVendorSchema>
export type UpdateVendor = z.infer<typeof updateVendorSchema>
