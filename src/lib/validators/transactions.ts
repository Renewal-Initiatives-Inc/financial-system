import { z } from 'zod'

const sourceTypes = [
  'MANUAL',
  'TIMESHEET',
  'EXPENSE_REPORT',
  'RAMP',
  'BANK_FEED',
  'SYSTEM',
  'FY25_IMPORT',
] as const

const positiveDecimal = z
  .number()
  .positive('Amount must be positive')
  .multipleOf(0.01, 'Amount must have at most 2 decimal places')

export const transactionLineSchema = z
  .object({
    accountId: z.number().int().positive('Account ID is required'),
    fundId: z.number().int().positive('Fund ID is required'),
    debit: positiveDecimal.nullable().optional(),
    credit: positiveDecimal.nullable().optional(),
    cipCostCodeId: z.number().int().positive().nullable().optional(),
    memo: z.string().nullable().optional(),
  })
  .refine(
    (line) => {
      const hasDebit = line.debit != null && line.debit > 0
      const hasCredit = line.credit != null && line.credit > 0
      return (hasDebit && !hasCredit) || (!hasDebit && hasCredit)
    },
    { message: 'Each line must have exactly one of debit or credit (positive)' }
  )

export const insertTransactionSchema = z
  .object({
    date: z.string().date('Must be a valid date (YYYY-MM-DD)'),
    memo: z.string().min(1, 'Memo is required'),
    sourceType: z.enum(sourceTypes),
    sourceReferenceId: z.string().max(255).nullable().optional(),
    isSystemGenerated: z.boolean().optional().default(false),
    lines: z.array(transactionLineSchema).min(2, 'Minimum 2 lines required'),
    createdBy: z.string().min(1, 'Created by is required'),
  })
  .refine(
    (txn) => {
      const totalDebits = txn.lines.reduce(
        (sum, line) => sum + (line.debit ?? 0),
        0
      )
      const totalCredits = txn.lines.reduce(
        (sum, line) => sum + (line.credit ?? 0),
        0
      )
      return Math.abs(totalDebits - totalCredits) < 0.001
    },
    { message: 'Transaction must balance: sum(debits) must equal sum(credits)' }
  )

export const editTransactionSchema = z.object({
  date: z.string().date().optional(),
  memo: z.string().min(1).optional(),
  lines: z.array(transactionLineSchema).min(2).optional(),
})

export type TransactionLine = z.infer<typeof transactionLineSchema>
export type InsertTransaction = z.input<typeof insertTransactionSchema>
export type EditTransaction = z.infer<typeof editTransactionSchema>
