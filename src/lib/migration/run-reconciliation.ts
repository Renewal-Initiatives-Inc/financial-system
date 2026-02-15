#!/usr/bin/env npx tsx
/**
 * Multi-Source Reconciliation CLI
 *
 * Matches transactions across QBO, UMass Five bank, and Ramp
 * to identify discrepancies before go-live.
 *
 * Usage (CSV mode):
 *   npx tsx src/lib/migration/run-reconciliation.ts \
 *     --qbo ./qbo-export/journal-all.csv \
 *     --bank-checking ./qbo-export/umass5-checking.csv \
 *     --bank-savings ./qbo-export/umass5-savings.csv \
 *     --ramp ./qbo-export/ramp-transactions.csv \
 *     --cutoff-date 2026-02-15 \
 *     --output ./qbo-export/reconciliation-report.txt
 *
 * Usage (DB mode — reads from Plaid/Ramp API-sourced tables):
 *   DATABASE_URL=<connection-string> npx tsx src/lib/migration/run-reconciliation.ts \
 *     --qbo ./qbo-export/journal-all.csv \
 *     --from-db \
 *     --cutoff-date 2026-02-15 \
 *     --output ./qbo-export/reconciliation-report.txt
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { runFullReconciliation, type ReconTransaction } from './reconciliation'

interface CliArgs {
  qbo?: string
  bankFiles: Array<{ path: string; label: string }>
  ramp?: string
  fromDb: boolean
  cutoffDate?: string
  output?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { bankFiles: [], fromDb: false }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    const next = args[i + 1]

    switch (arg) {
      case '--qbo':
        result.qbo = next
        i++
        break
      case '--bank-checking':
        result.bankFiles.push({ path: next, label: 'Checking' })
        i++
        break
      case '--bank-savings':
        result.bankFiles.push({ path: next, label: 'Savings' })
        i++
        break
      case '--bank-escrow':
        result.bankFiles.push({ path: next, label: 'Escrow' })
        i++
        break
      case '--bank': {
        // Generic: --bank Label:path
        const parts = next.split(':')
        if (parts.length === 2) {
          result.bankFiles.push({ path: parts[1], label: parts[0] })
        } else {
          result.bankFiles.push({ path: next, label: 'Bank' })
        }
        i++
        break
      }
      case '--ramp':
        result.ramp = next
        i++
        break
      case '--from-db':
        result.fromDb = true
        break
      case '--cutoff-date':
        result.cutoffDate = next
        i++
        break
      case '--output':
        result.output = next
        i++
        break
      case '--help':
      case '-h':
        printUsage()
        process.exit(0)
    }
  }

  return result
}

function printUsage(): void {
  console.log(`
Multi-Source Reconciliation Tool
================================

Matches transactions across QBO, UMass Five bank statements, and Ramp
to identify discrepancies before go-live.

Usage:
  npx tsx src/lib/migration/run-reconciliation.ts [options]

Required:
  --qbo <path>              Path to QBO Journal CSV export

Bank accounts (CSV mode — at least one recommended):
  --bank-checking <path>    UMass Five checking account CSV
  --bank-savings <path>     UMass Five savings account CSV
  --bank-escrow <path>      UMass Five escrow account CSV
  --bank Label:<path>       Generic bank CSV with custom label

Optional:
  --ramp <path>             Ramp transaction CSV export
  --from-db                 Load bank/Ramp data from database tables
                            (bank_transactions + ramp_transactions)
                            instead of CSV files. Requires DATABASE_URL.
  --cutoff-date YYYY-MM-DD  Only include transactions on or before this date
  --output <path>           Write report to file (default: stdout)
  --help                    Show this help message

Examples:
  # Full reconciliation (CSV mode)
  npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --bank-checking ./exports/umass5-checking.csv \\
    --ramp ./exports/ramp-transactions.csv \\
    --cutoff-date 2026-02-15 \\
    --output ./exports/recon-report.txt

  # Full reconciliation (DB mode — uses Plaid/Ramp API data)
  DATABASE_URL=<prod-url> npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --from-db \\
    --cutoff-date 2026-02-15 \\
    --output ./exports/recon-report.txt

  # QBO vs Bank only (CSV)
  npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --bank-checking ./exports/umass5-checking.csv
`)
}

function readFile(filePath: string): string {
  const resolved = path.resolve(filePath)
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`)
    process.exit(1)
  }
  return fs.readFileSync(resolved, 'utf-8')
}

/**
 * Load bank transactions from the bank_transactions table (Plaid-sourced).
 * Joins with bank_accounts to get account context.
 */
async function loadBankTransactionsFromDb(cutoffDate?: string): Promise<ReconTransaction[]> {
  const { Pool } = await import('@neondatabase/serverless')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

  try {
    let query = `
      SELECT
        bt.plaid_transaction_id,
        bt.amount::float,
        bt.date::text,
        bt.merchant_name,
        ba.name as account_name
      FROM bank_transactions bt
      JOIN bank_accounts ba ON bt.bank_account_id = ba.id
      WHERE bt.is_pending = false
    `
    const params: string[] = []

    if (cutoffDate) {
      query += ` AND bt.date <= $1`
      params.push(cutoffDate)
    }

    query += ` ORDER BY bt.date`

    const { rows } = await pool.query(query, params)

    return rows.map((row: Record<string, unknown>) => ({
      source: 'bank' as const,
      date: String(row.date),
      // Plaid: negative = money out, positive = money in
      // Our convention: positive = money out, negative = money in
      amount: -Number(row.amount),
      description: String(row.merchant_name ?? ''),
      sourceId: String(row.plaid_transaction_id),
    }))
  } finally {
    await pool.end()
  }
}

/**
 * Load Ramp transactions from the ramp_transactions table (Ramp API-sourced).
 */
async function loadRampTransactionsFromDb(cutoffDate?: string): Promise<ReconTransaction[]> {
  const { Pool } = await import('@neondatabase/serverless')
  const pool = new Pool({ connectionString: process.env.DATABASE_URL! })

  try {
    let query = `
      SELECT
        ramp_id,
        amount::float,
        date,
        merchant_name,
        cardholder
      FROM ramp_transactions
      WHERE 1=1
    `
    const params: string[] = []

    if (cutoffDate) {
      query += ` AND date <= $1`
      params.push(cutoffDate)
    }

    query += ` ORDER BY date`

    const { rows } = await pool.query(query, params)

    return rows.map((row: Record<string, unknown>) => ({
      source: 'ramp' as const,
      date: String(row.date),
      // Ramp amounts are charges (positive = money out)
      amount: Math.abs(Number(row.amount)),
      description: [row.merchant_name, row.cardholder].filter(Boolean).join(' — '),
      sourceId: String(row.ramp_id),
    }))
  } finally {
    await pool.end()
  }
}

async function main(): Promise<void> {
  const args = parseArgs()

  if (!args.qbo) {
    console.error('Error: --qbo is required. Use --help for usage.')
    process.exit(1)
  }

  if (!args.fromDb && args.bankFiles.length === 0 && !args.ramp) {
    console.error('Error: provide at least one of --bank-*, --ramp, or --from-db to reconcile against.')
    process.exit(1)
  }

  if (args.fromDb && !process.env.DATABASE_URL) {
    console.error('Error: --from-db requires DATABASE_URL environment variable.')
    process.exit(1)
  }

  console.log('Multi-Source Reconciliation')
  console.log('==========================')
  console.log(`QBO Journal: ${args.qbo}`)

  if (args.fromDb) {
    console.log('Data source: Database (bank_transactions + ramp_transactions)')
  } else {
    for (const bf of args.bankFiles) {
      console.log(`Bank (${bf.label}): ${bf.path}`)
    }
    if (args.ramp) console.log(`Ramp: ${args.ramp}`)
  }
  if (args.cutoffDate) console.log(`Cutoff date: ${args.cutoffDate}`)
  console.log('')

  const qboCsv = readFile(args.qbo)

  let bankTransactions: ReconTransaction[] | undefined
  let rampTransactions: ReconTransaction[] | undefined

  if (args.fromDb) {
    console.log('Loading bank transactions from database...')
    bankTransactions = await loadBankTransactionsFromDb(args.cutoffDate)
    console.log(`  Found ${bankTransactions.length} bank transactions`)

    console.log('Loading Ramp transactions from database...')
    rampTransactions = await loadRampTransactionsFromDb(args.cutoffDate)
    console.log(`  Found ${rampTransactions.length} Ramp transactions`)
    console.log('')
  }

  const bankCsvs = args.fromDb
    ? undefined
    : args.bankFiles.map((bf) => ({
        csv: readFile(bf.path),
        accountLabel: bf.label,
      }))

  const rampCsv = args.fromDb ? undefined : (args.ramp ? readFile(args.ramp) : undefined)

  const result = runFullReconciliation({
    qboCsv,
    bankCsvs: bankCsvs && bankCsvs.length > 0 ? bankCsvs : undefined,
    rampCsv,
    bankTransactions,
    rampTransactions,
    cutoffDate: args.cutoffDate,
  })

  const fullReport = result.reports.join('\n\n')

  if (args.output) {
    const outputPath = path.resolve(args.output)
    fs.writeFileSync(outputPath, fullReport, 'utf-8')
    console.log(`Report written to: ${outputPath}`)
  } else {
    console.log(fullReport)
  }

  // Exit with non-zero if there are unmatched transactions
  const hasUnmatched =
    (result.cashRecon && (result.cashRecon.unmatchedSource1.length > 0 || result.cashRecon.unmatchedSource2.length > 0)) ||
    (result.creditCardRecon && (result.creditCardRecon.unmatchedSource1.length > 0 || result.creditCardRecon.unmatchedSource2.length > 0))

  if (hasUnmatched) {
    console.log('\nUnmatched transactions found — review the report above.')
    process.exit(2)
  } else {
    console.log('\nAll sources reconciled successfully.')
  }
}

main().catch((err) => {
  console.error('Reconciliation failed:', err.message)
  process.exit(1)
})
