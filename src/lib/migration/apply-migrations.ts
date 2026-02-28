/**
 * One-time script: apply missing migrations to a database.
 * Usage: DATABASE_URL="..." MIGRATIONS="0017,0019,0020,0021" npx tsx src/lib/migration/apply-migrations.ts
 */
import { readFileSync } from 'fs'
import { db } from '@/lib/db'
import { sql } from 'drizzle-orm'

const MIGRATION_FILES: Record<string, string> = {
  '0017': './drizzle/0017_funding_category.sql',
  '0019': './drizzle/0019_drop_ahp_loan_config.sql',
  '0020': './drizzle/0020_funding_source_rate_history.sql',
  '0021': './drizzle/0021_rename_loans_payable.sql',
}

async function main() {
  const migrationList = (process.env.MIGRATIONS ?? '').split(',').filter(Boolean)
  if (migrationList.length === 0) {
    console.error('Set MIGRATIONS env var, e.g. MIGRATIONS="0017,0019,0020,0021"')
    process.exit(1)
  }

  for (const key of migrationList) {
    const file = MIGRATION_FILES[key]
    if (!file) {
      console.error(`Unknown migration: ${key}`)
      process.exit(1)
    }

    const sqlText = readFileSync(file, 'utf-8')
    // Strip comments for cleaner output
    const statements = sqlText
      .split(';')
      .map((s) => s.replace(/--.*$/gm, '').trim())
      .filter((s) => s.length > 0)

    console.log(`\n=== Applying ${key} (${file}) ===`)
    for (const stmt of statements) {
      const preview = stmt.substring(0, 80).replace(/\n/g, ' ')
      console.log(`  → ${preview}...`)
      await db.execute(sql.raw(stmt))
    }
    console.log(`  ✓ ${key} applied`)
  }

  // Verify account 2500
  const r = await db.execute(sql`SELECT code, name FROM accounts WHERE code = '2500'`)
  if (r.rows.length > 0) {
    console.log(`\nAccount 2500 is now: "${(r.rows[0] as any).name}"`)
  }

  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
