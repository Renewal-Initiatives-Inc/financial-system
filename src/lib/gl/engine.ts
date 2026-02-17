import { eq } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { db } from '@/lib/db'
import { transactions, transactionLines } from '@/lib/db/schema'
import {
  insertTransactionSchema,
  editTransactionSchema,
  type InsertTransaction,
  type EditTransaction,
} from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { getAccountsById, getFundsById, getNetAssetAccounts, getTransactionWithLines } from './lookups'
import {
  detectRestrictedFundExpenses,
  buildReleaseLines,
} from './restricted-fund-release'
import {
  InvalidAccountError,
  InvalidFundError,
  ImmutableTransactionError,
  VoidedTransactionError,
  AlreadyReversedError,
  TransactionNotFoundError,
} from './errors'
import type { TransactionResult } from './types'

/**
 * Format a transaction + lines into the standard TransactionResult shape.
 */
function formatResult(
  txn: typeof transactions.$inferSelect,
  lines: (typeof transactionLines.$inferSelect)[]
): TransactionResult['transaction'] {
  return {
    id: txn.id,
    date: txn.date,
    memo: txn.memo,
    sourceType: txn.sourceType,
    isSystemGenerated: txn.isSystemGenerated,
    lines: lines.map((l) => ({
      id: l.id,
      accountId: l.accountId,
      fundId: l.fundId,
      debit: l.debit,
      credit: l.credit,
      cipCostCodeId: l.cipCostCodeId,
      memo: l.memo,
    })),
  }
}

/**
 * Central GL write path. Every transaction in the system flows through this function.
 *
 * Validation pipeline:
 * 1. Zod schema validation (balance check INV-001, line format, min 2 lines)
 * 2. Account existence + active check (INV-002, INV-004)
 * 3. Fund existence check (INV-003)
 * 4. Source provenance (INV-011) — set from input, immutable after creation
 * 5. Restricted fund detection → auto-release (INV-007)
 * 6. System-generated flag (INV-008)
 */
export async function createTransaction(
  input: InsertTransaction
): Promise<TransactionResult> {
  // Step 1: Zod validation (INV-001 balance check included)
  const validated = insertTransactionSchema.parse(input)

  // Use db.transaction() for atomic multi-table writes
  return await db.transaction(async (tx) => {
    // Step 2: Account validation (INV-002 + INV-004)
    const accountIds = validated.lines.map((l) => l.accountId)
    const accountMap = await getAccountsById(tx as unknown as NeonDatabase<any>, accountIds)

    for (const line of validated.lines) {
      const account = accountMap.get(line.accountId)
      if (!account) {
        throw new InvalidAccountError(
          `Account ID ${line.accountId} does not exist`
        )
      }
      if (!account.isActive) {
        throw new InvalidAccountError(
          `Account ${account.code} (${account.name}) is inactive`
        )
      }
    }

    // Step 3: Fund validation (INV-003)
    const fundIds = validated.lines.map((l) => l.fundId)
    const fundMap = await getFundsById(tx as unknown as NeonDatabase<any>, fundIds)

    for (const line of validated.lines) {
      const fund = fundMap.get(line.fundId)
      if (!fund) {
        throw new InvalidFundError(`Fund ID ${line.fundId} does not exist`)
      }
    }

    // Step 4: Insert transaction header
    const [txnRow] = await tx
      .insert(transactions)
      .values({
        date: validated.date,
        memo: validated.memo,
        sourceType: validated.sourceType,
        sourceReferenceId: validated.sourceReferenceId ?? null,
        isSystemGenerated: validated.isSystemGenerated,
        isVoided: false,
        createdBy: validated.createdBy,
      })
      .returning()

    // Step 5: Insert transaction lines
    const insertedLines = await tx
      .insert(transactionLines)
      .values(
        validated.lines.map((line) => ({
          transactionId: txnRow.id,
          accountId: line.accountId,
          fundId: line.fundId,
          debit: line.debit != null ? String(line.debit) : null,
          credit: line.credit != null ? String(line.credit) : null,
          cipCostCodeId: line.cipCostCodeId ?? null,
          memo: line.memo ?? null,
        }))
      )
      .returning()

    // Step 6: Audit log (INV-012)
    const result = formatResult(txnRow, insertedLines)
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId: validated.createdBy,
      action: 'created',
      entityType: 'transaction',
      entityId: txnRow.id,
      afterState: result as unknown as Record<string, unknown>,
    })

    // Step 7: Restricted fund auto-release (INV-007)
    const restrictedExpenses = detectRestrictedFundExpenses(
      validated.lines,
      accountMap,
      fundMap
    )

    let releaseResult: TransactionResult['transaction'] | undefined

    if (restrictedExpenses.length > 0) {
      const netAssetAccounts = await getNetAssetAccounts(
        tx as unknown as NeonDatabase<any>
      )
      const releaseLines = buildReleaseLines(
        restrictedExpenses,
        netAssetAccounts
      )

      // Create release transaction (system-generated)
      const [releaseTxnRow] = await tx
        .insert(transactions)
        .values({
          date: validated.date,
          memo: `Net asset release for transaction #${txnRow.id}`,
          sourceType: 'SYSTEM',
          sourceReferenceId: `release-for:${txnRow.id}`,
          isSystemGenerated: true,
          isVoided: false,
          createdBy: validated.createdBy,
        })
        .returning()

      const releaseInsertedLines = await tx
        .insert(transactionLines)
        .values(
          releaseLines.map((line) => ({
            transactionId: releaseTxnRow.id,
            accountId: line.accountId,
            fundId: line.fundId,
            debit: line.debit != null ? String(line.debit) : null,
            credit: line.credit != null ? String(line.credit) : null,
            cipCostCodeId: null,
            memo: null,
          }))
        )
        .returning()

      releaseResult = formatResult(releaseTxnRow, releaseInsertedLines)

      // Audit log for release transaction
      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId: validated.createdBy,
        action: 'created',
        entityType: 'transaction',
        entityId: releaseTxnRow.id,
        afterState: releaseResult as unknown as Record<string, unknown>,
        metadata: { triggeringTransactionId: txnRow.id },
      })
    }

    return {
      transaction: result,
      releaseTransaction: releaseResult,
    }
  })
}

/**
 * Edit an existing transaction (INV-006 — unmatched only).
 *
 * Guards:
 * - Must exist
 * - Must not be voided
 * - Must not be system-generated (INV-008)
 * - Must not have been reversed
 * - Bank-matching guard is a no-op until Phase 12
 */
export async function editTransaction(
  id: number,
  updates: EditTransaction,
  userId: string
): Promise<TransactionResult> {
  const validated = editTransactionSchema.parse(updates)

  return await db.transaction(async (tx) => {
    const existing = await getTransactionWithLines(
      tx as unknown as NeonDatabase<any>,
      id
    )
    if (!existing) {
      throw new TransactionNotFoundError(id)
    }
    if (existing.isVoided) {
      throw new VoidedTransactionError(id)
    }
    if (existing.isSystemGenerated) {
      throw new ImmutableTransactionError(
        'System-generated transactions cannot be edited'
      )
    }
    if (existing.reversedById != null) {
      throw new ImmutableTransactionError(
        'Reversed transactions cannot be edited'
      )
    }

    // Capture before state
    const beforeState = formatResult(existing, existing.lines)

    // If new lines provided: validate, delete old, insert new
    if (validated.lines) {
      // Validate accounts
      const accountIds = validated.lines.map((l) => l.accountId)
      const accountMap = await getAccountsById(
        tx as unknown as NeonDatabase<any>,
        accountIds
      )
      for (const line of validated.lines) {
        const account = accountMap.get(line.accountId)
        if (!account) {
          throw new InvalidAccountError(
            `Account ID ${line.accountId} does not exist`
          )
        }
        if (!account.isActive) {
          throw new InvalidAccountError(
            `Account ${account.code} (${account.name}) is inactive`
          )
        }
      }

      // Validate funds
      const fundIds = validated.lines.map((l) => l.fundId)
      const fundMap = await getFundsById(
        tx as unknown as NeonDatabase<any>,
        fundIds
      )
      for (const line of validated.lines) {
        const fund = fundMap.get(line.fundId)
        if (!fund) {
          throw new InvalidFundError(`Fund ID ${line.fundId} does not exist`)
        }
      }

      // Delete old lines, insert new
      await tx
        .delete(transactionLines)
        .where(eq(transactionLines.transactionId, id))

      await tx.insert(transactionLines).values(
        validated.lines.map((line) => ({
          transactionId: id,
          accountId: line.accountId,
          fundId: line.fundId,
          debit: line.debit != null ? String(line.debit) : null,
          credit: line.credit != null ? String(line.credit) : null,
          cipCostCodeId: line.cipCostCodeId ?? null,
          memo: line.memo ?? null,
        }))
      )
    }

    // Update header fields if provided
    const headerUpdates: Record<string, unknown> = {}
    if (validated.date !== undefined) headerUpdates.date = validated.date
    if (validated.memo !== undefined) headerUpdates.memo = validated.memo

    if (Object.keys(headerUpdates).length > 0) {
      await tx
        .update(transactions)
        .set(headerUpdates)
        .where(eq(transactions.id, id))
    }

    // Re-fetch the updated transaction
    const updated = await getTransactionWithLines(
      tx as unknown as NeonDatabase<any>,
      id
    )
    const afterState = formatResult(updated!, updated!.lines)

    // Audit log
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'transaction',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: afterState as unknown as Record<string, unknown>,
    })

    return { transaction: afterState }
  })
}

/**
 * Create a reversing entry for a transaction (INV-006 — for matched transactions).
 *
 * Creates a new transaction with swapped debits/credits, linked via reversalOfId/reversedById.
 */
export async function reverseTransaction(
  id: number,
  userId: string
): Promise<TransactionResult> {
  return await db.transaction(async (tx) => {
    const existing = await getTransactionWithLines(
      tx as unknown as NeonDatabase<any>,
      id
    )
    if (!existing) {
      throw new TransactionNotFoundError(id)
    }
    if (existing.isVoided) {
      throw new VoidedTransactionError(id)
    }
    if (existing.reversedById != null) {
      throw new AlreadyReversedError(id)
    }

    // Create reversal transaction with swapped amounts
    const [reversalTxn] = await tx
      .insert(transactions)
      .values({
        date: existing.date,
        memo: `Reversal of: ${existing.memo}`,
        sourceType: existing.sourceType,
        sourceReferenceId: existing.sourceReferenceId,
        isSystemGenerated: false,
        isVoided: false,
        reversalOfId: existing.id,
        createdBy: userId,
      })
      .returning()

    // Swap debits and credits
    const reversalLines = await tx
      .insert(transactionLines)
      .values(
        existing.lines.map((line) => ({
          transactionId: reversalTxn.id,
          accountId: line.accountId,
          fundId: line.fundId,
          debit: line.credit, // swap: original credit → reversal debit
          credit: line.debit, // swap: original debit → reversal credit
          cipCostCodeId: line.cipCostCodeId,
          memo: line.memo,
        }))
      )
      .returning()

    // Link original to reversal
    await tx
      .update(transactions)
      .set({ reversedById: reversalTxn.id })
      .where(eq(transactions.id, existing.id))

    const reversalResult = formatResult(reversalTxn, reversalLines)

    // Audit: 'reversed' on original
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'reversed',
      entityType: 'transaction',
      entityId: existing.id,
      beforeState: formatResult(existing, existing.lines) as unknown as Record<
        string,
        unknown
      >,
      afterState: {
        ...formatResult(existing, existing.lines),
        reversedById: reversalTxn.id,
      } as unknown as Record<string, unknown>,
    })

    // Audit: 'created' on reversal
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'transaction',
      entityId: reversalTxn.id,
      afterState: reversalResult as unknown as Record<string, unknown>,
    })

    return { transaction: reversalResult }
  })
}

/**
 * Void a transaction — sets isVoided = true. Voided transactions are excluded from GL totals.
 */
export async function voidTransaction(
  id: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const existing = await getTransactionWithLines(
      tx as unknown as NeonDatabase<any>,
      id
    )
    if (!existing) {
      throw new TransactionNotFoundError(id)
    }
    if (existing.isVoided) {
      throw new VoidedTransactionError(id)
    }

    await tx
      .update(transactions)
      .set({ isVoided: true })
      .where(eq(transactions.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'voided',
      entityType: 'transaction',
      entityId: id,
      beforeState: { isVoided: false },
      afterState: { isVoided: true },
    })
  })
}
