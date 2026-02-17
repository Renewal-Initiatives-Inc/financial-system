'use server'

import { revalidatePath } from 'next/cache'
import { eq, ilike, and, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { donors } from '@/lib/db/schema'
import {
  insertDonorSchema,
  updateDonorSchema,
  type InsertDonor,
  type UpdateDonor,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { getUserId } from '@/lib/auth'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type DonorRow = typeof donors.$inferSelect

// --- Server Actions ---

export async function getDonors(filters?: {
  search?: string
  type?: string
  isActive?: boolean
}): Promise<DonorRow[]> {
  const conditions = []

  if (filters?.search) {
    const q = `%${filters.search}%`
    conditions.push(
      or(ilike(donors.name, q), ilike(donors.email, q))!
    )
  }
  if (filters?.type) {
    conditions.push(
      eq(
        donors.type,
        filters.type as (typeof donors.type.enumValues)[number]
      )
    )
  }
  if (filters?.isActive !== undefined) {
    conditions.push(eq(donors.isActive, filters.isActive))
  }

  return db
    .select()
    .from(donors)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(donors.name)
}

export async function getDonorById(id: number): Promise<DonorRow | null> {
  const [donor] = await db.select().from(donors).where(eq(donors.id, id))
  return donor ?? null
}

export async function createDonor(
  data: InsertDonor
): Promise<{ id: number }> {
  const userId = await getUserId()
  const validated = insertDonorSchema.parse(data)

  const [newDonor] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(donors)
      .values({
        name: validated.name,
        address: validated.address ?? null,
        email: validated.email ?? null,
        type: validated.type,
        firstGiftDate: validated.firstGiftDate ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'donor',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/donors')
  return { id: newDonor.id }
}

export async function updateDonor(
  id: number,
  data: UpdateDonor,
  userId: string
): Promise<void> {
  const validated = updateDonorSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(donors)
      .where(eq(donors.id, id))

    if (!existing) {
      throw new Error(`Donor ${id} not found`)
    }

    const beforeState = { ...existing }

    await tx
      .update(donors)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.address !== undefined
          ? { address: validated.address }
          : {}),
        ...(validated.email !== undefined ? { email: validated.email } : {}),
        ...(validated.type !== undefined ? { type: validated.type } : {}),
        ...(validated.firstGiftDate !== undefined
          ? { firstGiftDate: validated.firstGiftDate }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(donors.id, id))

    const [updated] = await tx
      .select()
      .from(donors)
      .where(eq(donors.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'donor',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/donors')
  revalidatePath(`/donors/${id}`)
}

export async function toggleDonorActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(donors)
      .where(eq(donors.id, id))

    if (!existing) {
      throw new Error(`Donor ${id} not found`)
    }

    await tx
      .update(donors)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(donors.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: active ? 'updated' : 'deactivated',
      entityType: 'donor',
      entityId: id,
      beforeState: { isActive: !active },
      afterState: { isActive: active },
    })
  })

  revalidatePath('/donors')
  revalidatePath(`/donors/${id}`)
}

export type GivingGift = {
  date: string
  amount: string
  memo: string
  transactionId: number
}

export async function getDonorGivingSummary(donorId: number): Promise<{
  totalGiving: number
  giftCount: number
  recentGifts: GivingGift[]
}> {
  // Find donation transactions that reference this donor
  // Donations are recorded via recordDonation which creates transactions with memo containing "Donation"
  // We look for transactions linked to donation pledges or direct donations
  const donorRecord = await getDonorById(donorId)
  if (!donorRecord) {
    return { totalGiving: 0, giftCount: 0, recentGifts: [] }
  }

  // Query pledges for this donor to get associated GL transactions
  const { pledges } = await import('@/lib/db/schema')
  const { desc } = await import('drizzle-orm')
  const donorPledges = await db
    .select()
    .from(pledges)
    .where(eq(pledges.donorId, donorId))
    .orderBy(desc(pledges.createdAt))

  const gifts: GivingGift[] = []
  let totalGiving = 0

  // Add pledges as gifts
  for (const pledge of donorPledges) {
    const amount = parseFloat(pledge.amount)
    totalGiving += amount
    gifts.push({
      date: pledge.expectedDate ?? pledge.createdAt.toISOString().split('T')[0],
      amount: pledge.amount,
      memo: `Pledge - ${pledge.status}`,
      transactionId: pledge.glTransactionId ?? 0,
    })
  }

  return {
    totalGiving: Math.round(totalGiving * 100) / 100,
    giftCount: gifts.length,
    recentGifts: gifts.slice(0, 10),
  }
}
