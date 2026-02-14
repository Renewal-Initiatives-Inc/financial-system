import { z } from 'zod'

const budgetStatuses = ['DRAFT', 'APPROVED'] as const
const spreadMethods = ['EVEN', 'SEASONAL', 'ONE_TIME', 'CUSTOM'] as const

export const insertBudgetSchema = z.object({
  fiscalYear: z.number().int().min(2025).max(2100),
  status: z.enum(budgetStatuses).default('DRAFT'),
  createdBy: z.string().min(1, 'Created by is required'),
})

export const insertBudgetLineSchema = z
  .object({
    budgetId: z.number().int().positive(),
    accountId: z.number().int().positive(),
    fundId: z.number().int().positive(),
    annualAmount: z.number().multipleOf(0.01, 'Amount must have at most 2 decimal places'),
    spreadMethod: z.enum(spreadMethods),
    monthlyAmounts: z.array(z.number()).length(12, 'Must have exactly 12 monthly amounts'),
  })
  .refine(
    (line) => {
      const sum = line.monthlyAmounts.reduce((a, b) => a + b, 0)
      // Allow rounding tolerance of $0.02 (12 months × $0.01 max rounding each)
      return Math.abs(sum - line.annualAmount) < 0.02
    },
    { message: 'Monthly amounts must sum to the annual amount' }
  )
  .refine(
    (line) => {
      if (line.spreadMethod !== 'ONE_TIME') return true
      const nonZero = line.monthlyAmounts.filter((m) => Math.abs(m) > 0.001)
      return nonZero.length === 1
    },
    { message: 'ONE_TIME spread must have exactly one non-zero month' }
  )

export const updateBudgetLineSchema = z.object({
  annualAmount: z
    .number()
    .multipleOf(0.01, 'Amount must have at most 2 decimal places')
    .optional(),
  spreadMethod: z.enum(spreadMethods).optional(),
  monthlyAmounts: z.array(z.number()).length(12).optional(),
})

export const updateBudgetStatusSchema = z.object({
  status: z.enum(budgetStatuses),
})

export type InsertBudget = z.infer<typeof insertBudgetSchema>
export type InsertBudgetLine = z.infer<typeof insertBudgetLineSchema>
export type UpdateBudgetLine = z.infer<typeof updateBudgetLineSchema>
export type UpdateBudgetStatus = z.infer<typeof updateBudgetStatusSchema>
