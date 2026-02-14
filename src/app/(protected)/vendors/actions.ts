'use server'

import { revalidatePath } from 'next/cache'
import { eq, ilike, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vendors, accounts, funds } from '@/lib/db/schema'
import {
  insertVendorSchema,
  updateVendorSchema,
  type InsertVendor,
  type UpdateVendor,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

// --- Types ---

export type VendorRow = typeof vendors.$inferSelect

export type VendorDetail = VendorRow & {
  defaultAccountName: string | null
  defaultFundName: string | null
}

// --- Server Actions ---

export async function getVendors(filters?: {
  search?: string
  is1099Eligible?: boolean
  w9Status?: string
  isActive?: boolean
}): Promise<VendorRow[]> {
  const conditions = []

  if (filters?.search) {
    conditions.push(ilike(vendors.name, `%${filters.search}%`))
  }
  if (filters?.is1099Eligible !== undefined) {
    conditions.push(eq(vendors.is1099Eligible, filters.is1099Eligible))
  }
  if (filters?.w9Status) {
    conditions.push(
      eq(
        vendors.w9Status,
        filters.w9Status as (typeof vendors.w9Status.enumValues)[number]
      )
    )
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(vendors.isActive, filters.isActive))
  }

  return db
    .select()
    .from(vendors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(vendors.name)
}

export async function getVendorById(
  id: number
): Promise<VendorDetail | null> {
  const [vendor] = await db
    .select()
    .from(vendors)
    .where(eq(vendors.id, id))

  if (!vendor) return null

  let defaultAccountName: string | null = null
  if (vendor.defaultAccountId) {
    const [account] = await db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, vendor.defaultAccountId))
    defaultAccountName = account?.name ?? null
  }

  let defaultFundName: string | null = null
  if (vendor.defaultFundId) {
    const [fund] = await db
      .select({ name: funds.name })
      .from(funds)
      .where(eq(funds.id, vendor.defaultFundId))
    defaultFundName = fund?.name ?? null
  }

  return {
    ...vendor,
    defaultAccountName,
    defaultFundName,
  }
}

export async function createVendor(
  data: InsertVendor,
  userId: string
): Promise<{ id: number }> {
  const validated = insertVendorSchema.parse(data)

  const [newVendor] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(vendors)
      .values({
        name: validated.name,
        address: validated.address ?? null,
        taxId: validated.taxId ?? null,
        entityType: validated.entityType ?? null,
        is1099Eligible: validated.is1099Eligible ?? false,
        defaultAccountId: validated.defaultAccountId ?? null,
        defaultFundId: validated.defaultFundId ?? null,
        w9Status: validated.w9Status ?? 'NOT_REQUIRED',
        w9CollectedDate: validated.w9CollectedDate ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'vendor',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/vendors')
  return { id: newVendor.id }
}

export async function updateVendor(
  id: number,
  data: UpdateVendor,
  userId: string
): Promise<void> {
  const validated = updateVendorSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))

    if (!existing) {
      throw new Error(`Vendor ${id} not found`)
    }

    const beforeState = { ...existing }

    await tx
      .update(vendors)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.address !== undefined
          ? { address: validated.address }
          : {}),
        ...(validated.taxId !== undefined ? { taxId: validated.taxId } : {}),
        ...(validated.entityType !== undefined
          ? { entityType: validated.entityType }
          : {}),
        ...(validated.is1099Eligible !== undefined
          ? { is1099Eligible: validated.is1099Eligible }
          : {}),
        ...(validated.defaultAccountId !== undefined
          ? { defaultAccountId: validated.defaultAccountId }
          : {}),
        ...(validated.defaultFundId !== undefined
          ? { defaultFundId: validated.defaultFundId }
          : {}),
        ...(validated.w9Status !== undefined
          ? { w9Status: validated.w9Status }
          : {}),
        ...(validated.w9CollectedDate !== undefined
          ? { w9CollectedDate: validated.w9CollectedDate }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, id))

    const [updated] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'vendor',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/vendors')
  revalidatePath(`/vendors/${id}`)
}

export async function toggleVendorActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))

    if (!existing) {
      throw new Error(`Vendor ${id} not found`)
    }

    await tx
      .update(vendors)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(vendors.id, id))

    await logAudit(tx as unknown as NeonHttpDatabase<any>, {
      userId,
      action: active ? 'updated' : 'deactivated',
      entityType: 'vendor',
      entityId: id,
      beforeState: { isActive: !active },
      afterState: { isActive: active },
    })
  })

  revalidatePath('/vendors')
  revalidatePath(`/vendors/${id}`)
}

export async function getVendor1099Summary(
  vendorId: number,
  year: number
): Promise<{ totalPayments: number; threshold: number; isOver: boolean }> {
  // Stub — returns $0 until Phase 8 builds vendor invoices
  // When Phase 8 ships, this will sum transaction_lines where
  // vendorId matches and date falls within the calendar year
  return {
    totalPayments: 0,
    threshold: 600,
    isOver: false,
  }
}

export async function getAccountOptions(): Promise<
  { id: number; name: string; code: string }[]
> {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}

export async function getFundOptions(): Promise<
  { id: number; name: string }[]
> {
  return db
    .select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(eq(funds.isActive, true))
    .orderBy(funds.name)
}
