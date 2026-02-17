/**
 * Payroll Engine — Orchestrator
 *
 * Coordinates the full payroll calculation and GL posting pipeline:
 * 1. calculatePayrollRun: Compute withholdings for all employees
 * 2. postPayrollRun: Create GL journal entries and update statuses
 */

import { eq, and, inArray, sql } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { db } from '@/lib/db'
import {
  payrollRuns,
  payrollEntries,
  stagingRecords,
  accounts,
  funds,
} from '@/lib/db/schema'
import { logAudit } from '@/lib/audit/logger'
import { createTransaction } from '@/lib/gl/engine'
import { getPayrollRates } from './rates'
import { calculateFederalWithholding } from './federal-tax'
import { calculateMAWithholding } from './ma-state-tax'
import { calculateFICA } from './fica'
import { calculateGrossPay, type EmployeeGrossPay } from './gross-pay'
import {
  getActiveEmployees,
  getEmployeeYtdWages,
  type EmployeePayrollData,
} from '@/lib/integrations/people'

export interface PayrollCalculation {
  runId: number
  payPeriodStart: string
  payPeriodEnd: string
  entries: PayrollEntryCalc[]
  totals: {
    grossPay: number
    federalWithholding: number
    stateWithholding: number
    socialSecurityEmployee: number
    medicareEmployee: number
    socialSecurityEmployer: number
    medicareEmployer: number
    netPay: number
    totalEmployerCost: number
  }
}

export interface PayrollEntryCalc {
  employeeId: string
  employeeName: string
  grossPay: number
  federalWithholding: number
  stateWithholding: number
  socialSecurityEmployee: number
  medicareEmployee: number
  socialSecurityEmployer: number
  medicareEmployer: number
  netPay: number
  fundAllocations: Array<{
    fundId: number
    fundName: string
    amount: string
    hours: string
  }>
  grossPayDetail: EmployeeGrossPay
}

interface PayrollAccounts {
  salariesWages: number // 5000
  accruedPayroll: number // 2100
  federalTax: number // 2110
  stateTax: number // 2120
  socialSecurity: number // 2130
  medicare: number // 2140
}

/**
 * Resolve payroll account IDs by their codes.
 */
async function getPayrollAccountIds(): Promise<PayrollAccounts> {
  const codes = ['5000', '2100', '2110', '2120', '2130', '2140']
  const result = await db
    .select({ id: accounts.id, code: accounts.code })
    .from(accounts)
    .where(inArray(accounts.code, codes))

  const codeMap = new Map(result.map((r) => [r.code, r.id]))

  const resolve = (code: string) => {
    const id = codeMap.get(code)
    if (!id) throw new Error(`Payroll account ${code} not found in chart of accounts`)
    return id
  }

  return {
    salariesWages: resolve('5000'),
    accruedPayroll: resolve('2100'),
    federalTax: resolve('2110'),
    stateTax: resolve('2120'),
    socialSecurity: resolve('2130'),
    medicare: resolve('2140'),
  }
}

/**
 * Fetch staging records for a pay period (timesheets only).
 */
async function getStagingRecordsForPayroll(
  payPeriodStart: string,
  payPeriodEnd: string
) {
  return db
    .select()
    .from(stagingRecords)
    .where(
      and(
        eq(stagingRecords.sourceApp, 'timesheets'),
        eq(stagingRecords.recordType, 'timesheet_fund_summary'),
        eq(stagingRecords.status, 'received'),
        sql`${stagingRecords.dateIncurred} >= ${payPeriodStart}`,
        sql`${stagingRecords.dateIncurred} <= ${payPeriodEnd}`
      )
    )
}

/**
 * Calculate a payroll run — computes all withholdings but does NOT persist entries.
 * Returns the calculation result for review before posting.
 */
export async function calculatePayrollRun(
  runId: number
): Promise<PayrollCalculation> {
  // Load the payroll run
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, runId))

  if (!run) throw new Error(`Payroll run ${runId} not found`)

  // Determine tax year from pay period
  const taxYear = parseInt(run.payPeriodEnd.substring(0, 4), 10)

  // Fetch data in parallel
  const [rawStagingRecords, employees, rates, fundRows] = await Promise.all([
    getStagingRecordsForPayroll(run.payPeriodStart, run.payPeriodEnd),
    getActiveEmployees(),
    getPayrollRates(taxYear),
    db.select({ id: funds.id, name: funds.name }).from(funds),
  ])

  const fundNames = new Map(fundRows.map((f) => [f.id, f.name]))

  // Group staging records by employee
  const stagingByEmployee = new Map<string, typeof rawStagingRecords>()
  for (const record of rawStagingRecords) {
    const existing = stagingByEmployee.get(record.employeeId) ?? []
    existing.push(record)
    stagingByEmployee.set(record.employeeId, existing)
  }

  // Calculate for each employee that has staging records
  const entries: PayrollEntryCalc[] = []

  for (const employee of employees) {
    const employeeRecords = stagingByEmployee.get(employee.id)
    if (!employeeRecords || employeeRecords.length === 0) continue

    // Calculate gross pay
    const grossPayResult = calculateGrossPay({
      employee,
      stagingRecords: employeeRecords.map((r) => ({
        id: r.id,
        employeeId: r.employeeId,
        fundId: r.fundId,
        amount: r.amount,
        metadata: (r.metadata ?? {}) as {
          regular_hours?: number
          overtime_hours?: number
          regular_earnings?: number
          overtime_earnings?: number
          week_ending_dates?: string[]
        },
      })),
      fundNames,
    })

    if (grossPayResult.grossPay <= 0) continue

    // Get YTD wages for FICA cap calculation
    const ytdWages = await getEmployeeYtdWages(employee.id, taxYear)

    // Calculate federal withholding
    const federalWithholding = calculateFederalWithholding({
      monthlyGross: grossPayResult.grossPay,
      filingStatus: employee.federalFilingStatus,
      additionalDeductions: 0, // No pre-tax deductions yet
      additionalIncome: 0,
      additionalWithholding: employee.additionalFederalWithholding,
      taxYear,
    })

    // Calculate MA state withholding
    const stateWithholding = calculateMAWithholding({
      monthlyGross: grossPayResult.grossPay,
      allowances: employee.stateAllowances,
      isHeadOfHousehold: employee.isHeadOfHousehold,
      isBlind: employee.isBlind,
      spouseIsBlind: employee.spouseIsBlind,
      additionalWithholding: employee.additionalStateWithholding,
      taxYear,
      rates: {
        stateRate: rates.stateRate,
        surtaxRate: rates.surtaxRate,
        surtaxThreshold: rates.surtaxThreshold,
      },
    })

    // Calculate FICA
    const fica = calculateFICA({
      monthlyGross: grossPayResult.grossPay,
      ytdWages,
      taxYear,
      rates: {
        ssRate: rates.ssRate,
        medicareRate: rates.medicareRate,
        ssWageBase: rates.ssWageBase,
      },
    })

    // Net pay
    const netPay =
      Math.round(
        (grossPayResult.grossPay -
          federalWithholding -
          stateWithholding -
          fica.socialSecurityEmployee -
          fica.medicareEmployee) *
          100
      ) / 100

    entries.push({
      employeeId: employee.id,
      employeeName: employee.name,
      grossPay: grossPayResult.grossPay,
      federalWithholding,
      stateWithholding,
      socialSecurityEmployee: fica.socialSecurityEmployee,
      medicareEmployee: fica.medicareEmployee,
      socialSecurityEmployer: fica.socialSecurityEmployer,
      medicareEmployer: fica.medicareEmployer,
      netPay: Math.max(0, netPay),
      fundAllocations: grossPayResult.fundAllocations.map((fa) => ({
        fundId: fa.fundId,
        fundName: fa.fundName,
        amount: fa.amount.toFixed(2),
        hours: fa.hours.toFixed(2),
      })),
      grossPayDetail: grossPayResult,
    })
  }

  // Calculate totals
  const totals = entries.reduce(
    (acc, entry) => ({
      grossPay: acc.grossPay + entry.grossPay,
      federalWithholding: acc.federalWithholding + entry.federalWithholding,
      stateWithholding: acc.stateWithholding + entry.stateWithholding,
      socialSecurityEmployee:
        acc.socialSecurityEmployee + entry.socialSecurityEmployee,
      medicareEmployee: acc.medicareEmployee + entry.medicareEmployee,
      socialSecurityEmployer:
        acc.socialSecurityEmployer + entry.socialSecurityEmployer,
      medicareEmployer: acc.medicareEmployer + entry.medicareEmployer,
      netPay: acc.netPay + entry.netPay,
      totalEmployerCost:
        acc.totalEmployerCost +
        entry.grossPay +
        entry.socialSecurityEmployer +
        entry.medicareEmployer,
    }),
    {
      grossPay: 0,
      federalWithholding: 0,
      stateWithholding: 0,
      socialSecurityEmployee: 0,
      medicareEmployee: 0,
      socialSecurityEmployer: 0,
      medicareEmployer: 0,
      netPay: 0,
      totalEmployerCost: 0,
    }
  )

  // Round totals
  for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
    totals[key] = Math.round(totals[key] * 100) / 100
  }

  return {
    runId,
    payPeriodStart: run.payPeriodStart,
    payPeriodEnd: run.payPeriodEnd,
    entries,
    totals,
  }
}

/**
 * Persist calculated entries and update run status to CALCULATED.
 */
export async function persistCalculation(
  calculation: PayrollCalculation,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    // Delete any existing entries (recalculation case)
    await tx
      .delete(payrollEntries)
      .where(eq(payrollEntries.payrollRunId, calculation.runId))

    // Insert entries
    if (calculation.entries.length > 0) {
      await tx.insert(payrollEntries).values(
        calculation.entries.map((entry) => ({
          payrollRunId: calculation.runId,
          employeeId: entry.employeeId,
          employeeName: entry.employeeName,
          grossPay: entry.grossPay.toFixed(2),
          federalWithholding: entry.federalWithholding.toFixed(2),
          stateWithholding: entry.stateWithholding.toFixed(2),
          socialSecurityEmployee: entry.socialSecurityEmployee.toFixed(2),
          medicareEmployee: entry.medicareEmployee.toFixed(2),
          socialSecurityEmployer: entry.socialSecurityEmployer.toFixed(2),
          medicareEmployer: entry.medicareEmployer.toFixed(2),
          netPay: entry.netPay.toFixed(2),
          fundAllocations: entry.fundAllocations,
        }))
      )
    }

    // Update run status
    await tx
      .update(payrollRuns)
      .set({ status: 'CALCULATED' })
      .where(eq(payrollRuns.id, calculation.runId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'payroll_run',
      entityId: calculation.runId,
      afterState: {
        status: 'CALCULATED',
        entryCount: calculation.entries.length,
        totals: calculation.totals,
      },
    })
  })
}

/**
 * Post a payroll run — create GL journal entries and finalize.
 */
export async function postPayrollRun(
  runId: number,
  userId: string
): Promise<void> {
  // Verify run status
  const [run] = await db
    .select()
    .from(payrollRuns)
    .where(eq(payrollRuns.id, runId))

  if (!run) throw new Error(`Payroll run ${runId} not found`)
  if (run.status !== 'CALCULATED') {
    throw new Error(`Cannot post payroll run — status is ${run.status}, expected CALCULATED`)
  }

  // Load entries
  const entries = await db
    .select()
    .from(payrollEntries)
    .where(eq(payrollEntries.payrollRunId, runId))

  if (entries.length === 0) {
    throw new Error('Cannot post payroll run — no entries found')
  }

  // Get account IDs
  const accts = await getPayrollAccountIds()

  // Format period for memos
  const periodLabel = formatPeriod(run.payPeriodStart, run.payPeriodEnd)

  // Post GL entries for each employee
  for (const entry of entries) {
    const fundAllocs = entry.fundAllocations as Array<{
      fundId: number
      fundName: string
      amount: string
      hours: string
    }>

    const grossPay = parseFloat(entry.grossPay)
    const federalWithholding = parseFloat(entry.federalWithholding)
    const stateWithholding = parseFloat(entry.stateWithholding)
    const ssEmployee = parseFloat(entry.socialSecurityEmployee)
    const medicareEmployee = parseFloat(entry.medicareEmployee)
    const ssEmployer = parseFloat(entry.socialSecurityEmployer)
    const medicareEmployer = parseFloat(entry.medicareEmployer)
    const netPay = parseFloat(entry.netPay)

    // --- Employee JE ---
    const employeeLines: Array<{
      accountId: number
      fundId: number
      debit: number | null
      credit: number | null
    }> = []

    // DR Salaries & Wages per fund
    for (const alloc of fundAllocs) {
      const amount = parseFloat(alloc.amount)
      if (amount > 0) {
        employeeLines.push({
          accountId: accts.salariesWages,
          fundId: alloc.fundId,
          debit: Math.round(amount * 100) / 100,
          credit: null,
        })
      }
    }

    // Use first fund for liability credits (single fund for simplicity)
    const primaryFundId = fundAllocs[0]?.fundId ?? 1

    // CR liability accounts
    if (federalWithholding > 0) {
      employeeLines.push({
        accountId: accts.federalTax,
        fundId: primaryFundId,
        debit: null,
        credit: Math.round(federalWithholding * 100) / 100,
      })
    }
    if (stateWithholding > 0) {
      employeeLines.push({
        accountId: accts.stateTax,
        fundId: primaryFundId,
        debit: null,
        credit: Math.round(stateWithholding * 100) / 100,
      })
    }
    if (ssEmployee > 0) {
      employeeLines.push({
        accountId: accts.socialSecurity,
        fundId: primaryFundId,
        debit: null,
        credit: Math.round(ssEmployee * 100) / 100,
      })
    }
    if (medicareEmployee > 0) {
      employeeLines.push({
        accountId: accts.medicare,
        fundId: primaryFundId,
        debit: null,
        credit: Math.round(medicareEmployee * 100) / 100,
      })
    }
    if (netPay > 0) {
      employeeLines.push({
        accountId: accts.accruedPayroll,
        fundId: primaryFundId,
        debit: null,
        credit: Math.round(netPay * 100) / 100,
      })
    }

    const employeeResult = await createTransaction({
      date: run.payPeriodEnd,
      memo: `Payroll ${periodLabel} - ${entry.employeeName}`,
      sourceType: 'SYSTEM',
      isSystemGenerated: true,
      lines: employeeLines,
      createdBy: userId,
    })

    // --- Employer FICA JE ---
    const employerTotal =
      Math.round((ssEmployer + medicareEmployer) * 100) / 100

    if (employerTotal > 0) {
      // Allocate employer FICA by fund proportion
      const totalGross = grossPay
      const employerLines: Array<{
        accountId: number
        fundId: number
        debit: number | null
        credit: number | null
      }> = []

      // DR Salaries & Wages per fund (proportional)
      for (const alloc of fundAllocs) {
        const allocAmount = parseFloat(alloc.amount)
        const proportion = totalGross > 0 ? allocAmount / totalGross : 0
        const fundEmployerAmount =
          Math.round(employerTotal * proportion * 100) / 100
        if (fundEmployerAmount > 0) {
          employerLines.push({
            accountId: accts.salariesWages,
            fundId: alloc.fundId,
            debit: fundEmployerAmount,
            credit: null,
          })
        }
      }

      // CR Social Security Payable
      if (ssEmployer > 0) {
        employerLines.push({
          accountId: accts.socialSecurity,
          fundId: primaryFundId,
          debit: null,
          credit: Math.round(ssEmployer * 100) / 100,
        })
      }
      // CR Medicare Payable
      if (medicareEmployer > 0) {
        employerLines.push({
          accountId: accts.medicare,
          fundId: primaryFundId,
          debit: null,
          credit: Math.round(medicareEmployer * 100) / 100,
        })
      }

      // Ensure the employer JE balances (rounding correction)
      const totalDebits = employerLines.reduce(
        (s, l) => s + (l.debit ?? 0),
        0
      )
      const totalCredits = employerLines.reduce(
        (s, l) => s + (l.credit ?? 0),
        0
      )
      const diff = Math.round((totalDebits - totalCredits) * 100) / 100
      if (Math.abs(diff) > 0.001 && employerLines.length > 0) {
        // Adjust last debit line to balance
        const lastDebit = employerLines.find((l) => l.debit != null)
        if (lastDebit && lastDebit.debit != null) {
          lastDebit.debit = Math.round((lastDebit.debit - diff) * 100) / 100
        }
      }

      const employerResult = await createTransaction({
        date: run.payPeriodEnd,
        memo: `Employer FICA ${periodLabel} - ${entry.employeeName}`,
        sourceType: 'SYSTEM',
        isSystemGenerated: true,
        lines: employerLines,
        createdBy: userId,
      })

      // Update entry with GL transaction IDs
      await db
        .update(payrollEntries)
        .set({
          glTransactionId: employeeResult.transaction.id,
          glEmployerTransactionId: employerResult.transaction.id,
        })
        .where(eq(payrollEntries.id, entry.id))
    } else {
      // No employer FICA (unusual but handle)
      await db
        .update(payrollEntries)
        .set({ glTransactionId: employeeResult.transaction.id })
        .where(eq(payrollEntries.id, entry.id))
    }
  }

  // Mark consumed staging records as posted
  const allStagingRecords = await db
    .select()
    .from(stagingRecords)
    .where(
      and(
        eq(stagingRecords.sourceApp, 'timesheets'),
        eq(stagingRecords.recordType, 'timesheet_fund_summary'),
        eq(stagingRecords.status, 'received'),
        sql`${stagingRecords.dateIncurred} >= ${run.payPeriodStart}`,
        sql`${stagingRecords.dateIncurred} <= ${run.payPeriodEnd}`
      )
    )

  for (const record of allStagingRecords) {
    await db
      .update(stagingRecords)
      .set({ status: 'posted', processedAt: new Date() })
      .where(eq(stagingRecords.id, record.id))
  }

  // Update payroll run status to POSTED
  await db
    .update(payrollRuns)
    .set({ status: 'POSTED', postedAt: new Date() })
    .where(eq(payrollRuns.id, runId))

  // Audit log
  await db.transaction(async (tx) => {
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'posted',
      entityType: 'payroll_run',
      entityId: runId,
      afterState: {
        status: 'POSTED',
        entryCount: entries.length,
      },
    })
  })
}

function formatPeriod(start: string, end: string): string {
  const startDate = new Date(start + 'T00:00:00')
  const endDate = new Date(end + 'T00:00:00')
  const month = endDate.toLocaleString('en-US', { month: 'short' })
  const year = endDate.getFullYear()

  if (
    startDate.getDate() === 1 &&
    endDate.getMonth() === startDate.getMonth()
  ) {
    return `${month} ${year}`
  }

  return `${startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, ${year}`
}
