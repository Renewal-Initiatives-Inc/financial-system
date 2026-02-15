import { eq, and, gte, lte, desc } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollRuns, payrollEntries } from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FundAllocation {
  fundName: string
  percentage: number
  amount: number
}

export interface PayrollRegisterRow {
  entryId: number
  employeeId: string
  employeeName: string
  grossPay: number
  federalWithholding: number
  stateWithholding: number
  socialSecurityEmployee: number
  medicareEmployee: number
  netPay: number
  fundAllocations: FundAllocation[]
}

export interface PayrollRunSummary {
  runId: number
  payPeriodStart: string
  payPeriodEnd: string
  status: string
  rows: PayrollRegisterRow[]
  totalGross: number
  totalFederal: number
  totalState: number
  totalSS: number
  totalMedicare: number
  totalNet: number
}

export interface PayrollRegisterFilters {
  startDate?: string
  endDate?: string
  runId?: number
}

export interface PayrollRegisterData {
  runs: PayrollRunSummary[]
  grandTotalGross: number
  grandTotalFederal: number
  grandTotalState: number
  grandTotalSS: number
  grandTotalMedicare: number
  grandTotalNet: number
  generatedAt: string
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getPayrollRegisterData(
  filters?: PayrollRegisterFilters
): Promise<PayrollRegisterData> {
  const now = new Date().toISOString()

  // Get payroll runs
  const conditions = []
  if (filters?.runId) {
    conditions.push(eq(payrollRuns.id, filters.runId))
  }
  if (filters?.startDate) {
    conditions.push(gte(payrollRuns.payPeriodStart, filters.startDate))
  }
  if (filters?.endDate) {
    conditions.push(lte(payrollRuns.payPeriodEnd, filters.endDate))
  }
  // Only show POSTED runs
  conditions.push(eq(payrollRuns.status, 'POSTED'))

  const runs = await db
    .select()
    .from(payrollRuns)
    .where(and(...conditions))
    .orderBy(desc(payrollRuns.payPeriodEnd))

  if (runs.length === 0) {
    return {
      runs: [],
      grandTotalGross: 0,
      grandTotalFederal: 0,
      grandTotalState: 0,
      grandTotalSS: 0,
      grandTotalMedicare: 0,
      grandTotalNet: 0,
      generatedAt: now,
    }
  }

  // Get entries for all matching runs
  const runSummaries: PayrollRunSummary[] = []

  for (const run of runs) {
    const entries = await db
      .select()
      .from(payrollEntries)
      .where(eq(payrollEntries.payrollRunId, run.id))
      .orderBy(payrollEntries.employeeName)

    const rows: PayrollRegisterRow[] = entries.map((e) => {
      // Parse fund allocations JSONB
      let fundAllocs: FundAllocation[] = []
      if (e.fundAllocations && typeof e.fundAllocations === 'object') {
        const allocs = e.fundAllocations as Record<string, unknown>[]
        if (Array.isArray(allocs)) {
          fundAllocs = allocs.map((a: Record<string, unknown>) => ({
            fundName: String(a.fundName ?? ''),
            percentage: Number(a.percentage ?? 0),
            amount: Number(a.amount ?? 0),
          }))
        }
      }

      return {
        entryId: e.id,
        employeeId: e.employeeId,
        employeeName: e.employeeName,
        grossPay: parseFloat(e.grossPay),
        federalWithholding: parseFloat(e.federalWithholding),
        stateWithholding: parseFloat(e.stateWithholding),
        socialSecurityEmployee: parseFloat(e.socialSecurityEmployee),
        medicareEmployee: parseFloat(e.medicareEmployee),
        netPay: parseFloat(e.netPay),
        fundAllocations: fundAllocs,
      }
    })

    runSummaries.push({
      runId: run.id,
      payPeriodStart: run.payPeriodStart,
      payPeriodEnd: run.payPeriodEnd,
      status: run.status,
      rows,
      totalGross: rows.reduce((s, r) => s + r.grossPay, 0),
      totalFederal: rows.reduce((s, r) => s + r.federalWithholding, 0),
      totalState: rows.reduce((s, r) => s + r.stateWithholding, 0),
      totalSS: rows.reduce((s, r) => s + r.socialSecurityEmployee, 0),
      totalMedicare: rows.reduce((s, r) => s + r.medicareEmployee, 0),
      totalNet: rows.reduce((s, r) => s + r.netPay, 0),
    })
  }

  return {
    runs: runSummaries,
    grandTotalGross: runSummaries.reduce((s, r) => s + r.totalGross, 0),
    grandTotalFederal: runSummaries.reduce((s, r) => s + r.totalFederal, 0),
    grandTotalState: runSummaries.reduce((s, r) => s + r.totalState, 0),
    grandTotalSS: runSummaries.reduce((s, r) => s + r.totalSS, 0),
    grandTotalMedicare: runSummaries.reduce((s, r) => s + r.totalMedicare, 0),
    grandTotalNet: runSummaries.reduce((s, r) => s + r.totalNet, 0),
    generatedAt: now,
  }
}
