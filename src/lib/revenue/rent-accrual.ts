/**
 * Monthly rent accrual batch logic.
 *
 * For each active tenant, creates a GL entry:
 *   DR Accounts Receivable (1100)
 *   CR Rental Income (4000)
 *
 * Idempotent: checks if accrual already exists for tenant+month before creating.
 */

import { eq, and, ilike } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants, transactions, transactionLines, accounts, funds } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'

export interface RentAccrualResult {
  tenantsProcessed: number
  entriesCreated: number
  errors: Array<{ tenantId: number; tenantName: string; error: string }>
  transactionIds: number[]
}

export async function runRentAccrualBatch(
  year: number,
  month: number
): Promise<RentAccrualResult> {
  const result: RentAccrualResult = {
    tenantsProcessed: 0,
    entriesCreated: 0,
    errors: [],
    transactionIds: [],
  }

  // Get all active tenants
  const activeTenants = await db
    .select()
    .from(tenants)
    .where(eq(tenants.isActive, true))

  // Lookup required accounts by code
  const [arAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1100'))
  const [rentalIncomeAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '4000'))

  if (!arAccount || !rentalIncomeAccount) {
    throw new Error(
      'Required accounts not found: Accounts Receivable (1100) and/or Rental Income (4000)'
    )
  }

  // Lookup General Fund (unrestricted)
  const [generalFund] = await db
    .select()
    .from(funds)
    .where(eq(funds.name, 'General Fund'))

  if (!generalFund) {
    throw new Error('General Fund not found')
  }

  const monthStr = String(month).padStart(2, '0')
  const dateStr = `${year}-${monthStr}-01`
  const memoPrefix = `Monthly rent accrual`

  for (const tenant of activeTenants) {
    result.tenantsProcessed++

    try {
      // Idempotency check: look for existing accrual for this tenant+month
      const existingAccruals = await db
        .select()
        .from(transactions)
        .where(
          and(
            ilike(
              transactions.memo,
              `%rent accrual%${tenant.name}%Unit ${tenant.unitNumber}%${year}-${monthStr}%`
            ),
            eq(transactions.sourceType, 'SYSTEM'),
            eq(transactions.isSystemGenerated, true)
          )
        )

      if (existingAccruals.length > 0) {
        continue // Already accrued for this tenant+month
      }

      const rentAmount = parseFloat(tenant.monthlyRent)
      if (rentAmount <= 0) continue

      const txnResult = await createTransaction({
        date: dateStr,
        memo: `${memoPrefix} - ${tenant.name} - Unit ${tenant.unitNumber} - ${year}-${monthStr}`,
        sourceType: 'SYSTEM',
        isSystemGenerated: true,
        createdBy: 'system',
        lines: [
          {
            accountId: arAccount.id,
            fundId: generalFund.id,
            debit: rentAmount,
            credit: null,
          },
          {
            accountId: rentalIncomeAccount.id,
            fundId: generalFund.id,
            debit: null,
            credit: rentAmount,
          },
        ],
      })

      result.entriesCreated++
      result.transactionIds.push(txnResult.transaction.id)
    } catch (err) {
      result.errors.push({
        tenantId: tenant.id,
        tenantName: tenant.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return result
}
