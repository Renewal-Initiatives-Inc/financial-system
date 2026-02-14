'use server'

import { revalidatePath } from 'next/cache'
import {
  createBudget,
  getBudget,
  getBudgetList,
  getBudgetByFiscalYear,
  createBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  updateBudgetStatus,
  type BudgetRow,
  type BudgetWithLines,
} from '@/lib/budget/queries'
import { getBudgetVsActual, type BudgetVarianceRow } from '@/lib/budget/variance'
import { recalculateSpread, type SpreadMethod } from '@/lib/budget/spread'
import type { InsertBudget, InsertBudgetLine, UpdateBudgetLine } from '@/lib/validators'


// --- Budget Actions ---

export async function createBudgetAction(
  fiscalYear: number,
  userId: string
): Promise<{ id: number } | { error: string }> {
  try {
    // Check if a budget already exists for this fiscal year
    const existing = await getBudgetByFiscalYear(fiscalYear)
    if (existing) {
      return { error: `A budget already exists for fiscal year ${fiscalYear}` }
    }

    const budget = await createBudget({
      fiscalYear,
      status: 'DRAFT',
      createdBy: userId,
    })

    revalidatePath('/budgets')
    return { id: budget.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to create budget' }
  }
}

export async function getBudgetListAction() {
  return getBudgetList()
}

export async function getBudgetAction(id: number) {
  return getBudget(id)
}

export async function saveBudgetLineAction(
  input: {
    budgetId: number
    accountId: number
    fundId: number
    annualAmount: number
    spreadMethod: SpreadMethod
    monthlyAmounts: number[]
  },
  userId: string
): Promise<{ id: number } | { error: string }> {
  try {
    const line = await createBudgetLine(input, userId)
    revalidatePath(`/budgets/${input.budgetId}`)
    revalidatePath(`/budgets/${input.budgetId}/edit`)
    return { id: line.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save budget line' }
  }
}

export async function updateBudgetLineAction(
  lineId: number,
  updates: UpdateBudgetLine,
  budgetId: number,
  userId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    await updateBudgetLine(lineId, updates, userId)
    revalidatePath(`/budgets/${budgetId}`)
    revalidatePath(`/budgets/${budgetId}/edit`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to update budget line' }
  }
}

export async function deleteBudgetLineAction(
  lineId: number,
  budgetId: number,
  userId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    await deleteBudgetLine(lineId, userId)
    revalidatePath(`/budgets/${budgetId}`)
    revalidatePath(`/budgets/${budgetId}/edit`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete budget line' }
  }
}

export async function approveBudgetAction(
  budgetId: number,
  userId: string
): Promise<{ success: boolean } | { error: string }> {
  try {
    await updateBudgetStatus(budgetId, 'APPROVED', userId)
    revalidatePath(`/budgets/${budgetId}`)
    revalidatePath('/budgets')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to approve budget' }
  }
}

export async function getBudgetVarianceAction(
  budgetId: number,
  month?: number,
  fundId?: number
): Promise<BudgetVarianceRow[]> {
  return getBudgetVsActual(budgetId, month, fundId)
}

export async function recalculateSpreadAction(
  method: SpreadMethod,
  annualAmount: number,
  params?: { weights?: number[]; targetMonth?: number }
): Promise<number[]> {
  return recalculateSpread(method, annualAmount, params)
}
