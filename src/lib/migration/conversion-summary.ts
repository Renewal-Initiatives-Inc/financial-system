import { sql } from 'drizzle-orm'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { transactions, transactionLines, accounts, funds } from '@/lib/db/schema'
import type { ImportResult } from './import-engine'
import type { AdjustmentResult } from './accrual-adjustments'
import type { VerificationResult } from './verification'

export interface AccountBalanceSummary {
  code: string
  name: string
  type: string
  debitBalance: number
  creditBalance: number
  netBalance: number
}

export interface FundBalanceSummary {
  name: string
  restrictionType: string
  totalDebits: number
  totalCredits: number
  netActivity: number
}

export interface ConversionSummaryData {
  importStats: {
    totalTransactions: number
    totalDebits: number
    totalCredits: number
    dateRange: { earliest: string; latest: string }
  }
  accountBalances: AccountBalanceSummary[]
  fundBalances: FundBalanceSummary[]
  accrualAdjustments: Array<{
    name: string
    description: string
    amount: number
  }>
  verification: VerificationResult
}

/**
 * Query trial balance data from the database for FY25_IMPORT transactions.
 */
async function queryTrialBalance(
  db: NeonHttpDatabase<any>
): Promise<{ accounts: AccountBalanceSummary[]; funds: FundBalanceSummary[] }> {
  // Account-level balances
  const accountResult = await db.execute(sql`
    SELECT
      a.code,
      a.name,
      a.type,
      COALESCE(SUM(tl.debit::numeric), 0) as total_debits,
      COALESCE(SUM(tl.credit::numeric), 0) as total_credits,
      COALESCE(SUM(tl.debit::numeric), 0) - COALESCE(SUM(tl.credit::numeric), 0) as net_balance
    FROM ${transactionLines} tl
    JOIN ${transactions} t ON tl.transaction_id = t.id
    JOIN ${accounts} a ON tl.account_id = a.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
    GROUP BY a.id, a.code, a.name, a.type
    ORDER BY a.code
  `)

  const accountBalances = (accountResult.rows as any[]).map((r) => ({
    code: r.code as string,
    name: r.name as string,
    type: r.type as string,
    debitBalance: parseFloat(r.total_debits),
    creditBalance: parseFloat(r.total_credits),
    netBalance: parseFloat(r.net_balance),
  }))

  // Fund-level balances
  const fundResult = await db.execute(sql`
    SELECT
      f.name,
      f.restriction_type,
      COALESCE(SUM(tl.debit::numeric), 0) as total_debits,
      COALESCE(SUM(tl.credit::numeric), 0) as total_credits,
      COALESCE(SUM(tl.debit::numeric), 0) - COALESCE(SUM(tl.credit::numeric), 0) as net_activity
    FROM ${transactionLines} tl
    JOIN ${transactions} t ON tl.transaction_id = t.id
    JOIN ${funds} f ON tl.fund_id = f.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
    GROUP BY f.id, f.name, f.restriction_type
    ORDER BY f.name
  `)

  const fundBalances = (fundResult.rows as any[]).map((r) => ({
    name: r.name as string,
    restrictionType: r.restriction_type as string,
    totalDebits: parseFloat(r.total_debits),
    totalCredits: parseFloat(r.total_credits),
    netActivity: parseFloat(r.net_activity),
  }))

  return { accounts: accountBalances, funds: fundBalances }
}

/**
 * Query import statistics from the database.
 */
async function queryImportStats(
  db: NeonHttpDatabase<any>
): Promise<ConversionSummaryData['importStats']> {
  const result = await db.execute(sql`
    SELECT
      COUNT(DISTINCT t.id) as total_transactions,
      COALESCE(SUM(tl.debit::numeric), 0) as total_debits,
      COALESCE(SUM(tl.credit::numeric), 0) as total_credits,
      MIN(t.date) as earliest_date,
      MAX(t.date) as latest_date
    FROM ${transactions} t
    JOIN ${transactionLines} tl ON tl.transaction_id = t.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
  `)

  const row = result.rows[0] as any
  return {
    totalTransactions: parseInt(row.total_transactions, 10),
    totalDebits: parseFloat(row.total_debits),
    totalCredits: parseFloat(row.total_credits),
    dateRange: {
      earliest: row.earliest_date ?? 'N/A',
      latest: row.latest_date ?? 'N/A',
    },
  }
}

/**
 * Generate a complete conversion summary for review.
 */
export async function generateConversionSummary(
  db: NeonHttpDatabase<any>,
  adjustmentResult: AdjustmentResult,
  verificationResult: VerificationResult
): Promise<ConversionSummaryData> {
  const importStats = await queryImportStats(db)
  const { accounts: accountBalances, funds: fundBalances } = await queryTrialBalance(db)

  return {
    importStats,
    accountBalances,
    fundBalances,
    accrualAdjustments: adjustmentResult.adjustments.map((a) => ({
      name: a.name,
      description: a.description,
      amount: a.amount,
    })),
    verification: verificationResult,
  }
}

/**
 * Format the summary as human-readable text for console output.
 */
export function formatConversionSummary(data: ConversionSummaryData): string {
  const lines: string[] = []

  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('          FY25 DATA CONVERSION — SUMMARY REPORT              ')
  lines.push('═══════════════════════════════════════════════════════════════')
  lines.push('')

  // Import Statistics
  lines.push('── Import Statistics ──')
  lines.push(`  Transactions:  ${data.importStats.totalTransactions}`)
  lines.push(`  Total Debits:  $${data.importStats.totalDebits.toFixed(2)}`)
  lines.push(`  Total Credits: $${data.importStats.totalCredits.toFixed(2)}`)
  lines.push(`  Date Range:    ${data.importStats.dateRange.earliest} → ${data.importStats.dateRange.latest}`)
  lines.push('')

  // Account Balance Summary
  lines.push('── Account Balance Summary ──')
  const typeOrder = ['ASSET', 'LIABILITY', 'NET_ASSET', 'REVENUE', 'EXPENSE']
  for (const type of typeOrder) {
    const typeAccounts = data.accountBalances.filter((a) => a.type === type)
    if (typeAccounts.length === 0) continue

    const typeLabel = type.replace('_', ' ')
    lines.push(`  ${typeLabel}:`)
    for (const acct of typeAccounts) {
      const balance = acct.netBalance >= 0
        ? `$${acct.netBalance.toFixed(2)} DR`
        : `$${Math.abs(acct.netBalance).toFixed(2)} CR`
      lines.push(`    ${acct.code} ${acct.name.padEnd(40)} ${balance}`)
    }
    lines.push('')
  }

  // Fund Balance Summary
  lines.push('── Fund Balance Summary ──')
  for (const fund of data.fundBalances) {
    const net = fund.netActivity >= 0
      ? `$${fund.netActivity.toFixed(2)} DR`
      : `$${Math.abs(fund.netActivity).toFixed(2)} CR`
    lines.push(`  ${fund.name.padEnd(25)} ${fund.restrictionType.padEnd(14)} Debits: $${fund.totalDebits.toFixed(2)}  Credits: $${fund.totalCredits.toFixed(2)}  Net: ${net}`)
  }
  lines.push('')

  // Accrual Adjustments
  if (data.accrualAdjustments.length > 0) {
    lines.push('── Accrual Adjustments ──')
    for (const adj of data.accrualAdjustments) {
      lines.push(`  ${adj.name}: $${adj.amount.toFixed(2)}`)
      lines.push(`    ${adj.description}`)
    }
    lines.push('')
  }

  // Verification Checks
  lines.push('── Verification Checks ──')
  for (const check of data.verification.checks) {
    const icon = check.passed ? '[PASS]' : '[FAIL]'
    lines.push(`  ${icon} ${check.name}: ${check.message}`)
  }
  lines.push('')

  const overallStatus = data.verification.passed ? 'ALL CHECKS PASSED' : 'SOME CHECKS FAILED'
  lines.push(`  Overall: ${overallStatus}`)
  lines.push('')
  lines.push('═══════════════════════════════════════════════════════════════')

  return lines.join('\n')
}

/**
 * Export summary as JSON for programmatic verification.
 */
export function toJson(data: ConversionSummaryData): string {
  return JSON.stringify(data, null, 2)
}
