import { z } from 'zod'

export const insertAnnualRateConfigSchema = z.object({
  fiscalYear: z.number().int().min(2020).max(2099),
  configKey: z.string().min(1).max(100),
  value: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a valid decimal (up to 6 places)'),
  effectiveDate: z.string().date().nullable().optional(),
  notes: z.string().nullable().optional(),
  updatedBy: z.string().min(1),
})

export const updateAnnualRateConfigSchema = z.object({
  value: z.string().regex(/^\d+(\.\d{1,6})?$/, 'Must be a valid decimal (up to 6 places)').optional(),
  notes: z.string().nullable().optional(),
  updatedBy: z.string().min(1),
})

export type InsertAnnualRateConfig = z.infer<typeof insertAnnualRateConfigSchema>
export type UpdateAnnualRateConfig = z.infer<typeof updateAnnualRateConfigSchema>
