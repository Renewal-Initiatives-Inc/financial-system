'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import {
  createBudget,
  getBudget,
  getBudgetList,
  getBudgetByFiscalYear,
  createBudgetLine,
  updateBudgetLine,
  deleteBudgetLine,
  updateBudgetStatus,
  getFundingBudgetSummary,
  copyBudgetFromPriorYear,
  type FundingBudgetSummary,
} from '@/lib/budget/queries'
import { getBudgetVsActual, type BudgetVarianceRow } from '@/lib/budget/variance'
import { getCIPBudgetVsActual, type CIPSubAccountVariance } from '@/lib/budget/cip-budget'
import { recalculateSpread, type SpreadMethod } from '@/lib/budget/spread'
import type { UpdateBudgetLine } from '@/lib/validators'

async function getUserId(): Promise<string> {
  const session = await auth()
  return session?.user?.id ?? 'system'
}

// --- Budget Actions ---

export async function createBudgetAction(
  fiscalYear: number
): Promise<{ id: number } | { error: string }> {
  try {
    const userId = await getUserId()

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
  }
): Promise<{ id: number } | { error: string }> {
  try {
    const userId = await getUserId()
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
  budgetId: number
): Promise<{ success: boolean } | { error: string }> {
  try {
    const userId = await getUserId()
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
  budgetId: number
): Promise<{ success: boolean } | { error: string }> {
  try {
    const userId = await getUserId()
    await deleteBudgetLine(lineId, userId)
    revalidatePath(`/budgets/${budgetId}`)
    revalidatePath(`/budgets/${budgetId}/edit`)
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to delete budget line' }
  }
}

export async function approveBudgetAction(
  budgetId: number
): Promise<{ success: boolean } | { error: string }> {
  try {
    const userId = await getUserId()
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

export async function getCIPVarianceAction(
  budgetId: number,
  fundId?: number
): Promise<CIPSubAccountVariance[]> {
  return getCIPBudgetVsActual(budgetId, fundId)
}

export async function getFundingBudgetSummaryAction(
  fundId: number
): Promise<FundingBudgetSummary | null> {
  return getFundingBudgetSummary(fundId)
}

export async function copyBudgetFromPriorYearAction(
  sourceBudgetId: number,
  targetFiscalYear: number,
  adjustmentPercent: number
): Promise<{ id: number } | { error: string }> {
  try {
    const userId = await getUserId()
    const budget = await copyBudgetFromPriorYear(
      sourceBudgetId,
      targetFiscalYear,
      adjustmentPercent,
      userId
    )
    revalidatePath('/budgets')
    return { id: budget.id }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to copy budget' }
  }
}

export async function recalculateSpreadAction(
  method: SpreadMethod,
  annualAmount: number,
  params?: { weights?: number[]; targetMonth?: number }
): Promise<number[]> {
  return recalculateSpread(method, annualAmount, params)
}
