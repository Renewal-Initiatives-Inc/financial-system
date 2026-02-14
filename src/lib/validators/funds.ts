import { z } from 'zod'

const fundRestrictions = ['RESTRICTED', 'UNRESTRICTED'] as const

export const insertFundSchema = z.object({
  name: z.string().min(1, 'Fund name is required').max(255),
  restrictionType: z.enum(fundRestrictions),
  description: z.string().nullable().optional(),
  isSystemLocked: z.boolean().optional().default(false),
})

export const updateFundSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
})

export type InsertFund = z.input<typeof insertFundSchema>
export type UpdateFund = z.infer<typeof updateFundSchema>
