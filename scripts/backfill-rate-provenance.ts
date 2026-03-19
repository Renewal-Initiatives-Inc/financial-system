/**
 * Backfill provenance columns (source_document, source_url, verified_date)
 * and insert federal tax bracket rows on existing annual_rate_config data.
 *
 * Usage:
 *   npx tsx scripts/backfill-rate-provenance.ts              # dev (.env.local)
 *   ENV_FILE=/tmp/.env.prod npx tsx scripts/backfill-rate-provenance.ts  # prod
 */

import { config } from 'dotenv'
config({ path: process.env.ENV_FILE || '.env.local' })

import { neon } from '@neondatabase/serverless'

const sql = neon(process.env.DATABASE_URL!)

// Provenance data for existing rate rows — keyed by fiscalYear:configKey
const PROVENANCE: Record<string, { sourceDocument: string; sourceUrl: string; verifiedDate: string }> = {
  '2025:fica_ss_rate': { sourceDocument: 'IRS Publication 15 (2025)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2025-01-15' },
  '2026:fica_ss_rate': { sourceDocument: 'IRS Publication 15 (2026)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2026-01-10' },
  '2025:fica_medicare_rate': { sourceDocument: 'IRS Publication 15 (2025)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2025-01-15' },
  '2026:fica_medicare_rate': { sourceDocument: 'IRS Publication 15 (2026)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2026-01-10' },
  '2025:fica_ss_wage_base': { sourceDocument: 'SSA Fact Sheet (Oct 2024)', sourceUrl: 'https://www.ssa.gov/news/press/factsheets/colafacts2025.pdf', verifiedDate: '2024-10-15' },
  '2026:fica_ss_wage_base': { sourceDocument: 'SSA Fact Sheet (Oct 2025)', sourceUrl: 'https://www.ssa.gov/news/press/factsheets/colafacts2026.pdf', verifiedDate: '2025-10-10' },
  '2025:vendor_1099_threshold': { sourceDocument: 'IRC §6041(a)', sourceUrl: 'https://www.law.cornell.edu/uscode/text/26/6041', verifiedDate: '2025-01-01' },
  '2026:vendor_1099_threshold': { sourceDocument: 'One Big Beautiful Bill Act (P.L. 119-21) §112', sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text', verifiedDate: '2025-08-15' },
  '2025:ma_state_tax_rate': { sourceDocument: 'MA DOR Circular M (2025)', sourceUrl: 'https://www.mass.gov/doc/circular-m-massachusetts-income-tax-withholding-tables', verifiedDate: '2025-01-15' },
  '2026:ma_state_tax_rate': { sourceDocument: 'MA DOR Circular M (2026)', sourceUrl: 'https://www.mass.gov/doc/circular-m-massachusetts-income-tax-withholding-tables', verifiedDate: '2026-01-10' },
  '2025:ma_surtax_rate': { sourceDocument: 'MA Constitution Art. XLIV (2022 ballot)', sourceUrl: 'https://www.mass.gov/info-details/massachusetts-millionaires-tax', verifiedDate: '2025-01-01' },
  '2026:ma_surtax_rate': { sourceDocument: 'MA Constitution Art. XLIV (2022 ballot)', sourceUrl: 'https://www.mass.gov/info-details/massachusetts-millionaires-tax', verifiedDate: '2026-01-01' },
  '2025:ma_surtax_threshold': { sourceDocument: 'MA DOR TIR 24-12', sourceUrl: 'https://www.mass.gov/technical-information-release/tir-24-12', verifiedDate: '2024-12-01' },
  '2026:ma_surtax_threshold': { sourceDocument: 'MA DOR Form 1-ES (2026)', sourceUrl: 'https://www.mass.gov/doc/2026-form-1-es-estimated-income-tax', verifiedDate: '2025-12-15' },
  '2025:mileage_rate': { sourceDocument: 'IRS Notice 2025-05', sourceUrl: 'https://www.irs.gov/pub/irs-drop/n-25-05.pdf', verifiedDate: '2024-12-19' },
  '2026:mileage_rate': { sourceDocument: 'IRS Notice 2026-10', sourceUrl: 'https://www.irs.gov/pub/irs-drop/n-26-10.pdf', verifiedDate: '2025-12-20' },
}

// Federal tax brackets to INSERT (new rows, not updates)
const BRACKET_ROWS = [
  {
    fiscalYear: 2026,
    configKey: 'federal_tax_brackets',
    value: '0.000000',
    notes: 'Federal tax brackets (percentage method, annual) — IRS Pub 15-T 2026',
    sourceDocument: 'IRS Publication 15-T (2026)',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15t.pdf',
    verifiedDate: '2026-01-10',
    jsonValue: {
      single: [
        { over: 0, notOver: 7500, rate: 0, plus: 0 },
        { over: 7500, notOver: 19900, rate: 0.1, plus: 0 },
        { over: 19900, notOver: 57900, rate: 0.12, plus: 1240 },
        { over: 57900, notOver: 113200, rate: 0.22, plus: 5800 },
        { over: 113200, notOver: 209275, rate: 0.24, plus: 17966 },
        { over: 209275, notOver: 263725, rate: 0.32, plus: 41024 },
        { over: 263725, notOver: 648100, rate: 0.35, plus: 58448 },
        { over: 648100, notOver: null, rate: 0.37, plus: 192979.25 },
      ],
      married: [
        { over: 0, notOver: 19300, rate: 0, plus: 0 },
        { over: 19300, notOver: 44100, rate: 0.1, plus: 0 },
        { over: 44100, notOver: 120100, rate: 0.12, plus: 2480 },
        { over: 120100, notOver: 230700, rate: 0.22, plus: 11600 },
        { over: 230700, notOver: 422850, rate: 0.24, plus: 35932 },
        { over: 422850, notOver: 531750, rate: 0.32, plus: 82048 },
        { over: 531750, notOver: 788000, rate: 0.35, plus: 116896 },
        { over: 788000, notOver: null, rate: 0.37, plus: 206583.5 },
      ],
      head_of_household: [
        { over: 0, notOver: 15550, rate: 0, plus: 0 },
        { over: 15550, notOver: 33250, rate: 0.1, plus: 0 },
        { over: 33250, notOver: 83000, rate: 0.12, plus: 1770 },
        { over: 83000, notOver: 121250, rate: 0.22, plus: 7740 },
        { over: 121250, notOver: 217300, rate: 0.24, plus: 16155 },
        { over: 217300, notOver: 271750, rate: 0.32, plus: 39207 },
        { over: 271750, notOver: 656150, rate: 0.35, plus: 56631 },
        { over: 656150, notOver: null, rate: 0.37, plus: 191171 },
      ],
    },
  },
  {
    fiscalYear: 2026,
    configKey: 'federal_standard_deductions',
    value: '0.000000',
    notes: 'Federal standard deductions by filing status — IRS Pub 15-T 2026',
    sourceDocument: 'IRS Publication 15-T (2026)',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15t.pdf',
    verifiedDate: '2026-01-10',
    jsonValue: {
      single: 8600,
      married: 12900,
      head_of_household: 8600,
    },
  },
]

async function run() {
  console.log('Backfilling provenance on existing rows...')

  let updated = 0
  for (const [key, prov] of Object.entries(PROVENANCE)) {
    const [year, configKey] = key.split(':')
    await sql.query(
      `UPDATE annual_rate_config
       SET source_document = $1, source_url = $2, verified_date = $3
       WHERE fiscal_year = $4 AND config_key = $5 AND source_document IS NULL`,
      [prov.sourceDocument, prov.sourceUrl, prov.verifiedDate, parseInt(year), configKey]
    )
    updated++
  }
  console.log(`  Updated ${updated} existing rows with provenance data`)

  console.log('Inserting federal tax bracket rows...')
  let inserted = 0
  for (const row of BRACKET_ROWS) {
    // Check if already exists (NULL effective_date can't use ON CONFLICT)
    const existing = await sql.query(
      `SELECT id FROM annual_rate_config WHERE fiscal_year = $1 AND config_key = $2 AND effective_date IS NULL`,
      [row.fiscalYear, row.configKey]
    )
    if (existing.length > 0) {
      // Update existing row with json_value and provenance
      await sql.query(
        `UPDATE annual_rate_config
         SET json_value = $1, source_document = $2, source_url = $3, verified_date = $4, notes = $5
         WHERE fiscal_year = $6 AND config_key = $7 AND effective_date IS NULL`,
        [JSON.stringify(row.jsonValue), row.sourceDocument, row.sourceUrl, row.verifiedDate, row.notes, row.fiscalYear, row.configKey]
      )
      console.log(`  Updated existing ${row.configKey} (FY${row.fiscalYear})`)
      inserted++
    } else {
      await sql.query(
        `INSERT INTO annual_rate_config
           (fiscal_year, config_key, value, notes, source_document, source_url, verified_date, json_value, updated_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          row.fiscalYear, row.configKey, row.value, row.notes,
          row.sourceDocument, row.sourceUrl, row.verifiedDate,
          JSON.stringify(row.jsonValue), 'system',
        ]
      )
      console.log(`  Inserted ${row.configKey} (FY${row.fiscalYear})`)
      inserted++
    }
  }
  console.log(`  Processed ${inserted} federal tax bracket rows`)

  // Verify
  const counts = await sql.query(
    `SELECT
       COUNT(*)::int AS total,
       COUNT(source_document)::int AS with_provenance,
       COUNT(json_value)::int AS with_json
     FROM annual_rate_config`
  )
  const r = counts[0] as { total: number; with_provenance: number; with_json: number }
  console.log(`\nVerification: ${r.total} total rows, ${r.with_provenance} with provenance, ${r.with_json} with JSON value`)
}

run().catch((e) => {
  console.error('Backfill failed:', e)
  process.exit(1)
})
