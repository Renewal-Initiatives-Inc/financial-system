'use server'

import { revalidatePath } from 'next/cache'
import { eq, sql, and, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import { funds, accounts, transactionLines, transactions } from '@/lib/db/schema'
import { insertFundSchema, updateFundSchema, type InsertFund, type UpdateFund } from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { deactivateFund } from '@/lib/gl/deactivation'
import { SystemLockedError } from '@/lib/gl/errors'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

// --- Types ---

export type FundRow = typeof funds.$inferSelect

export type FundWithBalance = FundRow & {
  balance: string
  transactionCount: number
}

export type FundDetail = FundRow & {
  balance: string
  transactionCount: number
  assetTotal: string
  liabilityTotal: string
  netAssetTotal: string
  revenueTotal: string
  expenseTotal: string
}

// --- Helper: Calculate fund balance breakdown ---

async function getFundBalanceBreakdown(
  fundId: number
): Promise<{
  balance: string
  transactionCount: number
  assetTotal: string
  liabilityTotal: string
  netAssetTotal: string
  revenueTotal: string
  expenseTotal: string
}> {
  // Get balance breakdown by account type for this fund
  const breakdown = await db
    .select({
      accountType: accounts.type,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactionLines.fundId, fundId),
        eq(transactions.isVoided, false)
      )
    )
    .groupBy(accounts.type)

  // Count non-voided transaction lines
  const [txnCount] = await db
    .select({ value: count() })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.fundId, fundId),
        eq(transactions.isVoided, false)
      )
    )

  const byType: Record<string, { debit: number; credit: number }> = {}
  for (const row of breakdown) {
    byType[row.accountType] = {
      debit: parseFloat(row.totalDebit),
      credit: parseFloat(row.totalCredit),
    }
  }

  const getNet = (type: string) => {
    const t = byType[type]
    if (!t) return 0
    return t.debit - t.credit
  }

  // Net debit position per type
  const assetNet = getNet('ASSET')
  const liabilityNet = getNet('LIABILITY')
  const netAssetNet = getNet('NET_ASSET')
  const revenueNet = getNet('REVENUE')
  const expenseNet = getNet('EXPENSE')

  // Overall net = debits - credits across all types
  const totalDebit = Object.values(byType).reduce((s, t) => s + t.debit, 0)
  const totalCredit = Object.values(byType).reduce((s, t) => s + t.credit, 0)
  const netBalance = totalDebit - totalCredit

  return {
    balance: netBalance.toFixed(2),
    transactionCount: txnCount?.value ?? 0,
    assetTotal: assetNet.toFixed(2),
    liabilityTotal: liabilityNet.toFixed(2),
    netAssetTotal: netAssetNet.toFixed(2),
    revenueTotal: revenueNet.toFixed(2),
    expenseTotal: expenseNet.toFixed(2),
  }
}

// --- Server Actions ---

export async function getFunds(): Promise<FundWithBalance[]> {
  const allFunds = await db
    .select()
    .from(funds)
    .orderBy(funds.name)

  const result: FundWithBalance[] = []
  for (const fund of allFunds) {
    const balanceInfo = await getFundBalanceBreakdown(fund.id)
    result.push({
      ...fund,
      balance: balanceInfo.balance,
      transactionCount: balanceInfo.transactionCount,
    })
  }

  return result
}

export async function getFundById(id: number): Promise<FundDetail | null> {
  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, id))

  if (!fund) return null

  const balanceInfo = await getFundBalanceBreakdown(id)

  return {
    ...fund,
    ...balanceInfo,
  }
}

export async function createFund(
  data: InsertFund,
  userId: string
): Promise<{ id: number }> {
  const validated = insertFundSchema.parse(data)

  const [newFund] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(funds)
      .values({
        name: validated.name,
        restrictionType: validated.restrictionType,
        description: validated.description ?? null,
        isSystemLocked: validated.isSystemLocked ?? false,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'fund',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/funds')
  return { id: newFund.id }
}

export async function updateFund(
  id: number,
  data: UpdateFund,
  userId: string
): Promise<void> {
  const validated = updateFundSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(funds)
      .where(eq(funds.id, id))

    if (!existing) {
      throw new Error(`Fund ${id} not found`)
    }

    if (existing.isSystemLocked && validated.name !== undefined) {
      throw new SystemLockedError('Fund', id)
    }

    const beforeState = { ...existing }

    await tx
      .update(funds)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, id))

    const [updated] = await tx
      .select()
      .from(funds)
      .where(eq(funds.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'fund',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/funds')
  revalidatePath(`/funds/${id}`)
}

export async function toggleFundActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  if (!active) {
    await deactivateFund(id, userId)
  } else {
    // Reactivation
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(funds)
        .where(eq(funds.id, id))

      if (!existing) {
        throw new Error(`Fund ${id} not found`)
      }

      await tx
        .update(funds)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(funds.id, id))

      await logAudit(tx as unknown as NeonHttpDatabase<any>, {
        userId,
        action: 'updated',
        entityType: 'fund',
        entityId: id,
        beforeState: { isActive: false },
        afterState: { isActive: true },
      })
    })
  }

  revalidatePath('/funds')
  revalidatePath(`/funds/${id}`)
}
