import { z } from 'zod'

// Insert schema (for sync upsert from Ramp API)
export const insertRampTransactionSchema = z.object({
  rampId: z.string().min(1).max(255),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD'),
  amount: z.number().positive(),
  merchantName: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  cardholder: z.string().min(1).max(255),
})

// Categorize a single Ramp transaction
export const categorizeRampTransactionSchema = z.object({
  rampTransactionId: z.number().int().positive(),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  createRule: z.boolean().optional().default(false),
})

// Bulk categorize multiple Ramp transactions
export const bulkCategorizeSchema = z.object({
  rampTransactionIds: z.array(z.number().int().positive()).min(1),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  createRule: z.boolean().optional().default(false),
})

export type InsertRampTransaction = z.infer<typeof insertRampTransactionSchema>
export type CategorizeRampTransaction = z.infer<typeof categorizeRampTransactionSchema>
export type BulkCategorize = z.infer<typeof bulkCategorizeSchema>
