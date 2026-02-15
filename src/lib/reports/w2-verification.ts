import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries, annualRateConfig } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface W2Row {
  employeeId: string
  employeeName: string
  box1: number  // Wages, tips, other compensation
  box2: number  // Federal income tax withheld
  box3: number  // Social Security wages (capped at SS wage base)
  box4: number  // Social Security tax withheld
  box5: number  // Medicare wages (no cap)
  box6: number  // Medicare tax withheld
  box16: number // State wages
  box17: number // State income tax withheld
  hasWageBaseExceeded: boolean
}

export interface W2VerificationFilters {
  year: number
}

export interface W2VerificationData {
  rows: W2Row[]
  year: number
  ssWageBase: number
  totalEmployees: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getW2VerificationData(
  filters: W2VerificationFilters
): Promise<W2VerificationData> {
  const now = new Date().toISOString()
  const { year } = filters
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // Get SS wage base from annual rate config
  const ssConfig = await db
    .select({ value: annualRateConfig.value })
    .from(annualRateConfig)
    .where(
      and(
        eq(annualRateConfig.fiscalYear, year),
        eq(annualRateConfig.configKey, 'ss_wage_base')
      )
    )
    .limit(1)

  const ssWageBase = ssConfig.length > 0 ? parseFloat(ssConfig[0].value) : 168600 // 2024 default

  // Aggregate payroll entries by employee for the calendar year
  const entries = await db
    .select({
      employeeId: payrollEntries.employeeId,
      employeeName: payrollEntries.employeeName,
      totalGross: sql<string>`SUM(CAST(${payrollEntries.grossPay} AS numeric))`,
      totalFederal: sql<string>`SUM(CAST(${payrollEntries.federalWithholding} AS numeric))`,
      totalState: sql<string>`SUM(CAST(${payrollEntries.stateWithholding} AS numeric))`,
      totalSSEmployee: sql<string>`SUM(CAST(${payrollEntries.socialSecurityEmployee} AS numeric))`,
      totalMedicareEmployee: sql<string>`SUM(CAST(${payrollEntries.medicareEmployee} AS numeric))`,
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
    .groupBy(payrollEntries.employeeId, payrollEntries.employeeName)
    .orderBy(payrollEntries.employeeName)

  const rows: W2Row[] = entries.map((e) => {
    const gross = parseFloat(e.totalGross ?? '0')
    const ssWages = Math.min(gross, ssWageBase)

    return {
      employeeId: e.employeeId,
      employeeName: e.employeeName,
      box1: Math.round(gross * 100) / 100,
      box2: Math.round(parseFloat(e.totalFederal ?? '0') * 100) / 100,
      box3: Math.round(ssWages * 100) / 100,
      box4: Math.round(parseFloat(e.totalSSEmployee ?? '0') * 100) / 100,
      box5: Math.round(gross * 100) / 100,
      box6: Math.round(parseFloat(e.totalMedicareEmployee ?? '0') * 100) / 100,
      box16: Math.round(gross * 100) / 100,
      box17: Math.round(parseFloat(e.totalState ?? '0') * 100) / 100,
      hasWageBaseExceeded: gross > ssWageBase,
    }
  })

  return {
    rows,
    year,
    ssWageBase,
    totalEmployees: rows.length,
    generatedAt: now,
  }
}
