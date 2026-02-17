/**
 * Seed Test Timesheet Staging Records
 *
 * Inserts dummy timesheet_fund_summary staging records for Heather and Jeff
 * so we can test the payroll run flow against real app-portal employee data.
 *
 * Usage:
 *   npx tsx scripts/seed-test-timesheets.ts
 *
 * Cleanup:
 *   npx tsx scripts/seed-test-timesheets.ts --cleanup
 *
 * Requires .env.local with:
 *   DATABASE_URL — financial-system DB (for staging_records + funds)
 *   PEOPLE_DATABASE_URL — app-portal DB (for employee IDs)
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { neon } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-http'
import { sql } from 'drizzle-orm'

const TEST_REF = 'SEED-TEST-TIMESHEETS'
const cleanup = process.argv.includes('--cleanup')

async function main() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set')
    process.exit(1)
  }

  const mainSql = neon(process.env.DATABASE_URL)
  const mainDb = drizzle(mainSql)

  // --- Cleanup mode ---
  // Unwinds everything: GL transactions, payroll entries/runs, and staging records
  if (cleanup) {
    console.log('=== Cleaning Up Test Timesheet Data ===\n')

    // 1. Find the payroll run that consumed our test staging records
    //    Look for Feb 2026 payroll runs (the period we seeded)
    const payrollRunsResult = await mainDb.execute(
      sql`SELECT pr.id, pr.status
          FROM payroll_runs pr
          WHERE pr.pay_period_start = '2026-02-01'
            AND pr.pay_period_end = '2026-02-28'`
    )

    for (const row of payrollRunsResult.rows) {
      const run = row as Record<string, unknown>
      const runId = run.id as number
      console.log(`Found payroll run #${runId} (status: ${run.status})`)

      // 2. Get payroll entries and void their GL transactions
      const entriesResult = await mainDb.execute(
        sql`SELECT id, employee_name, gl_transaction_id, gl_employer_transaction_id
            FROM payroll_entries
            WHERE payroll_run_id = ${runId}`
      )

      for (const entryRow of entriesResult.rows) {
        const entry = entryRow as Record<string, unknown>
        const glTxnId = entry.gl_transaction_id as number | null
        const glEmployerTxnId = entry.gl_employer_transaction_id as number | null

        const txnIds = [glTxnId, glEmployerTxnId].filter((id): id is number => id != null)
        for (const txnId of txnIds) {
          // Void the payroll JE itself
          await mainDb.execute(
            sql`UPDATE transactions SET is_voided = true WHERE id = ${txnId} AND is_voided = false`
          )
          console.log(`  Voided GL transaction #${txnId} (${txnId === glTxnId ? 'employee JE' : 'employer FICA'} for ${entry.employee_name})`)

          // Void any auto-generated net asset release companion transaction
          const narResult = await mainDb.execute(
            sql`UPDATE transactions SET is_voided = true
                WHERE memo = ${'Net asset release for transaction #' + txnId}
                  AND is_voided = false
                RETURNING id`
          )
          for (const nar of narResult.rows) {
            console.log(`  Voided GL transaction #${(nar as Record<string, unknown>).id} (net asset release for #${txnId})`)
          }
        }
      }

      // 3. Delete payroll entries (cascade from run delete would also work,
      //    but explicit is clearer)
      const deletedEntries = await mainDb.execute(
        sql`DELETE FROM payroll_entries WHERE payroll_run_id = ${runId} RETURNING id`
      )
      console.log(`  Deleted ${deletedEntries.rows.length} payroll entries`)

      // 4. Delete the payroll run itself
      await mainDb.execute(
        sql`DELETE FROM payroll_runs WHERE id = ${runId}`
      )
      console.log(`  Deleted payroll run #${runId}`)
    }

    if (payrollRunsResult.rows.length === 0) {
      console.log('No Feb 2026 payroll runs found (not yet posted — good)')
    }

    // 5. Delete staging records
    const deletedStaging = await mainDb.execute(
      sql`DELETE FROM staging_records WHERE reference_id = ${TEST_REF} RETURNING id`
    )
    console.log(`\nDeleted ${deletedStaging.rows.length} staging record(s)`)

    console.log('\nCleanup complete. Voided GL entries will be excluded from reports.')
    process.exit(0)
  }

  // --- Step 1: Get employee IDs from app-portal ---
  console.log('=== Seeding Test Timesheet Data ===\n')

  let heatherId: string | null = null
  let jeffId: string | null = null

  if (process.env.PEOPLE_DATABASE_URL) {
    console.log('Reading employees from app-portal...')
    const peopleSql = neon(process.env.PEOPLE_DATABASE_URL)
    const peopleDb = drizzle(peopleSql)

    const employees = await peopleDb.execute(
      sql`SELECT id, name, email FROM employees WHERE is_active = true`
    )

    for (const row of employees.rows) {
      const r = row as Record<string, unknown>
      const name = (r.name as string).toLowerCase()
      console.log(`  Found: ${r.name} (${r.email}) — id: ${r.id}`)
      if (name.includes('heather')) heatherId = r.id as string
      if (name.includes('jeff')) jeffId = r.id as string
    }
  } else {
    console.log('PEOPLE_DATABASE_URL not set — using mock employee IDs')
    heatherId = 'emp-001' // Mock Heather
    jeffId = 'emp-002'    // Mock Jeff (not in mock data, but ok for staging)
  }

  if (!heatherId) {
    console.error('Could not find Heather in employee data')
    process.exit(1)
  }
  if (!jeffId) {
    console.error('Could not find Jeff in employee data')
    process.exit(1)
  }

  console.log(`\nHeather ID: ${heatherId}`)
  console.log(`Jeff ID:    ${jeffId}`)

  // --- Step 2: Get available funds ---
  console.log('\nLooking up funds...')
  const fundsResult = await mainDb.execute(
    sql`SELECT id, name FROM funds WHERE is_active = true ORDER BY id`
  )

  for (const row of fundsResult.rows) {
    const r = row as Record<string, unknown>
    console.log(`  Fund ${r.id}: ${r.name}`)
  }

  if (fundsResult.rows.length === 0) {
    console.error('No active funds found')
    process.exit(1)
  }

  // Use first two funds (or just the first if only one exists)
  const fund1 = fundsResult.rows[0] as Record<string, unknown>
  const fund2 = fundsResult.rows.length > 1
    ? fundsResult.rows[1] as Record<string, unknown>
    : fund1

  // --- Step 3: Insert staging records ---
  console.log('\nInserting test staging records for February 2026...')

  const records = [
    // Heather — 80 hours on fund 1 (e.g., General Fund)
    {
      sourceApp: 'timesheets',
      sourceRecordId: `${TEST_REF}-heather-${fund1.id}-feb2026`,
      recordType: 'timesheet_fund_summary',
      employeeId: heatherId,
      referenceId: TEST_REF,
      dateIncurred: '2026-02-15',
      amount: '2769.23', // ~$72k/yr salaried, semi-monthly
      fundId: fund1.id as number,
      metadata: {
        regular_hours: 80,
        overtime_hours: 0,
        regular_earnings: 2769.23,
        overtime_earnings: 0,
        week_ending_dates: ['2026-02-07', '2026-02-14'],
      },
    },
    // Heather — 6 hours on fund 2 (split across funds)
    {
      sourceApp: 'timesheets',
      sourceRecordId: `${TEST_REF}-heather-${fund2.id}-feb2026`,
      recordType: 'timesheet_fund_summary',
      employeeId: heatherId,
      referenceId: TEST_REF,
      dateIncurred: '2026-02-15',
      amount: '207.69', // 6 hrs at ~$34.62/hr
      fundId: fund2.id as number,
      metadata: {
        regular_hours: 6,
        overtime_hours: 0,
        regular_earnings: 207.69,
        overtime_earnings: 0,
        week_ending_dates: ['2026-02-07', '2026-02-14'],
      },
    },
    // Jeff — 40 hours on fund 1
    {
      sourceApp: 'timesheets',
      sourceRecordId: `${TEST_REF}-jeff-${fund1.id}-feb2026`,
      recordType: 'timesheet_fund_summary',
      employeeId: jeffId,
      referenceId: TEST_REF,
      dateIncurred: '2026-02-15',
      amount: '1500.00',
      fundId: fund1.id as number,
      metadata: {
        regular_hours: 40,
        overtime_hours: 0,
        regular_earnings: 1500.00,
        overtime_earnings: 0,
        week_ending_dates: ['2026-02-07', '2026-02-14'],
      },
    },
    // Jeff — 20 hours on fund 2
    {
      sourceApp: 'timesheets',
      sourceRecordId: `${TEST_REF}-jeff-${fund2.id}-feb2026`,
      recordType: 'timesheet_fund_summary',
      employeeId: jeffId,
      referenceId: TEST_REF,
      dateIncurred: '2026-02-15',
      amount: '750.00',
      fundId: fund2.id as number,
      metadata: {
        regular_hours: 20,
        overtime_hours: 0,
        regular_earnings: 750.00,
        overtime_earnings: 0,
        week_ending_dates: ['2026-02-07', '2026-02-14'],
      },
    },
  ]

  let inserted = 0
  for (const rec of records) {
    try {
      await mainDb.execute(
        sql`INSERT INTO staging_records (
          source_app, source_record_id, record_type,
          employee_id, reference_id, date_incurred,
          amount, fund_id, gl_account_id, metadata, status
        ) VALUES (
          ${rec.sourceApp}, ${rec.sourceRecordId}, ${rec.recordType},
          ${rec.employeeId}, ${rec.referenceId}, ${rec.dateIncurred},
          ${rec.amount}, ${rec.fundId}, NULL,
          ${JSON.stringify(rec.metadata)}::jsonb, 'received'
        )`
      )
      console.log(`  Inserted: ${rec.employeeId === heatherId ? 'Heather' : 'Jeff'} — $${rec.amount} on fund ${rec.fundId}`)
      inserted++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      if (msg.includes('staging_records_source_uniq')) {
        console.log(`  Skipped (already exists): ${rec.sourceRecordId}`)
      } else {
        console.error(`  FAILED: ${msg}`)
      }
    }
  }

  console.log(`\nDone! Inserted ${inserted} staging records.`)
  console.log('Now go to Payroll → New Run → Select February 2026 → Check Period')
  console.log(`\nTo clean up later: npx tsx scripts/seed-test-timesheets.ts --cleanup`)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
