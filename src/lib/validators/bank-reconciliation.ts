import { z } from 'zod'

export const insertBankAccountSchema = z.object({
  name: z.string().min(1).max(255),
  institution: z.string().min(1).max(255),
  last4: z.string().length(4),
  glAccountId: z.number().int().positive(),
})

export const insertBankTransactionSchema = z.object({
  bankAccountId: z.number().int().positive(),
  plaidTransactionId: z.string().min(1).max(255),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  merchantName: z.string().max(500).nullable().optional(),
  isPending: z.boolean().default(false),
})

export const createMatchSchema = z.object({
  bankTransactionId: z.number().int().positive(),
  glTransactionLineId: z.number().int().positive(),
  matchType: z.enum(['auto', 'manual', 'rule']),
})

export const splitMatchSchema = z.object({
  bankTransactionId: z.number().int().positive(),
  splits: z
    .array(
      z.object({
        glTransactionLineId: z.number().int().positive(),
        amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
      })
    )
    .min(2),
})

export const createMatchingRuleSchema = z.object({
  criteria: z.object({
    merchantPattern: z.string().optional(),
    amountExact: z.string().optional(),
    description: z.string().optional(),
  }),
  action: z.object({
    glAccountId: z.number().int().positive(),
    fundId: z.number().int().positive(),
  }),
})

export const createReconciliationSessionSchema = z.object({
  bankAccountId: z.number().int().positive(),
  statementDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  statementBalance: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
})

export const signOffReconciliationSchema = z.object({
  reconciliationSessionId: z.number().int().positive(),
  userId: z.string().min(1),
})

export const inlineGlEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  memo: z.string().min(1).max(500),
  accountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/),
  bankTransactionId: z.number().int().positive(),
})
