import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'
import { getQuarterRange } from './types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Federal941Data {
  line1_employeeCount: number
  line2_totalWages: number
  line3_federalTaxWithheld: number
  line5a_ssWages: number
  line5a_ssTax: number  // × 0.124
  line5c_medicareWages: number
  line5c_medicareTax: number  // × 0.029
  line6_totalTaxBeforeAdjustments: number
  line10_totalTaxAfterAdjustments: number
}

export interface MaM941Data {
  totalWagesSubjectToMA: number
  maIncomeTaxWithheld: number
}

export interface QuarterlyTaxPrepFilters {
  year: number
  quarter: number // 1-4
}

export interface QuarterlyTaxPrepData {
  federal941: Federal941Data
  maM941: MaM941Data
  year: number
  quarter: number
  quarterLabel: string
  periodStart: string
  periodEnd: string
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getQuarterlyTaxPrepData(
  filters: QuarterlyTaxPrepFilters
): Promise<QuarterlyTaxPrepData> {
  const now = new Date().toISOString()
  const { year, quarter } = filters
  const { startDate, endDate } = getQuarterRange(year, quarter)

  // Aggregate for the quarter
  const result = await db
    .select({
      employeeCount: sql<string>`COUNT(DISTINCT ${payrollEntries.employeeId})`,
      totalWages: sql<string>`COALESCE(SUM(CAST(${payrollEntries.grossPay} AS numeric)), 0)`,
      federalWithheld: sql<string>`COALESCE(SUM(CAST(${payrollEntries.federalWithholding} AS numeric)), 0)`,
      stateWithheld: sql<string>`COALESCE(SUM(CAST(${payrollEntries.stateWithholding} AS numeric)), 0)`,
      ssEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployee} AS numeric)), 0)`,
      ssEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployer} AS numeric)), 0)`,
      medicareEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployee} AS numeric)), 0)`,
      medicareEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployer} AS numeric)), 0)`,
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

  const r = result[0]
  const totalWages = parseFloat(r?.totalWages ?? '0')
  const federalWithheld = parseFloat(r?.federalWithheld ?? '0')
  const stateWithheld = parseFloat(r?.stateWithheld ?? '0')
  const ssEe = parseFloat(r?.ssEmployee ?? '0')
  const ssEr = parseFloat(r?.ssEmployer ?? '0')
  const medEe = parseFloat(r?.medicareEmployee ?? '0')
  const medEr = parseFloat(r?.medicareEmployer ?? '0')

  // Federal 941 calculations
  const totalSSTax = ssEe + ssEr  // line 5a: both portions = 12.4%
  const totalMedTax = medEe + medEr  // line 5c: both portions = 2.9%
  const totalTax = federalWithheld + totalSSTax + totalMedTax

  const federal941: Federal941Data = {
    line1_employeeCount: parseInt(r?.employeeCount ?? '0'),
    line2_totalWages: Math.round(totalWages * 100) / 100,
    line3_federalTaxWithheld: Math.round(federalWithheld * 100) / 100,
    line5a_ssWages: Math.round(totalWages * 100) / 100,
    line5a_ssTax: Math.round(totalSSTax * 100) / 100,
    line5c_medicareWages: Math.round(totalWages * 100) / 100,
    line5c_medicareTax: Math.round(totalMedTax * 100) / 100,
    line6_totalTaxBeforeAdjustments: Math.round(totalTax * 100) / 100,
    line10_totalTaxAfterAdjustments: Math.round(totalTax * 100) / 100,
  }

  const maM941: MaM941Data = {
    totalWagesSubjectToMA: Math.round(totalWages * 100) / 100,
    maIncomeTaxWithheld: Math.round(stateWithheld * 100) / 100,
  }

  const quarterLabels = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)']

  return {
    federal941,
    maM941,
    year,
    quarter,
    quarterLabel: quarterLabels[quarter - 1],
    periodStart: startDate,
    periodEnd: endDate,
    generatedAt: now,
  }
}
