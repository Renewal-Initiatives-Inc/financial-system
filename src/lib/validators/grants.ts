import { z } from 'zod'

const grantTypes = ['CONDITIONAL', 'UNCONDITIONAL'] as const
const grantStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const

export const insertGrantSchema = z
  .object({
    funderId: z.number().int().positive('Funder is required'),
    amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
    type: z.enum(grantTypes),
    conditions: z.string().nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    fundId: z.number().int().positive('Fund is required'),
    isUnusualGrant: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      if (data.type === 'CONDITIONAL' && !data.conditions) {
        return false
      }
      return true
    },
    {
      message: 'Conditions are required for conditional grants',
      path: ['conditions'],
    }
  )

export const updateGrantSchema = z.object({
  funderId: z.number().int().positive().optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .optional(),
  type: z.enum(grantTypes).optional(),
  conditions: z.string().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  fundId: z.number().int().positive().optional(),
  status: z.enum(grantStatuses).optional(),
  isUnusualGrant: z.boolean().optional(),
})

export type InsertGrant = z.input<typeof insertGrantSchema>
export type UpdateGrant = z.infer<typeof updateGrantSchema>
