import { z } from 'zod'

const poStatuses = ['DRAFT', 'ACTIVE', 'COMPLETED', 'CANCELLED'] as const

const positiveDecimal = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

export const insertPurchaseOrderSchema = z.object({
  vendorId: z.number().int().positive('Vendor is required'),
  description: z.string().min(1, 'Description is required'),
  contractPdfUrl: z.string().url().nullable().optional(),
  totalAmount: positiveDecimal,
  glDestinationAccountId: z
    .number()
    .int()
    .positive('GL destination account is required'),
  fundId: z.number().int().positive('Fund is required'),
  cipCostCodeId: z.number().int().positive().nullable().optional(),
  status: z.enum(poStatuses).optional().default('DRAFT'),
  extractedMilestones: z.unknown().nullable().optional(),
  extractedTerms: z.unknown().nullable().optional(),
  extractedCovenants: z.unknown().nullable().optional(),
})

export const updatePurchaseOrderSchema = z.object({
  description: z.string().min(1).optional(),
  contractPdfUrl: z.string().url().nullable().optional(),
  totalAmount: positiveDecimal.optional(),
  glDestinationAccountId: z.number().int().positive().optional(),
  fundId: z.number().int().positive().optional(),
  cipCostCodeId: z.number().int().positive().nullable().optional(),
  extractedMilestones: z.unknown().nullable().optional(),
  extractedTerms: z.unknown().nullable().optional(),
  extractedCovenants: z.unknown().nullable().optional(),
})

export type InsertPurchaseOrder = z.input<typeof insertPurchaseOrderSchema>
export type UpdatePurchaseOrder = z.infer<typeof updatePurchaseOrderSchema>
