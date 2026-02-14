import { z } from 'zod'

const depreciationMethods = ['STRAIGHT_LINE'] as const

export const insertFixedAssetSchema = z
  .object({
    name: z.string().min(1, 'Asset name is required').max(255),
    description: z.string().nullable().optional(),
    acquisitionDate: z.string().date('Invalid date format'),
    cost: z
      .number()
      .positive('Cost must be positive')
      .multipleOf(0.01, 'Cost must have at most 2 decimal places'),
    salvageValue: z
      .number()
      .min(0, 'Salvage value cannot be negative')
      .multipleOf(0.01, 'Salvage value must have at most 2 decimal places')
      .default(0),
    usefulLifeMonths: z
      .number()
      .int('Useful life must be a whole number')
      .positive('Useful life must be positive'),
    depreciationMethod: z.enum(depreciationMethods).default('STRAIGHT_LINE'),
    datePlacedInService: z.string().date().nullable().optional(),
    glAssetAccountId: z.number().int().positive(),
    glAccumDeprAccountId: z.number().int().positive(),
    glExpenseAccountId: z.number().int().positive(),
    cipConversionId: z.number().int().positive().nullable().optional(),
    parentAssetId: z.number().int().positive().nullable().optional(),
  })
  .refine((data) => data.salvageValue < data.cost, {
    message: 'Salvage value must be less than cost',
    path: ['salvageValue'],
  })

export const updateFixedAssetSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().nullable().optional(),
  datePlacedInService: z.string().date().nullable().optional(),
  isActive: z.boolean().optional(),
})

export type InsertFixedAsset = z.input<typeof insertFixedAssetSchema>
export type UpdateFixedAsset = z.infer<typeof updateFixedAssetSchema>
