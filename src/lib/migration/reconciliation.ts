import Papa from 'papaparse'

// ── Types ──

/** A normalized transaction from any source */
export interface ReconTransaction {
  source: 'qbo' | 'bank' | 'ramp'
  date: string // YYYY-MM-DD
  amount: number // positive = money out (debit to expense / payment), negative = money in (credit / deposit)
  description: string
  sourceId: string // unique within source (trans no, plaid id, ramp id)
  accountCode?: string // QBO account code (e.g., "1000" for checking)
  raw?: Record<string, string> // original CSV row
}

export interface ReconMatch {
  source1: ReconTransaction
  source2: ReconTransaction
  matchType: 'exact' | 'fuzzy-1d' | 'fuzzy-3d' | 'amount-only'
  daysDiff: number
  amountDiff: number // should be 0 for exact matches
}

export interface ReconResult {
  matched: ReconMatch[]
  unmatchedSource1: ReconTransaction[]
  unmatchedSource2: ReconTransaction[]
  summary: {
    source1Name: string
    source2Name: string
    source1Count: number
    source2Count: number
    matchedCount: number
    unmatchedSource1Count: number
    unmatchedSource2Count: number
    source1Total: number
    source2Total: number
    matchedTotal: number
  }
}

// ── Date Utilities ──

function daysBetween(date1: string, date2: string): number {
  const d1 = new Date(date1 + 'T00:00:00Z')
  const d2 = new Date(date2 + 'T00:00:00Z')
  return Math.abs(Math.round((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24)))
}

// ── CSV Parsers ──

/**
 * Parse QBO Journal CSV into ReconTransactions.
 * Filters to only cash/credit card account transactions for reconciliation.
 *
 * Cash accounts: Checking (1000), Savings (1010), Escrow (1020)
 * Credit card: Credit Card Payable (2020)
 */
export function parseQboForRecon(
  csvContent: string,
  accountFilter: 'cash' | 'credit-card'
): ReconTransaction[] {
  const accountCodes =
    accountFilter === 'cash'
      ? ['1000', '1010', '1020']
      : ['2020']

  // We need the account mapping to filter — import it inline
  const { QBO_ACCOUNT_MAPPING } = require('./account-mapping')

  // Build reverse lookup: QBO account name → account code
  const nameToCode = new Map<string, string>()
  for (const [qboName, code] of Object.entries(QBO_ACCOUNT_MAPPING)) {
    nameToCode.set(qboName.toLowerCase(), code as string)
  }

  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0) {
    throw new Error(`QBO CSV parse error: ${result.errors[0].message}`)
  }

  // Normalize column headers
  const normalizeHeader = (headers: string[]): Map<string, string> => {
    const map = new Map<string, string>()
    const aliases: Record<string, string> = {
      'date': 'date',
      'trans no': 'transNo', 'transaction no': 'transNo', 'num': 'transNo',
      'trans no.': 'transNo', 'transaction no.': 'transNo',
      'account': 'account', 'account name': 'account',
      'name': 'name',
      'memo': 'memo', 'memo/description': 'memo', 'description': 'memo',
      'debit': 'debit',
      'credit': 'credit',
      'class': 'class',
    }
    for (const h of headers) {
      const lower = h.toLowerCase().trim()
      if (lower in aliases) {
        map.set(h, aliases[lower])
      }
    }
    return map
  }

  const headers = Object.keys(result.data[0])
  const headerMap = normalizeHeader(headers)

  const getMapped = (row: Record<string, string>, field: string): string => {
    for (const [csvHeader, mappedField] of headerMap) {
      if (mappedField === field) {
        return row[csvHeader]?.trim() ?? ''
      }
    }
    return ''
  }

  const transactions: ReconTransaction[] = []
  let lastDate = ''
  let lastTransNo = ''

  for (const row of result.data) {
    const rawDate = getMapped(row, 'date') || lastDate
    const rawTransNo = getMapped(row, 'transNo') || lastTransNo
    const accountName = getMapped(row, 'account')
    const rawDebit = getMapped(row, 'debit')
    const rawCredit = getMapped(row, 'credit')
    const memo = getMapped(row, 'memo')
    const name = getMapped(row, 'name')

    if (rawDate) lastDate = rawDate
    if (getMapped(row, 'transNo')) lastTransNo = getMapped(row, 'transNo')

    if (!accountName) continue

    // Resolve account code
    const code = nameToCode.get(accountName.toLowerCase())
    if (!code || !accountCodes.includes(code)) continue

    // Parse amount — for bank recon, debits = money out (positive), credits = money in (negative)
    const debit = parseCurrencyValue(rawDebit)
    const credit = parseCurrencyValue(rawCredit)
    const amount = debit > 0 ? debit : -credit

    // Convert date
    let date: string
    try {
      date = convertDateFormat(rawDate)
    } catch {
      continue // skip rows with bad dates
    }

    transactions.push({
      source: 'qbo',
      date,
      amount,
      description: [name, memo].filter(Boolean).join(' — '),
      sourceId: rawTransNo,
      accountCode: code,
      raw: { ...row },
    })
  }

  return transactions
}

/**
 * Parse a bank CSV export (UMass Five or similar).
 *
 * Flexible parser — tries common bank CSV formats:
 *   Format A: Date, Description, Amount (single column, negative = debit)
 *   Format B: Date, Description, Debit, Credit (separate columns)
 *   Format C: Date, Description, Withdrawals, Deposits
 *
 * Amount sign convention: positive = money out, negative = money in
 * (matches our QBO convention for reconciliation)
 */
export function parseBankCsv(
  csvContent: string,
  options?: {
    dateColumn?: string
    descriptionColumn?: string
    amountColumn?: string
    debitColumn?: string
    creditColumn?: string
    accountLabel?: string // e.g., "Checking", "Savings"
  }
): ReconTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0) {
    throw new Error(`Bank CSV parse error: ${result.errors[0].message}`)
  }

  if (result.data.length === 0) return []

  const headers = Object.keys(result.data[0]).map((h) => h.toLowerCase())

  // Auto-detect columns if not specified
  const dateCol =
    options?.dateColumn ??
    findColumn(headers, ['date', 'posting date', 'transaction date', 'post date', 'posted date'])
  const descCol =
    options?.descriptionColumn ??
    findColumn(headers, ['description', 'memo', 'transaction description', 'details', 'payee', 'name'])
  const amountCol = options?.amountColumn ?? findColumn(headers, ['amount', 'transaction amount'])
  const debitCol =
    options?.debitColumn ??
    findColumn(headers, ['debit', 'withdrawal', 'withdrawals', 'debit amount'])
  const creditCol =
    options?.creditColumn ??
    findColumn(headers, ['credit', 'deposit', 'deposits', 'credit amount'])

  if (!dateCol) throw new Error(`Bank CSV: cannot find date column. Headers: ${headers.join(', ')}`)
  if (!descCol) throw new Error(`Bank CSV: cannot find description column. Headers: ${headers.join(', ')}`)

  // Find the actual header case
  const findOriginalHeader = (lowerTarget: string): string => {
    const original = Object.keys(result.data[0])
    return original.find((h) => h.toLowerCase() === lowerTarget) ?? lowerTarget
  }

  const dateHeader = findOriginalHeader(dateCol)
  const descHeader = findOriginalHeader(descCol)
  const amountHeader = amountCol ? findOriginalHeader(amountCol) : undefined
  const debitHeader = debitCol ? findOriginalHeader(debitCol) : undefined
  const creditHeader = creditCol ? findOriginalHeader(creditCol) : undefined

  const transactions: ReconTransaction[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]
    const rawDate = row[dateHeader]?.trim()
    const description = row[descHeader]?.trim() ?? ''

    if (!rawDate) continue

    let date: string
    try {
      date = convertDateFormat(rawDate)
    } catch {
      continue
    }

    let amount: number
    if (amountHeader) {
      // Single amount column — negative typically means money out
      const raw = parseCurrencyValue(row[amountHeader])
      // Bank convention: negative = money out, positive = money in
      // Our convention: positive = money out, negative = money in
      amount = -raw
    } else if (debitHeader && creditHeader) {
      const debit = parseCurrencyValue(row[debitHeader])
      const credit = parseCurrencyValue(row[creditHeader])
      amount = debit > 0 ? debit : -credit
    } else {
      throw new Error(
        `Bank CSV: need either an amount column or debit+credit columns. Headers: ${headers.join(', ')}`
      )
    }

    transactions.push({
      source: 'bank',
      date,
      amount,
      description,
      sourceId: `bank-${options?.accountLabel ?? 'unknown'}-${i}`,
      raw: { ...row },
    })
  }

  return transactions
}

/**
 * Parse Ramp transaction CSV export.
 *
 * Ramp CSVs typically have: Date, Merchant, Amount, Cardholder, Category, Memo, etc.
 * Amount is always positive (charges).
 */
export function parseRampCsv(csvContent: string): ReconTransaction[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h: string) => h.trim(),
  })

  if (result.errors.length > 0) {
    throw new Error(`Ramp CSV parse error: ${result.errors[0].message}`)
  }

  if (result.data.length === 0) return []

  const headers = Object.keys(result.data[0]).map((h) => h.toLowerCase())

  const dateCol = findColumn(headers, ['date', 'transaction date', 'posted date'])
  const merchantCol = findColumn(headers, ['merchant', 'merchant name', 'vendor', 'description'])
  const amountCol = findColumn(headers, ['amount', 'transaction amount', 'total'])
  const idCol = findColumn(headers, ['id', 'transaction id', 'ramp id'])
  const cardholderCol = findColumn(headers, ['cardholder', 'card holder', 'user', 'employee'])

  if (!dateCol) throw new Error(`Ramp CSV: cannot find date column. Headers: ${headers.join(', ')}`)
  if (!amountCol) throw new Error(`Ramp CSV: cannot find amount column. Headers: ${headers.join(', ')}`)

  const findOriginalHeader = (lowerTarget: string): string => {
    const original = Object.keys(result.data[0])
    return original.find((h) => h.toLowerCase() === lowerTarget) ?? lowerTarget
  }

  const dateHeader = findOriginalHeader(dateCol)
  const merchantHeader = merchantCol ? findOriginalHeader(merchantCol) : undefined
  const amountHeader = findOriginalHeader(amountCol)
  const idHeader = idCol ? findOriginalHeader(idCol) : undefined
  const cardholderHeader = cardholderCol ? findOriginalHeader(cardholderCol) : undefined

  const transactions: ReconTransaction[] = []

  for (let i = 0; i < result.data.length; i++) {
    const row = result.data[i]
    const rawDate = row[dateHeader]?.trim()
    if (!rawDate) continue

    let date: string
    try {
      date = convertDateFormat(rawDate)
    } catch {
      continue
    }

    // Ramp amounts are charges (positive = money out)
    const amount = Math.abs(parseCurrencyValue(row[amountHeader]))
    const merchant = merchantHeader ? (row[merchantHeader]?.trim() ?? '') : ''
    const cardholder = cardholderHeader ? (row[cardholderHeader]?.trim() ?? '') : ''
    const id = idHeader ? (row[idHeader]?.trim() ?? `ramp-${i}`) : `ramp-${i}`

    transactions.push({
      source: 'ramp',
      date,
      amount,
      description: [merchant, cardholder].filter(Boolean).join(' — '),
      sourceId: id,
      raw: { ...row },
    })
  }

  return transactions
}

// ── Matching Engine ──

/**
 * Match transactions from two sources.
 *
 * Matching passes (in order of confidence):
 *   1. Exact: same date + same amount (within $0.01)
 *   2. Fuzzy 1-day: date ± 1 day + same amount
 *   3. Fuzzy 3-day: date ± 3 days + same amount
 *   4. Amount-only: same amount within the same week (± 7 days) — flagged for manual review
 *
 * Each transaction is matched at most once. Earlier passes take priority.
 */
export function matchTransactions(
  source1: ReconTransaction[],
  source2: ReconTransaction[],
  options?: {
    source1Name?: string
    source2Name?: string
    amountTolerance?: number // default $0.01
  }
): ReconResult {
  const tolerance = options?.amountTolerance ?? 0.01
  const source1Name = options?.source1Name ?? source1[0]?.source ?? 'source1'
  const source2Name = options?.source2Name ?? source2[0]?.source ?? 'source2'

  const matched: ReconMatch[] = []
  const used1 = new Set<number>()
  const used2 = new Set<number>()

  // Helper: find best match for a source1 transaction in source2
  const findMatch = (
    tx1: ReconTransaction,
    idx1: number,
    maxDaysDiff: number,
    matchType: ReconMatch['matchType']
  ): boolean => {
    if (used1.has(idx1)) return false

    let bestIdx = -1
    let bestDaysDiff = Infinity

    for (let j = 0; j < source2.length; j++) {
      if (used2.has(j)) continue
      const tx2 = source2[j]

      const amountDiff = Math.abs(Math.abs(tx1.amount) - Math.abs(tx2.amount))
      if (amountDiff > tolerance) continue

      const days = daysBetween(tx1.date, tx2.date)
      if (days > maxDaysDiff) continue

      if (days < bestDaysDiff) {
        bestDaysDiff = days
        bestIdx = j
      }
    }

    if (bestIdx >= 0) {
      used1.add(idx1)
      used2.add(bestIdx)
      matched.push({
        source1: tx1,
        source2: source2[bestIdx],
        matchType,
        daysDiff: bestDaysDiff,
        amountDiff: Math.abs(Math.abs(tx1.amount) - Math.abs(source2[bestIdx].amount)),
      })
      return true
    }
    return false
  }

  // Pass 1: Exact match (same date)
  for (let i = 0; i < source1.length; i++) {
    findMatch(source1[i], i, 0, 'exact')
  }

  // Pass 2: Fuzzy 1-day
  for (let i = 0; i < source1.length; i++) {
    findMatch(source1[i], i, 1, 'fuzzy-1d')
  }

  // Pass 3: Fuzzy 3-day
  for (let i = 0; i < source1.length; i++) {
    findMatch(source1[i], i, 3, 'fuzzy-3d')
  }

  // Pass 4: Amount-only within 7 days (low confidence — flag for review)
  for (let i = 0; i < source1.length; i++) {
    findMatch(source1[i], i, 7, 'amount-only')
  }

  const unmatchedSource1 = source1.filter((_, i) => !used1.has(i))
  const unmatchedSource2 = source2.filter((_, i) => !used2.has(i))

  const sum = (txs: ReconTransaction[]) =>
    Math.round(txs.reduce((s, t) => s + t.amount, 0) * 100) / 100
  const matchedSum = Math.round(
    matched.reduce((s, m) => s + Math.abs(m.source1.amount), 0) * 100
  ) / 100

  return {
    matched,
    unmatchedSource1,
    unmatchedSource2,
    summary: {
      source1Name,
      source2Name,
      source1Count: source1.length,
      source2Count: source2.length,
      matchedCount: matched.length,
      unmatchedSource1Count: unmatchedSource1.length,
      unmatchedSource2Count: unmatchedSource2.length,
      source1Total: sum(source1),
      source2Total: sum(source2),
      matchedTotal: matchedSum,
    },
  }
}

// ── Report Formatter ──

/**
 * Format reconciliation results as a human-readable report.
 */
export function formatReconReport(result: ReconResult): string {
  const { summary, matched, unmatchedSource1, unmatchedSource2 } = result
  const lines: string[] = []

  lines.push('=' .repeat(80))
  lines.push(`RECONCILIATION: ${summary.source1Name} ↔ ${summary.source2Name}`)
  lines.push('='.repeat(80))
  lines.push('')

  // Summary
  lines.push('SUMMARY')
  lines.push('-'.repeat(40))
  lines.push(`${summary.source1Name}: ${summary.source1Count} transactions, total $${summary.source1Total.toFixed(2)}`)
  lines.push(`${summary.source2Name}: ${summary.source2Count} transactions, total $${summary.source2Total.toFixed(2)}`)
  lines.push(`Matched: ${summary.matchedCount} transactions ($${summary.matchedTotal.toFixed(2)})`)
  lines.push(`Unmatched ${summary.source1Name}: ${summary.unmatchedSource1Count}`)
  lines.push(`Unmatched ${summary.source2Name}: ${summary.unmatchedSource2Count}`)
  lines.push('')

  // Match breakdown by type
  const byType = new Map<string, number>()
  for (const m of matched) {
    byType.set(m.matchType, (byType.get(m.matchType) ?? 0) + 1)
  }
  lines.push('MATCH QUALITY')
  lines.push('-'.repeat(40))
  for (const [type, count] of byType) {
    const label = {
      exact: 'Exact (same date + amount)',
      'fuzzy-1d': 'Fuzzy (±1 day)',
      'fuzzy-3d': 'Fuzzy (±3 days)',
      'amount-only': 'Amount-only (±7 days) ⚠️  REVIEW',
    }[type] ?? type
    lines.push(`  ${label}: ${count}`)
  }
  lines.push('')

  // Amount-only matches need attention
  const reviewMatches = matched.filter((m) => m.matchType === 'amount-only')
  if (reviewMatches.length > 0) {
    lines.push('⚠️  MATCHES NEEDING REVIEW (amount-only, no date match)')
    lines.push('-'.repeat(60))
    for (const m of reviewMatches) {
      lines.push(`  ${m.source1.date} | $${Math.abs(m.source1.amount).toFixed(2)} | ${m.source1.description}`)
      lines.push(`  ${m.source2.date} | $${Math.abs(m.source2.amount).toFixed(2)} | ${m.source2.description}`)
      lines.push(`  → ${m.daysDiff} days apart`)
      lines.push('')
    }
  }

  // Unmatched from source 1
  if (unmatchedSource1.length > 0) {
    lines.push(`UNMATCHED: ${summary.source1Name} (${unmatchedSource1.length} transactions)`)
    lines.push('-'.repeat(60))
    const sorted = [...unmatchedSource1].sort((a, b) => a.date.localeCompare(b.date))
    for (const tx of sorted) {
      const sign = tx.amount >= 0 ? '+' : ''
      lines.push(`  ${tx.date} | ${sign}$${tx.amount.toFixed(2)} | ${tx.description} [${tx.sourceId}]`)
    }
    lines.push('')
  }

  // Unmatched from source 2
  if (unmatchedSource2.length > 0) {
    lines.push(`UNMATCHED: ${summary.source2Name} (${unmatchedSource2.length} transactions)`)
    lines.push('-'.repeat(60))
    const sorted = [...unmatchedSource2].sort((a, b) => a.date.localeCompare(b.date))
    for (const tx of sorted) {
      const sign = tx.amount >= 0 ? '+' : ''
      lines.push(`  ${tx.date} | ${sign}$${tx.amount.toFixed(2)} | ${tx.description} [${tx.sourceId}]`)
    }
    lines.push('')
  }

  // Balance check
  if (unmatchedSource1.length === 0 && unmatchedSource2.length === 0) {
    lines.push('✓ FULLY RECONCILED — all transactions matched')
  } else {
    const diff = Math.abs(summary.source1Total) - Math.abs(summary.source2Total)
    lines.push(`BALANCE DIFFERENCE: $${diff.toFixed(2)}`)
    lines.push('Review unmatched transactions above to resolve.')
  }

  lines.push('')
  lines.push('='.repeat(80))

  return lines.join('\n')
}

// ── Full Reconciliation Pipeline ──

export interface FullReconOptions {
  qboCsv: string
  bankCsvs?: Array<{ csv: string; accountLabel: string; options?: Parameters<typeof parseBankCsv>[1] }>
  rampCsv?: string
  cutoffDate?: string // only include transactions on or before this date
}

export interface FullReconResult {
  cashRecon?: ReconResult // QBO cash accounts ↔ Bank
  creditCardRecon?: ReconResult // QBO credit card ↔ Ramp
  reports: string[]
}

/**
 * Run full multi-source reconciliation.
 *
 * 1. QBO cash account transactions ↔ UMass Five bank transactions
 * 2. QBO credit card transactions ↔ Ramp transactions
 */
export function runFullReconciliation(options: FullReconOptions): FullReconResult {
  const { qboCsv, cutoffDate } = options
  const reports: string[] = []

  const filterByCutoff = (txs: ReconTransaction[]): ReconTransaction[] => {
    if (!cutoffDate) return txs
    return txs.filter((tx) => tx.date <= cutoffDate)
  }

  let cashRecon: ReconResult | undefined
  let creditCardRecon: ReconResult | undefined

  // 1. QBO cash ↔ Bank
  if (options.bankCsvs && options.bankCsvs.length > 0) {
    const qboCash = filterByCutoff(parseQboForRecon(qboCsv, 'cash'))

    // Combine all bank CSVs into one list
    const allBank: ReconTransaction[] = []
    for (const bankCsv of options.bankCsvs) {
      const parsed = parseBankCsv(bankCsv.csv, {
        ...bankCsv.options,
        accountLabel: bankCsv.accountLabel,
      })
      allBank.push(...filterByCutoff(parsed))
    }

    cashRecon = matchTransactions(qboCash, allBank, {
      source1Name: 'QBO Cash',
      source2Name: 'UMass Five Bank',
    })
    reports.push(formatReconReport(cashRecon))
  }

  // 2. QBO credit card ↔ Ramp
  if (options.rampCsv) {
    const qboCC = filterByCutoff(parseQboForRecon(qboCsv, 'credit-card'))
    const ramp = filterByCutoff(parseRampCsv(options.rampCsv))

    creditCardRecon = matchTransactions(qboCC, ramp, {
      source1Name: 'QBO Credit Card',
      source2Name: 'Ramp',
    })
    reports.push(formatReconReport(creditCardRecon))
  }

  return { cashRecon, creditCardRecon, reports }
}

// ── Utility Functions ──

function parseCurrencyValue(value: string | undefined | null): number {
  if (value == null || value.trim() === '') return 0
  const cleaned = value.replace(/[$,()]/g, '').trim()
  if (cleaned === '') return 0
  // Handle parentheses as negative: "(123.45)" → -123.45
  const isNegative = value.includes('(') && value.includes(')')
  const num = Number(cleaned)
  if (isNaN(num)) return 0
  return Math.round((isNegative ? -Math.abs(num) : num) * 100) / 100
}

/**
 * Convert various date formats to YYYY-MM-DD.
 * Supports: MM/DD/YYYY, YYYY-MM-DD, M/D/YYYY, MM-DD-YYYY
 */
function convertDateFormat(dateStr: string): string {
  const trimmed = dateStr.trim()

  // Already YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed

  // MM/DD/YYYY or M/D/YYYY
  const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (slashMatch) {
    const [, month, day, year] = slashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  // MM-DD-YYYY
  const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/)
  if (dashMatch) {
    const [, month, day, year] = dashMatch
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
  }

  throw new Error(`Unrecognized date format: "${dateStr}"`)
}

function findColumn(headers: string[], candidates: string[]): string | undefined {
  for (const candidate of candidates) {
    const found = headers.find((h) => h === candidate)
    if (found) return found
  }
  return undefined
}
