'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { prepaidSchedules, accounts, funds, transactions, transactionLines } from '@/lib/db/schema'
import {
  insertPrepaidScheduleSchema,
  type InsertPrepaidSchedule,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import {
  calculateMonthlyAmortization,
  generateAmortizationEntriesWithCatchUp,
  handleRefundTrueUp,
} from '@/lib/assets/prepaid-amortization'
import { auth } from '@/lib/auth'

// --- Auth helper ---

async function getAuthUser(): Promise<{ id: string; name: string }> {
  const session = await auth()
  return {
    id: session?.user?.id ?? 'system',
    name: session?.user?.name ?? 'system',
  }
}

// --- Types ---

export type PrepaidScheduleRow = typeof prepaidSchedules.$inferSelect & {
  glExpenseAccountName: string
  glPrepaidAccountName: string
  fundName: string
  remainingBalance: string
}

export type AmortizationHistoryEntry = {
  transactionId: number
  date: string
  amount: number
  memo: string | null
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
  data: InsertPrepaidSchedule
): Promise<{ id: number }> {
  const user = await getAuthUser()
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
        sourceTransactionId: validated.sourceTransactionId ?? null,
        createdBy: user.name,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: user.name,
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

export async function runPrepaidAmortization(
  asOfDate: string
): Promise<{ entriesCreated: number; totalAmount: number }> {
  const user = await getAuthUser()
  const result = await generateAmortizationEntriesWithCatchUp(asOfDate, user.name)

  revalidatePath('/assets/prepaid')
  return result
}

export async function handlePrepaidRefund(
  scheduleId: number,
  refundAmount: number
): Promise<void> {
  const user = await getAuthUser()
  await handleRefundTrueUp(scheduleId, refundAmount, user.name)

  revalidatePath('/assets/prepaid')
}

export async function getAmortizationHistory(
  scheduleId: number
): Promise<AmortizationHistoryEntry[]> {
  // Get the schedule to find its accounts and description
  const [schedule] = await db
    .select()
    .from(prepaidSchedules)
    .where(eq(prepaidSchedules.id, scheduleId))

  if (!schedule) return []

  // Find system-generated transactions that credit the prepaid account
  // and mention this schedule's description in the memo
  const rows = await db
    .select({
      transactionId: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      credit: transactionLines.credit,
    })
    .from(transactions)
    .innerJoin(
      transactionLines,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(
      and(
        eq(transactions.sourceType, 'SYSTEM'),
        eq(transactions.isSystemGenerated, true),
        eq(transactions.isVoided, false),
        eq(transactionLines.accountId, schedule.glPrepaidAccountId),
        sql`${transactions.memo} LIKE ${'%' + schedule.description + '%'}`,
        sql`${transactionLines.credit}::numeric > 0`
      )
    )
    .orderBy(transactions.date)

  return rows.map((r) => ({
    transactionId: r.transactionId,
    date: typeof r.date === 'string' ? r.date : (r.date as Date).toISOString().split('T')[0],
    amount: Number(r.credit),
    memo: r.memo,
  }))
}

export async function updatePrepaidSchedule(
  scheduleId: number,
  data: {
    description?: string
    endDate?: string
    glExpenseAccountId?: number
    fundId?: number
  }
): Promise<void> {
  const user = await getAuthUser()

  const [schedule] = await db
    .select()
    .from(prepaidSchedules)
    .where(eq(prepaidSchedules.id, scheduleId))

  if (!schedule) throw new Error('Prepaid schedule not found')
  if (!schedule.isActive) throw new Error('Cannot edit an inactive schedule')

  const updates: Record<string, unknown> = {}
  if (data.description !== undefined) updates.description = data.description
  if (data.endDate !== undefined) updates.endDate = data.endDate
  if (data.glExpenseAccountId !== undefined) updates.glExpenseAccountId = data.glExpenseAccountId
  if (data.fundId !== undefined) updates.fundId = data.fundId

  // Recalculate monthly amount if endDate changed
  if (data.endDate) {
    const remaining = Number(schedule.totalAmount) - Number(schedule.amountAmortized)
    const today = new Date().toISOString().split('T')[0]
    const startYM = today.slice(0, 7)
    const endYM = data.endDate.slice(0, 7)
    const [sy, sm] = startYM.split('-').map(Number)
    const [ey, em] = endYM.split('-').map(Number)
    const remainingMonths = (ey - sy) * 12 + (em - sm)
    if (remainingMonths > 0) {
      updates.monthlyAmount = String(Math.round((remaining / remainingMonths) * 100) / 100)
    }
  }

  await db.transaction(async (tx) => {
    const beforeState = { ...schedule }

    await tx
      .update(prepaidSchedules)
      .set(updates)
      .where(eq(prepaidSchedules.id, scheduleId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: user.name,
      action: 'updated',
      entityType: 'prepaid_schedule',
      entityId: scheduleId,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: { ...beforeState, ...updates } as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/assets/prepaid')
}

export async function cancelPrepaidSchedule(
  scheduleId: number
): Promise<void> {
  const user = await getAuthUser()

  const [schedule] = await db
    .select()
    .from(prepaidSchedules)
    .where(eq(prepaidSchedules.id, scheduleId))

  if (!schedule) throw new Error('Prepaid schedule not found')
  if (!schedule.isActive) throw new Error('Schedule is already inactive')

  await db.transaction(async (tx) => {
    await tx
      .update(prepaidSchedules)
      .set({
        isActive: false,
        cancelledAt: new Date(),
      })
      .where(eq(prepaidSchedules.id, scheduleId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: user.name,
      action: 'deactivated',
      entityType: 'prepaid_schedule',
      entityId: scheduleId,
      beforeState: schedule as unknown as Record<string, unknown>,
      afterState: { ...schedule, isActive: false, cancelledAt: new Date() } as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/assets/prepaid')
}
