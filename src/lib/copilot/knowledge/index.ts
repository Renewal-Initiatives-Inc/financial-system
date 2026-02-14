import { readFileSync } from 'fs'
import { join } from 'path'

const KNOWLEDGE_DIR = join(process.cwd(), 'src/lib/copilot/knowledge')

/** Maps topic keys to file paths (relative to knowledge directory) */
const topicMap: Record<string, string[]> = {
  'exempt-org': [
    'exempt-org-rules/irc-501c3.txt',
    'exempt-org-rules/irc-170-contributions.txt',
    'exempt-org-rules/irc-509-public-charity.txt',
    'exempt-org-rules/irc-4946-disqualified-persons.txt',
    'exempt-org-rules/schedule-a-public-support.txt',
    'exempt-org-rules/pub-557-excerpts.txt',
  ],
  'fund-accounting': [
    'fund-accounting/asc-958-overview.txt',
    'fund-accounting/restricted-funds.txt',
    'fund-accounting/net-asset-releases.txt',
    'fund-accounting/nonprofit-basics.txt',
  ],
  depreciation: [
    'depreciation/irc-168-macrs.txt',
    'depreciation/pub-946-excerpts.txt',
    'depreciation/asc-360-impairment.txt',
  ],
  'payroll-tax': [
    'payroll-tax/pub-15t-excerpts.txt',
    'payroll-tax/circular-m-excerpts.txt',
    'payroll-tax/fica-rules.txt',
  ],
  'ma-compliance': [
    'ma-compliance/gl-c186-security-deposits.txt',
    'ma-compliance/form-pc-instructions.txt',
    'ma-compliance/ma-nonprofit-faq.txt',
  ],
  reporting: [
    'reporting/form-990-instructions.txt',
    'reporting/donor-acknowledgment.txt',
    'reporting/functional-expenses.txt',
    'reporting/functional-allocation-defaults.txt',
    'reporting/public-support-test.txt',
  ],
  construction: [
    'construction/asc-835-20-interest-cap.txt',
    'construction/irc-263a-capitalization.txt',
    'construction/cip-conversion-rules.txt',
  ],
}

/** In-memory cache to avoid re-reading files on each request */
const fileCache = new Map<string, string>()

function readKnowledgeFile(relativePath: string): string {
  if (fileCache.has(relativePath)) {
    return fileCache.get(relativePath)!
  }
  try {
    const content = readFileSync(join(KNOWLEDGE_DIR, relativePath), 'utf-8')
    fileCache.set(relativePath, content)
    return content
  } catch {
    return `[Knowledge file not found: ${relativePath}]`
  }
}

/**
 * Load knowledge documents for the given topic keys.
 * Returns concatenated text with section headers.
 */
export function loadKnowledge(topics: string[]): string {
  const sections: string[] = []

  for (const topic of topics) {
    const files = topicMap[topic]
    if (!files) continue

    for (const file of files) {
      const content = readKnowledgeFile(file)
      sections.push(`--- ${file} ---\n${content}`)
    }
  }

  return sections.join('\n\n')
}

/** Get all available topic keys */
export function getTopicKeys(): string[] {
  return Object.keys(topicMap)
}

/** Search all knowledge files for a query string. Returns matching excerpts. */
export function searchKnowledge(
  query: string,
  topics?: string[]
): Array<{ source: string; excerpt: string }> {
  const results: Array<{ source: string; excerpt: string }> = []
  const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean)
  const filesToSearch: string[] = []

  if (topics?.length) {
    for (const topic of topics) {
      const files = topicMap[topic]
      if (files) filesToSearch.push(...files)
    }
  } else {
    for (const files of Object.values(topicMap)) {
      filesToSearch.push(...files)
    }
  }

  for (const file of filesToSearch) {
    const content = readKnowledgeFile(file)
    const lines = content.split('\n')
    const matchingLines: number[] = []

    for (let i = 0; i < lines.length; i++) {
      const lower = lines[i].toLowerCase()
      if (searchTerms.some((term) => lower.includes(term))) {
        matchingLines.push(i)
      }
    }

    if (matchingLines.length > 0) {
      // Extract context around first few matches
      const excerpts: string[] = []
      const seen = new Set<number>()

      for (const lineIdx of matchingLines.slice(0, 3)) {
        const start = Math.max(0, lineIdx - 1)
        const end = Math.min(lines.length, lineIdx + 3)
        const chunk: string[] = []
        for (let i = start; i < end; i++) {
          if (!seen.has(i)) {
            chunk.push(lines[i])
            seen.add(i)
          }
        }
        if (chunk.length) excerpts.push(chunk.join('\n'))
      }

      results.push({
        source: file,
        excerpt: excerpts.join('\n...\n'),
      })
    }
  }

  return results.slice(0, 5)
}
