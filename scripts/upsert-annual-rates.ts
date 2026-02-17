/**
 * Upsert all annual rate configurations for FY 2025 and FY 2026.
 *
 * Verified rates with sources:
 *   - FICA SS/Medicare rates: IRS Publication 15 (2026)
 *   - SS Wage Base: SSA announcement Oct 2025 ($184,500)
 *   - 1099 Threshold: OBBBA P.L. 119-21 ($2,000 for 2026+)
 *   - MA State Tax: MA DOR Circular M (5% flat)
 *   - MA Surtax: MA DOR 4% on income > threshold
 *   - MA Surtax Threshold 2025: $1,083,150 (mass.gov)
 *   - MA Surtax Threshold 2026: $1,107,750 (MA DOR Form 1-ES 2026)
 *   - Mileage 2025: $0.70/mile (IRS Notice 2025-05)
 *   - Mileage 2026: $0.725/mile (IRS Notice 2026-10)
 *
 * Usage:
 *   npx tsx scripts/upsert-annual-rates.ts
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq, and, isNull } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

interface RateEntry {
  fiscalYear: number
  configKey: string
  value: string
  notes: string
  updatedBy: string
}

const RATES: RateEntry[] = [
  // --- FY 2025 ---
  { fiscalYear: 2025, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'fica_ss_wage_base', value: '176100.000000', notes: 'SSA announcement', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'vendor_1099_threshold', value: '600.000000', notes: 'Pre-OBBBA', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'ma_surtax_threshold', value: '1083150.000000', notes: 'MA DOR (indexed from $1M base)', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2025, configKey: 'mileage_rate', value: '0.700000', notes: 'IRS Notice 2025-05 ($0.70/mile)', updatedBy: 'migration-2026-rates' },

  // --- FY 2026 ---
  { fiscalYear: 2026, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'fica_ss_wage_base', value: '184500.000000', notes: 'SSA announcement Oct 2025', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'vendor_1099_threshold', value: '2000.000000', notes: 'Per OBBBA (P.L. 119-21)', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'ma_surtax_threshold', value: '1107750.000000', notes: 'MA DOR Form 1-ES 2026', updatedBy: 'migration-2026-rates' },
  { fiscalYear: 2026, configKey: 'mileage_rate', value: '0.725000', notes: 'IRS Notice 2026-10 ($0.725/mile)', updatedBy: 'migration-2026-rates' },
]

async function upsertRates() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in .env.local')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })

  console.log('\n=== Annual Rate Configuration Upsert ===\n')

  const report: { action: string; year: number; key: string; value: string }[] = []

  for (const rate of RATES) {
    // Look for existing row with same (fiscalYear, configKey, NULL effectiveDate)
    const existing = await db
      .select()
      .from(schema.annualRateConfig)
      .where(
        and(
          eq(schema.annualRateConfig.fiscalYear, rate.fiscalYear),
          eq(schema.annualRateConfig.configKey, rate.configKey),
          isNull(schema.annualRateConfig.effectiveDate)
        )
      )
      .limit(1)

    if (existing.length > 0) {
      const row = existing[0]
      if (row.value !== rate.value || row.notes !== rate.notes) {
        // Update
        await db
          .update(schema.annualRateConfig)
          .set({
            value: rate.value,
            notes: rate.notes,
            updatedBy: rate.updatedBy,
            updatedAt: new Date(),
          })
          .where(eq(schema.annualRateConfig.id, row.id))

        report.push({
          action: row.value !== rate.value ? `UPDATED (${row.value} → ${rate.value})` : 'UPDATED (notes)',
          year: rate.fiscalYear,
          key: rate.configKey,
          value: rate.value,
        })
      } else {
        report.push({
          action: 'UNCHANGED',
          year: rate.fiscalYear,
          key: rate.configKey,
          value: rate.value,
        })
      }
    } else {
      // Insert
      await db.insert(schema.annualRateConfig).values({
        fiscalYear: rate.fiscalYear,
        configKey: rate.configKey,
        value: rate.value,
        notes: rate.notes,
        updatedBy: rate.updatedBy,
      })

      report.push({
        action: 'INSERTED',
        year: rate.fiscalYear,
        key: rate.configKey,
        value: rate.value,
      })
    }
  }

  // Print report
  console.log('FY   | Config Key             | Value            | Action')
  console.log('-----|------------------------|------------------|----------------------------')
  for (const row of report) {
    const yr = String(row.year)
    const key = row.key.padEnd(22)
    const val = row.value.padEnd(16)
    console.log(`${yr} | ${key} | ${val} | ${row.action}`)
  }

  const inserted = report.filter((r) => r.action === 'INSERTED').length
  const updated = report.filter((r) => r.action.startsWith('UPDATED')).length
  const unchanged = report.filter((r) => r.action === 'UNCHANGED').length

  console.log(`\nSummary: ${inserted} inserted, ${updated} updated, ${unchanged} unchanged`)
  console.log('Done.\n')

  await pool.end()
}

upsertRates().catch((err) => {
  console.error('Migration failed:', err)
  process.exit(1)
})
