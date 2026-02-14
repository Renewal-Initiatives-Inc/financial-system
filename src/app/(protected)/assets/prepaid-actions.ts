'use server'

import { revalidatePath } from 'next/cache'
import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prepaidSchedules, accounts, funds } from '@/lib/db/schema'
import {
  insertPrepaidScheduleSchema,
  type InsertPrepaidSchedule,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import {
  calculateMonthlyAmortization,
  handleRefundTrueUp,
} from '@/lib/assets/prepaid-amortization'

// --- Types ---

export type PrepaidScheduleRow = typeof prepaidSchedules.$inferSelect & {
  glExpenseAccountName: string
  glPrepaidAccountName: string
  fundName: string
  remainingBalance: string
}

// --- Server Actions ---

export async function getPrepaidSchedules(filters?: {
  isActive?: boolean
}): Promise<PrepaidScheduleRow[]> {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(prepaidSchedules.isActive, filters.isActive))
  }

  const schedules = await db
    .select()
    .from(prepaidSchedules)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(prepaidSchedules.startDate)

  // Resolve names in bulk
  const expenseAccountIds = [...new Set(schedules.map((s) => s.glExpenseAccountId))]
  const prepaidAccountIds = [...new Set(schedules.map((s) => s.glPrepaidAccountId))]
  const fundIds = [...new Set(schedules.map((s) => s.fundId))]

  const allAccountRows = await db
    .select({ id: accounts.id, name: accounts.name })
    .from(accounts)
  const accountMap = new Map(allAccountRows.map((a) => [a.id, a.name]))

  const allFundRows = await db
    .select({ id: funds.id, name: funds.name })
    .from(funds)
  const fundMap = new Map(allFundRows.map((f) => [f.id, f.name]))

  return schedules.map((schedule) => ({
    ...schedule,
    glExpenseAccountName: accountMap.get(schedule.glExpenseAccountId) ?? '',
    glPrepaidAccountName: accountMap.get(schedule.glPrepaidAccountId) ?? '',
    fundName: fundMap.get(schedule.fundId) ?? '',
    remainingBalance: (
      Number(schedule.totalAmount) - Number(schedule.amountAmortized)
    ).toFixed(2),
  }))
}

export async function createPrepaidSchedule(
  data: InsertPrepaidSchedule,
  userId: string
): Promise<{ id: number }> {
  const validated = insertPrepaidScheduleSchema.parse(data)

  // Calculate monthly amount
  const monthlyAmount = calculateMonthlyAmortization({
    totalAmount: String(validated.totalAmount),
    startDate: validated.startDate,
    endDate: validated.endDate,
  })

  const [newSchedule] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(prepaidSchedules)
      .values({
        description: validated.description,
        totalAmount: String(validated.totalAmount),
        startDate: validated.startDate,
        endDate: validated.endDate,
        glExpenseAccountId: validated.glExpenseAccountId,
        glPrepaidAccountId: validated.glPrepaidAccountId,
        fundId: validated.fundId,
        monthlyAmount: String(monthlyAmount),
        createdBy: userId,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'prepaid_schedule',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/assets/prepaid')
  return { id: newSchedule.id }
}

export async function handlePrepaidRefund(
  scheduleId: number,
  refundAmount: number,
  userId: string
): Promise<void> {
  await handleRefundTrueUp(scheduleId, refundAmount, userId)

  revalidatePath('/assets/prepaid')
}
