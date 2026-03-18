import type { QboParsedTransaction } from './qbo-csv-parser'
import {
  resolveAccountId,
  resolveFundId,
  buildAccountLookup,
  buildFundLookup,
  getUnmappedAccounts,
  getUnmappedClasses,
  type AccountLookup,
  type FundLookup,
} from './account-mapping'
import { createTransaction } from '@/lib/gl/engine'
import type { InsertTransaction } from '@/lib/validators'

export interface ImportOptions {
  dryRun: boolean
  createdBy: string
}

export interface ImportError {
  transactionNo: string
  message: string
}

export interface ImportResult {
  totalTransactions: number
  imported: number
  errors: ImportError[]
  dryRun: boolean
}

/**
 * Import FY25 transactions from parsed QBO data into the GL engine.
 *
 * Design: Uses createTransaction() rather than direct DB inserts to ensure
 * all GL invariants are enforced (INV-001 through INV-012).
 */
export async function importFY25Transactions(
  parsedTransactions: QboParsedTransaction[],
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { select: (...args: any[]) => any; transaction?: (...args: any[]) => Promise<any> },
  options: ImportOptions
): Promise<ImportResult> {
  const errors: ImportError[] = []

  // Pre-flight: build lookups
  const accountLookup = await buildAccountLookup(db)
  const fundLookup = await buildFundLookup(db)

  // Pre-flight: validate all account/class names have mappings
  const allAccountNames = parsedTransactions.flatMap((t) =>
    t.lines.map((l) => l.accountName)
  )
  const unmappedAccounts = getUnmappedAccounts(allAccountNames)
  if (unmappedAccounts.length > 0) {
    return {
      totalTransactions: parsedTransactions.length,
      imported: 0,
      errors: [{
        transactionNo: 'PRE-FLIGHT',
        message: `Unmapped QBO accounts: ${unmappedAccounts.join(', ')}`,
      }],
      dryRun: options.dryRun,
    }
  }

  const allClassNames = parsedTransactions.flatMap((t) =>
    t.lines.map((l) => l.class)
  )
  const unmappedClasses = getUnmappedClasses(allClassNames)
  if (unmappedClasses.length > 0) {
    return {
      totalTransactions: parsedTransactions.length,
      imported: 0,
      errors: [{
        transactionNo: 'PRE-FLIGHT',
        message: `Unmapped QBO classes: ${unmappedClasses.join(', ')}`,
      }],
      dryRun: options.dryRun,
    }
  }

  // Build GL transactions from parsed QBO data
  let imported = 0

  for (const qboTxn of parsedTransactions) {
    try {
      const glInput = buildGlTransaction(
        qboTxn,
        accountLookup,
        fundLookup,
        options.createdBy
      )

      if (options.dryRun) {
        // In dry-run mode, validate via schema but don't commit
        const { insertTransactionSchema } = await import('@/lib/validators')
        insertTransactionSchema.parse(glInput)
        imported++
      } else {
        await createTransaction(glInput)
        imported++
      }
    } catch (error) {
      errors.push({
        transactionNo: qboTxn.transactionNo,
        message: error instanceof Error ? error.message : String(error),
      })

      // In non-dry-run mode, any error should halt (atomicity via caller)
      if (!options.dryRun) {
        break
      }
    }
  }

  return {
    totalTransactions: parsedTransactions.length,
    imported,
    errors,
    dryRun: options.dryRun,
  }
}

/**
 * Convert a parsed QBO transaction to a GL InsertTransaction.
 */
export function buildGlTransaction(
  qboTxn: QboParsedTransaction,
  accountLookup: AccountLookup,
  fundLookup: FundLookup,
  createdBy: string
): InsertTransaction {
  const lines = qboTxn.lines.map((line) => {
    const accountId = resolveAccountId(line.accountName, accountLookup)
    const fundId = resolveFundId(line.class, fundLookup)

    return {
      accountId,
      fundId,
      debit: line.debit > 0 ? line.debit : null,
      credit: line.credit > 0 ? line.credit : null,
    }
  })

  // Filter out zero-amount lines (QBO sometimes includes empty rows)
  const filteredLines = lines.filter(
    (l) => (l.debit != null && l.debit > 0) || (l.credit != null && l.credit > 0)
  )

  return {
    date: qboTxn.date,
    memo: qboTxn.memo || `QBO Import: ${qboTxn.transactionType} #${qboTxn.transactionNo}`,
    sourceType: 'FY25_IMPORT',
    sourceReferenceId: `qbo:${qboTxn.transactionNo}`,
    isSystemGenerated: false,
    lines: filteredLines,
    createdBy,
  }
}

/**
 * Delete all existing FY25_IMPORT transactions (for idempotent re-import).
 * Must be called within a database transaction for atomicity.
 */
export async function deleteExistingImports(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { execute: (...args: any[]) => Promise<{ rows: any[] }> }
): Promise<number> {
  const { sql } = await import('drizzle-orm')
  const { transactions, transactionLines } = await import('@/lib/db/schema')

  // Delete lines first (FK constraint), then transactions
  const result = await db.execute(sql`
    WITH import_txns AS (
      SELECT id FROM ${transactions}
      WHERE source_type = 'FY25_IMPORT'
    ),
    deleted_lines AS (
      DELETE FROM ${transactionLines}
      WHERE transaction_id IN (SELECT id FROM import_txns)
    ),
    deleted_releases AS (
      DELETE FROM ${transactions}
      WHERE source_type = 'SYSTEM'
        AND source_reference_id LIKE 'release-for:%'
        AND CAST(SUBSTRING(source_reference_id FROM 'release-for:(.*)') AS integer) IN (SELECT id FROM import_txns)
    )
    DELETE FROM ${transactions}
    WHERE source_type = 'FY25_IMPORT'
    RETURNING id
  `)

  return (result.rows as any[]).length
}

/**
 * Check if any FY25_IMPORT transactions already exist.
 */
export async function hasExistingImports(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { execute: (...args: any[]) => Promise<{ rows: any[] }> }
): Promise<{ exists: boolean; count: number }> {
  const { sql } = await import('drizzle-orm')
  const { transactions } = await import('@/lib/db/schema')

  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${transactions}
    WHERE source_type = 'FY25_IMPORT'
  `)

  const count = parseInt((result.rows[0] as { count: string }).count, 10)
  return { exists: count > 0, count }
}
