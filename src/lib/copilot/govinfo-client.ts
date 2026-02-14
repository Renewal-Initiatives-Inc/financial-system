/**
 * GovInfo REST API client for searching US government legal content.
 *
 * Official API: https://api.govinfo.gov/docs
 * MCP server:  https://api.govinfo.gov/mcp (same data, same key)
 * API key:     Free from https://www.govinfo.gov/api-signup
 * Rate limit:  36,000 requests/hour with registered key
 *
 * Collections used:
 *   FR      — Federal Register (IRS rules, notices, revenue rulings/procedures)
 *   USCODE  — US Code (Title 26 = Internal Revenue Code)
 *   CFR     — Code of Federal Regulations (Title 26 = Treasury Regulations)
 *   PLAW    — Public Laws (enacted tax legislation)
 */

const GOVINFO_BASE = 'https://api.govinfo.gov'
const REQUEST_TIMEOUT_MS = 15000

/** In-memory cache with TTL (1 hour — Federal Register updates daily) */
const cache = new Map<string, { data: GovInfoSearchResult; expires: number }>()
const CACHE_TTL_MS = 60 * 60 * 1000

export type GovInfoCollection = 'FR' | 'USCODE' | 'CFR' | 'PLAW'

export interface GovInfoResult {
  title: string
  packageId: string
  granuleId?: string
  dateIssued: string
  lastModified?: string
  collectionCode: string
  detailsUrl: string
  teaser?: string
}

export interface GovInfoSearchResult {
  query: string
  count: number
  results: GovInfoResult[]
}

function getApiKey(): string | null {
  return process.env.GOVINFO_API_KEY || null
}

/**
 * Search GovInfo across one or more collections.
 *
 * Query syntax supports Lucene-style field operators:
 *   collection:(FR)
 *   agency:"Internal Revenue Service"
 *   cfrcitation:(26 CFR 1.501)
 *   publishdate:range(2025-01-01, 2025-12-31)
 *   section:rule | section:prorule | section:notice
 *
 * @see https://www.govinfo.gov/help/fr for Federal Register field operators
 */
export async function searchGovInfo(
  query: string,
  options?: {
    collection?: GovInfoCollection
    pageSize?: number
    offsetMark?: string
  }
): Promise<GovInfoSearchResult | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('GOVINFO_API_KEY not configured')
    return null
  }

  // Build the full query with collection filter if specified
  const fullQuery = options?.collection
    ? `collection:(${options.collection}) ${query}`
    : query

  // Check cache
  const cacheKey = `${fullQuery}:${options?.pageSize || 10}`
  const cached = cache.get(cacheKey)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  try {
    const params = new URLSearchParams({
      query: fullQuery,
      pageSize: String(options?.pageSize || 10),
      api_key: apiKey,
    })
    if (options?.offsetMark) {
      params.set('offsetMark', options.offsetMark)
    }

    const response = await fetch(`${GOVINFO_BASE}/search?${params}`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })

    if (!response.ok) {
      console.error(`GovInfo API error: ${response.status} ${response.statusText}`)
      return null
    }

    const data = await response.json()

    const result: GovInfoSearchResult = {
      query: fullQuery,
      count: data.count || 0,
      results: (data.results || []).map(
        (r: Record<string, unknown>) => ({
          title: (r.title as string) || 'Untitled',
          packageId: (r.packageId as string) || '',
          granuleId: (r.granuleId as string) || undefined,
          dateIssued: (r.dateIssued as string) || '',
          lastModified: (r.lastModified as string) || undefined,
          collectionCode: (r.collectionCode as string) || '',
          detailsUrl: (r.detailsLink as string) || '',
          teaser: (r.resultLink as string) || undefined,
        })
      ),
    }

    cache.set(cacheKey, { data: result, expires: Date.now() + CACHE_TTL_MS })
    return result
  } catch (error) {
    console.error('GovInfo search error:', error)
    return null
  }
}

/**
 * Get details for a specific package or granule.
 * Returns metadata and links to renditions (HTML, PDF, XML).
 */
export async function describePackage(
  packageId: string,
  granuleId?: string
): Promise<GovInfoPackageDetail | null> {
  const apiKey = getApiKey()
  if (!apiKey) {
    console.error('GOVINFO_API_KEY not configured')
    return null
  }

  try {
    const path = granuleId
      ? `/packages/${packageId}/granules/${granuleId}/summary`
      : `/packages/${packageId}/summary`

    const response = await fetch(
      `${GOVINFO_BASE}${path}?api_key=${apiKey}`,
      {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      }
    )

    if (!response.ok) {
      console.error(`GovInfo package detail error: ${response.status}`)
      return null
    }

    const data = await response.json()
    return {
      title: data.title || '',
      packageId: data.packageId || packageId,
      dateIssued: data.dateIssued || '',
      category: data.category || '',
      htmlUrl: data.download?.txtLink || data.download?.htmlLink || null,
      pdfUrl: data.download?.pdfLink || null,
      xmlUrl: data.download?.xmlLink || null,
    }
  } catch (error) {
    console.error('GovInfo package detail error:', error)
    return null
  }
}

export interface GovInfoPackageDetail {
  title: string
  packageId: string
  dateIssued: string
  category: string
  htmlUrl: string | null
  pdfUrl: string | null
  xmlUrl: string | null
}

/**
 * Pre-built query templates for compliance calendar use cases.
 * These are tuned for the Federal Register search syntax.
 */
export const GOVINFO_QUERY_TEMPLATES = {
  /** October compliance calendar: find next-year SS wage base and withholding tables */
  annualRateReview: (year: number) =>
    `agency:"Internal Revenue Service" OR agency:"Social Security Administration" ("wage base" OR "Publication 15-T" OR "withholding") publishdate:range(${year}-08-01, ${year + 1}-01-31)`,

  /** Annual check: IRS rules or notices affecting exempt organizations */
  exemptOrgChanges: (sinceDate: string) =>
    `agency:"Internal Revenue Service" ("exempt organization" OR "501(c)(3)" OR "tax-exempt") publishdate:range(${sinceDate},)`,

  /** Track rulemaking touching specific CFR sections the system depends on */
  cfrCitationChanges: (citation: string, sinceDate: string) =>
    `cfrcitation:(${citation}) publishdate:range(${sinceDate},)`,

  /** Find 990 form or instruction changes */
  form990Changes: (sinceDate: string) =>
    `agency:"Internal Revenue Service" ("Form 990" OR "990-EZ" OR "990-T") publishdate:range(${sinceDate},)`,

  /** Track 1099 threshold or reporting changes */
  informationReturnChanges: (sinceDate: string) =>
    `agency:"Internal Revenue Service" ("1099" OR "information return" OR "section 6041") publishdate:range(${sinceDate},)`,

  /** Find new public laws affecting tax code */
  taxLegislation: (sinceDate: string) =>
    `title:("tax" OR "revenue" OR "internal revenue") publishdate:range(${sinceDate},)`,
} as const
