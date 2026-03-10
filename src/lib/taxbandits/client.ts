import type {
  TaxBanditsTokenResponse,
  TaxBanditsBusinessPayload,
  TaxBanditsBusinessResponse,
  TaxBanditsW2Payload,
  TaxBandits1099NECPayload,
  TaxBandits941Payload,
  TaxBanditsSubmissionResponse,
  TaxBanditsStatusResponse,
  TaxBanditsApiErrorDetail,
} from './types'
import { TaxBanditsApiError } from './types'

// Token cache — module-level, reused across requests in the same worker
let cachedToken: string | null = null
let tokenExpiresAt: number = 0

function getBaseUrl(): string {
  const envUrl = process.env.TAXBANDITS_API_URL
  if (envUrl) return envUrl
  // Default to sandbox unless NODE_ENV === 'production'
  return process.env.NODE_ENV === 'production'
    ? 'https://api.taxbandits.com/v1.7.1'
    : 'https://testapi.taxbandits.com/v1.7.1'
}

async function getAccessToken(): Promise<string> {
  const now = Date.now()
  if (cachedToken && now < tokenExpiresAt - 60_000) {
    return cachedToken
  }

  const clientId = process.env.TAXBANDITS_CLIENT_ID
  const clientSecret = process.env.TAXBANDITS_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    throw new TaxBanditsApiError(
      'TAXBANDITS_CLIENT_ID and TAXBANDITS_CLIENT_SECRET must be set',
      0
    )
  }

  const tokenUrl =
    process.env.NODE_ENV === 'production'
      ? 'https://api.taxbandits.com/token'
      : 'https://testapi.taxbandits.com/token'

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }),
  })

  if (!res.ok) {
    throw new TaxBanditsApiError(`Token request failed: ${res.status}`, res.status)
  }

  const data = (await res.json()) as TaxBanditsTokenResponse
  cachedToken = data.access_token
  tokenExpiresAt = now + data.expires_in * 1000
  return cachedToken
}

async function apiFetch<T>(
  path: string,
  options: { method: 'GET' | 'POST'; body?: unknown } = { method: 'GET' }
): Promise<T> {
  const token = await getAccessToken()
  const res = await fetch(`${getBaseUrl()}${path}`, {
    method: options.method,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })

  const json = (await res.json()) as T & {
    StatusCode?: number
    StatusName?: string
    Errors?: TaxBanditsApiErrorDetail[]
  }

  if (!res.ok) {
    throw new TaxBanditsApiError(
      (json as { StatusName?: string }).StatusName ?? `API error ${res.status}`,
      res.status,
      (json as { Errors?: TaxBanditsApiErrorDetail[] }).Errors ?? []
    )
  }

  return json
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function createBusiness(
  data: TaxBanditsBusinessPayload
): Promise<TaxBanditsBusinessResponse> {
  return apiFetch<TaxBanditsBusinessResponse>('/business/create', {
    method: 'POST',
    body: data,
  })
}

export async function submitW2(
  data: TaxBanditsW2Payload
): Promise<TaxBanditsSubmissionResponse> {
  return apiFetch<TaxBanditsSubmissionResponse>('/w2/create', {
    method: 'POST',
    body: data,
  })
}

export async function submitForm1099NEC(
  data: TaxBandits1099NECPayload
): Promise<TaxBanditsSubmissionResponse> {
  return apiFetch<TaxBanditsSubmissionResponse>('/1099nec/create', {
    method: 'POST',
    body: data,
  })
}

export async function submitForm941(
  data: TaxBandits941Payload
): Promise<TaxBanditsSubmissionResponse> {
  return apiFetch<TaxBanditsSubmissionResponse>('/941/create', {
    method: 'POST',
    body: data,
  })
}

export async function getSubmissionStatus(
  submissionId: string
): Promise<TaxBanditsStatusResponse> {
  return apiFetch<TaxBanditsStatusResponse>(`/submissions/${submissionId}`, {
    method: 'GET',
  })
}
