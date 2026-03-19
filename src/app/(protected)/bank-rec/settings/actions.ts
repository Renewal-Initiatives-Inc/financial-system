'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, bankTransactions, accounts } from '@/lib/db/schema'
import { insertBankAccountSchema } from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { encrypt, decrypt } from '@/lib/encryption'
import {
  exchangePublicToken,
  syncTransactions,
  createLinkToken,
  createUpdateLinkToken,
  removeItem,
} from '@/lib/integrations/plaid'
import { sendPlaidSyncFailureEmail } from '@/lib/integrations/plaid-sync-notification'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type BankAccountRow = {
  id: number
  name: string
  institution: string
  last4: string
  glAccountId: number
  glAccountName: string
  isActive: boolean
  lastSyncDate: string | null
  transactionCount: number
  createdAt: Date
}

// --- Server Actions ---

export async function getLinkToken(userId: string): Promise<string> {
  return createLinkToken(userId)
}

export async function getBankAccounts(): Promise<BankAccountRow[]> {
  const rows = await db
    .select({
      id: bankAccounts.id,
      name: bankAccounts.name,
      institution: bankAccounts.institution,
      last4: bankAccounts.last4,
      glAccountId: bankAccounts.glAccountId,
      glAccountName: accounts.name,
      isActive: bankAccounts.isActive,
      lastSyncedAt: bankAccounts.lastSyncedAt,
      createdAt: bankAccounts.createdAt,
    })
    .from(bankAccounts)
    .innerJoin(accounts, eq(bankAccounts.glAccountId, accounts.id))
    .orderBy(bankAccounts.name)

  // Get transaction count per account
  const result: BankAccountRow[] = []
  for (const row of rows) {
    const [countRow] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(bankTransactions)
      .where(eq(bankTransactions.bankAccountId, row.id))

    result.push({
      ...row,
      lastSyncDate: row.lastSyncedAt
        ? row.lastSyncedAt.toISOString().split('T')[0]
        : null,
      transactionCount: countRow?.count ?? 0,
    })
  }

  return result
}

export async function addBankAccounts(
  data: {
    publicToken: string
    institution: string
    accounts: Array<{
      plaidAccountId: string
      name: string
      last4: string
      type: string
      glAccountId: number
    }>
  },
  userId: string
): Promise<{ ids: number[] }> {
  // Validate each account
  for (const acc of data.accounts) {
    insertBankAccountSchema.parse({
      name: acc.name,
      institution: data.institution,
      last4: acc.last4,
      glAccountId: acc.glAccountId,
    })
  }

  // Exchange public token ONCE for access token
  let accessToken: string
  let itemId: string
  try {
    const result = await exchangePublicToken(data.publicToken)
    accessToken = result.accessToken
    itemId = result.itemId
  } catch (err: any) {
    const detail = err?.response?.data ?? err?.message ?? String(err)
    console.error('[addBankAccounts] Token exchange failed:', JSON.stringify(detail))
    throw new Error(`Plaid token exchange failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  }

  // Encrypt access token before storage (SYS-P0-017)
  let encryptedToken: string
  try {
    encryptedToken = encrypt(accessToken)
  } catch (err: any) {
    console.error('[addBankAccounts] Encryption failed:', err?.message)
    throw new Error(`Token encryption failed: ${err?.message}`)
  }

  // Insert N rows in a transaction (one per Plaid account)
  const ids = await db.transaction(async (tx) => {
    const insertedIds: number[] = []

    for (const acc of data.accounts) {
      const [newAccount] = await tx
        .insert(bankAccounts)
        .values({
          name: acc.name,
          institution: data.institution,
          last4: acc.last4,
          plaidAccessToken: encryptedToken,
          plaidItemId: itemId,
          plaidAccountId: acc.plaidAccountId,
          glAccountId: acc.glAccountId,
        })
        .returning()

      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId,
        action: 'created',
        entityType: 'bank_account',
        entityId: newAccount.id,
        afterState: {
          name: newAccount.name,
          institution: newAccount.institution,
          last4: newAccount.last4,
          plaidAccountId: acc.plaidAccountId,
          glAccountId: newAccount.glAccountId,
        },
      })

      insertedIds.push(newAccount.id)
    }

    return insertedIds
  })

  revalidatePath('/bank-rec/settings')
  return { ids }
}

export async function deactivateBankAccount(
  id: number,
  userId: string
): Promise<void> {
  // Fetch the account so we can check for siblings on the same Plaid item
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, id))

  if (!account) throw new Error('Bank account not found')

  // Check if other active accounts share this Plaid item
  const siblings = await db
    .select({ id: bankAccounts.id })
    .from(bankAccounts)
    .where(
      and(
        eq(bankAccounts.plaidItemId, account.plaidItemId),
        eq(bankAccounts.isActive, true),
        sql`${bankAccounts.id} != ${id}`
      )
    )

  let plaidRevoked = false

  // If this is the last active account on the item, revoke the Plaid token
  if (siblings.length === 0) {
    try {
      const accessToken = decrypt(account.plaidAccessToken)
      await removeItem(accessToken)
      plaidRevoked = true
    } catch (err) {
      // Best-effort: log failure but proceed with deactivation.
      // The encrypted token is useless after Plaid-side revocation;
      // if revocation failed, the token remains but the account is inactive.
      console.error(
        '[deactivateBankAccount] Plaid item revocation failed:',
        err instanceof Error ? err.message : String(err)
      )
    }
  }

  await db.transaction(async (tx) => {
    await tx
      .update(bankAccounts)
      .set({ isActive: false })
      .where(eq(bankAccounts.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'deactivated',
      entityType: 'bank_account',
      entityId: id,
      afterState: {
        isActive: false,
        plaidRevoked,
        siblingAccountsRemaining: siblings.length,
      },
    })
  })

  revalidatePath('/bank-rec/settings')
}

export async function triggerManualSync(
  bankAccountId: number,
  userId: string
): Promise<{ added: number; modified: number }> {
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))

  if (!account) throw new Error('Bank account not found')
  if (!account.isActive) throw new Error('Bank account is inactive')

  try {
    const accessToken = decrypt(account.plaidAccessToken)
    let cursor = account.plaidCursor
    let hasMore = true
    let totalAdded = 0
    let totalModified = 0

    while (hasMore) {
      const result = await syncTransactions(
        accessToken,
        cursor,
        account.plaidAccountId ?? undefined
      )

      for (const txn of result.added) {
        await db
          .insert(bankTransactions)
          .values({
            bankAccountId: account.id,
            plaidTransactionId: txn.plaidTransactionId,
            amount: String(txn.amount),
            date: txn.date,
            merchantName: txn.merchantName,
            category: txn.category,
            isPending: txn.isPending,
            paymentChannel: txn.paymentChannel,
            rawData: txn.rawData,
          })
          .onConflictDoNothing({
            target: bankTransactions.plaidTransactionId,
          })

        totalAdded++
      }

      for (const txn of result.modified) {
        await db
          .update(bankTransactions)
          .set({
            amount: String(txn.amount),
            date: txn.date,
            merchantName: txn.merchantName,
            category: txn.category,
            isPending: txn.isPending,
            paymentChannel: txn.paymentChannel,
            rawData: txn.rawData,
            updatedAt: new Date(),
          })
          .where(
            eq(bankTransactions.plaidTransactionId, txn.plaidTransactionId)
          )

        totalModified++
      }

      for (const plaidId of result.removed) {
        await db
          .delete(bankTransactions)
          .where(eq(bankTransactions.plaidTransactionId, plaidId))
      }

      cursor = result.nextCursor
      hasMore = result.hasMore
    }

    await db
      .update(bankAccounts)
      .set({ plaidCursor: cursor, lastSyncedAt: new Date() })
      .where(eq(bankAccounts.id, account.id))

    revalidatePath('/bank-rec/settings')
    revalidatePath('/bank-rec')
    return { added: totalAdded, modified: totalModified }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await sendPlaidSyncFailureEmail(message, account.name)
    throw new Error(`Sync failed: ${message}`)
  }
}

export async function getUpdateLinkToken(
  bankAccountId: number,
  userId: string
): Promise<string> {
  const [account] = await db
    .select()
    .from(bankAccounts)
    .where(eq(bankAccounts.id, bankAccountId))

  if (!account) throw new Error('Bank account not found')

  const accessToken = decrypt(account.plaidAccessToken)
  return createUpdateLinkToken(userId, accessToken)
}

export async function getGlAccountOptions(): Promise<
  { id: number; name: string; code: string }[]
> {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}
