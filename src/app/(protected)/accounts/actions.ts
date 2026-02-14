'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql, ilike, and, isNull, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, transactionLines, transactions } from '@/lib/db/schema'
import { insertAccountSchema, updateAccountSchema, type InsertAccount, type UpdateAccount } from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { deactivateAccount } from '@/lib/gl/deactivation'
import { SystemLockedError } from '@/lib/gl/errors'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

// --- Types ---

export type AccountRow = typeof accounts.$inferSelect

export type AccountDetail = AccountRow & {
  children: AccountRow[]
  transactionCount: number
  parent: AccountRow | null
}

export type AccountNode = AccountRow & {
  children: AccountNode[]
}

// --- Server Actions ---

export async function getAccounts(filters?: {
  type?: string
  isActive?: boolean
  search?: string
}): Promise<AccountRow[]> {
  const conditions = []

  if (filters?.type) {
    conditions.push(eq(accounts.type, filters.type as typeof accounts.type.enumValues[number]))
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(accounts.isActive, filters.isActive))
  }
  if (filters?.search) {
    conditions.push(
      sql`(${ilike(accounts.name, `%${filters.search}%`)} OR ${ilike(accounts.code, `%${filters.search}%`)})`
    )
  }

  const result = await db
    .select()
    .from(accounts)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(accounts.code)

  return result
}

export async function getAccountById(id: number): Promise<AccountDetail | null> {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.id, id))

  if (!account) return null

  // Fetch children
  const children = await db
    .select()
    .from(accounts)
    .where(eq(accounts.parentAccountId, id))
    .orderBy(accounts.code)

  // Fetch parent
  let parent: AccountRow | null = null
  if (account.parentAccountId) {
    const [parentRow] = await db
      .select()
      .from(accounts)
      .where(eq(accounts.id, account.parentAccountId))
    parent = parentRow ?? null
  }

  // Count non-voided transaction lines for this account
  const [txnCount] = await db
    .select({ value: count() })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.accountId, id),
        eq(transactions.isVoided, false)
      )
    )

  return {
    ...account,
    children,
    transactionCount: txnCount?.value ?? 0,
    parent,
  }
}

export async function createAccount(
  data: InsertAccount,
  userId: string
): Promise<{ id: number }> {
  const validated = insertAccountSchema.parse(data)

  const [newAccount] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(accounts)
      .values({
        code: validated.code,
        name: validated.name,
        type: validated.type,
        subType: validated.subType ?? null,
        normalBalance: validated.normalBalance,
        isActive: validated.isActive ?? true,
        form990Line: validated.form990Line ?? null,
        parentAccountId: validated.parentAccountId ?? null,
        isSystemLocked: validated.isSystemLocked ?? false,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'account',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/accounts')
  return { id: newAccount.id }
}

export async function updateAccount(
  id: number,
  data: UpdateAccount,
  userId: string
): Promise<void> {
  const validated = updateAccountSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))

    if (!existing) {
      throw new Error(`Account ${id} not found`)
    }

    // System-locked accounts: only subType can be changed (not name)
    if (existing.isSystemLocked && validated.name !== undefined) {
      throw new SystemLockedError('Account', id)
    }

    const beforeState = { ...existing }

    await tx
      .update(accounts)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.subType !== undefined ? { subType: validated.subType } : {}),
        updatedAt: new Date(),
      })
      .where(eq(accounts.id, id))

    const [updated] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'account',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/accounts')
  revalidatePath(`/accounts/${id}`)
}

export async function toggleAccountActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  if (!active) {
    // Deactivation uses the GL deactivation guard
    await deactivateAccount(id, userId)
  } else {
    // Reactivation — no special guards needed
    await reactivateAccount(id, userId)
  }
  revalidatePath('/accounts')
  revalidatePath(`/accounts/${id}`)
}

async function reactivateAccount(id: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(accounts)
      .where(eq(accounts.id, id))

    if (!existing) {
      throw new Error(`Account ${id} not found`)
    }

    await tx
      .update(accounts)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(accounts.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'account',
      entityId: id,
      beforeState: { isActive: false },
      afterState: { isActive: true },
    })
  })
}

export async function getAccountHierarchy(): Promise<AccountNode[]> {
  const allAccounts = await db
    .select()
    .from(accounts)
    .orderBy(accounts.code)

  // Build tree from flat list
  const accountMap = new Map<number, AccountNode>()
  const roots: AccountNode[] = []

  // First pass: create nodes
  for (const account of allAccounts) {
    accountMap.set(account.id, { ...account, children: [] })
  }

  // Second pass: build tree
  for (const account of allAccounts) {
    const node = accountMap.get(account.id)!
    if (account.parentAccountId) {
      const parent = accountMap.get(account.parentAccountId)
      if (parent) {
        parent.children.push(node)
      } else {
        roots.push(node)
      }
    } else {
      roots.push(node)
    }
  }

  return roots
}
