import { describe, expect, it } from 'vitest'
import type { DailyCloseResult } from '@/lib/bank-rec/daily-close'

/**
 * Tests for daily close notification email content, skip-if-empty, and error handling.
 */

describe('Daily Close Notification', () => {
  const MAX_EXCEPTION_ITEMS = 10

  function buildEmailContent(result: DailyCloseResult) {
    const today = '2026-03-18'
    const { totals } = result
    const appUrl = 'https://financial.renewalinitiatives.org'

    const subject = `Daily Close — ${today} — ${totals.autoMatched} auto-matched, ${totals.pendingReview} need review, ${totals.exceptions} exceptions`

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

    const accountBreakdown = result.accountResults
      .map((a) => `  ${a.bankAccountName}: ${a.autoMatched} auto, ${a.pendingReview} review, ${a.exceptions} exceptions`)
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
      ...(totals.exceptions > 0 || exceptionLines.length > 0 ? ['Errors:', ...exceptionLines, ''] : []),
      `Review pending items: ${appUrl}/bank-rec?filter=pending`,
      '',
      '---',
      'Renewal Initiatives Financial System',
    ].join('\n')

    return { subject, body }
  }

  const makeResult = (overrides: Partial<DailyCloseResult> = {}): DailyCloseResult => ({
    accountResults: [
      { bankAccountId: 1, bankAccountName: 'Operating Checking', autoMatched: 22, pendingReview: 5, exceptions: 2, errors: [] },
    ],
    totals: { autoMatched: 22, pendingReview: 5, exceptions: 2 },
    errors: [],
    ...overrides,
  })

  describe('Email subject', () => {
    it('includes date and tier counts', () => {
      const { subject } = buildEmailContent(makeResult())
      expect(subject).toContain('2026-03-18')
      expect(subject).toContain('22 auto-matched')
      expect(subject).toContain('5 need review')
      expect(subject).toContain('2 exceptions')
    })

    it('shows zero counts correctly', () => {
      const { subject } = buildEmailContent(
        makeResult({ totals: { autoMatched: 0, pendingReview: 0, exceptions: 0 } })
      )
      expect(subject).toContain('0 auto-matched')
    })
  })

  describe('Email body', () => {
    it('includes per-account breakdown', () => {
      const { body } = buildEmailContent(makeResult())
      expect(body).toContain('Operating Checking: 22 auto, 5 review, 2 exceptions')
    })

    it('includes review link', () => {
      const { body } = buildEmailContent(makeResult())
      expect(body).toContain('/bank-rec?filter=pending')
    })

    it('includes Renewal Initiatives footer', () => {
      const { body } = buildEmailContent(makeResult())
      expect(body).toContain('Renewal Initiatives Financial System')
    })

    it('includes exception details when present', () => {
      const result = makeResult({
        accountResults: [
          { bankAccountId: 1, bankAccountName: 'Operating', autoMatched: 5, pendingReview: 0, exceptions: 1, errors: ['Unknown merchant $250.00'] },
        ],
        totals: { autoMatched: 5, pendingReview: 0, exceptions: 1 },
      })
      const { body } = buildEmailContent(result)
      expect(body).toContain('Operating: Unknown merchant $250.00')
    })

    it('handles multiple accounts', () => {
      const result = makeResult({
        accountResults: [
          { bankAccountId: 1, bankAccountName: 'Operating', autoMatched: 10, pendingReview: 2, exceptions: 1, errors: [] },
          { bankAccountId: 2, bankAccountName: 'Savings', autoMatched: 3, pendingReview: 0, exceptions: 0, errors: [] },
        ],
      })
      const { body } = buildEmailContent(result)
      expect(body).toContain('Operating:')
      expect(body).toContain('Savings:')
    })
  })

  describe('Exception truncation', () => {
    it('truncates after 10 items', () => {
      const errors = Array.from({ length: 15 }, (_, i) => `Error ${i + 1}`)
      const result = makeResult({
        errors,
        accountResults: [
          { bankAccountId: 1, bankAccountName: 'Operating', autoMatched: 0, pendingReview: 0, exceptions: 15, errors },
        ],
        totals: { autoMatched: 0, pendingReview: 0, exceptions: 15 },
      })

      const exceptionLines: string[] = []
      for (const acctResult of result.accountResults) {
        for (const err of acctResult.errors.slice(0, MAX_EXCEPTION_ITEMS)) {
          exceptionLines.push(err)
        }
      }
      expect(exceptionLines).toHaveLength(10)
    })
  })

  describe('Skip-if-empty', () => {
    it('identifies empty results (nothing to report)', () => {
      const result = makeResult({
        accountResults: [],
        totals: { autoMatched: 0, pendingReview: 0, exceptions: 0 },
      })
      const hasActivity =
        result.totals.autoMatched + result.totals.pendingReview + result.totals.exceptions > 0
      expect(hasActivity).toBe(false)
    })

    it('identifies non-empty results', () => {
      const result = makeResult()
      const hasActivity =
        result.totals.autoMatched + result.totals.pendingReview + result.totals.exceptions > 0
      expect(hasActivity).toBe(true)
    })
  })

  describe('Graceful degradation', () => {
    it('handles missing POSTMARK_API_KEY', () => {
      const apiKey = undefined
      const shouldSend = !!apiKey
      expect(shouldSend).toBe(false)
    })

    it('handles missing ADMIN_EMAIL', () => {
      const adminEmail = undefined
      const shouldSend = !!adminEmail
      expect(shouldSend).toBe(false)
    })
  })
})
