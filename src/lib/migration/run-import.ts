/**
 * CLI Runner: FY25 Migration & Data Import
 *
 * Run via: npx tsx src/lib/migration/run-import.ts [options]
 *
 * Options:
 *   --csv-path <path>     Path to QBO General Journal CSV export
 *   --dry-run             Validate without importing
 *   --skip-adjustments    Skip accrual-basis adjustments
 *   --force               Force re-import (delete existing FY25_IMPORT data)
 *   --env <environment>   Target environment (dev|staging|prod)
 */

import { readFileSync } from 'fs'
import { parseAndGroupQboCsv } from './qbo-csv-parser'
import { getUnmappedAccounts, getUnmappedClasses, buildAccountLookup, buildFundLookup } from './account-mapping'
import { importFY25Transactions, hasExistingImports, deleteExistingImports } from './import-engine'
import { generateAccrualAdjustments, type AccrualAdjustmentOptions } from './accrual-adjustments'
import { runAllVerifications } from './verification'
import { generateConversionSummary, formatConversionSummary, toJson } from './conversion-summary'
import { db } from '@/lib/db'
import type { NeonHttpDatabase } from 'drizzle-orm/neon-http'
import { writeFileSync } from 'fs'

interface CliArgs {
  csvPath: string
  dryRun: boolean
  skipAdjustments: boolean
  force: boolean
  env: string
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2)
  const parsed: CliArgs = {
    csvPath: '',
    dryRun: false,
    skipAdjustments: false,
    force: false,
    env: 'dev',
  }

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--csv-path':
        parsed.csvPath = args[++i] ?? ''
        break
      case '--dry-run':
        parsed.dryRun = true
        break
      case '--skip-adjustments':
        parsed.skipAdjustments = true
        break
      case '--force':
        parsed.force = true
        break
      case '--env':
        parsed.env = args[++i] ?? 'dev'
        break
    }
  }

  return parsed
}

function log(message: string): void {
  console.log(`[FY25-IMPORT] ${message}`)
}

function logError(message: string): void {
  console.error(`[FY25-IMPORT ERROR] ${message}`)
}

async function main(): Promise<void> {
  const args = parseArgs()

  log('═══════════════════════════════════════════════')
  log('  FY25 Data Migration — Import Pipeline')
  log('═══════════════════════════════════════════════')
  log(`  Environment: ${args.env}`)
  log(`  Dry Run:     ${args.dryRun}`)
  log(`  CSV Path:    ${args.csvPath || '(none)'}`)
  log('')

  if (!args.csvPath) {
    logError('--csv-path is required')
    process.exit(1)
  }

  // Step 1: Parse QBO CSV
  log('Step 1: Parsing QBO CSV...')
  let csvContent: string
  try {
    csvContent = readFileSync(args.csvPath, 'utf-8')
  } catch (err) {
    logError(`Cannot read CSV file: ${(err as Error).message}`)
    process.exit(1)
  }

  const parsedTransactions = parseAndGroupQboCsv(csvContent)
  log(`  Parsed ${parsedTransactions.length} transactions`)

  // Step 2: Pre-flight validation
  log('Step 2: Pre-flight validation...')

  const allAccountNames = parsedTransactions.flatMap((t) => t.lines.map((l) => l.accountName))
  const unmappedAccounts = getUnmappedAccounts(allAccountNames)
  if (unmappedAccounts.length > 0) {
    logError(`Unmapped QBO accounts (${unmappedAccounts.length}):`)
    for (const name of unmappedAccounts) {
      logError(`  - "${name}"`)
    }
    logError('Add these to QBO_ACCOUNT_MAPPING in account-mapping.ts')
    process.exit(1)
  }

  const allClassNames = parsedTransactions.flatMap((t) => t.lines.map((l) => l.class))
  const unmappedClasses = getUnmappedClasses(allClassNames)
  if (unmappedClasses.length > 0) {
    logError(`Unmapped QBO classes (${unmappedClasses.length}):`)
    for (const name of unmappedClasses) {
      logError(`  - "${name}"`)
    }
    logError('Add these to QBO_FUND_MAPPING in account-mapping.ts')
    process.exit(1)
  }

  // Date range
  const dates = parsedTransactions.map((t) => t.date).sort()
  log(`  Date range: ${dates[0]} → ${dates[dates.length - 1]}`)
  log(`  All accounts mapped: YES`)
  log(`  All classes mapped:  YES`)

  // Step 3: Check for existing imports
  log('Step 3: Checking for existing imports...')
  const existing = await hasExistingImports(db as any)
  if (existing.exists) {
    if (args.force) {
      log(`  Found ${existing.count} existing FY25_IMPORT transactions — deleting (--force)`)
      if (!args.dryRun) {
        const deleted = await deleteExistingImports(db as any)
        log(`  Deleted ${deleted} transactions`)
      }
    } else {
      logError(`Found ${existing.count} existing FY25_IMPORT transactions.`)
      logError('Use --force to delete existing data and re-import.')
      process.exit(1)
    }
  } else {
    log('  No existing imports found — clean import')
  }

  // Step 4: Dry-run or confirm
  if (args.dryRun) {
    log('Step 4: DRY RUN — validating all transactions...')
  } else {
    log('Step 4: Importing transactions...')
    log('  ⚠  This will write to the database. Press Ctrl+C within 5 seconds to abort.')
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }

  // Step 5: Import transactions
  log('Step 5: Running import...')
  const importResult = await importFY25Transactions(
    parsedTransactions,
    db as any,
    {
      dryRun: args.dryRun,
      createdBy: 'system:fy25-import',
    }
  )

  log(`  Total:    ${importResult.totalTransactions}`)
  log(`  Imported: ${importResult.imported}`)
  log(`  Errors:   ${importResult.errors.length}`)

  if (importResult.errors.length > 0) {
    logError('Import errors:')
    for (const err of importResult.errors) {
      logError(`  [${err.transactionNo}] ${err.message}`)
    }
    if (!args.dryRun) {
      logError('Import aborted due to errors. All changes rolled back.')
      process.exit(1)
    }
  }

  // Step 6: Accrual adjustments
  if (!args.skipAdjustments && !args.dryRun) {
    log('Step 6: Generating accrual adjustments...')

    const accountLookup = await buildAccountLookup(db as any)
    const fundLookup = await buildFundLookup(db as any)

    const adjustmentOptions: AccrualAdjustmentOptions = {
      accountLookup,
      fundLookup,
      adjustmentDate: '2025-12-31', // Calendar year end per Jeff
      prepaidInsuranceAmount: 501,
      // Reimbursement: $4,472 will be imported per-transaction (CIP soft costs,
      // org costs, operating expenses split) — NOT as a blob to avoid double-counting
      reimbursementAmount: 0,
      reimbursementExpenseAccountCode: '5600',
      reimbursementFundName: 'General Fund',
      rentArAmount: 0, // No tenants in FY25 — building under construction
      // AHP interest: $100K drawn 11/18/2025 at 4.75%, but $572.60 paid 12/19
      // covering through 12/31/2025 — no accrual needed at year-end
      ahpInterest: undefined,
      createdBy: 'system:fy25-import',
      dryRun: args.dryRun,
    }

    const adjustmentResult = await generateAccrualAdjustments(adjustmentOptions)

    log(`  Generated ${adjustmentResult.adjustments.length} adjustments`)
    if (adjustmentResult.errors.length > 0) {
      logError('Adjustment errors:')
      for (const err of adjustmentResult.errors) {
        logError(`  [${err.name}] ${err.message}`)
      }
    }

    // Step 7: Run verification
    log('Step 7: Running verification checks...')
    const verificationResult = await runAllVerifications(db as unknown as NeonHttpDatabase<any>, {
      expectedTransactionCount: importResult.imported + adjustmentResult.adjustments.length,
    })

    for (const check of verificationResult.checks) {
      const icon = check.passed ? 'PASS' : 'FAIL'
      log(`  [${icon}] ${check.name}: ${check.message}`)
    }

    // Step 8: Generate summary
    log('Step 8: Generating conversion summary...')
    const summary = await generateConversionSummary(
      db as unknown as NeonHttpDatabase<any>,
      adjustmentResult,
      verificationResult
    )

    const formattedSummary = formatConversionSummary(summary)
    console.log('')
    console.log(formattedSummary)

    // Save JSON summary to file
    const jsonPath = args.csvPath.replace(/\.csv$/i, '') + '-conversion-summary.json'
    writeFileSync(jsonPath, toJson(summary), 'utf-8')
    log(`  JSON summary saved to: ${jsonPath}`)
  } else if (args.skipAdjustments) {
    log('Step 6: Skipping accrual adjustments (--skip-adjustments)')
  } else {
    log('Step 6: Skipping accrual adjustments (dry-run mode)')
  }

  log('')
  log(args.dryRun ? 'DRY RUN COMPLETE — no data was written' : 'IMPORT COMPLETE')
  log('═══════════════════════════════════════════════')
}

main().catch((err) => {
  logError(`Fatal error: ${err.message}`)
  console.error(err)
  process.exit(1)
})
