/**
 * One-time diagnostic: check migration state and key data in the connected DB.
 * Usage: DATABASE_URL="..." npx tsx src/lib/migration/check-db-state.ts
 */
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

async function main() {
  // 1. Migration journal
  try {
    const rows = await db.execute(
      sql`SELECT id, hash, created_at FROM drizzle.__drizzle_migrations ORDER BY id`
    )
    console.log('=== Migration Journal ===')
    console.log(`Total migrations applied: ${rows.rows.length}`)
    for (const row of rows.rows) {
      console.log(`  #${row.id} | ${row.created_at}`)
    }
  } catch (e: any) {
    console.log('Migration journal error:', e.message)
  }

  // 2. Does ahp_loan_config table still exist?
  try {
    const r = await db.execute(
      sql`SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_name = 'ahp_loan_config'`
    )
    const exists = (r.rows[0] as any).cnt > 0
    console.log(`\nahp_loan_config table exists: ${exists}`)
    if (exists) console.log('  → Migration 0019 has NOT been applied')
    else console.log('  → Migration 0019 has been applied (table dropped)')
  } catch (e: any) {
    console.log('ahp_loan_config check error:', e.message)
  }

  // 3. Does funding_source_rate_history table exist?
  try {
    const r = await db.execute(
      sql`SELECT count(*)::int as cnt FROM information_schema.tables WHERE table_name = 'funding_source_rate_history'`
    )
    const exists = (r.rows[0] as any).cnt > 0
    console.log(`\nfunding_source_rate_history table exists: ${exists}`)
    if (exists) console.log('  → Migration 0020 has been applied')
    else console.log('  → Migration 0020 has NOT been applied')
  } catch (e: any) {
    console.log('rate_history check error:', e.message)
  }

  // 4. Does funds.funding_category column exist?
  try {
    const r = await db.execute(
      sql`SELECT count(*)::int as cnt FROM information_schema.columns WHERE table_name = 'funds' AND column_name = 'funding_category'`
    )
    const exists = (r.rows[0] as any).cnt > 0
    console.log(`\nfunds.funding_category column exists: ${exists}`)
    if (exists) console.log('  → Migration 0017 has been applied')
    else console.log('  → Migration 0017 has NOT been applied')
  } catch (e: any) {
    console.log('funding_category check error:', e.message)
  }

  // 5. Account 2500 current name
  try {
    const r = await db.execute(sql`SELECT code, name FROM accounts WHERE code = '2500'`)
    if (r.rows.length > 0) {
      console.log(`\nAccount 2500: "${(r.rows[0] as any).name}"`)
    } else {
      console.log('\nAccount 2500: NOT FOUND')
    }
  } catch (e: any) {
    console.log('Account 2500 check error:', e.message)
  }

  // 6. Any LOAN funding sources?
  try {
    const r = await db.execute(
      sql`SELECT id, name, funding_category, interest_rate FROM funds WHERE funding_category = 'LOAN'`
    )
    console.log(`\nLOAN funding sources: ${r.rows.length}`)
    for (const row of r.rows) {
      console.log(`  id=${(row as any).id} | "${(row as any).name}" | rate=${(row as any).interest_rate}`)
    }
    if (r.rows.length === 0) {
      console.log('  → No AHP loan entity created yet')
    }
  } catch (e: any) {
    // funding_category column might not exist
    console.log(`\nLOAN funding sources: column not available (${e.message})`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
