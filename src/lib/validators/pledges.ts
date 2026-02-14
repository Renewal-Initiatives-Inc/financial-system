import { z } from 'zod'

const pledgeStatuses = ['PLEDGED', 'RECEIVED', 'WRITTEN_OFF'] as const

export const insertPledgeSchema = z.object({
  donorId: z.number().int().positive('Donor is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  expectedDate: z.string().date().nullable().optional(),
  fundId: z.number().int().positive('Fund is required'),
})

export const updatePledgeSchema = z.object({
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .optional(),
  expectedDate: z.string().date().nullable().optional(),
  fundId: z.number().int().positive().optional(),
  status: z.enum(pledgeStatuses).optional(),
  glTransactionId: z.number().int().positive().nullable().optional(),
})

export type InsertPledge = z.input<typeof insertPledgeSchema>
export type UpdatePledge = z.infer<typeof updatePledgeSchema>
