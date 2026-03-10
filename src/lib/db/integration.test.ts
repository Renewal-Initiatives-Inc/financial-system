// @vitest-environment node
/**
 * DB Integration Test
 *
 * Verifies the live database is reachable and all schema tables exist.
 * Catches migration drift before it becomes a runtime error.
 *
 * Requires DATABASE_URL (loaded from .env.local if not set in env).
 *
 * Run: npx vitest run src/lib/db/integration.test.ts
 */
import { config } from 'dotenv'
import { neon } from '@neondatabase/serverless'
import { describe, it, expect, beforeAll } from 'vitest'

// Load .env.local if DATABASE_URL isn't already set
if (!process.env.DATABASE_URL) {
  config({ path: '.env.local' })
}

const EXPECTED_TABLES = [
  // Core GL
  'accounts',
  'transactions',
  'transaction_lines',
  'funds',
  // Vendors & payables
  'vendors',
  'purchase_orders',
  'invoices',
  // Revenue
  'donors',
  'pledges',
  // People & property
  'tenants',
  // Payroll
  'payroll_runs',
  'payroll_entries',
  // Budgets
  'budgets',
  'budget_lines',
  // Assets
  'fixed_assets',
  'cip_cost_codes',
  'prepaid_schedules',
  // Bank rec
  'bank_accounts',
  'bank_transactions',
  'bank_matches',
  'reconciliation_sessions',
  // Compliance & reporting
  'compliance_deadlines',
  'functional_allocations',
  'audit_log',
  // Other
  'staging_records',
  'import_review_items',
  'annual_rate_config',
]

describe('DB Integration', () => {
  let existingTables: Set<string>

  beforeAll(async () => {
    const url = process.env.DATABASE_URL
    if (!url) {
      throw new Error('DATABASE_URL not set. Add it to .env.local.')
    }

    const sql = neon(url)
    const rows = await sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_type = 'BASE TABLE'
    `
    existingTables = new Set(rows.map((r: any) => r.table_name as string))
  })

  it('connects to the database', () => {
    // If beforeAll succeeded, connection works
    expect(existingTables).toBeDefined()
    expect(existingTables.size).toBeGreaterThan(0)
  })

  for (const table of EXPECTED_TABLES) {
    it(`table "${table}" exists`, () => {
      if (!existingTables.has(table)) {
        throw new Error(
          `Table "${table}" is missing from the database.\n` +
          `Run pending migrations: npx drizzle-kit migrate`
        )
      }
      expect(existingTables.has(table)).toBe(true)
    })
  }
})
