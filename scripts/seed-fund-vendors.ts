/**
 * Seed fund_vendors junction table from existing data:
 * 1. Distinct (vendor_id, fund_id) pairs from purchase_orders
 * 2. (id, default_fund_id) from vendors where default_fund_id is not null
 *
 * Idempotent — uses ON CONFLICT DO NOTHING.
 *
 * Usage:
 *   npx tsx scripts/seed-fund-vendors.ts              # dev (.env.local)
 *   ENV_FILE=/tmp/.env.prod npx tsx scripts/seed-fund-vendors.ts  # prod
 */

import { config } from 'dotenv'
config({ path: process.env.ENV_FILE || '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

async function main() {
  console.log('Seeding fund_vendors from existing PO pairs and vendor defaults...\n')

  // 1. Insert from purchase_orders (distinct vendor+fund pairs)
  const poResult = await sql`
    INSERT INTO fund_vendors (fund_id, vendor_id)
    SELECT DISTINCT fund_id, vendor_id
    FROM purchase_orders
    WHERE fund_id IS NOT NULL AND vendor_id IS NOT NULL
    ON CONFLICT (fund_id, vendor_id) DO NOTHING
  `

  // 2. Insert from vendors.default_fund_id
  const vendorResult = await sql`
    INSERT INTO fund_vendors (fund_id, vendor_id)
    SELECT default_fund_id, id
    FROM vendors
    WHERE default_fund_id IS NOT NULL
    ON CONFLICT (fund_id, vendor_id) DO NOTHING
  `

  // Count total rows
  const [{ count }] = await sql`SELECT COUNT(*) as count FROM fund_vendors`

  console.log(`PO pairs inserted: ${poResult.length ?? 'n/a'} (skipped duplicates)`)
  console.log(`Vendor defaults inserted: ${vendorResult.length ?? 'n/a'} (skipped duplicates)`)
  console.log(`Total fund_vendors rows: ${count}`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
