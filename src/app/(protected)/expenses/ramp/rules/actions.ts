'use server'

import { revalidatePath } from 'next/cache'
import { eq, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { categorizationRules, accounts, funds } from '@/lib/db/schema'
import {
  insertCategorizationRuleSchema,
  updateCategorizationRuleSchema,
  type InsertCategorizationRule,
  type UpdateCategorizationRule,
} from '@/lib/validators'
import { getUserId } from '@/lib/auth'

// --- Types ---

export type CategorizationRuleRow = typeof categorizationRules.$inferSelect & {
  glAccountName: string | null
  glAccountCode: string | null
  fundName: string | null
}

// --- Queries ---

export async function getCategorizationRules(): Promise<
  CategorizationRuleRow[]
> {
  return db
    .select({
      id: categorizationRules.id,
      criteria: categorizationRules.criteria,
      glAccountId: categorizationRules.glAccountId,
      fundId: categorizationRules.fundId,
      autoApply: categorizationRules.autoApply,
      hitCount: categorizationRules.hitCount,
      createdBy: categorizationRules.createdBy,
      createdAt: categorizationRules.createdAt,
      glAccountName: accounts.name,
      glAccountCode: accounts.code,
      fundName: funds.name,
    })
    .from(categorizationRules)
    .leftJoin(accounts, eq(categorizationRules.glAccountId, accounts.id))
    .leftJoin(funds, eq(categorizationRules.fundId, funds.id))
    .orderBy(desc(categorizationRules.hitCount))
}

// --- Mutations ---

export async function createCategorizationRule(
  data: Omit<InsertCategorizationRule, 'createdBy'>
): Promise<{ id: number }> {
  const userId = await getUserId()
  const validated = insertCategorizationRuleSchema.parse({ ...data, createdBy: userId })

  const [newRule] = await db
    .insert(categorizationRules)
    .values({
      criteria: validated.criteria,
      glAccountId: validated.glAccountId,
      fundId: validated.fundId,
      autoApply: validated.autoApply,
      createdBy: userId,
    })
    .returning({ id: categorizationRules.id })

  revalidatePath('/expenses/ramp/rules')
  return { id: newRule.id }
}

export async function updateCategorizationRule(
  id: number,
  data: UpdateCategorizationRule
): Promise<void> {
  const validated = updateCategorizationRuleSchema.parse(data)

  const updates: Record<string, unknown> = {}
  if (validated.criteria !== undefined) updates.criteria = validated.criteria
  if (validated.glAccountId !== undefined)
    updates.glAccountId = validated.glAccountId
  if (validated.fundId !== undefined) updates.fundId = validated.fundId
  if (validated.autoApply !== undefined) updates.autoApply = validated.autoApply

  if (Object.keys(updates).length > 0) {
    await db
      .update(categorizationRules)
      .set(updates)
      .where(eq(categorizationRules.id, id))
  }

  revalidatePath('/expenses/ramp/rules')
}

export async function deleteCategorizationRule(id: number): Promise<void> {
  await db
    .delete(categorizationRules)
    .where(eq(categorizationRules.id, id))

  revalidatePath('/expenses/ramp/rules')
}
