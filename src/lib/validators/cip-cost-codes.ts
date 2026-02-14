import { z } from 'zod'

const cipCostCategories = ['HARD_COST', 'SOFT_COST'] as const

export const insertCipCostCodeSchema = z.object({
  code: z.string().min(1, 'Code is required').max(10),
  name: z.string().min(1, 'Name is required').max(255),
  category: z.enum(cipCostCategories),
  sortOrder: z.number().int().min(0).optional().default(0),
})

export const updateCipCostCodeSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().min(0).optional(),
})

export type InsertCipCostCode = z.input<typeof insertCipCostCodeSchema>
export type UpdateCipCostCode = z.infer<typeof updateCipCostCodeSchema>
