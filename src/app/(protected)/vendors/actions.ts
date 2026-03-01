'use server'

import { revalidatePath } from 'next/cache'
import { eq, ilike, and, sql, inArray, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vendors, accounts, funds, invoices } from '@/lib/db/schema'
import {
  insertVendorSchema,
  updateVendorSchema,
  type InsertVendor,
  type UpdateVendor,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { getUserId } from '@/lib/auth'
import { encryptVendorTaxId } from '@/lib/encryption'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type VendorRow = typeof vendors.$inferSelect

export type VendorDetail = Omit<VendorRow, 'taxId'> & {
  taxId: null // never send encrypted/plaintext tax ID to client
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

  const rows = await db
    .select()
    .from(vendors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(vendors.name)

  // Strip encrypted taxId — clients only need taxIdLastFour
  return rows.map((v) => ({ ...v, taxId: null }))
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
    taxId: null, // never expose encrypted tax ID to client
    defaultAccountName,
    defaultFundName,
  }
}

export async function createVendor(
  data: InsertVendor
): Promise<{ id: number }> {
  const userId = await getUserId()
  const validated = insertVendorSchema.parse(data)

  // Encrypt tax ID if provided
  const rawTaxId = validated.taxId ?? null
  const encryptedTaxId = rawTaxId ? encryptVendorTaxId(rawTaxId) : null
  const taxIdLastFour = rawTaxId ? rawTaxId.replace(/\D/g, '').slice(-4) : null

  const [newVendor] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(vendors)
      .values({
        name: validated.name,
        address: validated.address ?? null,
        taxId: encryptedTaxId,
        taxIdLastFour,
        entityType: validated.entityType ?? null,
        is1099Eligible: validated.is1099Eligible ?? false,
        defaultAccountId: validated.defaultAccountId ?? null,
        defaultFundId: validated.defaultFundId ?? null,
        w9Status: validated.w9Status ?? 'NOT_REQUIRED',
        w9CollectedDate: validated.w9CollectedDate ?? null,
        w9DocumentUrl: validated.w9DocumentUrl ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
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
        ...(validated.taxId !== undefined
          ? {
              taxId: validated.taxId ? encryptVendorTaxId(validated.taxId) : null,
              taxIdLastFour: validated.taxId
                ? validated.taxId.replace(/\D/g, '').slice(-4)
                : null,
            }
          : {}),
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
        ...(validated.w9DocumentUrl !== undefined
          ? { w9DocumentUrl: validated.w9DocumentUrl }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(vendors.id, id))

    const [updated] = await tx
      .select()
      .from(vendors)
      .where(eq(vendors.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
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

    await logAudit(tx as unknown as NeonDatabase<any>, {
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

/**
 * 1099-NEC filing thresholds by tax year.
 * - TY2025 and prior: $600 (IRC § 6041(a))
 * - TY2026+: $2,000 (One Big Beautiful Bill Act, signed July 4, 2025)
 * - TY2027+: $2,000 indexed for inflation per OBBBA § 103
 * Add new years as IRS announces inflation-adjusted thresholds.
 */
const FORM_1099_THRESHOLDS: Record<number, number> = {
  2024: 600,
  2025: 600,
  2026: 2000,
  // 2027+ will be inflation-indexed — add when IRS announces
}

function get1099Threshold(year: number): number {
  if (FORM_1099_THRESHOLDS[year] !== undefined) {
    return FORM_1099_THRESHOLDS[year]
  }
  // For future years not yet configured, use the most recent known threshold
  const knownYears = Object.keys(FORM_1099_THRESHOLDS)
    .map(Number)
    .sort((a, b) => b - a)
  const mostRecent = knownYears.find((y) => y <= year)
  return mostRecent !== undefined ? FORM_1099_THRESHOLDS[mostRecent] : 2000
}

export async function getVendor1099Summary(
  vendorId: number,
  year: number
): Promise<{ totalPayments: number; threshold: number; isOver: boolean }> {
  const threshold = get1099Threshold(year)
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const [result] = await db
    .select({
      total: sql<string>`COALESCE(SUM(${invoices.amount}), 0)`,
    })
    .from(invoices)
    .where(
      and(
        eq(invoices.vendorId, vendorId),
        inArray(invoices.paymentStatus, ['MATCHED_TO_PAYMENT', 'PAID']),
        sql`${invoices.invoiceDate} >= ${yearStart}`,
        sql`${invoices.invoiceDate} <= ${yearEnd}`
      )
    )

  const totalPayments = parseFloat(result?.total ?? '0')
  return {
    totalPayments,
    threshold,
    isOver: totalPayments >= threshold,
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
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  return db
    .select({ id: funds.id, name: funds.name })
    .from(funds)
    .where(
      and(
        eq(funds.isActive, true),
        or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
      )
    )
    .orderBy(funds.name)
}
