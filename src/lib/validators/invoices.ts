import { z } from 'zod'

const invoicePaymentStatuses = [
  'PENDING',
  'POSTED',
  'PAYMENT_IN_PROCESS',
  'MATCHED_TO_PAYMENT',
  'PAID',
] as const

const positiveDecimal = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

export const insertInvoiceSchema = z.object({
  purchaseOrderId: z.number().int().positive('Purchase order is required'),
  vendorId: z.number().int().positive('Vendor is required'),
  invoiceNumber: z.string().max(100).nullable().optional(),
  amount: positiveDecimal,
  invoiceDate: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  dueDate: z.string().date().nullable().optional(),
})

export const insertArInvoiceSchema = z.object({
  fundId: z.number().int().positive('Funding source is required'),
  invoiceNumber: z.string().max(100).nullable().optional(),
  amount: positiveDecimal,
  invoiceDate: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  dueDate: z.string().date().nullable().optional(),
})

export const updateInvoiceSchema = z.object({
  invoiceNumber: z.string().max(100).nullable().optional(),
  paymentStatus: z.enum(invoicePaymentStatuses).optional(),
  dueDate: z.string().date().nullable().optional(),
})

export type InsertInvoice = z.input<typeof insertInvoiceSchema>
export type InsertArInvoice = z.input<typeof insertArInvoiceSchema>
export type UpdateInvoice = z.infer<typeof updateInvoiceSchema>
