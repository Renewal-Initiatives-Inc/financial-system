import { z } from 'zod'

const projectionLineTypes = ['INFLOW', 'OUTFLOW'] as const

export const insertCashProjectionSchema = z.object({
  fiscalYear: z.number().int(),
  asOfDate: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  createdBy: z.string().min(1, 'Created by is required'),
})

export const insertCashProjectionLineSchema = z
  .object({
    projectionId: z.number().int().positive(),
    month: z.number().int().min(1).max(12),
    sourceLabel: z.string().min(1).max(255),
    autoAmount: z.number().multipleOf(0.01),
    overrideAmount: z.number().multipleOf(0.01).nullable().optional(),
    overrideNote: z.string().nullable().optional(),
    lineType: z.enum(projectionLineTypes),
    sortOrder: z.number().int(),
  })
  .refine(
    (line) => {
      if (line.overrideAmount != null) {
        return line.overrideNote != null && line.overrideNote.trim().length > 0
      }
      return true
    },
    { message: 'Override note is required when an override amount is provided' }
  )

export type InsertCashProjection = z.infer<typeof insertCashProjectionSchema>
export type InsertCashProjectionLine = z.infer<typeof insertCashProjectionLineSchema>
