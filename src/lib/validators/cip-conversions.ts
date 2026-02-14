import { z } from 'zod'

const cipConversionAllocationSchema = z.object({
  sourceCipAccountId: z.number().int().positive(),
  sourceCostCodeId: z.number().int().positive().nullable().optional(),
  targetAssetName: z.string().min(1, 'Component name is required'),
  targetUsefulLifeMonths: z
    .number()
    .int()
    .positive('Useful life must be positive'),
  targetGlAssetAccountId: z.number().int().positive(),
  targetGlAccumDeprAccountId: z.number().int().positive(),
  targetGlExpenseAccountId: z.number().int().positive(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .multipleOf(0.01, 'Amount must have at most 2 decimal places'),
})

export const cipConversionInputSchema = z
  .object({
    structureName: z.string().min(1, 'Structure name is required'),
    placedInServiceDate: z.string().date('Invalid date format'),
    allocations: z
      .array(cipConversionAllocationSchema)
      .min(1, 'At least one allocation is required'),
  })
  .refine(
    (data) => {
      const total = data.allocations.reduce((sum, a) => sum + a.amount, 0)
      return total > 0
    },
    {
      message: 'Total allocation amount must be greater than zero',
      path: ['allocations'],
    }
  )

export type CipConversionInput = z.infer<typeof cipConversionInputSchema>
export type CipConversionAllocation = z.infer<
  typeof cipConversionAllocationSchema
>
