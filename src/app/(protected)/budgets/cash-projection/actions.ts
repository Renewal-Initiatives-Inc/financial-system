'use server'

import { revalidatePath } from 'next/cache'
import { auth } from '@/lib/auth'
import {
  createCashProjection,
  saveCashProjectionLines,
  getCashProjection,
  getLatestCashProjection,
  createWeeklyCashProjection,
  saveWeeklyCashProjectionLines,
  getWeeklyCashProjection,
  getLatestWeeklyCashProjection,
} from '@/lib/budget/queries'
import { generateProjectionLines, getStartingCash } from '@/lib/budget/projection'
import { generateWeeklyProjection } from '@/lib/budget/weekly-projection'
import { getBudgetByFiscalYear } from '@/lib/budget/queries'

async function getUserId(): Promise<string> {
  const session = await auth()
  return session?.user?.id ?? 'system'
}

export async function generateProjectionAction(
  fiscalYear: number
): Promise<{ projectionId: number; startingCash: number } | { error: string }> {
  try {
    const userId = await getUserId()
    const now = new Date()
    const startMonth = now.getMonth() + 2 // Next month (1-indexed)
    const asOfDate = now.toISOString().split('T')[0]

    // Find the budget for this fiscal year
    const budget = await getBudgetByFiscalYear(fiscalYear)
    const budgetId = budget?.id

    // Generate projection lines
    const monthlyData = await generateProjectionLines(startMonth, budgetId)
    const startingCash = await getStartingCash()

    // Create the projection record
    const projection = await createCashProjection({
      fiscalYear,
      asOfDate,
      createdBy: userId,
    })

    // Flatten lines for all 3 months
    const allLines: {
      month: number
      sourceLabel: string
      autoAmount: number
      lineType: 'INFLOW' | 'OUTFLOW'
      sortOrder: number
    }[] = []

    // Add starting cash as first line for each month
    for (const md of monthlyData) {
      allLines.push({
        month: md.month,
        sourceLabel: 'Starting Cash',
        autoAmount: startingCash,
        lineType: 'INFLOW',
        sortOrder: -1,
      })
      for (const line of md.lines) {
        allLines.push({
          month: md.month,
          ...line,
        })
      }
    }

    await saveCashProjectionLines(projection.id, allLines)

    revalidatePath('/budgets/cash-projection')
    return { projectionId: projection.id, startingCash }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to generate projection' }
  }
}

export async function saveProjectionOverridesAction(
  projectionId: number,
  overrides: { lineId: number; overrideAmount: number | null; overrideNote: string | null }[]
): Promise<{ success: boolean } | { error: string }> {
  try {
    // Get existing projection to preserve lines
    const projection = await getCashProjection(projectionId)
    if (!projection) return { error: 'Projection not found' }

    const updatedLines = projection.lines.map((line) => {
      const override = overrides.find((o) => o.lineId === line.id)
      return {
        month: line.month,
        sourceLabel: line.sourceLabel,
        autoAmount: Number(line.autoAmount),
        overrideAmount: override ? override.overrideAmount : line.overrideAmount ? Number(line.overrideAmount) : null,
        overrideNote: override ? override.overrideNote : line.overrideNote,
        lineType: line.lineType,
        sortOrder: line.sortOrder,
      }
    })

    await saveCashProjectionLines(projectionId, updatedLines)

    revalidatePath('/budgets/cash-projection')
    return { success: true }
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Failed to save overrides' }
  }
}

export async function getProjectionAction(projectionId: number) {
  return getCashProjection(projectionId)
}

export async function getLatestProjectionAction(fiscalYear: number) {
  return getLatestCashProjection(fiscalYear)
}

// --- Weekly projection actions ---

export async function generateWeeklyProjectionAction(
  fiscalYear: number
): Promise<{ projectionId: number; startingCash: number } | { error: string }> {
  try {
    const userId = await getUserId()
    const now = new Date()
    const asOfDate = now.toISOString().split('T')[0]

    const lines = await generateWeeklyProjection(fiscalYear)
    const startingCash = await getStartingCash()

    const projection = await createWeeklyCashProjection({
      fiscalYear,
      asOfDate,
      createdBy: userId,
    })

    await saveWeeklyCashProjectionLines(projection.id, lines)

    revalidatePath('/budgets/cash-projection')
    return { projectionId: projection.id, startingCash }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to generate weekly projection',
    }
  }
}

export async function saveWeeklyProjectionOverridesAction(
  projectionId: number,
  overrides: {
    lineId: number
    overrideAmount: number | null
    overrideNote: string | null
  }[]
): Promise<{ success: boolean } | { error: string }> {
  try {
    const projection = await getWeeklyCashProjection(projectionId)
    if (!projection) return { error: 'Weekly projection not found' }

    const updatedLines = projection.weeklyLines.map((line) => {
      const override = overrides.find((o) => o.lineId === line.id)
      return {
        weekNumber: line.weekNumber,
        weekStartDate: line.weekStartDate,
        sourceLabel: line.sourceLabel,
        autoAmount: Number(line.autoAmount),
        overrideAmount: override
          ? override.overrideAmount
          : line.overrideAmount
            ? Number(line.overrideAmount)
            : null,
        overrideNote: override ? override.overrideNote : line.overrideNote,
        lineType: line.lineType,
        confidenceLevel: line.confidenceLevel,
        fundId: line.fundId,
        sortOrder: line.sortOrder,
      }
    })

    await saveWeeklyCashProjectionLines(projectionId, updatedLines)

    revalidatePath('/budgets/cash-projection')
    return { success: true }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : 'Failed to save weekly overrides',
    }
  }
}

export async function getWeeklyProjectionAction(projectionId: number) {
  return getWeeklyCashProjection(projectionId)
}

export async function getLatestWeeklyProjectionAction(fiscalYear: number) {
  return getLatestWeeklyCashProjection(fiscalYear)
}
