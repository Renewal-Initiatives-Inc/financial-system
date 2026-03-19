/**
 * Daily close notification via Postmark (Phase 23a Task 5, INT-P0-016/017).
 *
 * Sends a reconciliation summary email after auto-match completes.
 */

import { db } from '@/lib/db'
import { logAudit } from '@/lib/audit/logger'
import type { DailyCloseResult } from '@/lib/bank-rec/daily-close'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

const MAX_EXCEPTION_ITEMS = 10

/**
 * Send daily close summary email to all active users.
 */
export async function sendDailyCloseEmail(
  result: DailyCloseResult
): Promise<void> {
  const apiKey = process.env.POSTMARK_API_KEY
  const adminEmail = process.env.ADMIN_EMAIL
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://financial.renewalinitiatives.org'

  if (!apiKey || !adminEmail) {
    console.error(
      'Postmark or admin email not configured — skipping daily close notification'
    )
    return
  }

  const today = new Date().toISOString().substring(0, 10)
  const { totals } = result

  const subject = `Daily Close — ${today} — ${totals.autoMatched} auto-matched, ${totals.pendingReview} need review, ${totals.exceptions} exceptions`

  // Build exception details
  const exceptionLines: string[] = []
  for (const acctResult of result.accountResults) {
    if (acctResult.errors.length > 0) {
      for (const err of acctResult.errors.slice(0, MAX_EXCEPTION_ITEMS)) {
        exceptionLines.push(`  - ${acctResult.bankAccountName}: ${err}`)
      }
    }
  }

  const totalExceptionErrors = result.errors.length
  if (totalExceptionErrors > MAX_EXCEPTION_ITEMS) {
    exceptionLines.push(`  ... and ${totalExceptionErrors - MAX_EXCEPTION_ITEMS} more`)
  }

  // Build per-account breakdown
  const accountBreakdown = result.accountResults
    .map(
      (a) =>
        `  ${a.bankAccountName}: ${a.autoMatched} auto, ${a.pendingReview} review, ${a.exceptions} exceptions`
    )
    .join('\n')

  const body = [
    `Bank Reconciliation Summary for ${today}:`,
    '',
    `✓ ${totals.autoMatched} transactions auto-matched`,
    `⟳ ${totals.pendingReview} transactions need your review`,
    `✕ ${totals.exceptions} exceptions require manual handling`,
    '',
    'Per Account:',
    accountBreakdown,
    '',
    ...(totals.exceptions > 0 || exceptionLines.length > 0
      ? ['Errors:', ...exceptionLines, '']
      : []),
    `Review pending items: ${appUrl}/bank-rec?filter=pending`,
    '',
    '---',
    'Renewal Initiatives Financial System',
  ].join('\n')

  try {
    await fetch('https://api.postmarkapp.com/email', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'X-Postmark-Server-Token': apiKey,
      },
      body: JSON.stringify({
        From: process.env.POSTMARK_FROM_EMAIL ?? adminEmail,
        To: adminEmail,
        Subject: subject,
        TextBody: body,
      }),
    })

    // Log delivery to audit_log
    await db.transaction(async (tx) => {
      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId: 'system-daily-close',
        action: 'created',
        entityType: 'notification',
        entityId: 0,
        afterState: {
          type: 'daily_close_email',
          date: today,
          recipients: adminEmail,
          autoMatched: totals.autoMatched,
          pendingReview: totals.pendingReview,
          exceptions: totals.exceptions,
        },
      })
    })
  } catch (err) {
    console.error('Failed to send daily close notification:', err)
  }
}
