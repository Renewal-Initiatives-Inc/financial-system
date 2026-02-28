/**
 * One-time enrichment: Cross-walk per-line descriptions from
 * "Transaction List by Date" CSV into import_review_items.
 *
 * The Journal.csv only has a single memo per transaction. The Transaction List
 * has per-line descriptions (e.g., "Domain name purchase", "IRS 501c3 application").
 * This script matches lines by date + amount + account name and writes the
 * per-line memo into each review item's parsedData.lines[].memo field.
 *
 * Usage: DATABASE_URL="..." npx tsx src/lib/migration/enrich-line-memos.ts
 */

import { readFileSync } from 'fs'
import Papa from 'papaparse'
import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { importReviewItems } from '@/lib/db/schema'
import { stripQboMetadataRows, convertDate } from './qbo-csv-parser'
import type { QboParsedTransaction } from './qbo-csv-parser'

const TXN_LIST_PATH = './docs/qbo-export-20251231/Renewal Initiatives_Transaction List by Date.csv'

interface TxnListRow {
  date: string       // YYYY-MM-DD
  memo: string       // per-line description
  accountName: string // payment account (e.g., "Employee Reimbursements Payable")
  accountFull: string // expense category (e.g., "6500 Technology/Software")
  amount: number     // absolute value
}

/** Strip leading account number from "6500 Technology/Software" → "Technology/Software" */
function stripAccountNumber(name: string): string {
  return name.replace(/^\d+\s+/, '').trim()
}

function parseTxnList(): TxnListRow[] {
  const raw = readFileSync(TXN_LIST_PATH, 'utf-8')
  const cleaned = stripQboMetadataRows(raw)

  const result = Papa.parse<Record<string, string>>(cleaned, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
  })

  const rows: TxnListRow[] = []

  for (const row of result.data) {
    const dateRaw = row['Date']?.trim()
    if (!dateRaw || dateRaw === 'TOTAL') continue

    let date: string
    try {
      date = convertDate(dateRaw)
    } catch {
      continue // skip non-date rows (totals, footers)
    }

    const amountStr = (row['Amount'] ?? '').replace(/[$,]/g, '').trim()
    if (!amountStr) continue
    const amount = Math.abs(parseFloat(amountStr))
    if (isNaN(amount) || amount === 0) continue

    rows.push({
      date,
      memo: (row['Memo/Description'] ?? '').trim(),
      accountName: (row['Account name'] ?? '').trim(),
      accountFull: (row['Account full name'] ?? '').trim(),
      amount: Math.round(amount * 100) / 100,
    })
  }

  return rows
}

/** Days between two YYYY-MM-DD dates */
function daysBetween(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00')
  const db = new Date(b + 'T00:00:00')
  return Math.abs(da.getTime() - db.getTime()) / (24 * 60 * 60 * 1000)
}

/** Known payment-side accounts that don't appear in Transaction List's accountFull */
const PAYMENT_ACCOUNTS = new Set([
  'employee reimbursements payable',
  'undeposited funds',
  'umass five checking (0180)',
  'umass five savings (0172)',
  'accounts payable',
])

function isPaymentSideAccount(accountName: string): boolean {
  return PAYMENT_ACCOUNTS.has(stripAccountNumber(accountName).toLowerCase())
}

function findLineMemo(
  txnListRows: TxnListRow[],
  consumed: Set<number>,
  date: string,
  amount: number,
  qboAccountName: string
): { memo: string; index: number } | null {
  const normalizedAccount = stripAccountNumber(qboAccountName).toLowerCase()
  const absAmount = Math.round(Math.abs(amount) * 100) / 100

  // Only match against accountFull (expense category), not accountName (payment side).
  // This prevents the CR payment line from consuming the row before the DR expense line.
  for (let i = 0; i < txnListRows.length; i++) {
    if (consumed.has(i)) continue
    const row = txnListRows[i]

    // Allow ±14 day tolerance — Journal often groups under a different date
    if (daysBetween(row.date, date) > 14) continue
    if (Math.abs(row.amount - absAmount) > 0.01) continue

    const fullMatch = stripAccountNumber(row.accountFull).toLowerCase() === normalizedAccount
    if (!fullMatch) continue

    return { memo: row.memo, index: i }
  }

  return null
}

async function main() {
  console.log('Parsing Transaction List by Date CSV...')
  const txnListRows = parseTxnList()
  console.log(`  Found ${txnListRows.length} line items`)

  console.log('Loading review items from DB...')
  const items = await db
    .select()
    .from(importReviewItems)
    .orderBy(importReviewItems.id)

  console.log(`  Found ${items.length} review items`)

  const consumed = new Set<number>()
  let enriched = 0
  let linesEnriched = 0
  let linesMissed = 0

  for (const item of items) {
    const parsed = item.parsedData as QboParsedTransaction
    let anyChanged = false

    // Pass 1: Match expense-side lines (DR to expense accounts) against Transaction List
    for (const line of parsed.lines) {
      const amount = line.debit > 0 ? line.debit : line.credit
      if (amount === 0) continue
      if (isPaymentSideAccount(line.accountName)) continue // skip payment lines in pass 1

      const match = findLineMemo(txnListRows, consumed, parsed.date, amount, line.accountName)
      if (match) {
        ;(line as any).lineMemo = match.memo
        consumed.add(match.index)
        anyChanged = true
        linesEnriched++
      }
    }

    // Pass 2: Payment-side lines (CR to payment accounts) inherit memo from
    // their paired expense line in the same transaction
    for (const line of parsed.lines) {
      if ('lineMemo' in (line as any)) continue // already matched (even if memo is "")
      const amount = line.debit > 0 ? line.debit : line.credit
      if (amount === 0) continue

      if (isPaymentSideAccount(line.accountName)) {
        // Find the expense-side line in this transaction with the same amount
        const pairedExpenseLine = parsed.lines.find(
          (other) =>
            other !== line &&
            'lineMemo' in (other as any) &&
            Math.abs((other.debit > 0 ? other.debit : other.credit) - amount) < 0.01
        )
        if (pairedExpenseLine) {
          ;(line as any).lineMemo = (pairedExpenseLine as any).lineMemo
          anyChanged = true
          linesEnriched++
        } else {
          // Multi-line transaction: inherit from first matched line
          const anyMatchedLine = parsed.lines.find((l) => 'lineMemo' in (l as any))
          if (anyMatchedLine) {
            ;(line as any).lineMemo = (anyMatchedLine as any).lineMemo
            anyChanged = true
            linesEnriched++
          } else {
            linesMissed++
          }
        }
      } else {
        linesMissed++
      }
    }

    if (anyChanged) {
      await db
        .update(importReviewItems)
        .set({ parsedData: parsed, updatedAt: new Date() })
        .where(eq(importReviewItems.id, item.id))
      enriched++
    }
  }

  console.log(`\nResults:`)
  console.log(`  Review items updated: ${enriched} / ${items.length}`)
  console.log(`  Lines enriched with memo: ${linesEnriched}`)
  console.log(`  Lines with no match: ${linesMissed}`)
  console.log(`  Transaction List rows consumed: ${consumed.size} / ${txnListRows.length}`)

  // Show unmatched lines for debugging
  if (linesMissed > 0) {
    console.log(`\nUnmatched lines:`)
    for (const item of items) {
      const parsed = item.parsedData as QboParsedTransaction
      for (const line of parsed.lines) {
        if (!('lineMemo' in (line as any)) && (line.debit > 0 || line.credit > 0)) {
          const amt = line.debit > 0 ? line.debit : line.credit
          console.log(`  ${parsed.date} | $${amt.toFixed(2)} | ${line.accountName}`)
        }
      }
    }
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
