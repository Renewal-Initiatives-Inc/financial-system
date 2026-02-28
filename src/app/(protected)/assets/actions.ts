'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import { fixedAssets, accounts, cipConversions } from '@/lib/db/schema'
import {
  insertFixedAssetSchema,
  updateFixedAssetSchema,
  type InsertFixedAsset,
  type UpdateFixedAsset,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import {
  calculateMonthlyDepreciation,
  calculateAccumulatedDepreciation,
  calculateNetBookValue,
  isFullyDepreciated,
} from '@/lib/assets/depreciation'
import {
  getCipBalances as getCipBalancesLib,
  getConvertedStructures as getConvertedStructuresLib,
  executeCipConversion,
} from '@/lib/assets/cip-conversion'
import type { CipConversionInput } from '@/lib/validators'

// --- Types ---

export type FixedAssetRow = {
  id: number
  name: string
  description: string | null
  acquisitionDate: string
  cost: string
  salvageValue: string
  usefulLifeMonths: number
  depreciationMethod: string
  datePlacedInService: string | null
  glAssetAccountId: number
  glAssetAccountName: string
  glAccumDeprAccountId: number
  glAccumDeprAccountName: string
  glExpenseAccountId: number
  glExpenseAccountName: string
  cipConversionId: number | null
  parentAssetId: number | null
  parentAssetName: string | null
  isActive: boolean
  createdAt: Date
  // Calculated fields
  monthlyDepreciation: string
  accumulatedDepreciation: string
  netBookValue: string
  isFullyDepreciated: boolean
}

export type FixedAssetDetail = FixedAssetRow & {
  children: FixedAssetRow[]
  cipConversion: {
    id: number
    structureName: string
    placedInServiceDate: string
    totalAmountConverted: string
    glTransactionId: number
  } | null
}

// --- Server Actions ---

export async function getFixedAssets(filters?: {
  isActive?: boolean
  parentId?: number
}): Promise<FixedAssetRow[]> {
  const conditions = []

  if (filters?.isActive !== undefined) {
    conditions.push(eq(fixedAssets.isActive, filters.isActive))
  }
  if (filters?.parentId !== undefined) {
    conditions.push(eq(fixedAssets.parentAssetId, filters.parentId))
  }

  const assets = await db
    .select()
    .from(fixedAssets)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(fixedAssets.name)

  const today = new Date().toISOString().split('T')[0]

  // Resolve GL account names and parent names in bulk
  const accountIds = new Set<number>()
  const parentIds = new Set<number>()
  for (const asset of assets) {
    accountIds.add(asset.glAssetAccountId)
    accountIds.add(asset.glAccumDeprAccountId)
    accountIds.add(asset.glExpenseAccountId)
    if (asset.parentAssetId) parentIds.add(asset.parentAssetId)
  }

  const accountRows =
    accountIds.size > 0
      ? await db
          .select({ id: accounts.id, name: accounts.name })
          .from(accounts)
      : []
  const accountMap = new Map(accountRows.map((a) => [a.id, a.name]))

  const parentAssets =
    parentIds.size > 0
      ? await db
          .select({ id: fixedAssets.id, name: fixedAssets.name })
          .from(fixedAssets)
      : []
  const parentMap = new Map(parentAssets.map((a) => [a.id, a.name]))

  return assets.map((asset) => ({
    id: asset.id,
    name: asset.name,
    description: asset.description,
    acquisitionDate: asset.acquisitionDate,
    cost: asset.cost,
    salvageValue: asset.salvageValue,
    usefulLifeMonths: asset.usefulLifeMonths,
    depreciationMethod: asset.depreciationMethod,
    datePlacedInService: asset.datePlacedInService,
    glAssetAccountId: asset.glAssetAccountId,
    glAssetAccountName: accountMap.get(asset.glAssetAccountId) ?? '',
    glAccumDeprAccountId: asset.glAccumDeprAccountId,
    glAccumDeprAccountName: accountMap.get(asset.glAccumDeprAccountId) ?? '',
    glExpenseAccountId: asset.glExpenseAccountId,
    glExpenseAccountName: accountMap.get(asset.glExpenseAccountId) ?? '',
    cipConversionId: asset.cipConversionId,
    parentAssetId: asset.parentAssetId,
    parentAssetName: asset.parentAssetId
      ? parentMap.get(asset.parentAssetId) ?? null
      : null,
    isActive: asset.isActive,
    createdAt: asset.createdAt,
    monthlyDepreciation: calculateMonthlyDepreciation(asset).toFixed(2),
    accumulatedDepreciation: calculateAccumulatedDepreciation(
      asset,
      today
    ).toFixed(2),
    netBookValue: calculateNetBookValue(asset, today).toFixed(2),
    isFullyDepreciated: isFullyDepreciated(asset, today),
  }))
}

export async function getFixedAssetById(
  id: number
): Promise<FixedAssetDetail | null> {
  const [asset] = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.id, id))

  if (!asset) return null

  const today = new Date().toISOString().split('T')[0]

  // Resolve GL account names
  const [assetAccount, accumAccount, expenseAccount] = await Promise.all([
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, asset.glAssetAccountId))
      .then((r) => r[0]),
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, asset.glAccumDeprAccountId))
      .then((r) => r[0]),
    db
      .select({ name: accounts.name })
      .from(accounts)
      .where(eq(accounts.id, asset.glExpenseAccountId))
      .then((r) => r[0]),
  ])

  // Resolve parent name
  let parentAssetName: string | null = null
  if (asset.parentAssetId) {
    const [parent] = await db
      .select({ name: fixedAssets.name })
      .from(fixedAssets)
      .where(eq(fixedAssets.id, asset.parentAssetId))
    parentAssetName = parent?.name ?? null
  }

  // Get children (components)
  const childAssets = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.parentAssetId, id))
    .orderBy(fixedAssets.name)

  const children: FixedAssetRow[] = childAssets.map((child) => ({
    id: child.id,
    name: child.name,
    description: child.description,
    acquisitionDate: child.acquisitionDate,
    cost: child.cost,
    salvageValue: child.salvageValue,
    usefulLifeMonths: child.usefulLifeMonths,
    depreciationMethod: child.depreciationMethod,
    datePlacedInService: child.datePlacedInService,
    glAssetAccountId: child.glAssetAccountId,
    glAssetAccountName: assetAccount?.name ?? '',
    glAccumDeprAccountId: child.glAccumDeprAccountId,
    glAccumDeprAccountName: accumAccount?.name ?? '',
    glExpenseAccountId: child.glExpenseAccountId,
    glExpenseAccountName: expenseAccount?.name ?? '',
    cipConversionId: child.cipConversionId,
    parentAssetId: child.parentAssetId,
    parentAssetName: asset.name,
    isActive: child.isActive,
    createdAt: child.createdAt,
    monthlyDepreciation: calculateMonthlyDepreciation(child).toFixed(2),
    accumulatedDepreciation: calculateAccumulatedDepreciation(
      child,
      today
    ).toFixed(2),
    netBookValue: calculateNetBookValue(child, today).toFixed(2),
    isFullyDepreciated: isFullyDepreciated(child, today),
  }))

  // Get CIP conversion info
  let cipConversion: FixedAssetDetail['cipConversion'] = null
  if (asset.cipConversionId) {
    const [conv] = await db
      .select()
      .from(cipConversions)
      .where(eq(cipConversions.id, asset.cipConversionId))
    if (conv) {
      cipConversion = {
        id: conv.id,
        structureName: conv.structureName,
        placedInServiceDate: conv.placedInServiceDate,
        totalAmountConverted: conv.totalAmountConverted,
        glTransactionId: conv.glTransactionId,
      }
    }
  }

  return {
    id: asset.id,
    name: asset.name,
    description: asset.description,
    acquisitionDate: asset.acquisitionDate,
    cost: asset.cost,
    salvageValue: asset.salvageValue,
    usefulLifeMonths: asset.usefulLifeMonths,
    depreciationMethod: asset.depreciationMethod,
    datePlacedInService: asset.datePlacedInService,
    glAssetAccountId: asset.glAssetAccountId,
    glAssetAccountName: assetAccount?.name ?? '',
    glAccumDeprAccountId: asset.glAccumDeprAccountId,
    glAccumDeprAccountName: accumAccount?.name ?? '',
    glExpenseAccountId: asset.glExpenseAccountId,
    glExpenseAccountName: expenseAccount?.name ?? '',
    cipConversionId: asset.cipConversionId,
    parentAssetId: asset.parentAssetId,
    parentAssetName,
    isActive: asset.isActive,
    createdAt: asset.createdAt,
    monthlyDepreciation: calculateMonthlyDepreciation(asset).toFixed(2),
    accumulatedDepreciation: calculateAccumulatedDepreciation(
      asset,
      today
    ).toFixed(2),
    netBookValue: calculateNetBookValue(asset, today).toFixed(2),
    isFullyDepreciated: isFullyDepreciated(asset, today),
    children,
    cipConversion,
  }
}

export async function createFixedAsset(
  data: InsertFixedAsset,
  userId: string
): Promise<{ id: number }> {
  const validated = insertFixedAssetSchema.parse(data)

  const [newAsset] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(fixedAssets)
      .values({
        name: validated.name,
        description: validated.description ?? null,
        acquisitionDate: validated.acquisitionDate,
        cost: String(validated.cost),
        salvageValue: String(validated.salvageValue),
        usefulLifeMonths: validated.usefulLifeMonths,
        depreciationMethod: validated.depreciationMethod,
        datePlacedInService: validated.datePlacedInService ?? null,
        glAssetAccountId: validated.glAssetAccountId,
        glAccumDeprAccountId: validated.glAccumDeprAccountId,
        glExpenseAccountId: validated.glExpenseAccountId,
        cipConversionId: validated.cipConversionId ?? null,
        parentAssetId: validated.parentAssetId ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'fixed_asset',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/assets')
  return { id: newAsset.id }
}

export async function updateFixedAsset(
  id: number,
  data: UpdateFixedAsset,
  userId: string
): Promise<void> {
  const validated = updateFixedAssetSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.id, id))

    if (!existing) throw new Error(`Fixed asset ${id} not found`)

    const beforeState = { ...existing }

    await tx
      .update(fixedAssets)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.description !== undefined
          ? { description: validated.description }
          : {}),
        ...(validated.datePlacedInService !== undefined
          ? { datePlacedInService: validated.datePlacedInService }
          : {}),
        ...(validated.isActive !== undefined
          ? { isActive: validated.isActive }
          : {}),
        updatedAt: new Date(),
      })
      .where(eq(fixedAssets.id, id))

    const [updated] = await tx
      .select()
      .from(fixedAssets)
      .where(eq(fixedAssets.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'fixed_asset',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/assets')
  revalidatePath(`/assets/${id}`)
}

export async function toggleFixedAssetActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  const today = new Date().toISOString().split('T')[0]

  const [existing] = await db
    .select()
    .from(fixedAssets)
    .where(eq(fixedAssets.id, id))

  if (!existing) throw new Error(`Fixed asset ${id} not found`)

  // Warn if trying to deactivate a not-fully-depreciated asset
  if (!active && !isFullyDepreciated(existing, today)) {
    throw new Error(
      'Cannot deactivate an asset that is not fully depreciated. Depreciation will continue until the depreciable basis is exhausted.'
    )
  }

  await db.transaction(async (tx) => {
    await tx
      .update(fixedAssets)
      .set({ isActive: active, updatedAt: new Date() })
      .where(eq(fixedAssets.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: active ? 'updated' : 'deactivated',
      entityType: 'fixed_asset',
      entityId: id,
      beforeState: { isActive: !active },
      afterState: { isActive: active },
    })
  })

  revalidatePath('/assets')
  revalidatePath(`/assets/${id}`)
}

// --- CIP Delegation ---

export async function getCipBalances() {
  return getCipBalancesLib()
}

export async function getConvertedStructures() {
  return getConvertedStructuresLib()
}

export async function executeCipConversionAction(
  input: CipConversionInput,
  userId: string
): Promise<{ conversionId: number }> {
  const result = await executeCipConversion(input, userId)
  revalidatePath('/assets')
  revalidatePath('/assets/cip')
  return { conversionId: result.conversionId }
}

// --- Shared option queries ---

export async function getAccountOptions(): Promise<
  { id: number; name: string; code: string; subType: string | null }[]
> {
  return db
    .select({
      id: accounts.id,
      name: accounts.name,
      code: accounts.code,
      subType: accounts.subType,
    })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}

export async function getFundOptions(): Promise<
  { id: number; name: string }[]
> {
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  const { funds } = await import('@/lib/db/schema')
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
