/**
 * eCFR REST API client for real-time Treasury Regulation lookup.
 * API docs: https://www.ecfr.gov/developers/documentation/api/v1
 */

interface RegulationResult {
  citation: string
  text: string
  effectiveDate: string
}

/** In-memory cache with TTL (24 hours — regulations change infrequently) */
const cache = new Map<string, { data: RegulationResult; expires: number }>()
const CACHE_TTL_MS = 24 * 60 * 60 * 1000

/**
 * Parse a citation string like "26 CFR 1.501(c)(3)-1" into title and section.
 * Returns { title: "26", section: "1.501(c)(3)-1" }
 */
function parseCitation(citation: string): { title: string; section: string } | null {
  // Match patterns like "26 CFR 1.501(c)(3)-1" or "26 CFR 1.170A-1"
  const match = citation.match(/(\d+)\s*CFR\s*(?:§?\s*)?(.+)/i)
  if (!match) return null
  return { title: match[1], section: match[2].trim() }
}

/**
 * Fetch a specific Treasury Regulation section via eCFR API.
 * Uses the full-text search endpoint for best results.
 */
export async function fetchRegulation(citation: string): Promise<RegulationResult | null> {
  // Check cache
  const cached = cache.get(citation)
  if (cached && cached.expires > Date.now()) {
    return cached.data
  }

  const parsed = parseCitation(citation)
  if (!parsed) {
    return null
  }

  try {
    const today = new Date().toISOString().split('T')[0]
    // Use the search endpoint to find the section
    const searchUrl = `https://www.ecfr.gov/api/search/v1/results?query=${encodeURIComponent(parsed.section)}&per_page=5&page=1&order=relevance`

    const response = await fetch(searchUrl, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10000),
    })

    if (!response.ok) {
      console.error(`eCFR API error: ${response.status}`)
      return null
    }

    const data = await response.json()

    if (!data.results || data.results.length === 0) {
      return null
    }

    // Extract the most relevant result
    const result = data.results[0]
    const regulationResult: RegulationResult = {
      citation,
      text: result.full_text_excerpt || result.headings?.join(' > ') || 'No text available',
      effectiveDate: today,
    }

    // Cache the result
    cache.set(citation, { data: regulationResult, expires: Date.now() + CACHE_TTL_MS })

    return regulationResult
  } catch (error) {
    console.error('eCFR fetch error:', error)
    return null
  }
}
