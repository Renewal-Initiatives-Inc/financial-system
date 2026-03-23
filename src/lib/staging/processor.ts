import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, invoices, stagingRecords } from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import { resolveVendorByZitadelId } from '@/lib/vendor-resolve'
import { getUnprocessedRecords, type StagingRecord } from './queries'

// --- Types ---

export interface ProcessingResult {
  processed: number
  expenseReportsPosted: number
  timesheetsReceived: number
  errors: Array<{ recordId: number; error: string }>
}

// --- Account Lookup (cached) ---

let reimbursementsPayableId: number | null = null

async function getReimbursementsPayableAccount(): Promise<{ id: number }> {
  if (reimbursementsPayableId !== null) {
    return { id: reimbursementsPayableId }
  }

  const [account] = await db
    .select({ id: accounts.id })
    .from(accounts)
    .where(eq(accounts.code, '2010'))

  if (!account) {
    throw new Error(
      'Reimbursements Payable account (code 2010) not found. Ensure chart of accounts is seeded.'
    )
  }

  reimbursementsPayableId = account.id
  return account
}

// --- Processor ---

async function processExpenseReport(
  record: StagingRecord
): Promise<{ glTransactionId: number }> {
  if (!record.glAccountId) {
    throw new Error('Expense report record missing glAccountId')
  }

  const reimbursementsPayable = await getReimbursementsPayableAccount()
  const amount = parseFloat(record.amount)

  // Build memo from metadata if available
  const metadata = record.metadata as Record<string, unknown> | null
  const merchant = metadata?.merchant as string | undefined
  const memo = metadata?.memo as string | undefined
  const memoText = [merchant, memo].filter(Boolean).join(' — ') || record.referenceId

  // Resolve employee → vendor for AP invoice linkage.
  // Returns null if no vendor record is linked to this Zitadel user ID.
  const vendor = await resolveVendorByZitadelId(record.employeeId)

  const result = await createTransaction({
    date: record.dateIncurred,
    memo: `Expense report: ${memoText}`,
    sourceType: 'EXPENSE_REPORT',
    sourceReferenceId: record.referenceId,
    isSystemGenerated: true,
    createdBy: 'system:staging-processor',
    lines: [
      {
        accountId: record.glAccountId,
        fundId: record.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: reimbursementsPayable.id,
        fundId: record.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  // Create AP invoice so reimbursement appears in vendor payables / AP aging.
  // vendorId is null if the employee doesn't have a linked vendor record —
  // the GL entry still posts; the invoice just won't appear in vendor-specific AP reports.
  await db.insert(invoices).values({
    direction: 'AP',
    vendorId: vendor?.id ?? null,
    fundId: record.fundId,
    amount: record.amount,
    invoiceDate: record.dateIncurred,
    glTransactionId: result.transaction.id,
    paymentStatus: 'POSTED',
    createdBy: 'system:staging-processor',
  })

  return { glTransactionId: result.transaction.id }
}

export async function processReceivedStagingRecords(): Promise<ProcessingResult> {
  const records = await getUnprocessedRecords()

  const result: ProcessingResult = {
    processed: 0,
    expenseReportsPosted: 0,
    timesheetsReceived: 0,
    errors: [],
  }

  for (const record of records) {
    try {
      if (record.recordType === 'expense_line_item') {
        const { glTransactionId } = await processExpenseReport(record)

        await db
          .update(stagingRecords)
          .set({
            status: 'posted',
            glTransactionId,
            processedAt: new Date(),
          })
          .where(eq(stagingRecords.id, record.id))

        result.expenseReportsPosted++
      } else if (record.recordType === 'timesheet_fund_summary') {
        // Timesheets accumulate for payroll — no GL entry yet.
        // Status stays 'received' until payroll processing consumes them.
        result.timesheetsReceived++
      }

      result.processed++
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      console.error(`Staging processor error for record ${record.id}:`, message)
      result.errors.push({ recordId: record.id, error: message })
    }
  }

  return result
}
