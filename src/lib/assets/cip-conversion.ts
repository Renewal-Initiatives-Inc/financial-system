import { and, eq, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  fixedAssets,
  cipConversions,
  cipConversionLines,
  transactionLines,
  accounts,
} from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import type { CipConversionInput } from '@/lib/validators'

export interface CipSubAccountBalance {
  accountId: number
  accountCode: string
  accountName: string
  balance: number
}

export interface CipBalanceSummary {
  totalBalance: number
  subAccounts: CipSubAccountBalance[]
}

export interface CipConversionResult {
  conversionId: number
  transactionId: number
  assetsCreated: Array<{ id: number; name: string }>
}

/**
 * Get current CIP balances grouped by sub-account (1510-1550).
 * Balance = sum of debits - sum of credits for each CIP sub-account.
 */
export async function getCipBalances(): Promise<CipBalanceSummary> {
  const cipAccounts = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(accounts)
    .where(
      and(
        sql`${accounts.code} >= '1510'`,
        sql`${accounts.code} <= '1550'`
      )
    )
    .orderBy(accounts.code)

  const subAccounts: CipSubAccountBalance[] = []
  let totalBalance = 0

  for (const account of cipAccounts) {
    const [result] = await db
      .select({
        balance: sql<string>`
          COALESCE(SUM(COALESCE(${transactionLines.debit}::numeric, 0)) - SUM(COALESCE(${transactionLines.credit}::numeric, 0)), 0)
        `,
      })
      .from(transactionLines)
      .innerJoin(
        // Only include non-voided transactions
        sql`transactions`,
        sql`transactions.id = ${transactionLines.transactionId} AND transactions.is_voided = false`
      )
      .where(eq(transactionLines.accountId, account.accountId))

    const balance = Math.round(Number(result.balance) * 100) / 100
    subAccounts.push({
      accountId: account.accountId,
      accountCode: account.accountCode,
      accountName: account.accountName,
      balance,
    })
    totalBalance += balance
  }

  return {
    totalBalance: Math.round(totalBalance * 100) / 100,
    subAccounts,
  }
}

/**
 * Get all completed CIP conversions.
 */
export async function getConvertedStructures() {
  return db
    .select()
    .from(cipConversions)
    .orderBy(cipConversions.createdAt)
}

/**
 * Execute a CIP-to-fixed-asset conversion.
 *
 * Steps:
 * 1. Validate allocations
 * 2. Create fixed_asset records
 * 3. Generate reclassification JE (DR Building, CR CIP)
 * 4. Create cip_conversions and cip_conversion_lines records
 * 5. Audit log
 */
export async function executeCipConversion(
  input: CipConversionInput,
  userId: string
): Promise<CipConversionResult> {
  return await db.transaction(async (tx) => {
    const typedTx = tx as unknown as NeonDatabase<any>

    // 1. Check for duplicate conversion
    const existing = await tx
      .select({ id: cipConversions.id })
      .from(cipConversions)
      .where(eq(cipConversions.structureName, input.structureName))
      .limit(1)

    if (existing.length > 0) {
      throw new Error(
        `Structure "${input.structureName}" has already been converted`
      )
    }

    // 2. Validate CIP balances
    const cipBalances = await getCipBalances()
    for (const allocation of input.allocations) {
      const subAccount = cipBalances.subAccounts.find(
        (s) => s.accountId === allocation.sourceCipAccountId
      )
      if (!subAccount) {
        throw new Error(
          `CIP account ID ${allocation.sourceCipAccountId} not found`
        )
      }
      if (subAccount.balance < allocation.amount) {
        throw new Error(
          `Insufficient CIP balance in ${subAccount.accountName}: ` +
            `available $${subAccount.balance.toFixed(2)}, ` +
            `requested $${allocation.amount.toFixed(2)}`
        )
      }
    }

    // Look up General Fund
    const generalFund = await tx.query.funds.findFirst({
      where: (f, { eq }) => eq(f.name, 'General Fund'),
    })
    if (!generalFund) throw new Error('General Fund not found')

    // Identify parent asset for Lodging components
    let parentAssetId: number | null = null

    // 3. Create fixed_asset records
    const totalAmount = input.allocations.reduce(
      (sum, a) => sum + a.amount,
      0
    )

    const assetsCreated: Array<{ id: number; name: string }> = []

    // For Lodging, create parent first, then components reference it
    if (
      input.structureName === 'Lodging' &&
      input.allocations.length > 1
    ) {
      // The first allocation is typically the Structure component
      // All get the same parent (the first one created)
      for (let i = 0; i < input.allocations.length; i++) {
        const alloc = input.allocations[i]
        const insertResult: { id: number; name: string }[] = await tx
          .insert(fixedAssets)
          .values({
            name: alloc.targetAssetName,
            acquisitionDate: input.placedInServiceDate,
            cost: String(alloc.amount),
            salvageValue: '0',
            usefulLifeMonths: alloc.targetUsefulLifeMonths,
            depreciationMethod: 'STRAIGHT_LINE' as const,
            datePlacedInService: input.placedInServiceDate,
            glAssetAccountId: alloc.targetGlAssetAccountId,
            glAccumDeprAccountId: alloc.targetGlAccumDeprAccountId,
            glExpenseAccountId: alloc.targetGlExpenseAccountId,
            parentAssetId: i === 0 ? null : parentAssetId,
          })
          .returning({ id: fixedAssets.id, name: fixedAssets.name })

        if (i === 0) {
          parentAssetId = insertResult[0].id
        }

        assetsCreated.push({ id: insertResult[0].id, name: alloc.targetAssetName })
      }
    } else {
      // Single-item asset (Barn, Garage, or single allocation)
      for (const alloc of input.allocations) {
        const singleResult: { id: number }[] = await tx
          .insert(fixedAssets)
          .values({
            name: alloc.targetAssetName,
            acquisitionDate: input.placedInServiceDate,
            cost: String(alloc.amount),
            salvageValue: '0',
            usefulLifeMonths: alloc.targetUsefulLifeMonths,
            depreciationMethod: 'STRAIGHT_LINE' as const,
            datePlacedInService: input.placedInServiceDate,
            glAssetAccountId: alloc.targetGlAssetAccountId,
            glAccumDeprAccountId: alloc.targetGlAccumDeprAccountId,
            glExpenseAccountId: alloc.targetGlExpenseAccountId,
          })
          .returning({ id: fixedAssets.id })

        assetsCreated.push({ id: singleResult[0].id, name: alloc.targetAssetName })
      }
    }

    // 4. Generate reclassification JE: DR Building accounts, CR CIP sub-accounts
    const jeLines: Array<{
      accountId: number
      fundId: number
      debit: number | null
      credit: number | null
    }> = []

    for (const alloc of input.allocations) {
      // DR Building account
      jeLines.push({
        accountId: alloc.targetGlAssetAccountId,
        fundId: generalFund.id,
        debit: alloc.amount,
        credit: null,
      })
      // CR CIP sub-account
      jeLines.push({
        accountId: alloc.sourceCipAccountId,
        fundId: generalFund.id,
        debit: null,
        credit: alloc.amount,
      })
    }

    // Build the reclassification JE within this transaction
    // (Cannot use createTransaction since it manages its own transaction)
    const { transactions: txnTable, transactionLines: txnLinesTable } =
      await import('@/lib/db/schema')

    const [glTxn] = await tx
      .insert(txnTable)
      .values({
        date: input.placedInServiceDate,
        memo: `CIP to fixed asset reclassification - ${input.structureName}`,
        sourceType: 'SYSTEM',
        isSystemGenerated: true,
        isVoided: false,
        createdBy: userId,
      })
      .returning()

    await tx.insert(txnLinesTable).values(
      jeLines.map((line) => ({
        transactionId: glTxn.id,
        accountId: line.accountId,
        fundId: line.fundId,
        debit: line.debit != null ? String(line.debit) : null,
        credit: line.credit != null ? String(line.credit) : null,
        cipCostCodeId: null,
        memo: null,
      }))
    )

    // 5. Create cip_conversions record
    const [conversion] = await tx
      .insert(cipConversions)
      .values({
        structureName: input.structureName,
        placedInServiceDate: input.placedInServiceDate,
        totalAmountConverted: String(totalAmount),
        glTransactionId: glTxn.id,
        createdBy: userId,
      })
      .returning()

    // 6. Update fixed assets with cipConversionId
    for (const asset of assetsCreated) {
      await tx
        .update(fixedAssets)
        .set({ cipConversionId: conversion.id })
        .where(eq(fixedAssets.id, asset.id))
    }

    // 7. Create conversion lines
    for (let i = 0; i < input.allocations.length; i++) {
      const alloc = input.allocations[i]
      await tx.insert(cipConversionLines).values({
        conversionId: conversion.id,
        sourceCipAccountId: alloc.sourceCipAccountId,
        sourceCostCodeId: alloc.sourceCostCodeId ?? null,
        targetFixedAssetId: assetsCreated[i].id,
        amount: String(alloc.amount),
      })
    }

    // 8. Audit log
    await logAudit(typedTx, {
      userId,
      action: 'created',
      entityType: 'cip_conversion',
      entityId: conversion.id,
      afterState: {
        structureName: input.structureName,
        totalAmountConverted: totalAmount,
        assetsCreated: assetsCreated.map((a) => a.name),
        transactionId: glTxn.id,
      } as unknown as Record<string, unknown>,
    })

    return {
      conversionId: conversion.id,
      transactionId: glTxn.id,
      assetsCreated,
    }
  })
}
