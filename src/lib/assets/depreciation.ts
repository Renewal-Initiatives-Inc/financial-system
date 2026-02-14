import { and, eq, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  fixedAssets,
  transactions,
  transactionLines,
  accounts,
} from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'

export interface FixedAssetForDepreciation {
  id: number
  name: string
  cost: string
  salvageValue: string
  usefulLifeMonths: number
  datePlacedInService: string | null
  glAccumDeprAccountId: number
  glExpenseAccountId: number
  isActive: boolean
}

export interface AssetDepreciationDetail {
  assetId: number
  assetName: string
  monthlyAmount: number
  transactionId: number
}

export interface DepreciationResult {
  entriesCreated: number
  totalAmount: number
  details: AssetDepreciationDetail[]
}

/**
 * Calculate monthly straight-line depreciation for an asset.
 * Formula: (cost - salvageValue) / usefulLifeMonths
 */
export function calculateMonthlyDepreciation(asset: {
  cost: string
  salvageValue: string
  usefulLifeMonths: number
}): number {
  const cost = Number(asset.cost)
  const salvage = Number(asset.salvageValue)
  const depreciableBasis = cost - salvage
  if (depreciableBasis <= 0) return 0
  return Math.round((depreciableBasis / asset.usefulLifeMonths) * 100) / 100
}

/**
 * Calculate accumulated depreciation as of a given date.
 * Capped at depreciable basis (cost - salvage).
 */
export function calculateAccumulatedDepreciation(
  asset: {
    cost: string
    salvageValue: string
    usefulLifeMonths: number
    datePlacedInService: string | null
  },
  asOfDate: string
): number {
  if (!asset.datePlacedInService) return 0

  const pis = new Date(asset.datePlacedInService)
  const asOf = new Date(asOfDate)

  // Depreciation starts the month after PIS
  const monthsElapsed =
    (asOf.getFullYear() - pis.getFullYear()) * 12 +
    (asOf.getMonth() - pis.getMonth())

  if (monthsElapsed <= 0) return 0

  const monthly = calculateMonthlyDepreciation(asset)
  const accumulated = monthly * monthsElapsed
  const depreciableBasis = Number(asset.cost) - Number(asset.salvageValue)

  return Math.round(Math.min(accumulated, depreciableBasis) * 100) / 100
}

/**
 * Calculate net book value as of a given date.
 */
export function calculateNetBookValue(
  asset: {
    cost: string
    salvageValue: string
    usefulLifeMonths: number
    datePlacedInService: string | null
  },
  asOfDate: string
): number {
  const cost = Number(asset.cost)
  const accumulated = calculateAccumulatedDepreciation(asset, asOfDate)
  return Math.round((cost - accumulated) * 100) / 100
}

/**
 * Check if an asset is fully depreciated as of a given date.
 */
export function isFullyDepreciated(
  asset: {
    cost: string
    salvageValue: string
    usefulLifeMonths: number
    datePlacedInService: string | null
  },
  asOfDate: string
): boolean {
  if (!asset.datePlacedInService) return false
  const accumulated = calculateAccumulatedDepreciation(asset, asOfDate)
  const depreciableBasis = Number(asset.cost) - Number(asset.salvageValue)
  return accumulated >= depreciableBasis
}

/**
 * Get all active assets that are depreciable (placed in service, not fully depreciated).
 */
export async function getDepreciableAssets(
  asOfDate: string
): Promise<FixedAssetForDepreciation[]> {
  const assets = await db
    .select({
      id: fixedAssets.id,
      name: fixedAssets.name,
      cost: fixedAssets.cost,
      salvageValue: fixedAssets.salvageValue,
      usefulLifeMonths: fixedAssets.usefulLifeMonths,
      datePlacedInService: fixedAssets.datePlacedInService,
      glAccumDeprAccountId: fixedAssets.glAccumDeprAccountId,
      glExpenseAccountId: fixedAssets.glExpenseAccountId,
      isActive: fixedAssets.isActive,
    })
    .from(fixedAssets)
    .where(
      and(
        eq(fixedAssets.isActive, true),
        isNotNull(fixedAssets.datePlacedInService)
      )
    )

  // Filter out fully depreciated assets
  return assets.filter((asset) => !isFullyDepreciated(asset, asOfDate))
}

/**
 * Check if depreciation has already been posted for a given asset and month.
 */
async function hasDepreciationForMonth(
  assetAccumDeprAccountId: number,
  yearMonth: string
): Promise<boolean> {
  const result = await db
    .select({ count: sql<number>`count(*)` })
    .from(transactions)
    .innerJoin(transactionLines, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactions.sourceType, 'SYSTEM'),
        eq(transactions.isSystemGenerated, true),
        eq(transactions.isVoided, false),
        eq(transactionLines.accountId, assetAccumDeprAccountId),
        sql`to_char(${transactions.date}::date, 'YYYY-MM') = ${yearMonth}`
      )
    )

  return Number(result[0].count) > 0
}

/**
 * Look up the General Fund ID.
 */
async function getGeneralFundId(): Promise<number> {
  const funds = await db.query.funds.findFirst({
    where: (f, { eq }) => eq(f.name, 'General Fund'),
  })
  if (!funds) throw new Error('General Fund not found')
  return funds.id
}

/**
 * Generate monthly depreciation entries for all depreciable assets.
 * Idempotent: skips assets that already have entries for the target month.
 */
export async function generateDepreciationEntries(
  asOfDate: string,
  userId: string
): Promise<DepreciationResult> {
  const yearMonth = asOfDate.slice(0, 7) // YYYY-MM
  const depreciableAssets = await getDepreciableAssets(asOfDate)
  const generalFundId = await getGeneralFundId()

  // Look up Depreciation Expense account (5200)
  const deprExpenseAccount = await db.query.accounts.findFirst({
    where: (a, { eq }) => eq(a.code, '5200'),
  })
  if (!deprExpenseAccount) {
    throw new Error('Depreciation Expense account (5200) not found')
  }

  const details: AssetDepreciationDetail[] = []
  let totalAmount = 0

  for (const asset of depreciableAssets) {
    // Idempotency check
    const alreadyProcessed = await hasDepreciationForMonth(
      asset.glAccumDeprAccountId,
      yearMonth
    )
    if (alreadyProcessed) continue

    // Calculate monthly amount
    let monthlyAmount = calculateMonthlyDepreciation(asset)

    // Final month adjustment: use remaining depreciable basis
    const depreciableBasis = Number(asset.cost) - Number(asset.salvageValue)
    const accumulated = calculateAccumulatedDepreciation(asset, asOfDate)
    const remaining = Math.round((depreciableBasis - accumulated) * 100) / 100

    if (remaining < monthlyAmount) {
      monthlyAmount = remaining
    }

    if (monthlyAmount <= 0) continue

    // Format month/year for memo
    const dateObj = new Date(asOfDate)
    const monthYear = dateObj.toLocaleDateString('en-US', {
      month: 'long',
      year: 'numeric',
    })

    const result = await createTransaction({
      date: asOfDate,
      memo: `Monthly depreciation - ${asset.name} - ${monthYear}`,
      sourceType: 'SYSTEM',
      isSystemGenerated: true,
      createdBy: userId,
      lines: [
        {
          accountId: deprExpenseAccount.id,
          fundId: generalFundId,
          debit: monthlyAmount,
          credit: null,
        },
        {
          accountId: asset.glAccumDeprAccountId,
          fundId: generalFundId,
          debit: null,
          credit: monthlyAmount,
        },
      ],
    })

    details.push({
      assetId: asset.id,
      assetName: asset.name,
      monthlyAmount,
      transactionId: result.transaction.id,
    })
    totalAmount += monthlyAmount
  }

  return {
    entriesCreated: details.length,
    totalAmount: Math.round(totalAmount * 100) / 100,
    details,
  }
}
