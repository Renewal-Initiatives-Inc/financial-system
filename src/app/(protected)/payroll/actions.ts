'use server'

import { eq, and, sql, desc } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import {
  payrollRuns,
  payrollEntries,
  stagingRecords,
  annualRateConfig,
} from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import {
  insertPayrollRunSchema,
  insertAnnualRateConfigSchema,
  updateAnnualRateConfigSchema,
} from '@/lib/validators'
import {
  calculatePayrollRun as engineCalculate,
  persistCalculation,
  postPayrollRun as enginePost,
  type PayrollCalculation,
} from '@/lib/payroll/engine'

// --- Query Actions ---

export type PayrollRunRow = typeof payrollRuns.$inferSelect & {
  entryCount: number
  totalGross: string
  totalNet: string
}

export async function getPayrollRuns(filters?: {
  status?: string
}): Promise<PayrollRunRow[]> {
  const conditions = []

  if (filters?.status) {
    conditions.push(eq(payrollRuns.status, filters.status as 'DRAFT' | 'CALCULATED' | 'POSTED'))
  }

  const rows = await db
    .select({
      run: payrollRuns,
      entryCount: sql<number>`CAST(COUNT(${payrollEntries.id}) AS INTEGER)`,
      totalGross: sql<string>`COALESCE(SUM(${payrollEntries.grossPay}::numeric), 0)::text`,
      totalNet: sql<string>`COALESCE(SUM(${payrollEntries.netPay}::numeric), 0)::text`,
    })
    .from(payrollRuns)
    .leftJoin(payrollEntries, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .groupBy(payrollRuns.id)
    .orderBy(desc(payrollRuns.payPeriodStart))

  return rows.map((row) => ({
    ...row.run,
    entryCount: row.entryCount,
    totalGross: row.totalGross,
    totalNet: row.totalNet,
  }))
}

export async function getPayrollRunById(id: number) {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, id))

  return run ?? null
}

export type PayrollEntryRow = typeof payrollEntries.$inferSelect

export async function getPayrollRunEntries(
  runId: number
): Promise<PayrollEntryRow[]> {
  return db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollRunId, runId))
    .orderBy(payrollEntries.employeeName)
}

export async function getStagingRecordsForPeriod(
  start: string,
  end: string
) {
  return db
    .select()
    .from(stagingRecords)
    .where(
      and(
        eq(stagingRecords.sourceApp, 'timesheets'),
        eq(stagingRecords.recordType, 'timesheet_fund_summary'),
        eq(stagingRecords.status, 'received'),
        sql`${stagingRecords.dateIncurred} >= ${start}`,
        sql`${stagingRecords.dateIncurred} <= ${end}`
      )
    )
}

export async function getAnnualRates(year?: number) {
  const conditions = year
    ? [eq(annualRateConfig.fiscalYear, year)]
    : []

  return db
    .select()
    .from(annualRateConfig)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(annualRateConfig.fiscalYear), annualRateConfig.configKey)
}

export async function checkExistingRun(start: string, end: string) {
  const existing = await db
    .select({ id: payrollRuns.id, status: payrollRuns.status })
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.payPeriodStart, start),
        eq(payrollRuns.payPeriodEnd, end)
      )
    )
    .limit(1)

  return existing[0] ?? null
}

// --- Mutation Actions ---

export async function createPayrollRun(
  data: { payPeriodStart: string; payPeriodEnd: string },
  userId: string
): Promise<{ id: number }> {
  const validated = insertPayrollRunSchema.parse({
    ...data,
    createdBy: userId,
  })

  const [newRun] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(payrollRuns)
      .values({
        payPeriodStart: validated.payPeriodStart,
        payPeriodEnd: validated.payPeriodEnd,
        createdBy: validated.createdBy,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'payroll_run',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/payroll')
  return { id: newRun.id }
}

export async function calculatePayroll(
  runId: number,
  userId: string
): Promise<PayrollCalculation> {
  const calculation = await engineCalculate(runId)
  await persistCalculation(calculation, userId)
  revalidatePath('/payroll')
  revalidatePath(`/payroll/runs/${runId}`)
  return calculation
}

export async function postPayroll(
  runId: number,
  userId: string
): Promise<void> {
  await enginePost(runId, userId)
  revalidatePath('/payroll')
  revalidatePath(`/payroll/runs/${runId}`)
  revalidatePath('/transactions')
}

export async function deletePayrollRun(
  runId: number,
  userId: string
): Promise<void> {
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, runId))

  if (!run) throw new Error('Payroll run not found')
  if (run.status === 'POSTED') {
    throw new Error('Cannot delete a posted payroll run')
  }

  await db.transaction(async (tx) => {
    // Entries cascade-delete via FK
    await tx.delete(payrollRuns).where(eq(payrollRuns.id, runId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'voided',
      entityType: 'payroll_run',
      entityId: runId,
      afterState: { deleted: true },
    })
  })

  revalidatePath('/payroll')
}

export async function createAnnualRate(
  data: {
    fiscalYear: number
    configKey: string
    value: string
    effectiveDate?: string | null
    notes?: string | null
  },
  userId: string
): Promise<{ id: number }> {
  const validated = insertAnnualRateConfigSchema.parse({
    ...data,
    updatedBy: userId,
  })

  const [newRate] = await db
    .insert(annualRateConfig)
    .values({
      fiscalYear: validated.fiscalYear,
      configKey: validated.configKey,
      value: validated.value,
      effectiveDate: validated.effectiveDate ?? null,
      notes: validated.notes ?? null,
      updatedBy: validated.updatedBy,
    })
    .returning()

  revalidatePath('/settings/rates')
  return { id: newRate.id }
}

export async function updateAnnualRate(
  id: number,
  data: { value?: string; notes?: string | null },
  userId: string
): Promise<void> {
  const validated = updateAnnualRateConfigSchema.parse({
    ...data,
    updatedBy: userId,
  })

  // Check immutability: cannot edit if posted runs exist for that year
  const [rate] = await db
    .select()
    .from(annualRateConfig)
    .where(eq(annualRateConfig.id, id))

  if (!rate) throw new Error('Rate not found')

  const postedRuns = await db
    .select({ id: payrollRuns.id })
    .from(payrollRuns)
    .where(
      and(
        eq(payrollRuns.status, 'POSTED'),
        sql`EXTRACT(YEAR FROM ${payrollRuns.payPeriodEnd}::date) = ${rate.fiscalYear}`
      )
    )
    .limit(1)

  if (postedRuns.length > 0) {
    throw new Error(
      `Cannot edit rate for ${rate.fiscalYear} — payroll has been posted for this year`
    )
  }

  await db
    .update(annualRateConfig)
    .set({
      ...(validated.value !== undefined ? { value: validated.value } : {}),
      ...(validated.notes !== undefined ? { notes: validated.notes } : {}),
      updatedBy: validated.updatedBy,
      updatedAt: new Date(),
    })
    .where(eq(annualRateConfig.id, id))

  revalidatePath('/settings/rates')
}
