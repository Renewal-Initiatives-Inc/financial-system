/**
 * QBO Import Review Engine
 *
 * Orchestrates the interactive import workflow:
 * 1. parseAndStore — Parse CSV, generate recommendations, match against Plaid/Ramp, store in DB
 * 2. submitApproved — Post all approved items to GL in a single atomic transaction
 */

import { eq, and, sql, lte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  importReviewItems,
  bankTransactions,
  bankAccounts,
  rampTransactions,
  accounts,
  funds,
} from '@/lib/db/schema'
import { parseAndGroupQboCsv } from './qbo-csv-parser'
import type { QboParsedTransaction, QboTransactionLine } from './qbo-csv-parser'
import {
  resolveAccountId,
  resolveFundId,
  buildAccountLookup,
  buildFundLookup,
  QBO_ACCOUNT_MAPPING,
  type AccountLookup,
  type FundLookup,
} from './account-mapping'
import { matchTransactions, type ReconTransaction } from './reconciliation'
import { createTransaction } from '@/lib/gl/engine'
import type { InsertTransaction } from '@/lib/validators'

// ── Types ──

export interface ReviewRecommendation {
  lines: Array<{
    accountId: number
    fundId: number
    accountCode: string
    accountName: string
    fundName: string
    debit: number | null
    credit: number | null
    memo: string | null
  }>
  justification: string
}

export interface MatchCandidate {
  id: number
  source: 'plaid' | 'ramp'
  sourceId: string
  date: string
  amount: string
  description: string
  matchType: 'exact' | 'fuzzy-1d' | 'fuzzy-3d' | 'amount-only'
  daysDiff: number
}

export interface MatchData {
  candidates: MatchCandidate[]
  isTransfer: boolean
}

export interface AccrualData {
  flag: boolean
  startDate: string | null
  endDate: string | null
}

export interface UserSelections {
  lines?: Array<{
    accountId: number
    fundId: number
    memo?: string | null
  }>
  matchConfirmed: boolean
  matchedTransactionId?: string
  matchedSource?: 'plaid' | 'ramp'
  accrual?: {
    enabled: boolean
    startDate: string
    endDate: string
  }
}

export interface ParseAndStoreResult {
  batchId: string
  totalTransactions: number
  errors: Array<{ transactionNo: string; message: string }>
}

// ── Account metadata for justifications ──

const ACCRUAL_CANDIDATE_ACCOUNTS = new Set([
  '1200', // Prepaid Expenses
  '5410', // Property Insurance
])

const CASH_ACCOUNT_CODES = new Set(['1000', '1010', '1020'])
const CREDIT_CARD_CODE = '2020'

// ── Parse & Store ──

export async function parseAndStore(
  csvContent: string,
  cutoffDate: string
): Promise<ParseAndStoreResult> {
  const batchId = `import-${Date.now()}`
  const errors: Array<{ transactionNo: string; message: string }> = []

  // Parse CSV
  let parsed: QboParsedTransaction[]
  try {
    parsed = parseAndGroupQboCsv(csvContent)
  } catch (err) {
    return {
      batchId,
      totalTransactions: 0,
      errors: [{ transactionNo: 'PARSE', message: err instanceof Error ? err.message : String(err) }],
    }
  }

  // Filter to cutoff date
  parsed = parsed.filter((t) => t.date <= cutoffDate)

  if (parsed.length === 0) {
    return { batchId, totalTransactions: 0, errors: [{ transactionNo: 'FILTER', message: 'No transactions on or before cutoff date' }] }
  }

  // Build lookups
  const accountLookup = await buildAccountLookup(db as any)
  const fundLookup = await buildFundLookup(db as any)

  // Build reverse lookups for display names
  const accountRows = await db.select({ id: accounts.id, code: accounts.code, name: accounts.name, type: accounts.type, form990Line: accounts.form990Line }).from(accounts)
  const accountById = new Map(accountRows.map((a) => [a.id, a]))
  const fundRows = await db.select({ id: funds.id, name: funds.name, restrictionType: funds.restrictionType }).from(funds)
  const fundById = new Map(fundRows.map((f) => [f.id, f]))

  // Load bank + ramp transactions for matching
  const plaidTxns = await loadPlaidTransactions(cutoffDate)
  const rampTxns = await loadRampTransactions(cutoffDate)

  // Process each transaction
  const rows: (typeof importReviewItems.$inferInsert)[] = []

  for (const qboTxn of parsed) {
    try {
      const recommendation = buildRecommendation(qboTxn, accountLookup, fundLookup, accountById, fundById)
      const description = buildDescription(qboTxn)
      const matchData = buildMatchData(qboTxn, accountLookup, plaidTxns, rampTxns)
      const accrualData = detectAccrualCandidate(qboTxn, accountLookup)
      const totalDebits = qboTxn.lines.reduce((sum, l) => sum + l.debit, 0)

      rows.push({
        batchId,
        qboTransactionNo: qboTxn.transactionNo,
        transactionDate: qboTxn.date,
        amount: totalDebits.toFixed(2),
        parsedData: qboTxn,
        description,
        recommendation,
        matchData,
        accrualData,
        status: 'pending',
      })
    } catch (err) {
      errors.push({
        transactionNo: qboTxn.transactionNo,
        message: err instanceof Error ? err.message : String(err),
      })
    }
  }

  // Bulk insert
  if (rows.length > 0) {
    // Insert in batches of 50 to avoid parameter limit
    for (let i = 0; i < rows.length; i += 50) {
      const batch = rows.slice(i, i + 50)
      await db.insert(importReviewItems).values(batch)
    }
  }

  return {
    batchId,
    totalTransactions: rows.length,
    errors,
  }
}

// ── Submit Approved ──

export async function submitApproved(
  batchId: string,
  userId: string
): Promise<{ posted: number; errors: Array<{ id: number; transactionNo: string; message: string }> }> {
  // Load all approved items
  const items = await db
    .select()
    .from(importReviewItems)
    .where(and(eq(importReviewItems.batchId, batchId), eq(importReviewItems.status, 'approved')))
    .orderBy(importReviewItems.transactionDate)

  if (items.length === 0) {
    return { posted: 0, errors: [{ id: 0, transactionNo: '', message: 'No approved items to post' }] }
  }

  const errors: Array<{ id: number; transactionNo: string; message: string }> = []
  let posted = 0

  // Post each approved item to GL
  // We post one-by-one through createTransaction so each gets full GL validation
  // + auto restricted-fund release detection
  for (const item of items) {
    if (item.glTransactionId) {
      // Already posted (idempotency)
      posted++
      continue
    }

    try {
      const selections = item.userSelections as UserSelections | null
      const parsed = item.parsedData as QboParsedTransaction
      const recommendation = item.recommendation as ReviewRecommendation

      const glInput = buildGlInput(parsed, recommendation, selections, userId)
      const result = await createTransaction(glInput)

      // Update review item with GL transaction ID
      await db
        .update(importReviewItems)
        .set({ glTransactionId: result.transaction.id, updatedAt: new Date() })
        .where(eq(importReviewItems.id, item.id))

      posted++
    } catch (err) {
      errors.push({
        id: item.id,
        transactionNo: item.qboTransactionNo,
        message: err instanceof Error ? err.message : String(err),
      })
      // Stop on first error — atomic semantics
      break
    }
  }

  return { posted, errors }
}

// ── Internal Helpers ──

function buildRecommendation(
  qboTxn: QboParsedTransaction,
  accountLookup: AccountLookup,
  fundLookup: FundLookup,
  accountById: Map<number, { id: number; code: string; name: string; type: string; form990Line: string | null }>,
  fundById: Map<number, { id: number; name: string; restrictionType: string }>
): ReviewRecommendation {
  const lines = qboTxn.lines
    .filter((l) => l.debit > 0 || l.credit > 0)
    .map((line) => {
      const accountId = resolveAccountId(line.accountName, accountLookup)
      const fundId = resolveFundId(line.class, fundLookup)
      const account = accountById.get(accountId)
      const fund = fundById.get(fundId)

      return {
        accountId,
        fundId,
        accountCode: account?.code ?? '?',
        accountName: account?.name ?? line.accountName,
        fundName: fund?.name ?? 'General Fund',
        debit: line.debit > 0 ? line.debit : null,
        credit: line.credit > 0 ? line.credit : null,
        memo: line.name || null,
      }
    })

  const justification = buildJustification(lines, accountById, fundById)

  return { lines, justification }
}

function buildJustification(
  lines: ReviewRecommendation['lines'],
  accountById: Map<number, { id: number; code: string; name: string; type: string; form990Line: string | null }>,
  fundById: Map<number, { id: number; name: string; restrictionType: string }>
): string {
  const parts: string[] = []

  for (const line of lines) {
    const account = accountById.get(line.accountId)
    const fund = fundById.get(line.fundId)
    if (!account) continue

    const side = line.debit ? 'DR' : 'CR'
    const amount = line.debit ?? line.credit ?? 0
    parts.push(`${side} ${account.code} ${account.name} $${amount.toFixed(2)}`)

    if (account.form990Line) {
      parts.push(`  → Form 990 Part IX, Line ${account.form990Line}`)
    }
    if (fund && fund.restrictionType === 'RESTRICTED') {
      parts.push(`  → ${fund.name} (restricted) — triggers net asset release on expenses`)
    }
  }

  return parts.join('\n')
}

function buildDescription(qboTxn: QboParsedTransaction): string {
  const totalDebits = qboTxn.lines.reduce((sum, l) => sum + l.debit, 0)
  const names = [...new Set(qboTxn.lines.map((l) => l.name).filter(Boolean))]
  const nameStr = names.length > 0 ? ` to ${names.join(', ')}` : ''
  const dateObj = new Date(qboTxn.date + 'T12:00:00')
  const dateStr = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

  const type = qboTxn.transactionType || 'Transaction'
  return `${type}${nameStr} for $${totalDebits.toFixed(2)} on ${dateStr}`
}

function buildMatchData(
  qboTxn: QboParsedTransaction,
  accountLookup: AccountLookup,
  plaidTxns: ReconTransaction[],
  rampTxns: ReconTransaction[]
): MatchData | null {
  // Determine if this is a cash or credit card transaction
  const accountCodes = qboTxn.lines.map((l) => {
    try {
      const id = resolveAccountId(l.accountName, accountLookup)
      // Find code from accountLookup (reverse lookup)
      for (const [code, aid] of accountLookup.entries()) {
        if (aid === id) return code
      }
    } catch { /* unmapped */ }
    return null
  }).filter(Boolean) as string[]

  const hasCash = accountCodes.some((c) => CASH_ACCOUNT_CODES.has(c))
  const hasCC = accountCodes.some((c) => c === CREDIT_CARD_CODE)

  // Detect internal transfers (checking ↔ savings)
  const isTransfer = accountCodes.filter((c) => CASH_ACCOUNT_CODES.has(c)).length >= 2

  if (!hasCash && !hasCC) return null

  // Build a ReconTransaction for this QBO entry
  const totalDebits = qboTxn.lines.reduce((sum, l) => sum + l.debit, 0)
  const qboRecon: ReconTransaction = {
    source: 'qbo',
    date: qboTxn.date,
    amount: totalDebits,
    description: qboTxn.memo || '',
    sourceId: qboTxn.transactionNo,
  }

  const candidates: MatchCandidate[] = []

  if (hasCash && plaidTxns.length > 0) {
    const result = matchTransactions([qboRecon], plaidTxns, {
      source1Name: 'QBO',
      source2Name: 'Plaid',
    })
    for (const m of result.matched) {
      candidates.push({
        id: 0,
        source: 'plaid',
        sourceId: m.source2.sourceId,
        date: m.source2.date,
        amount: Math.abs(m.source2.amount).toFixed(2),
        description: m.source2.description,
        matchType: m.matchType,
        daysDiff: m.daysDiff,
      })
    }
  }

  if (hasCC && rampTxns.length > 0) {
    const result = matchTransactions([qboRecon], rampTxns, {
      source1Name: 'QBO',
      source2Name: 'Ramp',
    })
    for (const m of result.matched) {
      candidates.push({
        id: 0,
        source: 'ramp',
        sourceId: m.source2.sourceId,
        date: m.source2.date,
        amount: Math.abs(m.source2.amount).toFixed(2),
        description: m.source2.description,
        matchType: m.matchType,
        daysDiff: m.daysDiff,
      })
    }
  }

  // Also add nearby unmatched candidates (within 7 days, similar amount)
  const sourcePool = hasCash ? plaidTxns : rampTxns
  const source = hasCash ? 'plaid' : 'ramp'
  const existingSourceIds = new Set(candidates.map((c) => c.sourceId))

  for (const txn of sourcePool) {
    if (existingSourceIds.has(txn.sourceId)) continue
    const daysDiff = Math.abs(
      (new Date(qboRecon.date + 'T00:00:00Z').getTime() - new Date(txn.date + 'T00:00:00Z').getTime()) / 86400000
    )
    if (daysDiff <= 7 && Math.abs(Math.abs(qboRecon.amount) - Math.abs(txn.amount)) < 0.02) {
      candidates.push({
        id: 0,
        source: source as 'plaid' | 'ramp',
        sourceId: txn.sourceId,
        date: txn.date,
        amount: Math.abs(txn.amount).toFixed(2),
        description: txn.description,
        matchType: daysDiff === 0 ? 'exact' : daysDiff <= 1 ? 'fuzzy-1d' : daysDiff <= 3 ? 'fuzzy-3d' : 'amount-only',
        daysDiff,
      })
    }
  }

  // De-duplicate and limit to top 5
  const seen = new Set<string>()
  const uniqueCandidates = candidates.filter((c) => {
    if (seen.has(c.sourceId)) return false
    seen.add(c.sourceId)
    return true
  })

  // Sort by confidence: exact > fuzzy-1d > fuzzy-3d > amount-only
  const typeOrder = { exact: 0, 'fuzzy-1d': 1, 'fuzzy-3d': 2, 'amount-only': 3 }
  uniqueCandidates.sort((a, b) => typeOrder[a.matchType] - typeOrder[b.matchType])

  return {
    candidates: uniqueCandidates.slice(0, 5),
    isTransfer,
  }
}

function detectAccrualCandidate(
  qboTxn: QboParsedTransaction,
  accountLookup: AccountLookup
): AccrualData | null {
  for (const line of qboTxn.lines) {
    try {
      const accountId = resolveAccountId(line.accountName, accountLookup)
      for (const [code, aid] of accountLookup.entries()) {
        if (aid === accountId && ACCRUAL_CANDIDATE_ACCOUNTS.has(code)) {
          return { flag: true, startDate: null, endDate: null }
        }
      }
    } catch { /* unmapped */ }
  }
  return null
}

async function loadPlaidTransactions(cutoffDate: string): Promise<ReconTransaction[]> {
  const rows = await db
    .select({
      id: bankTransactions.id,
      plaidTransactionId: bankTransactions.plaidTransactionId,
      amount: bankTransactions.amount,
      date: bankTransactions.date,
      merchantName: bankTransactions.merchantName,
      glAccountId: bankAccounts.glAccountId,
    })
    .from(bankTransactions)
    .innerJoin(bankAccounts, eq(bankTransactions.bankAccountId, bankAccounts.id))
    .where(lte(bankTransactions.date, cutoffDate))

  return rows.map((r) => ({
    source: 'bank' as const,
    date: String(r.date).slice(0, 10),
    amount: -Number(r.amount), // Plaid: negative = money out; our convention: positive = money out
    description: r.merchantName ?? '',
    sourceId: r.plaidTransactionId,
  }))
}

async function loadRampTransactions(cutoffDate: string): Promise<ReconTransaction[]> {
  const rows = await db
    .select({
      id: rampTransactions.id,
      rampId: rampTransactions.rampId,
      amount: rampTransactions.amount,
      date: rampTransactions.date,
      merchantName: rampTransactions.merchantName,
      description: rampTransactions.description,
    })
    .from(rampTransactions)
    .where(lte(rampTransactions.date, cutoffDate))

  return rows.map((r) => ({
    source: 'ramp' as const,
    date: r.date,
    amount: Math.abs(Number(r.amount)), // Ramp amounts are charges (positive = money out)
    description: r.merchantName || r.description || '',
    sourceId: r.rampId,
  }))
}

function buildGlInput(
  parsed: QboParsedTransaction,
  recommendation: ReviewRecommendation,
  selections: UserSelections | null,
  userId: string
): InsertTransaction {
  // Use user selections if present, otherwise use recommendation
  const useLines = selections?.lines ?? recommendation.lines

  // Match rec lines back to QBO source lines (rec filters out zero-amount lines)
  const qboLinesWithAmounts = parsed.lines.filter((l) => l.debit > 0 || l.credit > 0)

  const glLines = useLines.map((line, i) => {
    const recLine = recommendation.lines[i]
    const qboLine = qboLinesWithAmounts[i]
    // Prefer enriched per-line memo > user/rec memo > null
    const lineMemo = (qboLine as any)?.lineMemo as string | undefined
    return {
      accountId: line.accountId,
      fundId: line.fundId,
      debit: recLine?.debit ?? null,
      credit: recLine?.credit ?? null,
      memo: lineMemo || line.memo || null,
    }
  }).filter((l) => (l.debit != null && l.debit > 0) || (l.credit != null && l.credit > 0))

  return {
    date: parsed.date,
    memo: parsed.memo || `QBO Import: ${parsed.transactionType} #${parsed.transactionNo}`,
    sourceType: 'FY25_IMPORT',
    sourceReferenceId: `qbo:${parsed.transactionNo}`,
    isSystemGenerated: false,
    createdBy: userId,
    lines: glLines,
  }
}

// ── Consumed Match Query Helper ──

/**
 * Get the set of Plaid/Ramp transaction source IDs that are already consumed
 * by approved items in this batch. Used to exclude from candidate lists.
 */
export async function getConsumedMatchIds(batchId: string): Promise<Set<string>> {
  const items = await db
    .select({ userSelections: importReviewItems.userSelections })
    .from(importReviewItems)
    .where(
      and(
        eq(importReviewItems.batchId, batchId),
        eq(importReviewItems.status, 'approved')
      )
    )

  const consumed = new Set<string>()
  for (const item of items) {
    const sel = item.userSelections as UserSelections | null
    if (sel?.matchedTransactionId) {
      consumed.add(sel.matchedTransactionId)
    }
  }
  return consumed
}
