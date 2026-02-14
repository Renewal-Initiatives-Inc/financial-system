'use server'

import { revalidatePath } from 'next/cache'
import { eq, ilike, and, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  tenants,
  securityDepositReceipts,
  securityDepositInterestPayments,
} from '@/lib/db/schema'
import {
  insertTenantSchema,
  updateTenantSchema,
  type InsertTenant,
  type UpdateTenant,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { collectSecurityDeposit } from '@/lib/security-deposits/collect'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

// --- Types ---

export type TenantRow = typeof tenants.$inferSelect

// --- Helpers ---

function computeTenancyAnniversary(moveInDate: string | null): string | null {
  if (!moveInDate) return null
  const d = new Date(moveInDate)
  const now = new Date()
  const thisYear = now.getFullYear()
  const anniversary = new Date(thisYear, d.getMonth(), d.getDate())
  // If this year's anniversary has passed, use next year
  if (anniversary < now) {
    anniversary.setFullYear(thisYear + 1)
  }
  return anniversary.toISOString().split('T')[0]
}

// --- Server Actions ---

export async function getTenants(filters?: {
  search?: string
  fundingSourceType?: string
  isActive?: boolean
}): Promise<TenantRow[]> {
  const conditions = []

  if (filters?.search) {
    const q = `%${filters.search}%`
    conditions.push(
      or(ilike(tenants.name, q), ilike(tenants.unitNumber, q))!
    )
  }
  if (filters?.fundingSourceType) {
    conditions.push(
      eq(
        tenants.fundingSourceType,
        filters.fundingSourceType as (typeof tenants.fundingSourceType.enumValues)[number]
      )
    )
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(tenants.isActive, filters.isActive))
  }

  return db
    .select()
    .from(tenants)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(tenants.unitNumber)
}

export async function getTenantById(
  id: number
): Promise<TenantRow | null> {
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, id))

  return tenant ?? null
}

export async function createTenant(
  data: InsertTenant,
  userId: string
): Promise<{ id: number }> {
  const validated = insertTenantSchema.parse(data)

  const [newTenant] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(tenants)
      .values({
        name: validated.name,
        unitNumber: validated.unitNumber,
        leaseStart: validated.leaseStart ?? null,
        leaseEnd: validated.leaseEnd ?? null,
        monthlyRent: validated.monthlyRent,
        fundingSourceType: validated.fundingSourceType,
        moveInDate: validated.moveInDate ?? null,
        securityDepositAmount: validated.securityDepositAmount ?? null,
        escrowBankRef: validated.escrowBankRef ?? null,
        depositDate: validated.depositDate ?? null,
        interestRate: validated.interestRate ?? null,
        statementOfConditionDate: validated.statementOfConditionDate ?? null,
        tenancyAnniversary: computeTenancyAnniversary(
          validated.moveInDate ?? null
        ),
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'tenant',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/tenants')
  return { id: newTenant.id }
}

export async function updateTenant(
  id: number,
  data: UpdateTenant,
  userId: string
): Promise<void> {
  const validated = updateTenantSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))

    if (!existing) {
      throw new Error(`Tenant ${id} not found`)
    }

    const beforeState = { ...existing }

    // Recalculate tenancy anniversary if moveInDate changes
    const moveInDate =
      validated.moveInDate !== undefined
        ? validated.moveInDate
        : existing.moveInDate
    const tenancyAnniversary = computeTenancyAnniversary(moveInDate ?? null)

    await tx
      .update(tenants)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.unitNumber !== undefined
          ? { unitNumber: validated.unitNumber }
          : {}),
        ...(validated.leaseStart !== undefined
          ? { leaseStart: validated.leaseStart }
          : {}),
        ...(validated.leaseEnd !== undefined
          ? { leaseEnd: validated.leaseEnd }
          : {}),
        ...(validated.monthlyRent !== undefined
          ? { monthlyRent: validated.monthlyRent }
          : {}),
        ...(validated.fundingSourceType !== undefined
          ? { fundingSourceType: validated.fundingSourceType }
          : {}),
        ...(validated.moveInDate !== undefined
          ? { moveInDate: validated.moveInDate, tenancyAnniversary }
          : {}),
        ...(validated.securityDepositAmount !== undefined
          ? { securityDepositAmount: validated.securityDepositAmount }
          : {}),
        ...(validated.escrowBankRef !== undefined
          ? { escrowBankRef: validated.escrowBankRef }
          : {}),
        ...(validated.depositDate !== undefined
          ? { depositDate: validated.depositDate }
          : {}),
        ...(validated.interestRate !== undefined
          ? { interestRate: validated.interestRate }
          : {}),
        ...(validated.statementOfConditionDate !== undefined
          ? { statementOfConditionDate: validated.statementOfConditionDate }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(tenants.id, id))

    const [updated] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'tenant',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${id}`)
}

export async function toggleTenantActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(tenants)
      .where(eq(tenants.id, id))

    if (!existing) {
      throw new Error(`Tenant ${id} not found`)
    }

    await tx
      .update(tenants)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(tenants.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: active ? 'updated' : 'deactivated',
      entityType: 'tenant',
      entityId: id,
      beforeState: { isActive: !active },
      afterState: { isActive: active },
    })
  })

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${id}`)
}

// --- Security Deposit Actions ---

export async function collectDeposit(
  tenantId: number,
  amount: number,
  depositDate: string,
  escrowBankRef: string,
  userId: string
): Promise<{ transactionId: number }> {
  const result = await collectSecurityDeposit(
    tenantId,
    amount,
    depositDate,
    escrowBankRef,
    userId
  )

  revalidatePath('/tenants')
  revalidatePath(`/tenants/${tenantId}`)
  revalidatePath('/compliance')
  revalidatePath('/reports/security-deposit-register')
  return result
}

export async function completeReceipt(
  receiptId: number,
  tenantId: number,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  await db.transaction(async (tx) => {
    await tx
      .update(securityDepositReceipts)
      .set({ completedDate: today })
      .where(eq(securityDepositReceipts.id, receiptId))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'security_deposit_receipt',
      entityId: receiptId,
      afterState: { completedDate: today },
    })
  })

  revalidatePath(`/tenants/${tenantId}`)
}

export async function getSecurityDepositReceipts(tenantId: number) {
  return db
    .select()
    .from(securityDepositReceipts)
    .where(eq(securityDepositReceipts.tenantId, tenantId))
}

export async function getInterestPayments(tenantId: number) {
  return db
    .select()
    .from(securityDepositInterestPayments)
    .where(eq(securityDepositInterestPayments.tenantId, tenantId))
}
