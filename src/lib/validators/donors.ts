import { z } from 'zod'

const donorTypes = ['INDIVIDUAL', 'CORPORATE', 'FOUNDATION', 'GOVERNMENT'] as const

export const insertDonorSchema = z.object({
  name: z.string().min(1, 'Donor name is required').max(255),
  address: z.string().nullable().optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  type: z.enum(donorTypes),
  firstGiftDate: z.string().date().nullable().optional(),
})

export const updateDonorSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().nullable().optional(),
  email: z.string().email('Invalid email format').nullable().optional(),
  type: z.enum(donorTypes).optional(),
  firstGiftDate: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type InsertDonor = z.input<typeof insertDonorSchema>
export type UpdateDonor = z.infer<typeof updateDonorSchema>
