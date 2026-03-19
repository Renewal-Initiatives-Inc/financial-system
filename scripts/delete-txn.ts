/**
 * Delete a transaction and all dependent rows from the database.
 *
 * Usage:
 *   npx tsx scripts/delete-txn.ts <transactionId>
 *
 * Example:
 *   npx tsx scripts/delete-txn.ts 1
 */

import { config } from 'dotenv'
config({ path: '.env.local' })

import { Pool } from '@neondatabase/serverless'
import { drizzle } from 'drizzle-orm/neon-serverless'
import { eq, and, sql } from 'drizzle-orm'
import * as schema from '../src/lib/db/schema'

const TARGET_TXN_ID = parseInt(process.argv[2] || '1', 10)

if (isNaN(TARGET_TXN_ID) || TARGET_TXN_ID <= 0) {
  console.error('Usage: npx tsx scripts/delete-txn.ts <transactionId>')
  process.exit(1)
}

async function deleteTxn() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set in .env.local')
  }

  const pool = new Pool({ connectionString })
  const db = drizzle(pool, { schema })

  console.log(`\nDeleting transaction #${TARGET_TXN_ID} and all dependent rows...\n`)

  // 1. Verify the transaction exists
  const txn = await db
    .select()
    .from(schema.transactions)
    .where(eq(schema.transactions.id, TARGET_TXN_ID))
    .limit(1)

  if (txn.length === 0) {
    console.error(`Transaction #${TARGET_TXN_ID} not found.`)
    await pool.end()
    process.exit(1)
  }

  console.log(`Found transaction #${TARGET_TXN_ID}: "${txn[0].memo}" (${txn[0].date})`)
  console.log('---')

  const report: { table: string; count: number }[] = []

  // 2. Get transaction line IDs (needed for bank_matches lookup)
  const txnLines = await db
    .select({ id: schema.transactionLines.id })
    .from(schema.transactionLines)
    .where(eq(schema.transactionLines.transactionId, TARGET_TXN_ID))

  const txnLineIds = txnLines.map((l) => l.id)

  // 3. Delete bank_matches that reference these transaction lines
  if (txnLineIds.length > 0) {
    const bankMatchesDeleted = await db
      .delete(schema.bankMatches)
      .where(
        sql`${schema.bankMatches.glTransactionLineId} IN (${sql.join(
          txnLineIds.map((id) => sql`${id}`),
          sql`, `
        )})`
      )
      .returning({ id: schema.bankMatches.id })

    report.push({ table: 'bank_matches', count: bankMatchesDeleted.length })
  } else {
    report.push({ table: 'bank_matches', count: 0 })
  }

  // 4. Null out glTransactionId on staging_records (nullable FK)
  const stagingUpdated = await db
    .update(schema.stagingRecords)
    .set({ glTransactionId: null, status: 'received' })
    .where(eq(schema.stagingRecords.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.stagingRecords.id })

  report.push({ table: 'staging_records (nulled glTransactionId)', count: stagingUpdated.length })

  // 5. Null out glTransactionId on ramp_transactions (nullable FK)
  const rampUpdated = await db
    .update(schema.rampTransactions)
    .set({ glTransactionId: null, status: 'uncategorized' })
    .where(eq(schema.rampTransactions.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.rampTransactions.id })

  report.push({ table: 'ramp_transactions (nulled glTransactionId)', count: rampUpdated.length })

  // 6. Null out glTransactionId on invoices (nullable FK)
  const invoicesUpdated = await db
    .update(schema.invoices)
    .set({ glTransactionId: null })
    .where(eq(schema.invoices.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.invoices.id })

  report.push({ table: 'invoices (nulled glTransactionId)', count: invoicesUpdated.length })

  // 7. Null out glTransactionId on pledges (nullable FK)
  const pledgesUpdated = await db
    .update(schema.pledges)
    .set({ glTransactionId: null })
    .where(eq(schema.pledges.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.pledges.id })

  report.push({ table: 'pledges (nulled glTransactionId)', count: pledgesUpdated.length })

  // 8. Null out glTransactionId / glEmployerTransactionId on payroll_entries (nullable FKs)
  const payrollUpdated1 = await db
    .update(schema.payrollEntries)
    .set({ glTransactionId: null })
    .where(eq(schema.payrollEntries.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.payrollEntries.id })

  const payrollUpdated2 = await db
    .update(schema.payrollEntries)
    .set({ glEmployerTransactionId: null })
    .where(eq(schema.payrollEntries.glEmployerTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.payrollEntries.id })

  report.push({
    table: 'payroll_entries (nulled glTransactionId)',
    count: payrollUpdated1.length,
  })
  report.push({
    table: 'payroll_entries (nulled glEmployerTransactionId)',
    count: payrollUpdated2.length,
  })

  // 9. Null out glTransactionId on security_deposit_interest_payments (no FK constraint in schema)
  const secDepUpdated = await db
    .update(schema.securityDepositInterestPayments)
    .set({ glTransactionId: null })
    .where(eq(schema.securityDepositInterestPayments.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.securityDepositInterestPayments.id })

  report.push({
    table: 'security_deposit_interest_payments (nulled glTransactionId)',
    count: secDepUpdated.length,
  })

  // 10. Delete cip_conversions that reference this transaction (NOT NULL FK - must delete)
  //     First delete related cip_conversion_lines, then the conversion itself
  const cipConversions = await db
    .select({ id: schema.cipConversions.id })
    .from(schema.cipConversions)
    .where(eq(schema.cipConversions.glTransactionId, TARGET_TXN_ID))

  let cipConversionLinesCount = 0
  for (const conv of cipConversions) {
    const linesDeleted = await db
      .delete(schema.cipConversionLines)
      .where(eq(schema.cipConversionLines.conversionId, conv.id))
      .returning({ id: schema.cipConversionLines.id })
    cipConversionLinesCount += linesDeleted.length
  }
  report.push({ table: 'cip_conversion_lines', count: cipConversionLinesCount })

  const cipConversionsDeleted = await db
    .delete(schema.cipConversions)
    .where(eq(schema.cipConversions.glTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.cipConversions.id })

  report.push({ table: 'cip_conversions', count: cipConversionsDeleted.length })

  // 11. Null out sourceTransactionId on prepaid_schedules (nullable FK)
  const prepaidUpdated = await db
    .update(schema.prepaidSchedules)
    .set({ sourceTransactionId: null })
    .where(eq(schema.prepaidSchedules.sourceTransactionId, TARGET_TXN_ID))
    .returning({ id: schema.prepaidSchedules.id })

  report.push({
    table: 'prepaid_schedules (nulled sourceTransactionId)',
    count: prepaidUpdated.length,
  })

  // 12. Clear self-referencing columns on other transactions pointing to this one
  const reversalOfCleared = await db
    .update(schema.transactions)
    .set({ reversalOfId: null })
    .where(eq(schema.transactions.reversalOfId, TARGET_TXN_ID))
    .returning({ id: schema.transactions.id })

  report.push({
    table: 'transactions (cleared reversalOfId)',
    count: reversalOfCleared.length,
  })

  const reversedByCleared = await db
    .update(schema.transactions)
    .set({ reversedById: null })
    .where(eq(schema.transactions.reversedById, TARGET_TXN_ID))
    .returning({ id: schema.transactions.id })

  report.push({
    table: 'transactions (cleared reversedById)',
    count: reversedByCleared.length,
  })

  // 13. Delete audit_log entries for this transaction (soft reference by entityType + entityId)
  const auditDeleted = await db
    .delete(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.entityType, 'transaction'),
        eq(schema.auditLog.entityId, TARGET_TXN_ID)
      )
    )
    .returning({ id: schema.auditLog.id })

  report.push({ table: 'audit_log', count: auditDeleted.length })

  // 14. Delete transaction_lines (cascade should handle this, but be explicit)
  const linesDeleted = await db
    .delete(schema.transactionLines)
    .where(eq(schema.transactionLines.transactionId, TARGET_TXN_ID))
    .returning({ id: schema.transactionLines.id })

  report.push({ table: 'transaction_lines', count: linesDeleted.length })

  // 15. Delete the transaction itself
  const txnDeleted = await db
    .delete(schema.transactions)
    .where(eq(schema.transactions.id, TARGET_TXN_ID))
    .returning({ id: schema.transactions.id })

  report.push({ table: 'transactions', count: txnDeleted.length })

  // --- Report ---
  console.log('\n=== Deletion Report ===')
  for (const row of report) {
    if (row.count > 0) {
      console.log(`  ${row.table}: ${row.count} row(s)`)
    } else {
      console.log(`  ${row.table}: 0 (none found)`)
    }
  }

  const totalAffected = report.reduce((sum, r) => sum + r.count, 0)
  console.log(`\nTotal rows affected: ${totalAffected}`)
  console.log('Done.\n')

  await pool.end()
}

deleteTxn().catch((err) => {
  console.error('Delete failed:', err)
  process.exit(1)
})
