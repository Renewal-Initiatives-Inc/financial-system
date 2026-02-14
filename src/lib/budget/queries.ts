import { eq, and } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { db } from '@/lib/db'
import {
  budgets,
  budgetLines,
  accounts,
  funds,
  cashProjections,
  cashProjectionLines,
} from '@/lib/db/schema'
import {
  insertBudgetSchema,
  insertBudgetLineSchema,
  updateBudgetLineSchema,
  type InsertBudget,
  type InsertBudgetLine,
  type UpdateBudgetLine,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'

// --- Types ---

export type BudgetRow = typeof budgets.$inferSelect
export type BudgetLineRow = typeof budgetLines.$inferSelect
export type CashProjectionRow = typeof cashProjections.$inferSelect

export interface BudgetWithLines extends BudgetRow {
  lines: (BudgetLineRow & {
    accountCode: string
    accountName: string
    accountType: string
    fundName: string
  })[]
}

// --- Budget CRUD ---

export async function createBudget(input: InsertBudget): Promise<BudgetRow> {
  const validated = insertBudgetSchema.parse(input)

  const [newBudget] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(budgets)
      .values({
        fiscalYear: validated.fiscalYear,
        status: validated.status,
        createdBy: validated.createdBy,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId: validated.createdBy,
      action: 'created',
      entityType: 'budget',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  return newBudget
}

export async function getBudget(id: number): Promise<BudgetWithLines | null> {
  const [budget] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.id, id))

  if (!budget) return null

  const lines = await db
    .select({
      id: budgetLines.id,
      budgetId: budgetLines.budgetId,
      accountId: budgetLines.accountId,
      fundId: budgetLines.fundId,
      annualAmount: budgetLines.annualAmount,
      spreadMethod: budgetLines.spreadMethod,
      monthlyAmounts: budgetLines.monthlyAmounts,
      createdAt: budgetLines.createdAt,
      updatedAt: budgetLines.updatedAt,
      accountCode: accounts.code,
      accountName: accounts.name,
      accountType: accounts.type,
      fundName: funds.name,
    })
    .from(budgetLines)
    .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .innerJoin(funds, eq(budgetLines.fundId, funds.id))
    .where(eq(budgetLines.budgetId, id))
    .orderBy(accounts.code)

  return { ...budget, lines }
}

export async function getBudgetByFiscalYear(year: number): Promise<BudgetRow | null> {
  const [budget] = await db
    .select()
    .from(budgets)
    .where(eq(budgets.fiscalYear, year))

  return budget ?? null
}

export async function getBudgetList(): Promise<(BudgetRow & { totalAmount: string })[]> {
  const allBudgets = await db.select().from(budgets).orderBy(budgets.fiscalYear)

  const result = []
  for (const budget of allBudgets) {
    const lines = await db
      .select({ annualAmount: budgetLines.annualAmount })
      .from(budgetLines)
      .where(eq(budgetLines.budgetId, budget.id))

    const totalAmount = lines
      .reduce((sum, l) => sum + Number(l.annualAmount), 0)
      .toFixed(2)

    result.push({ ...budget, totalAmount })
  }

  return result
}

export async function createBudgetLine(
  input: InsertBudgetLine,
  userId: string
): Promise<BudgetLineRow> {
  const validated = insertBudgetLineSchema.parse(input)

  const [newLine] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(budgetLines)
      .values({
        budgetId: validated.budgetId,
        accountId: validated.accountId,
        fundId: validated.fundId,
        annualAmount: validated.annualAmount.toFixed(2),
        spreadMethod: validated.spreadMethod,
        monthlyAmounts: validated.monthlyAmounts,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'budget_line',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  return newLine
}

/**
 * Update a budget line with mid-year lock enforcement.
 * Months ≤ current month cannot be changed.
 */
export async function updateBudgetLine(
  id: number,
  updates: UpdateBudgetLine,
  userId: string
): Promise<BudgetLineRow> {
  const validated = updateBudgetLineSchema.parse(updates)

  const [updated] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.id, id))

    if (!existing) throw new Error(`Budget line ${id} not found`)

    // Mid-year lock: check if locked months are being changed
    if (validated.monthlyAmounts) {
      const currentMonth = new Date().getMonth() + 1 // 1-12
      const existingMonthly = existing.monthlyAmounts as number[]

      for (let i = 0; i < currentMonth; i++) {
        if (Math.abs((validated.monthlyAmounts[i] ?? 0) - (existingMonthly[i] ?? 0)) > 0.001) {
          throw new Error(
            `Cannot modify month ${i + 1} — past months are locked for mid-year revision`
          )
        }
      }
    }

    const beforeState = { ...existing }

    const result = await tx
      .update(budgetLines)
      .set({
        ...(validated.annualAmount !== undefined
          ? { annualAmount: validated.annualAmount.toFixed(2) }
          : {}),
        ...(validated.spreadMethod !== undefined
          ? { spreadMethod: validated.spreadMethod }
          : {}),
        ...(validated.monthlyAmounts !== undefined
          ? { monthlyAmounts: validated.monthlyAmounts }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(budgetLines.id, id))
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'budget_line',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  return updated
}

export async function deleteBudgetLine(id: number, userId: string): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(budgetLines)
      .where(eq(budgetLines.id, id))

    if (!existing) throw new Error(`Budget line ${id} not found`)

    await tx.delete(budgetLines).where(eq(budgetLines.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'budget_line',
      entityId: id,
      beforeState: existing as unknown as Record<string, unknown>,
      afterState: { deleted: true },
    })
  })
}

export async function updateBudgetStatus(
  id: number,
  status: 'DRAFT' | 'APPROVED',
  userId: string
): Promise<BudgetRow> {
  const [updated] = await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(budgets)
      .where(eq(budgets.id, id))

    if (!existing) throw new Error(`Budget ${id} not found`)

    const result = await tx
      .update(budgets)
      .set({ status, updatedAt: new Date() })
      .where(eq(budgets.id, id))
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'budget',
      entityId: id,
      beforeState: { status: existing.status } as Record<string, unknown>,
      afterState: { status } as Record<string, unknown>,
    })

    return result
  })

  return updated
}

/**
 * Get budget amounts for a specific month, optionally filtered by fund.
 */
export async function getBudgetForMonth(
  fiscalYear: number,
  month: number,
  fundId?: number
): Promise<{ accountId: number; fundId: number; amount: number }[]> {
  const budget = await getBudgetByFiscalYear(fiscalYear)
  if (!budget) return []

  const conditions = [eq(budgetLines.budgetId, budget.id)]
  if (fundId) conditions.push(eq(budgetLines.fundId, fundId))

  const lines = await db
    .select({
      accountId: budgetLines.accountId,
      fundId: budgetLines.fundId,
      monthlyAmounts: budgetLines.monthlyAmounts,
    })
    .from(budgetLines)
    .where(and(...conditions))

  return lines.map((l) => ({
    accountId: l.accountId,
    fundId: l.fundId,
    amount: (l.monthlyAmounts as number[])[month - 1] ?? 0,
  }))
}

// --- Cash Projection CRUD ---

export async function createCashProjection(input: {
  fiscalYear: number
  asOfDate: string
  createdBy: string
}): Promise<CashProjectionRow> {
  const [projection] = await db
    .insert(cashProjections)
    .values({
      fiscalYear: input.fiscalYear,
      asOfDate: input.asOfDate,
      createdBy: input.createdBy,
    })
    .returning()

  return projection
}

export async function saveCashProjectionLines(
  projectionId: number,
  lines: {
    month: number
    sourceLabel: string
    autoAmount: number
    overrideAmount?: number | null
    overrideNote?: string | null
    lineType: 'INFLOW' | 'OUTFLOW'
    sortOrder: number
  }[]
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete existing lines for this projection
    await tx
      .delete(cashProjectionLines)
      .where(eq(cashProjectionLines.projectionId, projectionId))

    // Insert new lines
    if (lines.length > 0) {
      await tx.insert(cashProjectionLines).values(
        lines.map((l) => ({
          projectionId,
          month: l.month,
          sourceLabel: l.sourceLabel,
          autoAmount: l.autoAmount.toFixed(2),
          overrideAmount: l.overrideAmount != null ? l.overrideAmount.toFixed(2) : null,
          overrideNote: l.overrideNote ?? null,
          lineType: l.lineType,
          sortOrder: l.sortOrder,
        }))
      )
    }
  })
}

export async function getCashProjection(id: number) {
  const [projection] = await db
    .select()
    .from(cashProjections)
    .where(eq(cashProjections.id, id))

  if (!projection) return null

  const lines = await db
    .select()
    .from(cashProjectionLines)
    .where(eq(cashProjectionLines.projectionId, id))
    .orderBy(cashProjectionLines.sortOrder)

  return { ...projection, lines }
}

export async function getLatestCashProjection(fiscalYear: number) {
  const [projection] = await db
    .select()
    .from(cashProjections)
    .where(eq(cashProjections.fiscalYear, fiscalYear))
    .orderBy(cashProjections.createdAt)
    .limit(1)

  if (!projection) return null

  return getCashProjection(projection.id)
}
