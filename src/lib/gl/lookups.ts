import { eq, inArray } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import {
  accounts,
  funds,
  transactions,
  transactionLines,
} from '@/lib/db/schema'
import type { Account, Fund, TransactionWithLines } from './types'

/**
 * Batch-fetch accounts by ID, return map for O(1) lookup.
 */
export async function getAccountsById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NeonDatabase<any>,
  ids: number[]
): Promise<Map<number, Account>> {
  if (ids.length === 0) return new Map()

  const uniqueIds = [...new Set(ids)]
  const rows = await tx
    .select()
    .from(accounts)
    .where(inArray(accounts.id, uniqueIds))

  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Batch-fetch funds by ID, return map for O(1) lookup.
 */
export async function getFundsById(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NeonDatabase<any>,
  ids: number[]
): Promise<Map<number, Fund>> {
  if (ids.length === 0) return new Map()

  const uniqueIds = [...new Set(ids)]
  const rows = await tx
    .select()
    .from(funds)
    .where(inArray(funds.id, uniqueIds))

  return new Map(rows.map((row) => [row.id, row]))
}

/**
 * Get the two net asset accounts (3000 and 3100).
 * Returns the accounts used for restricted fund auto-release (INV-007).
 */
export async function getNetAssetAccounts(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NeonDatabase<any>
): Promise<{ unrestricted: Account; restricted: Account }> {
  const [unrestricted] = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.code, '3000'))

  const [restricted] = await tx
    .select()
    .from(accounts)
    .where(eq(accounts.code, '3100'))

  if (!unrestricted || !restricted) {
    throw new Error(
      'Net asset accounts (3000, 3100) not found. Run seed data first.'
    )
  }

  return { unrestricted, restricted }
}

/**
 * Get a transaction with all its lines.
 */
export async function getTransactionWithLines(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tx: NeonDatabase<any>,
  id: number
): Promise<TransactionWithLines | null> {
  const [txnRow] = await tx
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))

  if (!txnRow) return null

  const lines = await tx
    .select()
    .from(transactionLines)
    .where(eq(transactionLines.transactionId, id))

  return { ...txnRow, lines }
}
