import { z } from 'zod'

export const insertCategorizationRuleSchema = z.object({
  criteria: z
    .object({
      merchantPattern: z.string().min(1).optional(),
      descriptionKeywords: z.array(z.string()).optional(),
    })
    .refine((d) => d.merchantPattern || (d.descriptionKeywords && d.descriptionKeywords.length > 0), {
      message: 'At least one criterion required',
    }),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  autoApply: z.boolean().default(true),
  createdBy: z.string().min(1),
})

export const updateCategorizationRuleSchema = z.object({
  criteria: z
    .object({
      merchantPattern: z.string().min(1).optional(),
      descriptionKeywords: z.array(z.string()).optional(),
    })
    .refine((d) => d.merchantPattern || (d.descriptionKeywords && d.descriptionKeywords.length > 0), {
      message: 'At least one criterion required',
    })
    .optional(),
  glAccountId: z.number().int().positive().optional(),
  fundId: z.number().int().positive().optional(),
  autoApply: z.boolean().optional(),
})

export type InsertCategorizationRule = z.infer<typeof insertCategorizationRuleSchema>
export type UpdateCategorizationRule = z.infer<typeof updateCategorizationRuleSchema>
