'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import {
  recurringExpectations,
  accounts,
  funds,
  bankAccounts,
} from '@/lib/db/schema'
import type { RecurringExpectationFrequency } from '@/lib/db/schema/recurring-expectations'

// --- Types ---

export type RecurringExpectationRow = {
  id: number
  merchantPattern: string
  description: string
  expectedAmount: string
  amountTolerance: string
  frequency: string
  expectedDay: number
  glAccountId: number
  glAccountName: string
  fundId: number
  fundName: string
  bankAccountId: number
  bankAccountName: string
  isActive: boolean
  lastMatchedAt: Date | null
}

// --- Validation ---

const frequencyValues = ['weekly', 'biweekly', 'monthly', 'quarterly', 'annual'] as const

const recurringExpectationSchema = z.object({
  merchantPattern: z
    .string()
    .min(1, 'Merchant pattern is required')
    .max(255)
    .refine(
      (val) => {
        try {
          new RegExp(val)
          return true
        } catch {
          return false
        }
      },
      { message: 'Invalid regex pattern' }
    ),
  description: z.string().min(1, 'Description is required').max(255),
  expectedAmount: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) > 0,
    { message: 'Expected amount must be a positive number' }
  ),
  amountTolerance: z.string().refine(
    (val) => !isNaN(parseFloat(val)) && parseFloat(val) >= 0,
    { message: 'Tolerance must be zero or positive' }
  ),
  frequency: z.enum(frequencyValues),
  expectedDay: z.number().int(),
  glAccountId: z.number().int().positive(),
  fundId: z.number().int().positive(),
  bankAccountId: z.number().int().positive(),
})

function validateExpectedDay(frequency: RecurringExpectationFrequency, day: number): string | null {
  switch (frequency) {
    case 'weekly':
    case 'biweekly':
      if (day < 1 || day > 7) return 'Day must be 1-7 (Mon-Sun) for weekly/biweekly'
      break
    case 'monthly':
    case 'quarterly':
    case 'annual':
      if (day < 1 || day > 31) return 'Day must be 1-31 for monthly/quarterly/annual'
      break
  }
  return null
}

// --- Server Actions ---

export async function getRecurringExpectations(): Promise<RecurringExpectationRow[]> {
  const rows = await db
    .select({
      id: recurringExpectations.id,
      merchantPattern: recurringExpectations.merchantPattern,
      description: recurringExpectations.description,
      expectedAmount: recurringExpectations.expectedAmount,
      amountTolerance: recurringExpectations.amountTolerance,
      frequency: recurringExpectations.frequency,
      expectedDay: recurringExpectations.expectedDay,
      glAccountId: recurringExpectations.glAccountId,
      glAccountName: accounts.name,
      fundId: recurringExpectations.fundId,
      fundName: funds.name,
      bankAccountId: recurringExpectations.bankAccountId,
      bankAccountName: bankAccounts.name,
      isActive: recurringExpectations.isActive,
      lastMatchedAt: recurringExpectations.lastMatchedAt,
    })
    .from(recurringExpectations)
    .innerJoin(accounts, eq(recurringExpectations.glAccountId, accounts.id))
    .innerJoin(funds, eq(recurringExpectations.fundId, funds.id))
    .innerJoin(bankAccounts, eq(recurringExpectations.bankAccountId, bankAccounts.id))
    .orderBy(recurringExpectations.description)

  return rows
}

export async function createRecurringExpectation(
  data: z.infer<typeof recurringExpectationSchema>
): Promise<{ id: number }> {
  const validated = recurringExpectationSchema.parse(data)

  const dayError = validateExpectedDay(
    validated.frequency as RecurringExpectationFrequency,
    validated.expectedDay
  )
  if (dayError) throw new Error(dayError)

  // Verify account exists
  const [acct] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.id, validated.glAccountId))
  if (!acct) throw new Error('GL account not found')

  // Verify fund exists
  const [fund] = await db
    .select({ id: funds.id })
    .from(funds)
    .where(eq(funds.id, validated.fundId))
  if (!fund) throw new Error('Fund not found')

  const [result] = await db
    .insert(recurringExpectations)
    .values({
      merchantPattern: validated.merchantPattern,
      description: validated.description,
      expectedAmount: validated.expectedAmount,
      amountTolerance: validated.amountTolerance,
      frequency: validated.frequency,
      expectedDay: validated.expectedDay,
      glAccountId: validated.glAccountId,
      fundId: validated.fundId,
      bankAccountId: validated.bankAccountId,
    })
    .returning()

  revalidatePath('/settings/recurring-expectations')
  return { id: result.id }
}

export async function updateRecurringExpectation(
  id: number,
  data: z.infer<typeof recurringExpectationSchema>
): Promise<void> {
  const validated = recurringExpectationSchema.parse(data)

  const dayError = validateExpectedDay(
    validated.frequency as RecurringExpectationFrequency,
    validated.expectedDay
  )
  if (dayError) throw new Error(dayError)

  await db
    .update(recurringExpectations)
    .set({
      merchantPattern: validated.merchantPattern,
      description: validated.description,
      expectedAmount: validated.expectedAmount,
      amountTolerance: validated.amountTolerance,
      frequency: validated.frequency,
      expectedDay: validated.expectedDay,
      glAccountId: validated.glAccountId,
      fundId: validated.fundId,
      bankAccountId: validated.bankAccountId,
      updatedAt: new Date(),
    })
    .where(eq(recurringExpectations.id, id))

  revalidatePath('/settings/recurring-expectations')
}

export async function deleteRecurringExpectation(id: number): Promise<void> {
  await db
    .delete(recurringExpectations)
    .where(eq(recurringExpectations.id, id))

  revalidatePath('/settings/recurring-expectations')
}

export async function toggleRecurringExpectation(
  id: number,
  isActive: boolean
): Promise<void> {
  await db
    .update(recurringExpectations)
    .set({ isActive, updatedAt: new Date() })
    .where(eq(recurringExpectations.id, id))

  revalidatePath('/settings/recurring-expectations')
}

export async function getAccountOptions(): Promise<
  { id: number; name: string; code: string }[]
> {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}

export async function getFundOptions(): Promise<
  { id: number; name: string }[]
> {
  return db
    .select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(eq(funds.isActive, true))
    .orderBy(funds.name)
}

export async function getBankAccountOptions(): Promise<
  { id: number; name: string }[]
> {
  return db
    .select({ id: bankAccounts.id, name: bankAccounts.name })
    .from(bankAccounts)
    .where(eq(bankAccounts.isActive, true))
    .orderBy(bankAccounts.name)
}
