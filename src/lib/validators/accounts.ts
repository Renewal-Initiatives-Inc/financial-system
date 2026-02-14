import { z } from 'zod'

const accountTypes = [
  'ASSET',
  'LIABILITY',
  'NET_ASSET',
  'REVENUE',
  'EXPENSE',
] as const

const normalBalances = ['DEBIT', 'CREDIT'] as const

export const insertAccountSchema = z.object({
  code: z.string().min(1, 'Account code is required').max(20),
  name: z.string().min(1, 'Account name is required').max(255),
  type: z.enum(accountTypes),
  subType: z.string().max(50).nullable().optional(),
  normalBalance: z.enum(normalBalances),
  isActive: z.boolean().optional().default(true),
  form990Line: z.string().max(10).nullable().optional(),
  parentAccountId: z.number().int().positive().nullable().optional(),
  isSystemLocked: z.boolean().optional().default(false),
})

export const updateAccountSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  subType: z.string().max(50).nullable().optional(),
  isActive: z.boolean().optional(),
})

export type InsertAccount = z.input<typeof insertAccountSchema>
export type UpdateAccount = z.infer<typeof updateAccountSchema>
