/**
 * Jaro-Winkler string similarity for bank reconciliation matching.
 * Pure TypeScript — no dependencies.
 */

/**
 * Compute Jaro similarity between two strings.
 * Returns a value between 0 (no match) and 1 (exact match).
 */
function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0
  if (s1.length === 0 || s2.length === 0) return 0.0

  const matchDistance = Math.max(Math.floor(Math.max(s1.length, s2.length) / 2) - 1, 0)

  const s1Matches = new Array(s1.length).fill(false)
  const s2Matches = new Array(s2.length).fill(false)

  let matches = 0
  let transpositions = 0

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchDistance)
    const end = Math.min(i + matchDistance + 1, s2.length)

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue
      s1Matches[i] = true
      s2Matches[j] = true
      matches++
      break
    }
  }

  if (matches === 0) return 0.0

  // Count transpositions
  let k = 0
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue
    while (!s2Matches[k]) k++
    if (s1[i] !== s2[k]) transpositions++
    k++
  }

  return (
    (matches / s1.length +
      matches / s2.length +
      (matches - transpositions / 2) / matches) /
    3
  )
}

/**
 * Compute Jaro-Winkler similarity between two strings.
 * Gives a boost for common prefixes (up to 4 characters).
 * Returns a value between 0 (no match) and 1 (exact match).
 *
 * Reference values:
 * - "MARTHA"/"MARHTA" ≈ 0.961
 * - "DWAYNE"/"DUANE" ≈ 0.84
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(s1, s2)

  // Find common prefix length (max 4)
  let prefixLength = 0
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length))
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefixLength++
    } else {
      break
    }
  }

  return jaro + prefixLength * prefixScale * (1 - jaro)
}

/**
 * Bank-specific merchant name noise patterns to strip before comparison.
 */
const NOISE_PATTERNS = [
  // Square, Toast, Stripe prefixes
  /^SQ\s*\*\s*/i,
  /^TST\s*\*\s*/i,
  /^STRIPE\s*\*\s*/i,
  /^PAYPAL\s*\*\s*/i,
  /^SP\s*\*\s*/i,
  // Trailing location codes (city, state, zip patterns)
  /\s+[A-Z]{2}\s+\d{5}(-\d{4})?$/,
  /\s+[A-Z][a-z]+\s+[A-Z]{2}$/,
  // Trailing transaction IDs / reference numbers
  /\s+#\d+$/,
  /\s+\d{10,}$/,
  // Common suffixes
  /\s+(INC|LLC|CORP|LTD|CO)\.?$/i,
]

/**
 * Normalize a merchant name for comparison by stripping
 * bank-specific noise (processor prefixes, location codes, etc).
 */
export function normalizeMerchantName(s: string): string {
  let normalized = s.trim().toUpperCase()
  for (const pattern of NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, '')
  }
  // Collapse multiple spaces
  normalized = normalized.replace(/\s+/g, ' ').trim()
  return normalized
}
