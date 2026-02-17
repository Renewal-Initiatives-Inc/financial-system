'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { bankAccounts, bankTransactions, accounts } from '@/lib/db/schema'
import { insertBankAccountSchema } from '@/lib/validators'
import { logAudit } from '@/lib/audit/logger'
import { encrypt, decrypt } from '@/lib/encryption'
import { exchangePublicToken, syncTransactions, createLinkToken } from '@/lib/integrations/plaid'
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
      createdAt: bankAccounts.createdAt,
    })
    .from(bankAccounts)
    .innerJoin(accounts, eq(bankAccounts.glAccountId, accounts.id))
    .orderBy(bankAccounts.name)

  // Get last sync date and transaction count per account
  const result: BankAccountRow[] = []
  for (const row of rows) {
    const txns = await db
      .select({ date: bankTransactions.date })
      .from(bankTransactions)
      .where(eq(bankTransactions.bankAccountId, row.id))
      .orderBy(bankTransactions.createdAt)

    result.push({
      ...row,
      lastSyncDate: txns.length > 0 ? txns[txns.length - 1].date : null,
      transactionCount: txns.length,
    })
  }

  return result
}

export async function addBankAccount(
  data: {
    publicToken: string
    name: string
    institution: string
    last4: string
    glAccountId: number
  },
  userId: string
): Promise<{ id: number }> {
  const validated = insertBankAccountSchema.parse({
    name: data.name,
    institution: data.institution,
    last4: data.last4,
    glAccountId: data.glAccountId,
  })

  // Exchange public token for access token
  let accessToken: string
  let itemId: string
  try {
    const result = await exchangePublicToken(data.publicToken)
    accessToken = result.accessToken
    itemId = result.itemId
  } catch (err: any) {
    const detail = err?.response?.data ?? err?.message ?? String(err)
    console.error('[addBankAccount] Token exchange failed:', JSON.stringify(detail))
    throw new Error(`Plaid token exchange failed: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  }

  // Encrypt access token before storage (SYS-P0-017)
  let encryptedToken: string
  try {
    encryptedToken = encrypt(accessToken)
  } catch (err: any) {
    console.error('[addBankAccount] Encryption failed:', err?.message)
    throw new Error(`Token encryption failed: ${err?.message}`)
  }

  const [newAccount] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(bankAccounts)
      .values({
        name: validated.name,
        institution: validated.institution,
        last4: validated.last4,
        plaidAccessToken: encryptedToken,
        plaidItemId: itemId,
        glAccountId: validated.glAccountId,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'bank_account',
      entityId: result[0].id,
      afterState: {
        name: result[0].name,
        institution: result[0].institution,
        last4: result[0].last4,
        glAccountId: result[0].glAccountId,
      },
    })

    return result
  })

  revalidatePath('/bank-rec/settings')
  return { id: newAccount.id }
}

export async function deactivateBankAccount(
  id: number,
  userId: string
): Promise<void> {
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
      afterState: { isActive: false },
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
      const result = await syncTransactions(accessToken, cursor)

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
      .set({ plaidCursor: cursor })
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

export async function getGlAccountOptions(): Promise<
  { id: number; name: string; code: string }[]
> {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}
