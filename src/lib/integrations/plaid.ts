/**
 * Plaid API client — bank feed integration (INT-P0-013).
 *
 * Environment variables:
 * - PLAID_CLIENT_ID
 * - PLAID_SECRET
 * - PLAID_ENV (sandbox | production)
 */

import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  Products,
  CountryCode,
  type Transaction as PlaidTransaction,
  type RemovedTransaction,
} from 'plaid'

// --- Types ---

export interface PlaidSyncResult {
  added: PlaidTransactionRecord[]
  modified: PlaidTransactionRecord[]
  removed: string[]
  nextCursor: string
  hasMore: boolean
}

export interface PlaidTransactionRecord {
  plaidTransactionId: string
  plaidAccountId: string
  amount: number
  date: string
  merchantName: string | null
  category: string | null
  isPending: boolean
  paymentChannel: string | null
  rawData: Record<string, unknown>
}

export interface PlaidAccount {
  accountId: string
  name: string
  mask: string | null
  type: string
  subtype: string | null
}

// --- Client initialization ---

function getClient(): PlaidApi {
  const clientId = process.env.PLAID_CLIENT_ID
  const secret = process.env.PLAID_SECRET
  const env = process.env.PLAID_ENV ?? 'sandbox'

  if (!clientId || !secret) {
    throw new Error('PLAID_CLIENT_ID and PLAID_SECRET must be set')
  }

  const basePath =
    env === 'production'
      ? PlaidEnvironments.production
      : PlaidEnvironments.sandbox

  const config = new Configuration({
    basePath,
    baseOptions: {
      headers: {
        'PLAID-CLIENT-ID': clientId,
        'PLAID-SECRET': secret,
      },
    },
  })

  return new PlaidApi(config)
}

// --- Exported functions ---

/**
 * Create a Plaid Link token for the bank account connection UI.
 */
export async function createLinkToken(userId: string): Promise<string> {
  const client = getClient()
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Renewal Initiatives Finance',
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: 'en',
  })
  return response.data.link_token
}

/**
 * Exchange a public token (from Plaid Link success) for an access token.
 */
export async function exchangePublicToken(
  publicToken: string
): Promise<{ accessToken: string; itemId: string }> {
  const client = getClient()
  const response = await client.itemPublicTokenExchange({
    public_token: publicToken,
  })
  return {
    accessToken: response.data.access_token,
    itemId: response.data.item_id,
  }
}

/**
 * Incremental transaction sync using cursor-based /transactions/sync.
 * Plaid sign convention: positive = money out, negative = money in.
 * We store as-is to match GL debit convention.
 *
 * When accountId is provided, transactions are filtered to that single
 * Plaid account and a separate per-account cursor is maintained.
 */
export async function syncTransactions(
  accessToken: string,
  cursor: string | null,
  accountId?: string
): Promise<PlaidSyncResult> {
  const client = getClient()
  const response = await client.transactionsSync({
    access_token: accessToken,
    ...(cursor ? { cursor } : {}),
    ...(accountId ? { options: { account_id: accountId } } : {}),
  })

  const { added, modified, removed, next_cursor, has_more } = response.data

  return {
    added: added.map(mapPlaidTransaction),
    modified: modified.map(mapPlaidTransaction),
    removed: removed.map((r: RemovedTransaction) => r.transaction_id ?? '').filter(Boolean),
    nextCursor: next_cursor,
    hasMore: has_more,
  }
}

/**
 * Create a Plaid Link token in update mode for re-authentication.
 * Uses access_token instead of products — frontend opens Link in re-auth mode.
 * On success, the access_token stays the same (no token exchange needed).
 */
export async function createUpdateLinkToken(
  userId: string,
  accessToken: string
): Promise<string> {
  const client = getClient()
  const response = await client.linkTokenCreate({
    user: { client_user_id: userId },
    client_name: 'Renewal Initiatives Finance',
    country_codes: [CountryCode.Us],
    language: 'en',
    access_token: accessToken,
  })
  return response.data.link_token
}

/**
 * Get account information for a connected bank item.
 */
export async function getAccounts(
  accessToken: string
): Promise<PlaidAccount[]> {
  const client = getClient()
  const response = await client.accountsGet({
    access_token: accessToken,
  })

  return response.data.accounts.map((acc) => ({
    accountId: acc.account_id,
    name: acc.name,
    mask: acc.mask,
    type: acc.type,
    subtype: acc.subtype,
  }))
}

/**
 * Revoke a Plaid Item, invalidating its access token on the Plaid side.
 * Called when the last bank account on an item is deactivated.
 */
export async function removeItem(accessToken: string): Promise<void> {
  const client = getClient()
  await client.itemRemove({ access_token: accessToken })
}

// --- Internal mapping ---

function mapPlaidTransaction(txn: PlaidTransaction): PlaidTransactionRecord {
  return {
    plaidTransactionId: txn.transaction_id,
    plaidAccountId: txn.account_id,
    amount: txn.amount,
    date: txn.date,
    merchantName: txn.merchant_name ?? txn.name ?? null,
    category: txn.personal_finance_category?.primary ?? null,
    isPending: txn.pending,
    paymentChannel: txn.payment_channel ?? null,
    rawData: txn as unknown as Record<string, unknown>,
  }
}
