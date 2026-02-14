import {
  searchGovInfo,
  describePackage,
  GOVINFO_QUERY_TEMPLATES,
  type GovInfoCollection,
} from '../govinfo-client'

interface GovInfoSearchInput {
  query?: string
  collection?: GovInfoCollection
  template?: keyof typeof GOVINFO_QUERY_TEMPLATES
  templateArgs?: { year?: number; sinceDate?: string; citation?: string }
  packageId?: string
  granuleId?: string
}

export async function handleGovInfoSearch(
  input: GovInfoSearchInput
): Promise<unknown> {
  // Package detail mode — fetch a specific document's metadata and links
  if (input.packageId) {
    const detail = await describePackage(input.packageId, input.granuleId)
    if (!detail) {
      return { error: `Could not retrieve package: ${input.packageId}` }
    }
    return detail
  }

  // Build query from template or raw query
  let query: string
  if (input.template) {
    const args = input.templateArgs || {}
    switch (input.template) {
      case 'annualRateReview':
        query = GOVINFO_QUERY_TEMPLATES.annualRateReview(args.year || new Date().getFullYear())
        break
      case 'exemptOrgChanges':
        query = GOVINFO_QUERY_TEMPLATES.exemptOrgChanges(
          args.sinceDate || defaultSinceDate()
        )
        break
      case 'form990Changes':
        query = GOVINFO_QUERY_TEMPLATES.form990Changes(
          args.sinceDate || defaultSinceDate()
        )
        break
      case 'informationReturnChanges':
        query = GOVINFO_QUERY_TEMPLATES.informationReturnChanges(
          args.sinceDate || defaultSinceDate()
        )
        break
      case 'taxLegislation':
        query = GOVINFO_QUERY_TEMPLATES.taxLegislation(
          args.sinceDate || defaultSinceDate()
        )
        break
      case 'cfrCitationChanges':
        if (!args.citation) {
          return { error: 'cfrCitationChanges template requires a citation argument' }
        }
        query = GOVINFO_QUERY_TEMPLATES.cfrCitationChanges(
          args.citation,
          args.sinceDate || defaultSinceDate()
        )
        break
      default:
        return { error: `Unknown template: ${input.template}` }
    }
  } else if (input.query) {
    query = input.query
  } else {
    return { error: 'Provide either a query or a template' }
  }

  const result = await searchGovInfo(query, {
    collection: input.collection,
    pageSize: 10,
  })

  if (!result) {
    return {
      error:
        'GovInfo search failed. Verify GOVINFO_API_KEY is configured. Get a free key at https://www.govinfo.gov/api-signup',
    }
  }

  return {
    query: result.query,
    totalResults: result.count,
    results: result.results.map((r) => ({
      title: r.title,
      date: r.dateIssued,
      collection: r.collectionCode,
      packageId: r.packageId,
      granuleId: r.granuleId,
      detailsUrl: r.detailsUrl,
      teaser: r.teaser,
    })),
    note:
      result.count > 10
        ? `Showing first 10 of ${result.count} results. Use more specific query terms or date ranges to narrow results.`
        : undefined,
  }
}

/** Default sinceDate: 1 year ago */
function defaultSinceDate(): string {
  const d = new Date()
  d.setFullYear(d.getFullYear() - 1)
  return d.toISOString().split('T')[0]
}
