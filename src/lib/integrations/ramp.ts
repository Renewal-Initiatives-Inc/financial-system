/**
 * Ramp API client — OAuth2 Client Credentials flow.
 *
 * Environment variables:
 * - RAMP_CLIENT_ID
 * - RAMP_CLIENT_SECRET
 * - RAMP_BASE_URL (optional, defaults to https://api.ramp.com)
 */

const RAMP_BASE_URL =
  process.env.RAMP_BASE_URL ?? 'https://api.ramp.com'

// --- Types ---

/** Ramp API transaction shape (relevant fields only). */
export interface RampApiTransaction {
  id: string
  user_transaction_time?: string
  accounting_date?: string
  amount: number
  merchant_name: string
  memo?: string | null
  card_holder?: {
    first_name: string
    last_name: string
  }
  state: string
}

/** Internal mapped transaction ready for DB insert. */
export interface MappedRampTransaction {
  rampId: string
  date: string
  amount: number
  merchantName: string
  description: string | null
  cardholder: string
  isPending: boolean
}

// --- Token cache ---

let cachedToken: string | null = null
let tokenExpiresAt = 0

/**
 * Acquire OAuth2 access token via client credentials grant.
 * Caches token in module scope and refreshes when expired.
 */
export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiresAt) {
    return cachedToken
  }

  const clientId = process.env.RAMP_CLIENT_ID
  const clientSecret = process.env.RAMP_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new Error('RAMP_CLIENT_ID and RAMP_CLIENT_SECRET must be set')
  }

  const basicAuth = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')

  const res = await fetch(`${RAMP_BASE_URL}/developer/v1/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${basicAuth}`,
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      scope: 'transactions:read',
    }),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error('[Ramp] Token request failed', {
      status: res.status,
      url: `${RAMP_BASE_URL}/developer/v1/token`,
      body: text,
    })
    throw new Error(`Ramp token request failed (${res.status}): ${text}`)
  }

  const data = (await res.json()) as { access_token: string; expires_in: number }
  cachedToken = data.access_token
  // Refresh 60s early to avoid edge-case expiration
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

/** Clear cached token (used on 401 retry). */
export function clearTokenCache(): void {
  cachedToken = null
  tokenExpiresAt = 0
}

// --- API calls ---

interface FetchTransactionsParams {
  from_date?: string
  to_date?: string
  state?: string
  start?: string
  page_size?: number
}

interface RampPageResponse {
  data: RampApiTransaction[]
  page: { next: string | null }
}

/**
 * Fetch a single page of transactions from the Ramp API.
 * On 401, clears token cache and retries once.
 */
async function fetchTransactionsPage(
  params: FetchTransactionsParams,
  retried = false
): Promise<RampPageResponse> {
  const token = await getAccessToken()
  const url = new URL(`${RAMP_BASE_URL}/developer/v1/transactions`)
  // Ramp API requires ISO 8601 datetime, not bare dates
  if (params.from_date) {
    const val = params.from_date.includes('T') ? params.from_date : `${params.from_date}T00:00:00Z`
    url.searchParams.set('from_date', val)
  }
  if (params.to_date) {
    const val = params.to_date.includes('T') ? params.to_date : `${params.to_date}T23:59:59Z`
    url.searchParams.set('to_date', val)
  }
  if (params.state) url.searchParams.set('state', params.state)
  if (params.start) url.searchParams.set('start', params.start)
  url.searchParams.set('page_size', String(params.page_size ?? 100))

  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (res.status === 401 && !retried) {
    clearTokenCache()
    return fetchTransactionsPage(params, true)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ramp API error (${res.status}): ${text}`)
  }

  return res.json() as Promise<RampPageResponse>
}

/** States we sync — cleared/completed + pending. Declined/error are excluded. */
const SYNC_STATES = new Set(['CLEARED', 'COMPLETION', 'PENDING', 'PENDING_INITIATION'])

/**
 * Fetch all syncable transactions from Ramp, handling pagination.
 * Includes both cleared and pending transactions.
 * Returns mapped transactions ready for DB insert.
 */
export async function fetchTransactions(params?: {
  from_date?: string
  to_date?: string
}): Promise<MappedRampTransaction[]> {
  const results: MappedRampTransaction[] = []
  let cursor: string | undefined

  do {
    const page = await fetchTransactionsPage({
      from_date: params?.from_date,
      to_date: params?.to_date,
      start: cursor,
      page_size: 100,
    })

    for (const txn of page.data) {
      if (!SYNC_STATES.has(txn.state)) continue
      results.push(mapRampTransaction(txn))
    }

    cursor = page.page.next ?? undefined
  } while (cursor)

  return results
}

/**
 * Fetch a single transaction by ID.
 */
export async function fetchTransaction(
  transactionId: string,
  retried = false
): Promise<MappedRampTransaction> {
  const token = await getAccessToken()
  const res = await fetch(
    `${RAMP_BASE_URL}/developer/v1/transactions/${transactionId}`,
    { headers: { Authorization: `Bearer ${token}` } }
  )

  if (res.status === 401 && !retried) {
    clearTokenCache()
    return fetchTransaction(transactionId, true)
  }

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Ramp API error (${res.status}): ${text}`)
  }

  const txn = (await res.json()) as RampApiTransaction
  return mapRampTransaction(txn)
}

// --- Mapping ---

/**
 * Map Ramp API response to our internal format.
 * - Prefers user_transaction_time over accounting_date for date
 * - Takes Math.abs() of amount (Ramp returns negative for charges)
 * - Concatenates cardholder first + last name
 * - Sets isPending based on Ramp state
 */
export function mapRampTransaction(txn: RampApiTransaction): MappedRampTransaction {
  const rawDate = txn.user_transaction_time ?? txn.accounting_date ?? ''
  const date = rawDate.substring(0, 10) // Extract YYYY-MM-DD

  return {
    rampId: txn.id,
    date,
    amount: Math.abs(txn.amount),
    merchantName: txn.merchant_name,
    description: txn.memo ?? null,
    cardholder: txn.card_holder
      ? `${txn.card_holder.first_name} ${txn.card_holder.last_name}`
      : 'Unknown',
    isPending: txn.state === 'PENDING' || txn.state === 'PENDING_INITIATION',
  }
}
