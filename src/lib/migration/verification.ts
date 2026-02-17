import { sql } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { transactions, transactionLines, accounts, funds } from '@/lib/db/schema'

export interface VerificationCheck {
  name: string
  passed: boolean
  expected: string
  actual: string
  message: string
}

export interface VerificationResult {
  passed: boolean
  checks: VerificationCheck[]
}

/**
 * Verify total debits = total credits across all FY25_IMPORT transactions.
 */
export async function verifyTotalBalance(
  db: NeonDatabase<any>
): Promise<VerificationCheck> {
  const result = await db.execute(sql`
    SELECT
      COALESCE(SUM(tl.debit::numeric), 0) as total_debits,
      COALESCE(SUM(tl.credit::numeric), 0) as total_credits
    FROM ${transactionLines} tl
    JOIN ${transactions} t ON tl.transaction_id = t.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
  `)

  const row = result.rows[0] as { total_debits: string; total_credits: string }
  const totalDebits = parseFloat(row.total_debits)
  const totalCredits = parseFloat(row.total_credits)
  const balanced = Math.abs(totalDebits - totalCredits) < 0.01

  return {
    name: 'Total Balance',
    passed: balanced,
    expected: 'Total debits = Total credits',
    actual: `Debits: $${totalDebits.toFixed(2)}, Credits: $${totalCredits.toFixed(2)}`,
    message: balanced
      ? `Balanced at $${totalDebits.toFixed(2)}`
      : `IMBALANCE: difference of $${Math.abs(totalDebits - totalCredits).toFixed(2)}`,
  }
}

/**
 * Verify per-fund balance: Sum(debits) = Sum(credits) for each fund (INV-010).
 */
export async function verifyFundBalance(
  db: NeonDatabase<any>
): Promise<VerificationCheck> {
  const result = await db.execute(sql`
    SELECT
      f.name as fund_name,
      COALESCE(SUM(tl.debit::numeric), 0) as total_debits,
      COALESCE(SUM(tl.credit::numeric), 0) as total_credits,
      ABS(COALESCE(SUM(tl.debit::numeric), 0) - COALESCE(SUM(tl.credit::numeric), 0)) as difference
    FROM ${transactionLines} tl
    JOIN ${transactions} t ON tl.transaction_id = t.id
    JOIN ${funds} f ON tl.fund_id = f.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
    GROUP BY f.id, f.name
    HAVING ABS(COALESCE(SUM(tl.debit::numeric), 0) - COALESCE(SUM(tl.credit::numeric), 0)) >= 0.01
  `)

  const imbalancedFunds = result.rows as Array<{
    fund_name: string
    total_debits: string
    total_credits: string
    difference: string
  }>

  const passed = imbalancedFunds.length === 0

  return {
    name: 'Fund-Level Balance (INV-010)',
    passed,
    expected: 'All funds balanced (debits = credits per fund)',
    actual: passed
      ? 'All funds balanced'
      : `${imbalancedFunds.length} fund(s) imbalanced: ${imbalancedFunds.map((f) => `${f.fund_name} ($${parseFloat(f.difference).toFixed(2)} off)`).join(', ')}`,
    message: passed
      ? 'All funds pass INV-010'
      : `Imbalanced funds: ${imbalancedFunds.map((f) => f.fund_name).join(', ')}`,
  }
}

/**
 * Verify account balances match expected QBO ending balances.
 */
export async function verifyAccountBalances(
  db: NeonDatabase<any>,
  expectedBalances: Record<string, number> // account code → expected balance (positive = debit, negative = credit)
): Promise<VerificationCheck> {
  const result = await db.execute(sql`
    SELECT
      a.code as account_code,
      a.name as account_name,
      COALESCE(SUM(tl.debit::numeric), 0) - COALESCE(SUM(tl.credit::numeric), 0) as net_balance
    FROM ${transactionLines} tl
    JOIN ${transactions} t ON tl.transaction_id = t.id
    JOIN ${accounts} a ON tl.account_id = a.id
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
    GROUP BY a.id, a.code, a.name
    ORDER BY a.code
  `)

  const rows = result.rows as Array<{
    account_code: string
    account_name: string
    net_balance: string
  }>

  const mismatches: string[] = []

  for (const [code, expected] of Object.entries(expectedBalances)) {
    const row = rows.find((r) => r.account_code === code)
    const actual = row ? parseFloat(row.net_balance) : 0

    if (Math.abs(actual - expected) >= 0.01) {
      mismatches.push(
        `${code}: expected $${expected.toFixed(2)}, got $${actual.toFixed(2)}`
      )
    }
  }

  return {
    name: 'Account Balance Verification',
    passed: mismatches.length === 0,
    expected: `${Object.keys(expectedBalances).length} accounts match expected balances`,
    actual: mismatches.length === 0
      ? 'All accounts match'
      : `${mismatches.length} mismatch(es)`,
    message: mismatches.length === 0
      ? 'All account balances verified'
      : `Mismatches: ${mismatches.join('; ')}`,
  }
}

/**
 * Verify count of imported transactions matches expected.
 */
export async function verifyTransactionCount(
  db: NeonDatabase<any>,
  expectedCount: number
): Promise<VerificationCheck> {
  const result = await db.execute(sql`
    SELECT COUNT(*) as count
    FROM ${transactions}
    WHERE source_type = 'FY25_IMPORT'
      AND is_voided = false
  `)

  const actual = parseInt((result.rows[0] as { count: string }).count, 10)

  return {
    name: 'Transaction Count',
    passed: actual === expectedCount,
    expected: `${expectedCount} transactions`,
    actual: `${actual} transactions`,
    message: actual === expectedCount
      ? `Correct: ${actual} transactions imported`
      : `Count mismatch: expected ${expectedCount}, found ${actual}`,
  }
}

/**
 * Verify every imported transaction has a corresponding audit log entry.
 */
export async function verifyAuditTrail(
  db: NeonDatabase<any>
): Promise<VerificationCheck> {
  const result = await db.execute(sql`
    SELECT t.id
    FROM ${transactions} t
    LEFT JOIN audit_log al ON al.entity_type = 'transaction'
      AND al.entity_id = t.id
      AND al.action = 'created'
    WHERE t.source_type = 'FY25_IMPORT'
      AND t.is_voided = false
      AND al.id IS NULL
  `)

  const missingAudit = result.rows as Array<{ id: number }>
  const passed = missingAudit.length === 0

  return {
    name: 'Audit Trail Completeness',
    passed,
    expected: 'Every FY25_IMPORT transaction has an audit log entry',
    actual: passed
      ? 'All transactions have audit entries'
      : `${missingAudit.length} transaction(s) missing audit entries`,
    message: passed
      ? 'Audit trail complete'
      : `Missing audit entries for transaction IDs: ${missingAudit.map((r) => r.id).join(', ')}`,
  }
}

/**
 * Verify that every expense to a restricted fund has a paired net asset release.
 */
export async function verifyRestrictedFundReleases(
  db: NeonDatabase<any>
): Promise<VerificationCheck> {
  // Find FY25_IMPORT expense lines against restricted funds
  // that don't have a matching SYSTEM release transaction
  const result = await db.execute(sql`
    WITH restricted_expenses AS (
      SELECT t.id as txn_id, t.date, tl.fund_id, f.name as fund_name,
             COALESCE(tl.debit::numeric, 0) as amount
      FROM ${transactionLines} tl
      JOIN ${transactions} t ON tl.transaction_id = t.id
      JOIN ${accounts} a ON tl.account_id = a.id
      JOIN ${funds} f ON tl.fund_id = f.id
      WHERE t.source_type = 'FY25_IMPORT'
        AND t.is_voided = false
        AND a.type = 'EXPENSE'
        AND f.restriction_type = 'RESTRICTED'
        AND tl.debit IS NOT NULL
    ),
    releases AS (
      SELECT t.source_reference_id
      FROM ${transactions} t
      WHERE t.source_type = 'SYSTEM'
        AND t.is_system_generated = true
        AND t.source_reference_id LIKE 'release-for:%'
        AND t.is_voided = false
    )
    SELECT re.txn_id, re.fund_name, re.amount
    FROM restricted_expenses re
    LEFT JOIN releases r ON r.source_reference_id = 'release-for:' || re.txn_id::text
    WHERE r.source_reference_id IS NULL
  `)

  const unreleased = result.rows as Array<{
    txn_id: number
    fund_name: string
    amount: string
  }>

  const passed = unreleased.length === 0

  return {
    name: 'Restricted Fund Releases',
    passed,
    expected: 'Every restricted fund expense has a paired net asset release',
    actual: passed
      ? 'All restricted expenses have releases'
      : `${unreleased.length} expense(s) missing releases`,
    message: passed
      ? 'All restricted fund releases verified'
      : `Missing releases for: ${unreleased.map((r) => `Txn #${r.txn_id} (${r.fund_name}, $${parseFloat(r.amount).toFixed(2)})`).join('; ')}`,
  }
}

/**
 * Run all verification checks and return a combined result.
 */
export async function runAllVerifications(
  db: NeonDatabase<any>,
  options: {
    expectedTransactionCount?: number
    expectedBalances?: Record<string, number>
  } = {}
): Promise<VerificationResult> {
  const checks: VerificationCheck[] = []

  checks.push(await verifyTotalBalance(db))
  checks.push(await verifyFundBalance(db))

  if (options.expectedTransactionCount != null) {
    checks.push(await verifyTransactionCount(db, options.expectedTransactionCount))
  }

  if (options.expectedBalances) {
    checks.push(await verifyAccountBalances(db, options.expectedBalances))
  }

  checks.push(await verifyAuditTrail(db))
  checks.push(await verifyRestrictedFundReleases(db))

  return {
    passed: checks.every((c) => c.passed),
    checks,
  }
}
