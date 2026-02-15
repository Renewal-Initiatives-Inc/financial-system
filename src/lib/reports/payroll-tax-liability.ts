import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface TaxLiabilityRow {
  taxType: string
  employeeAmount: number
  employerAmount: number
  totalAmount: number
}

export interface PayrollTaxLiabilityFilters {
  startDate: string
  endDate: string
}

export interface PayrollTaxLiabilityData {
  rows: TaxLiabilityRow[]
  totalEmployeeWithholding: number
  totalEmployerContribution: number
  grandTotal: number
  periodStart: string
  periodEnd: string
  employeeCount: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getPayrollTaxLiabilityData(
  filters: PayrollTaxLiabilityFilters
): Promise<PayrollTaxLiabilityData> {
  const now = new Date().toISOString()

  // Aggregate payroll entries for posted runs in the period
  const result = await db
    .select({
      totalFederalWithholding: sql<string>`COALESCE(SUM(CAST(${payrollEntries.federalWithholding} AS numeric)), 0)`,
      totalStateWithholding: sql<string>`COALESCE(SUM(CAST(${payrollEntries.stateWithholding} AS numeric)), 0)`,
      totalSSEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployee} AS numeric)), 0)`,
      totalMedicareEmployee: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployee} AS numeric)), 0)`,
      totalSSEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.socialSecurityEmployer} AS numeric)), 0)`,
      totalMedicareEmployer: sql<string>`COALESCE(SUM(CAST(${payrollEntries.medicareEmployer} AS numeric)), 0)`,
      employeeCount: sql<string>`COUNT(DISTINCT ${payrollEntries.employeeId})`,
    })
    .from(payrollEntries)
    .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollRuns.status, 'POSTED'),
        gte(payrollRuns.payPeriodStart, filters.startDate),
        lte(payrollRuns.payPeriodEnd, filters.endDate)
      )
    )

  const r = result[0]
  const fedW = parseFloat(r?.totalFederalWithholding ?? '0')
  const stateW = parseFloat(r?.totalStateWithholding ?? '0')
  const ssEe = parseFloat(r?.totalSSEmployee ?? '0')
  const medEe = parseFloat(r?.totalMedicareEmployee ?? '0')
  const ssEr = parseFloat(r?.totalSSEmployer ?? '0')
  const medEr = parseFloat(r?.totalMedicareEmployer ?? '0')

  const rows: TaxLiabilityRow[] = [
    { taxType: 'Federal Income Tax Withholding', employeeAmount: fedW, employerAmount: 0, totalAmount: fedW },
    { taxType: 'State Income Tax Withholding (MA)', employeeAmount: stateW, employerAmount: 0, totalAmount: stateW },
    { taxType: 'Social Security (6.2%)', employeeAmount: ssEe, employerAmount: ssEr, totalAmount: ssEe + ssEr },
    { taxType: 'Medicare (1.45%)', employeeAmount: medEe, employerAmount: medEr, totalAmount: medEe + medEr },
  ]

  const totalEmployeeWithholding = fedW + stateW + ssEe + medEe
  const totalEmployerContribution = ssEr + medEr
  const grandTotal = totalEmployeeWithholding + totalEmployerContribution

  return {
    rows,
    totalEmployeeWithholding: Math.round(totalEmployeeWithholding * 100) / 100,
    totalEmployerContribution: Math.round(totalEmployerContribution * 100) / 100,
    grandTotal: Math.round(grandTotal * 100) / 100,
    periodStart: filters.startDate,
    periodEnd: filters.endDate,
    employeeCount: parseInt(r?.employeeCount ?? '0'),
    generatedAt: now,
  }
}
