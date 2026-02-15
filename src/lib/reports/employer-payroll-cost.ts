import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries, budgets, budgetLines, accounts } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EmployerCostMonth {
  month: string // YYYY-MM
  monthLabel: string
  totalWages: number
  employerSS: number
  employerMedicare: number
  totalEmployerFICA: number
  totalBurden: number
  budget: number | null
  variance: number | null
}

export interface EmployerPayrollCostFilters {
  year: number
}

export interface EmployerPayrollCostData {
  months: EmployerCostMonth[]
  ytdWages: number
  ytdEmployerSS: number
  ytdEmployerMedicare: number
  ytdTotalFICA: number
  ytdTotalBurden: number
  ytdBudget: number | null
  ytdVariance: number | null
  year: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getMonthLabel(ym: string): string {
  const [y, m] = ym.split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'short' })
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getEmployerPayrollCostData(
  filters: EmployerPayrollCostFilters
): Promise<EmployerPayrollCostData> {
  const now = new Date().toISOString()
  const { year } = filters
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // Monthly payroll aggregation
  const monthlyData = await db
    .select({
      month: sql<string>`TO_CHAR(${payrollRuns.payPeriodEnd}::date, 'YYYY-MM')`,
      totalWages: sql<string>`SUM(CAST(${payrollEntries.grossPay} AS numeric))`,
      employerSS: sql<string>`SUM(CAST(${payrollEntries.socialSecurityEmployer} AS numeric))`,
      employerMedicare: sql<string>`SUM(CAST(${payrollEntries.medicareEmployer} AS numeric))`,
    })
    .from(payrollEntries)
    .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollRuns.status, 'POSTED'),
        gte(payrollRuns.payPeriodStart, startDate),
        lte(payrollRuns.payPeriodEnd, endDate)
      )
    )
    .groupBy(sql`TO_CHAR(${payrollRuns.payPeriodEnd}::date, 'YYYY-MM')`)
    .orderBy(sql`TO_CHAR(${payrollRuns.payPeriodEnd}::date, 'YYYY-MM')`)

  // Get approved budget for salary accounts
  const approvedBudget = await db
    .select({
      monthlyAmounts: budgetLines.monthlyAmounts,
    })
    .from(budgetLines)
    .innerJoin(budgets, eq(budgetLines.budgetId, budgets.id))
    .innerJoin(accounts, eq(budgetLines.accountId, accounts.id))
    .where(
      and(
        eq(budgets.fiscalYear, year),
        eq(budgets.status, 'APPROVED'),
        sql`(${accounts.name} ILIKE '%salaries%' OR ${accounts.name} ILIKE '%wages%' OR ${accounts.name} ILIKE '%payroll%')`
      )
    )

  // Sum budget monthly amounts across all matching budget lines
  const budgetByMonth: number[] = new Array(12).fill(0)
  for (const bl of approvedBudget) {
    const amounts = bl.monthlyAmounts as number[]
    if (Array.isArray(amounts)) {
      for (let i = 0; i < Math.min(amounts.length, 12); i++) {
        budgetByMonth[i] += amounts[i]
      }
    }
  }

  const months: EmployerCostMonth[] = monthlyData.map((m) => {
    const wages = parseFloat(m.totalWages ?? '0')
    const ss = parseFloat(m.employerSS ?? '0')
    const med = parseFloat(m.employerMedicare ?? '0')
    const fica = ss + med
    const burden = wages + fica
    const monthIndex = parseInt(m.month.split('-')[1]) - 1
    const budget = budgetByMonth[monthIndex] || null
    const variance = budget !== null ? budget - burden : null

    return {
      month: m.month,
      monthLabel: getMonthLabel(m.month),
      totalWages: Math.round(wages * 100) / 100,
      employerSS: Math.round(ss * 100) / 100,
      employerMedicare: Math.round(med * 100) / 100,
      totalEmployerFICA: Math.round(fica * 100) / 100,
      totalBurden: Math.round(burden * 100) / 100,
      budget: budget !== null ? Math.round(budget * 100) / 100 : null,
      variance: variance !== null ? Math.round(variance * 100) / 100 : null,
    }
  })

  const ytdWages = months.reduce((s, m) => s + m.totalWages, 0)
  const ytdSS = months.reduce((s, m) => s + m.employerSS, 0)
  const ytdMed = months.reduce((s, m) => s + m.employerMedicare, 0)
  const ytdFICA = ytdSS + ytdMed
  const ytdBurden = ytdWages + ytdFICA
  const ytdBudget = budgetByMonth.reduce((s, b) => s + b, 0) || null
  const ytdVariance = ytdBudget !== null ? ytdBudget - ytdBurden : null

  return {
    months,
    ytdWages: Math.round(ytdWages * 100) / 100,
    ytdEmployerSS: Math.round(ytdSS * 100) / 100,
    ytdEmployerMedicare: Math.round(ytdMed * 100) / 100,
    ytdTotalFICA: Math.round(ytdFICA * 100) / 100,
    ytdTotalBurden: Math.round(ytdBurden * 100) / 100,
    ytdBudget: ytdBudget !== null ? Math.round(ytdBudget * 100) / 100 : null,
    ytdVariance: ytdVariance !== null ? Math.round(ytdVariance * 100) / 100 : null,
    year,
    generatedAt: now,
  }
}
