/**
 * Cross-Neon Connectivity Verification Script
 *
 * Tests all three cross-database connections:
 * 1. financial-system reads employee data from app-portal (PEOPLE_DATABASE_URL)
 * 2. timesheets_role can INSERT into staging_records
 * 3. expense_reports_role can INSERT into staging_records
 * 4. Staging processor can convert records to GL entries
 *
 * Usage:
 *   DATABASE_URL=<prod> npx tsx scripts/verify-cross-db.ts
 *
 * Optional env vars:
 *   PEOPLE_DATABASE_URL — app-portal connection (skipped if not set)
 *   TIMESHEETS_DATABASE_URL — timesheets role connection (skipped if not set)
 *   EXPENSE_REPORTS_DATABASE_URL — expense_reports role connection (skipped if not set)
 *
 * Pass --cleanup to remove test records after verification.
 */

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'

const TEST_PREFIX = 'VERIFY-CROSS-DB'
const cleanup = process.argv.includes('--cleanup')

interface TestResult {
  test: string
  status: 'PASS' | 'FAIL' | 'SKIP'
  detail: string
}

const results: TestResult[] = []

function log(label: string, status: 'PASS' | 'FAIL' | 'SKIP', detail: string) {
  const icon = status === 'PASS' ? '\u2705' : status === 'FAIL' ? '\u274c' : '\u23ed\ufe0f'
  console.log(`${icon}  ${label}: ${detail}`)
  results.push({ test: label, status, detail })
}

// --- Test 1: Read employee data from app-portal ---

async function testAppPortalRead() {
  const label = '11a: Read employees from app-portal'

  if (!process.env.PEOPLE_DATABASE_URL) {
    log(label, 'SKIP', 'PEOPLE_DATABASE_URL not set')
    return
  }

  try {
    const peopleSql = neon(process.env.PEOPLE_DATABASE_URL)
    const peopleDb = drizzle(peopleSql)

    const rows = await peopleDb.execute(
      sql`SELECT id, name, email FROM employees WHERE is_active = true LIMIT 5`
    )

    if (rows.rows.length === 0) {
      log(label, 'FAIL', 'Query succeeded but returned 0 active employees')
      return
    }

    const names = rows.rows.map((r: Record<string, unknown>) => r.name).join(', ')
    log(label, 'PASS', `Found ${rows.rows.length} active employee(s): ${names}`)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(label, 'FAIL', msg)
  }
}

// --- Test 2: timesheets_role can INSERT + SELECT ---

async function testTimesheetsRole() {
  const label = '11b: timesheets_role INSERT + SELECT'

  if (!process.env.TIMESHEETS_DATABASE_URL) {
    log(label, 'SKIP', 'TIMESHEETS_DATABASE_URL not set')
    return
  }

  try {
    const tsSql = neon(process.env.TIMESHEETS_DATABASE_URL)
    const tsDb = drizzle(tsSql)

    // Test SELECT on reference tables
    const fundsResult = await tsDb.execute(sql`SELECT count(*) as cnt FROM funds`)
    const fundCount = (fundsResult.rows[0] as Record<string, unknown>).cnt
    console.log(`   -> funds table: ${fundCount} rows`)

    const accountsResult = await tsDb.execute(sql`SELECT count(*) as cnt FROM accounts`)
    const accountCount = (accountsResult.rows[0] as Record<string, unknown>).cnt
    console.log(`   -> accounts table: ${accountCount} rows`)

    // Test INSERT
    const sourceRecordId = `${TEST_PREFIX}-TS-${Date.now()}`
    await tsDb.execute(
      sql`INSERT INTO staging_records (
        source_app, source_record_id, record_type,
        employee_id, reference_id, date_incurred,
        amount, fund_id, gl_account_id, metadata
      ) VALUES (
        'timesheets', ${sourceRecordId}, 'timesheet_fund_summary',
        'emp-001', ${TEST_PREFIX}, '2026-02-16',
        '100.00', 1, NULL,
        '{"regularHours": 2.5, "overtimeHours": 0, "regularEarnings": 100.00, "overtimeEarnings": 0}'::jsonb
      )`
    )

    // Test SELECT on own records
    const readBack = await tsDb.execute(
      sql`SELECT id, status FROM staging_records WHERE source_record_id = ${sourceRecordId}`
    )

    if (readBack.rows.length === 1) {
      log(label, 'PASS', `INSERT + SELECT verified (record ID: ${sourceRecordId})`)
    } else {
      log(label, 'FAIL', 'INSERT succeeded but SELECT returned unexpected results')
    }

    // Test that UPDATE is denied
    try {
      await tsDb.execute(
        sql`UPDATE staging_records SET status = 'posted' WHERE source_record_id = ${sourceRecordId}`
      )
      log('11b: timesheets_role UPDATE denied', 'FAIL', 'UPDATE succeeded — role has too many permissions!')
    } catch {
      log('11b: timesheets_role UPDATE denied', 'PASS', 'UPDATE correctly denied')
    }

    // Test that DELETE is denied
    try {
      await tsDb.execute(
        sql`DELETE FROM staging_records WHERE source_record_id = ${sourceRecordId}`
      )
      log('11b: timesheets_role DELETE denied', 'FAIL', 'DELETE succeeded — role has too many permissions!')
    } catch {
      log('11b: timesheets_role DELETE denied', 'PASS', 'DELETE correctly denied')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(label, 'FAIL', msg)
  }
}

// --- Test 3: expense_reports_role can INSERT + SELECT ---

async function testExpenseReportsRole() {
  const label = '11c: expense_reports_role INSERT + SELECT'

  if (!process.env.EXPENSE_REPORTS_DATABASE_URL) {
    log(label, 'SKIP', 'EXPENSE_REPORTS_DATABASE_URL not set')
    return
  }

  try {
    const erSql = neon(process.env.EXPENSE_REPORTS_DATABASE_URL)
    const erDb = drizzle(erSql)

    // Test SELECT on reference tables
    const fundsResult = await erDb.execute(sql`SELECT count(*) as cnt FROM funds`)
    const fundCount = (fundsResult.rows[0] as Record<string, unknown>).cnt
    console.log(`   -> funds table: ${fundCount} rows`)

    // Get a valid expense account for the test INSERT
    const expAcct = await erDb.execute(
      sql`SELECT id FROM accounts WHERE type = 'EXPENSE' AND is_active = true LIMIT 1`
    )
    const expenseAccountId = expAcct.rows.length > 0
      ? (expAcct.rows[0] as Record<string, unknown>).id as number
      : null

    if (!expenseAccountId) {
      log(label, 'FAIL', 'No active expense account found for test INSERT')
      return
    }

    // Test INSERT
    const sourceRecordId = `${TEST_PREFIX}-ER-${Date.now()}`
    await erDb.execute(
      sql`INSERT INTO staging_records (
        source_app, source_record_id, record_type,
        employee_id, reference_id, date_incurred,
        amount, fund_id, gl_account_id, metadata
      ) VALUES (
        'expense_reports', ${sourceRecordId}, 'expense_line_item',
        'emp-001', ${TEST_PREFIX}, '2026-02-16',
        '50.00', 1, ${expenseAccountId},
        '{"merchant": "Test Merchant", "memo": "Connectivity verification", "expenseType": "out_of_pocket"}'::jsonb
      )`
    )

    // Test SELECT on own records
    const readBack = await erDb.execute(
      sql`SELECT id, status FROM staging_records WHERE source_record_id = ${sourceRecordId}`
    )

    if (readBack.rows.length === 1) {
      log(label, 'PASS', `INSERT + SELECT verified (record ID: ${sourceRecordId})`)
    } else {
      log(label, 'FAIL', 'INSERT succeeded but SELECT returned unexpected results')
    }

    // Test that UPDATE is denied
    try {
      await erDb.execute(
        sql`UPDATE staging_records SET status = 'posted' WHERE source_record_id = ${sourceRecordId}`
      )
      log('11c: expense_reports_role UPDATE denied', 'FAIL', 'UPDATE succeeded — role has too many permissions!')
    } catch {
      log('11c: expense_reports_role UPDATE denied', 'PASS', 'UPDATE correctly denied')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(label, 'FAIL', msg)
  }
}

// --- Test 4: Staging processor picks up test records ---

async function testStagingProcessor() {
  const label = '11d: Staging processor processes records'

  if (!process.env.DATABASE_URL) {
    log(label, 'FAIL', 'DATABASE_URL not set')
    return
  }

  try {
    const mainSql = neon(process.env.DATABASE_URL)
    const mainDb = drizzle(mainSql)

    // Check for any test records from the above tests
    const testRecords = await mainDb.execute(
      sql`SELECT id, source_app, record_type, status, gl_transaction_id
          FROM staging_records
          WHERE reference_id = ${TEST_PREFIX}
          ORDER BY created_at`
    )

    if (testRecords.rows.length === 0) {
      log(label, 'SKIP', 'No test staging records found (run with TIMESHEETS_DATABASE_URL or EXPENSE_REPORTS_DATABASE_URL first)')
      return
    }

    console.log(`   -> Found ${testRecords.rows.length} test staging record(s):`)
    for (const row of testRecords.rows) {
      const r = row as Record<string, unknown>
      console.log(`      ${r.source_app} | ${r.record_type} | status=${r.status} | gl_txn=${r.gl_transaction_id ?? 'null'}`)
    }

    // Check if any expense_line_item records were posted by the processor
    const posted = testRecords.rows.filter(
      (r: Record<string, unknown>) => r.status === 'posted' && r.gl_transaction_id !== null
    )
    const expenseRecords = testRecords.rows.filter(
      (r: Record<string, unknown>) => r.record_type === 'expense_line_item'
    )
    const tsRecords = testRecords.rows.filter(
      (r: Record<string, unknown>) => r.record_type === 'timesheet_fund_summary'
    )

    if (expenseRecords.length > 0 && posted.length > 0) {
      log(label, 'PASS', `${posted.length} expense record(s) posted to GL`)
    } else if (expenseRecords.length > 0) {
      log(label, 'SKIP', `${expenseRecords.length} expense record(s) still in 'received' — trigger the staging processor cron, then re-run this script`)
    } else if (tsRecords.length > 0) {
      log(label, 'PASS', `${tsRecords.length} timesheet record(s) correctly held in 'received' (awaiting payroll)`)
    } else {
      log(label, 'SKIP', 'No processable test records found')
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    log(label, 'FAIL', msg)
  }
}

// --- Cleanup ---

async function cleanupTestRecords() {
  if (!process.env.DATABASE_URL) return

  try {
    const mainSql = neon(process.env.DATABASE_URL)
    const mainDb = drizzle(mainSql)

    // Delete test staging records (must use main DB role, not restricted roles)
    const deleted = await mainDb.execute(
      sql`DELETE FROM staging_records WHERE reference_id = ${TEST_PREFIX} RETURNING id`
    )
    console.log(`\n\ud83e\uddf9  Cleaned up ${deleted.rows.length} test staging record(s)`)

    // Note: GL transactions created by the processor are NOT cleaned up
    // to avoid orphaning audit log entries. Void them manually if needed.
    if (deleted.rows.length > 0) {
      console.log('   Note: Any GL entries created from test records should be voided manually.')
    }
  } catch (err) {
    console.error('Cleanup failed:', err instanceof Error ? err.message : String(err))
  }
}

// --- Main ---

async function main() {
  console.log('=== Cross-Neon Connectivity Verification ===\n')
  console.log(`Database: ${process.env.DATABASE_URL ? 'set' : 'NOT SET'}`)
  console.log(`People DB: ${process.env.PEOPLE_DATABASE_URL ? 'set' : 'not set (will skip 11a)'}`)
  console.log(`Timesheets DB: ${process.env.TIMESHEETS_DATABASE_URL ? 'set' : 'not set (will skip 11b)'}`)
  console.log(`Expense Reports DB: ${process.env.EXPENSE_REPORTS_DATABASE_URL ? 'set' : 'not set (will skip 11c)'}`)
  console.log()

  await testAppPortalRead()
  await testTimesheetsRole()
  await testExpenseReportsRole()
  await testStagingProcessor()

  if (cleanup) {
    await cleanupTestRecords()
  }

  // Summary
  console.log('\n=== Summary ===')
  const passed = results.filter((r) => r.status === 'PASS').length
  const failed = results.filter((r) => r.status === 'FAIL').length
  const skipped = results.filter((r) => r.status === 'SKIP').length
  console.log(`  ${passed} passed, ${failed} failed, ${skipped} skipped`)

  if (failed > 0) {
    console.log('\nFailed tests:')
    for (const r of results.filter((r) => r.status === 'FAIL')) {
      console.log(`  \u274c ${r.test}: ${r.detail}`)
    }
  }

  if (!cleanup && results.some((r) => r.status === 'PASS' && r.test.includes('INSERT'))) {
    console.log('\nTip: Run with --cleanup to remove test staging records')
  }

  process.exit(failed > 0 ? 1 : 0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
