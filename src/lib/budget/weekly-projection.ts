import { eq, and, sql, gte, lte, inArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  invoices,
  pledges,
  payrollRuns,
  payrollEntries,
  recurringExpectations,
  tenants,
  budgetLines,
  budgets,
  accounts,
  funds,
  vendors,
  donors,
  transactionLines,
  transactions,
} from '@/lib/db/schema'

export interface WeeklyProjectionLineData {
  weekNumber: number
  weekStartDate: string
  sourceLabel: string
  autoAmount: number
  lineType: 'INFLOW' | 'OUTFLOW'
  confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW'
  fundId: number | null
  sortOrder: number
}

/**
 * Get the Monday of the next week from a given date.
 */
function getNextMonday(from: Date): Date {
  const d = new Date(from)
  const day = d.getDay()
  // days until next Monday: if Sunday(0)→1, Mon(1)→7, Tue(2)→6, etc.
  const daysUntilMonday = day === 0 ? 1 : 8 - day
  d.setDate(d.getDate() + daysUntilMonday)
  d.setHours(0, 0, 0, 0)
  return d
}

/**
 * Format a Date as YYYY-MM-DD string.
 */
function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

/**
 * Add N days to a date.
 */
function addDays(d: Date, n: number): Date {
  const result = new Date(d)
  result.setDate(result.getDate() + n)
  return result
}

/**
 * Check if a date falls within a week window (weekStart to weekStart+6 days).
 */
function isInWeek(dateStr: string, weekStart: Date): boolean {
  const d = new Date(dateStr)
  const weekEnd = addDays(weekStart, 6)
  return d >= weekStart && d <= weekEnd
}

// ---------------------------------------------------------------------------
// HIGH confidence sources (weeks 1-2)
// ---------------------------------------------------------------------------

/**
 * Get AR invoices with due dates in the given window → INFLOW.
 */
async function getInvoiceInflows(
  windowStart: string,
  windowEnd: string
): Promise<{ amount: number; label: string; dueDate: string; fundId: number | null }[]> {
  const rows = await db
    .select({
      amount: invoices.amount,
      invoiceNumber: invoices.invoiceNumber,
      dueDate: invoices.dueDate,
      fundId: invoices.fundId,
      vendorName: vendors.name,
    })
    .from(invoices)
    .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
    .where(
      and(
        eq(invoices.direction, 'AR'),
        inArray(invoices.paymentStatus, ['PENDING', 'POSTED']),
        gte(invoices.dueDate, windowStart),
        lte(invoices.dueDate, windowEnd)
      )
    )

  return rows.map((r) => ({
    amount: Number(r.amount),
    label: `AR Invoice ${r.invoiceNumber ?? ''} — ${r.vendorName ?? 'Unknown'}`.trim(),
    dueDate: r.dueDate ?? windowStart,
    fundId: r.fundId,
  }))
}

/**
 * Get AP invoices with due dates in the given window → OUTFLOW.
 */
async function getInvoiceOutflows(
  windowStart: string,
  windowEnd: string
): Promise<{ amount: number; label: string; dueDate: string; fundId: number | null }[]> {
  const rows = await db
    .select({
      amount: invoices.amount,
      invoiceNumber: invoices.invoiceNumber,
      dueDate: invoices.dueDate,
      fundId: invoices.fundId,
      vendorName: vendors.name,
    })
    .from(invoices)
    .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
    .where(
      and(
        eq(invoices.direction, 'AP'),
        inArray(invoices.paymentStatus, ['PENDING', 'POSTED', 'PAYMENT_IN_PROCESS']),
        gte(invoices.dueDate, windowStart),
        lte(invoices.dueDate, windowEnd)
      )
    )

  return rows.map((r) => ({
    amount: Number(r.amount),
    label: `AP Invoice ${r.invoiceNumber ?? ''} — ${r.vendorName ?? 'Unknown'}`.trim(),
    dueDate: r.dueDate ?? windowStart,
    fundId: r.fundId,
  }))
}

/**
 * Get pending pledges with expected dates in the window → INFLOW.
 */
async function getPledgeInflows(
  windowStart: string,
  windowEnd: string
): Promise<{ amount: number; label: string; expectedDate: string; fundId: number }[]> {
  const rows = await db
    .select({
      amount: pledges.amount,
      expectedDate: pledges.expectedDate,
      fundId: pledges.fundId,
      donorName: donors.name,
    })
    .from(pledges)
    .leftJoin(donors, eq(pledges.donorId, donors.id))
    .where(
      and(
        eq(pledges.status, 'PLEDGED'),
        gte(pledges.expectedDate, windowStart),
        lte(pledges.expectedDate, windowEnd)
      )
    )

  return rows.map((r) => ({
    amount: Number(r.amount),
    label: `Pledge — ${r.donorName ?? 'Unknown Donor'}`,
    expectedDate: r.expectedDate ?? windowStart,
    fundId: r.fundId,
  }))
}

/**
 * Get scheduled rent from active tenants → INFLOW (monthly, first of month).
 */
async function getRentInflows(): Promise<
  { monthlyAmount: number; tenantName: string }[]
> {
  const rows = await db
    .select({
      monthlyRent: tenants.monthlyRent,
      name: tenants.name,
    })
    .from(tenants)
    .where(eq(tenants.isActive, true))

  return rows.map((r) => ({
    monthlyAmount: Number(r.monthlyRent),
    tenantName: r.name,
  }))
}

/**
 * Get payroll runs that overlap with the given window → OUTFLOW.
 */
async function getPayrollOutflows(
  windowStart: string,
  windowEnd: string
): Promise<{ amount: number; label: string; payDate: string }[]> {
  const runs = await db
    .select({
      id: payrollRuns.id,
      payPeriodEnd: payrollRuns.payPeriodEnd,
    })
    .from(payrollRuns)
    .where(
      and(
        inArray(payrollRuns.status, ['DRAFT', 'CALCULATED']),
        gte(payrollRuns.payPeriodEnd, windowStart),
        lte(payrollRuns.payPeriodEnd, windowEnd)
      )
    )

  const results: { amount: number; label: string; payDate: string }[] = []
  for (const run of runs) {
    const entries = await db
      .select({
        grossPay: payrollEntries.grossPay,
        socialSecurityEmployer: payrollEntries.socialSecurityEmployer,
        medicareEmployer: payrollEntries.medicareEmployer,
      })
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollRunId, run.id))

    const total = entries.reduce(
      (sum, e) =>
        sum +
        Number(e.grossPay) +
        Number(e.socialSecurityEmployer) +
        Number(e.medicareEmployer),
      0
    )

    if (total > 0) {
      results.push({
        amount: total,
        label: `Payroll — period ending ${run.payPeriodEnd}`,
        payDate: run.payPeriodEnd,
      })
    }
  }

  return results
}

/**
 * Get active recurring expectations → INFLOW or OUTFLOW depending on account type.
 */
async function getRecurringExpectationLines(
  windowStart: string,
  windowEnd: string
): Promise<
  {
    amount: number
    label: string
    lineType: 'INFLOW' | 'OUTFLOW'
    fundId: number
    dueDate: string
  }[]
> {
  const rows = await db
    .select({
      id: recurringExpectations.id,
      description: recurringExpectations.description,
      expectedAmount: recurringExpectations.expectedAmount,
      frequency: recurringExpectations.frequency,
      expectedDay: recurringExpectations.expectedDay,
      fundId: recurringExpectations.fundId,
      glAccountId: recurringExpectations.glAccountId,
      accountType: accounts.type,
    })
    .from(recurringExpectations)
    .innerJoin(accounts, eq(recurringExpectations.glAccountId, accounts.id))
    .where(eq(recurringExpectations.isActive, true))

  const results: {
    amount: number
    label: string
    lineType: 'INFLOW' | 'OUTFLOW'
    fundId: number
    dueDate: string
  }[] = []

  const start = new Date(windowStart)
  const end = new Date(windowEnd)

  for (const row of rows) {
    const expectedDates = getExpectedDatesInWindow(
      row.frequency as string,
      row.expectedDay,
      start,
      end
    )

    for (const dateStr of expectedDates) {
      results.push({
        amount: Number(row.expectedAmount),
        label: row.description,
        lineType: row.accountType === 'REVENUE' ? 'INFLOW' : 'OUTFLOW',
        fundId: row.fundId,
        dueDate: dateStr,
      })
    }
  }

  return results
}

/**
 * Calculate expected occurrence dates for a recurring expectation within a window.
 */
function getExpectedDatesInWindow(
  frequency: string,
  expectedDay: number,
  start: Date,
  end: Date
): string[] {
  const dates: string[] = []

  if (frequency === 'monthly') {
    // Check each month in the window
    const cursor = new Date(start.getFullYear(), start.getMonth(), expectedDay)
    if (cursor < start) cursor.setMonth(cursor.getMonth() + 1)
    while (cursor <= end) {
      dates.push(toDateStr(cursor))
      cursor.setMonth(cursor.getMonth() + 1)
    }
  } else if (frequency === 'weekly') {
    // expectedDay is day of week (1=Mon..7=Sun)
    const cursor = new Date(start)
    const targetDow = expectedDay % 7 // convert to JS day (0=Sun)
    while (cursor.getDay() !== targetDow) cursor.setDate(cursor.getDate() + 1)
    while (cursor <= end) {
      dates.push(toDateStr(cursor))
      cursor.setDate(cursor.getDate() + 7)
    }
  } else if (frequency === 'biweekly') {
    const cursor = new Date(start)
    const targetDow = expectedDay % 7
    while (cursor.getDay() !== targetDow) cursor.setDate(cursor.getDate() + 1)
    while (cursor <= end) {
      dates.push(toDateStr(cursor))
      cursor.setDate(cursor.getDate() + 14)
    }
  } else if (frequency === 'quarterly') {
    const quarterMonths = [1, 4, 7, 10]
    for (const m of quarterMonths) {
      const d = new Date(start.getFullYear(), m - 1, expectedDay)
      if (d >= start && d <= end) dates.push(toDateStr(d))
    }
  } else if (frequency === 'annual') {
    const d = new Date(start.getFullYear(), 0, expectedDay)
    if (d >= start && d <= end) dates.push(toDateStr(d))
  }

  return dates
}

// ---------------------------------------------------------------------------
// MODERATE / LOW confidence sources (weeks 3-13)
// ---------------------------------------------------------------------------

/**
 * Get budget-based weekly estimates: monthly budget ÷ 4.33.
 */
async function getBudgetBasedWeeklyLines(
  fiscalYear: number
): Promise<
  {
    sourceLabel: string
    weeklyAmount: number
    lineType: 'INFLOW' | 'OUTFLOW'
    fundId: number
  }[]
> {
  const budget = await db
    .select()
    .from(budgets)
    .where(eq(budgets.fiscalYear, fiscalYear))
    .limit(1)

  if (budget.length === 0) return []

  const lines = await db
    .select({
      accountName: accounts.name,
      accountType: accounts.type,
      fundId: budgetLines.fundId,
      monthlyAmounts: budgetLines.monthlyAmounts,
    })
    .from(budgetLines)
    .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .where(eq(budgetLines.budgetId, budget[0].id))

  const currentMonth = new Date().getMonth() // 0-indexed

  return lines
    .map((l) => {
      const monthly = l.monthlyAmounts as number[]
      // Use average of remaining months for weekly estimate
      const remainingMonths = monthly.slice(currentMonth)
      const avgMonthly =
        remainingMonths.length > 0
          ? remainingMonths.reduce((a, b) => a + b, 0) / remainingMonths.length
          : 0
      const weeklyAmount = Math.round((avgMonthly / 4.33) * 100) / 100

      return {
        sourceLabel: l.accountName,
        weeklyAmount,
        lineType: (l.accountType === 'REVENUE' ? 'INFLOW' : 'OUTFLOW') as
          | 'INFLOW'
          | 'OUTFLOW',
        fundId: l.fundId,
      }
    })
    .filter((l) => Math.abs(l.weeklyAmount) >= 0.01)
}

/**
 * Get GL 3-month average weekly estimates as fallback.
 */
async function getGlAverageWeeklyLines(): Promise<
  {
    sourceLabel: string
    weeklyAmount: number
    lineType: 'INFLOW' | 'OUTFLOW'
    fundId: number
  }[]
> {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, 1)
  const startDate = toDateStr(threeMonthsAgo)
  const endDate = toDateStr(now)

  const rows = await db
    .select({
      accountId: transactionLines.accountId,
      accountName: accounts.name,
      accountType: accounts.type,
      fundId: transactionLines.fundId,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
      normalBalance: accounts.normalBalance,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactions.isVoided, false),
        gte(transactions.date, startDate),
        lte(transactions.date, endDate),
        sql`${accounts.type} IN ('REVENUE', 'EXPENSE')`
      )
    )
    .groupBy(
      transactionLines.accountId,
      accounts.name,
      accounts.type,
      transactionLines.fundId,
      accounts.normalBalance
    )

  return rows
    .map((r) => {
      const debits = Number(r.totalDebit)
      const credits = Number(r.totalCredit)
      const total =
        r.normalBalance === 'CREDIT' ? credits - debits : debits - credits
      const monthlyAvg = total / 3
      const weeklyAmount = Math.round((monthlyAvg / 4.33) * 100) / 100

      return {
        sourceLabel: r.accountName,
        weeklyAmount: Math.abs(weeklyAmount),
        lineType: (r.accountType === 'REVENUE' ? 'INFLOW' : 'OUTFLOW') as
          | 'INFLOW'
          | 'OUTFLOW',
        fundId: r.fundId,
      }
    })
    .filter((l) => l.weeklyAmount >= 0.01)
}

// ---------------------------------------------------------------------------
// Main generator
// ---------------------------------------------------------------------------

/**
 * Generate 13 weeks of INFLOW + OUTFLOW projection lines starting from next Monday.
 * Returns lines ready to be inserted into weekly_cash_projection_lines.
 */
export async function generateWeeklyProjection(
  fiscalYear: number
): Promise<WeeklyProjectionLineData[]> {
  const now = new Date()
  const week1Start = getNextMonday(now)
  const allLines: WeeklyProjectionLineData[] = []

  // Preload data sources for moderate/low weeks
  let budgetWeeklyLines = await getBudgetBasedWeeklyLines(fiscalYear)
  if (budgetWeeklyLines.length === 0) {
    // Fallback to GL 3-month average
    budgetWeeklyLines = await getGlAverageWeeklyLines()
  }

  // Preload rent inflows (same every week for high-confidence)
  const rentData = await getRentInflows()
  const totalMonthlyRent = rentData.reduce((sum, r) => sum + r.monthlyAmount, 0)
  const weeklyRent = Math.round((totalMonthlyRent / 4.33) * 100) / 100

  for (let w = 1; w <= 13; w++) {
    const weekStart = addDays(week1Start, (w - 1) * 7)
    const weekEnd = addDays(weekStart, 6)
    const weekStartStr = toDateStr(weekStart)
    const weekEndStr = toDateStr(weekEnd)

    const isHighConfidence = w <= 2
    const isModerateConfidence = w >= 3 && w <= 8
    const confidenceLevel: 'HIGH' | 'MODERATE' | 'LOW' = isHighConfidence
      ? 'HIGH'
      : isModerateConfidence
        ? 'MODERATE'
        : 'LOW'

    let inflowSort = 0
    let outflowSort = 100

    if (isHighConfidence) {
      // --- HIGH confidence: real data sources ---

      // AR Invoices
      const arInvoices = await getInvoiceInflows(weekStartStr, weekEndStr)
      for (const inv of arInvoices) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: inv.label,
          autoAmount: inv.amount,
          lineType: 'INFLOW',
          confidenceLevel: 'HIGH',
          fundId: inv.fundId,
          sortOrder: inflowSort++,
        })
      }

      // Pledges
      const pledgeItems = await getPledgeInflows(weekStartStr, weekEndStr)
      for (const p of pledgeItems) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: p.label,
          autoAmount: p.amount,
          lineType: 'INFLOW',
          confidenceLevel: 'HIGH',
          fundId: p.fundId,
          sortOrder: inflowSort++,
        })
      }

      // Rent — check if first of month falls in this week
      const firstOfMonth = new Date(weekStart.getFullYear(), weekStart.getMonth(), 1)
      if (isInWeek(toDateStr(firstOfMonth), weekStart) && totalMonthlyRent > 0) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: `Tenant Rent (${rentData.length} tenants)`,
          autoAmount: totalMonthlyRent,
          lineType: 'INFLOW',
          confidenceLevel: 'HIGH',
          fundId: null,
          sortOrder: inflowSort++,
        })
      }

      // AP Invoices
      const apInvoices = await getInvoiceOutflows(weekStartStr, weekEndStr)
      for (const inv of apInvoices) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: inv.label,
          autoAmount: inv.amount,
          lineType: 'OUTFLOW',
          confidenceLevel: 'HIGH',
          fundId: inv.fundId,
          sortOrder: outflowSort++,
        })
      }

      // Payroll
      const payroll = await getPayrollOutflows(weekStartStr, weekEndStr)
      for (const p of payroll) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: p.label,
          autoAmount: p.amount,
          lineType: 'OUTFLOW',
          confidenceLevel: 'HIGH',
          fundId: null,
          sortOrder: outflowSort++,
        })
      }

      // Recurring expectations
      const recurring = await getRecurringExpectationLines(weekStartStr, weekEndStr)
      for (const r of recurring) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: r.label,
          autoAmount: r.amount,
          lineType: r.lineType,
          confidenceLevel: 'HIGH',
          fundId: r.fundId,
          sortOrder: r.lineType === 'INFLOW' ? inflowSort++ : outflowSort++,
        })
      }
    } else {
      // --- MODERATE/LOW confidence: budget-based or GL average ---

      // Also include recurring expectations for moderate weeks
      if (isModerateConfidence) {
        const recurring = await getRecurringExpectationLines(weekStartStr, weekEndStr)
        for (const r of recurring) {
          allLines.push({
            weekNumber: w,
            weekStartDate: weekStartStr,
            sourceLabel: r.label,
            autoAmount: r.amount,
            lineType: r.lineType,
            confidenceLevel: 'MODERATE',
            fundId: r.fundId,
            sortOrder: r.lineType === 'INFLOW' ? inflowSort++ : outflowSort++,
          })
        }
      }

      // Budget-based lines
      for (const bl of budgetWeeklyLines) {
        allLines.push({
          weekNumber: w,
          weekStartDate: weekStartStr,
          sourceLabel: bl.sourceLabel,
          autoAmount: bl.weeklyAmount,
          lineType: bl.lineType,
          confidenceLevel,
          fundId: bl.fundId,
          sortOrder: bl.lineType === 'INFLOW' ? inflowSort++ : outflowSort++,
        })
      }
    }
  }

  return allLines
}

/**
 * Get starting cash balance — reuses logic from projection.ts.
 */
export { getStartingCash } from './projection'
