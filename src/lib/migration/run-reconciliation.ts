#!/usr/bin/env npx tsx
/**
 * Multi-Source Reconciliation CLI
 *
 * Matches transactions across QBO, UMass Five bank, and Ramp
 * to identify discrepancies before go-live.
 *
 * Usage:
 *   npx tsx src/lib/migration/run-reconciliation.ts \
 *     --qbo ./qbo-export/journal-all.csv \
 *     --bank-checking ./qbo-export/umass5-checking.csv \
 *     --bank-savings ./qbo-export/umass5-savings.csv \
 *     --ramp ./qbo-export/ramp-transactions.csv \
 *     --cutoff-date 2026-02-15 \
 *     --output ./qbo-export/reconciliation-report.txt
 */

import * as fs from 'node:fs'
import * as path from 'node:path'
import { runFullReconciliation } from './reconciliation'

interface CliArgs {
  qbo?: string
  bankFiles: Array<{ path: string; label: string }>
  ramp?: string
  cutoffDate?: string
  output?: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const result: CliArgs = { bankFiles: [] }

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

Bank accounts (at least one recommended):
  --bank-checking <path>    UMass Five checking account CSV
  --bank-savings <path>     UMass Five savings account CSV
  --bank-escrow <path>      UMass Five escrow account CSV
  --bank Label:<path>       Generic bank CSV with custom label

Optional:
  --ramp <path>             Ramp transaction CSV export
  --cutoff-date YYYY-MM-DD  Only include transactions on or before this date
  --output <path>           Write report to file (default: stdout)
  --help                    Show this help message

Examples:
  # Full reconciliation
  npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --bank-checking ./exports/umass5-checking.csv \\
    --ramp ./exports/ramp-transactions.csv \\
    --cutoff-date 2026-02-15 \\
    --output ./exports/recon-report.txt

  # QBO vs Bank only
  npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --bank-checking ./exports/umass5-checking.csv

  # QBO vs Ramp only
  npx tsx src/lib/migration/run-reconciliation.ts \\
    --qbo ./exports/journal-all.csv \\
    --ramp ./exports/ramp-transactions.csv
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

async function main(): Promise<void> {
  const args = parseArgs()

  if (!args.qbo) {
    console.error('Error: --qbo is required. Use --help for usage.')
    process.exit(1)
  }

  if (args.bankFiles.length === 0 && !args.ramp) {
    console.error('Error: provide at least one of --bank-* or --ramp to reconcile against.')
    process.exit(1)
  }

  console.log('Multi-Source Reconciliation')
  console.log('==========================')
  console.log(`QBO Journal: ${args.qbo}`)
  for (const bf of args.bankFiles) {
    console.log(`Bank (${bf.label}): ${bf.path}`)
  }
  if (args.ramp) console.log(`Ramp: ${args.ramp}`)
  if (args.cutoffDate) console.log(`Cutoff date: ${args.cutoffDate}`)
  console.log('')

  const qboCsv = readFile(args.qbo)

  const bankCsvs = args.bankFiles.map((bf) => ({
    csv: readFile(bf.path),
    accountLabel: bf.label,
  }))

  const rampCsv = args.ramp ? readFile(args.ramp) : undefined

  const result = runFullReconciliation({
    qboCsv,
    bankCsvs: bankCsvs.length > 0 ? bankCsvs : undefined,
    rampCsv,
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
    console.log('\n⚠️  Unmatched transactions found — review the report above.')
    process.exit(2)
  } else {
    console.log('\n✓ All sources reconciled successfully.')
  }
}

main().catch((err) => {
  console.error('Reconciliation failed:', err.message)
  process.exit(1)
})
