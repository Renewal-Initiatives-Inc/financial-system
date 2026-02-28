import { NextResponse } from 'next/server'
import {
  accrueInterestForFund,
  getActiveLoanFunds,
  type AccrualResult,
} from '@/lib/assets/interest-accrual'

/**
 * Interest accrual cron job.
 *
 * Runs on the 28th of each month (vercel.json: 0 6 28 * *).
 * Iterates all active LOAN-category funding sources, calculates interest
 * on the drawn balance using Actual/365, and posts:
 *   DR 5100 Interest Expense / CR 2520 Accrued Interest Payable
 *
 * Idempotent — safe to retry. Skips funds that already have an accrual
 * for the target month.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Default to current month; allow override via ?month=2026-01 for catch-up
  const url = new URL(request.url)
  const monthParam = url.searchParams.get('month')
  const yearMonth = monthParam ?? getCurrentYearMonth()

  // Validate format
  if (!/^\d{4}-\d{2}$/.test(yearMonth)) {
    return NextResponse.json(
      { error: 'Invalid month format. Use YYYY-MM.' },
      { status: 400 }
    )
  }

  const loanFunds = await getActiveLoanFunds()

  if (loanFunds.length === 0) {
    return NextResponse.json({
      success: true,
      message: 'No active LOAN funds found',
      results: [],
    })
  }

  const results: AccrualResult[] = []

  for (const fund of loanFunds) {
    const result = await accrueInterestForFund(fund.id, fund.name, yearMonth)
    results.push(result)
  }

  const posted = results.filter((r) => !r.skipped)
  const skipped = results.filter((r) => r.skipped)

  return NextResponse.json({
    success: true,
    month: yearMonth,
    summary: {
      fundsProcessed: results.length,
      accrualPosted: posted.length,
      skipped: skipped.length,
      totalInterest: posted.reduce((sum, r) => sum + r.interest, 0),
    },
    results,
  })
}

function getCurrentYearMonth(): string {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}
