/**
 * ProPublica Nonprofit Explorer API client.
 * API: https://projects.propublica.org/nonprofits/api/v2/
 *
 * Notes from testing:
 * - Multi-word searches often return 0 results; use single keywords
 * - EIN-based lookups are reliable and rich
 * - Returns financial totals but NOT Part IX functional breakdowns
 */

export interface OrgSummary {
  ein: string
  name: string
  city: string
  state: string
  nteeCode: string
}

export interface OrgDetail {
  ein: string
  name: string
  city: string
  state: string
  nteeCode: string
  subsectionCode: number
  rulingDate: string
  taxPeriod: string
  assetAmount: number
  incomeAmount: number
}

export interface OrgFinancial {
  taxPeriod: string
  totalRevenue: number
  totalExpenses: number
  totalAssets: number
  totalLiabilities: number
}

/** Validated benchmark data from Feb 2025 990 PDF analysis */
export interface FunctionalBenchmark {
  orgName: string
  ein: string
  programPct: number
  mgaPct: number
  fundraisingPct: number
  notes: string
}

export const RI_BENCHMARKS: FunctionalBenchmark[] = [
  {
    orgName: 'Falcon Housing Corp',
    ein: '04-3538884',
    programPct: 75.6,
    mgaPct: 24.4,
    fundraisingPct: 0.0,
    notes: 'Closest comp to RI — small MA housing nonprofit, single property, no fundraising staff',
  },
  {
    orgName: 'Pioneer Valley Habitat for Humanity',
    ein: '04-3049506',
    programPct: 78.0,
    mgaPct: 9.6,
    fundraisingPct: 12.3,
    notes: 'Active fundraising model, less relevant to RI grant-funded structure',
  },
  {
    orgName: 'Valley Community Development Corp',
    ein: '22-2906466',
    programPct: 85.2,
    mgaPct: 14.5,
    fundraisingPct: 0.3,
    notes: 'Multi-property, government-funded; represents RI growth trajectory',
  },
]

const BASE_URL = 'https://projects.propublica.org/nonprofits/api/v2'

export async function searchNonprofits(query: string): Promise<OrgSummary[]> {
  try {
    const response = await fetch(
      `${BASE_URL}/search.json?q=${encodeURIComponent(query)}`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) return []

    const data = await response.json()
    if (!data.organizations) return []

    return data.organizations.slice(0, 10).map(
      (org: Record<string, unknown>) => ({
        ein: String(org.ein || ''),
        name: String(org.name || ''),
        city: String(org.city || ''),
        state: String(org.state || ''),
        nteeCode: String(org.ntee_code || ''),
      })
    )
  } catch (error) {
    console.error('ProPublica search error:', error)
    return []
  }
}

export async function getOrganization(ein: string): Promise<OrgDetail | null> {
  try {
    // Strip dashes for API
    const cleanEin = ein.replace(/-/g, '')
    const response = await fetch(
      `${BASE_URL}/organizations/${cleanEin}.json`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) return null

    const data = await response.json()
    const org = data.organization
    if (!org) return null

    return {
      ein: String(org.ein || ''),
      name: String(org.name || ''),
      city: String(org.city || ''),
      state: String(org.state || ''),
      nteeCode: String(org.ntee_code || ''),
      subsectionCode: Number(org.subsection_code || 0),
      rulingDate: String(org.ruling_date || ''),
      taxPeriod: String(org.tax_period || ''),
      assetAmount: Number(org.asset_amount || 0),
      incomeAmount: Number(org.income_amount || 0),
    }
  } catch (error) {
    console.error('ProPublica org lookup error:', error)
    return null
  }
}

export async function getFinancials(ein: string): Promise<OrgFinancial[] | null> {
  try {
    const cleanEin = ein.replace(/-/g, '')
    const response = await fetch(
      `${BASE_URL}/organizations/${cleanEin}.json`,
      { signal: AbortSignal.timeout(10000) }
    )

    if (!response.ok) return null

    const data = await response.json()
    const filings = data.filings_with_data
    if (!filings || !Array.isArray(filings)) return null

    return filings.slice(0, 5).map(
      (f: Record<string, unknown>) => ({
        taxPeriod: String(f.tax_prd || ''),
        totalRevenue: Number(f.totrevenue || 0),
        totalExpenses: Number(f.totfuncexpns || 0),
        totalAssets: Number(f.totassetsend || 0),
        totalLiabilities: Number(f.totliabend || 0),
      })
    )
  } catch (error) {
    console.error('ProPublica financials error:', error)
    return null
  }
}
