/**
 * Gross Pay Calculator
 *
 * Calculates gross pay per employee from staging records + employee data.
 * Handles both PER_TASK and SALARIED compensation types.
 * Applies overtime premiums for NON_EXEMPT employees.
 */

import type { EmployeePayrollData } from '@/lib/integrations/people'

export interface StagingRecordForPayroll {
  id: number
  employeeId: string
  fundId: number
  amount: string
  metadata: {
    regular_hours?: number
    overtime_hours?: number
    regular_earnings?: number
    overtime_earnings?: number
    week_ending_dates?: string[]
  }
}

export interface EmployeeGrossPay {
  employeeId: string
  grossPay: number
  fundAllocations: Array<{
    fundId: number
    fundName: string
    amount: number
    hours: number
  }>
  regularHours: number
  overtimeHours: number
  regularPay: number
  overtimePay: number
  stagingRecordIds: number[]
}

/**
 * Calculate gross pay for a single employee based on staging records.
 */
export function calculateGrossPay(params: {
  employee: EmployeePayrollData
  stagingRecords: StagingRecordForPayroll[]
  fundNames: Map<number, string>
}): EmployeeGrossPay {
  const { employee, stagingRecords, fundNames } = params

  if (stagingRecords.length === 0) {
    return {
      employeeId: employee.id,
      grossPay: 0,
      fundAllocations: [],
      regularHours: 0,
      overtimeHours: 0,
      regularPay: 0,
      overtimePay: 0,
      stagingRecordIds: [],
    }
  }

  // Aggregate hours and amounts by fund
  const fundMap = new Map<
    number,
    { amount: number; regularHours: number; overtimeHours: number }
  >()

  let totalRegularHours = 0
  let totalOvertimeHours = 0
  const stagingRecordIds: number[] = []

  for (const record of stagingRecords) {
    stagingRecordIds.push(record.id)
    const meta = record.metadata
    const regularHours = meta.regular_hours ?? 0
    const overtimeHours = meta.overtime_hours ?? 0

    totalRegularHours += regularHours
    totalOvertimeHours += overtimeHours

    const existing = fundMap.get(record.fundId) ?? {
      amount: 0,
      regularHours: 0,
      overtimeHours: 0,
    }

    existing.regularHours += regularHours
    existing.overtimeHours += overtimeHours
    existing.amount += parseFloat(record.amount)
    fundMap.set(record.fundId, existing)
  }

  let regularPay = 0
  let overtimePay = 0
  let grossPay = 0

  if (employee.compensationType === 'PER_TASK') {
    // PER_TASK: staging amounts already have task-code rates applied
    // Sum base amounts
    for (const [, data] of fundMap) {
      regularPay += data.amount
    }

    // Apply overtime premium for NON_EXEMPT (0.5x on OT hours)
    // The base 1x is already in staging amount; we add the 0.5x premium
    if (employee.exemptStatus === 'NON_EXEMPT' && totalOvertimeHours > 0) {
      // For PER_TASK, estimate hourly rate from total amount / total hours
      const totalHours = totalRegularHours + totalOvertimeHours
      if (totalHours > 0) {
        const effectiveHourlyRate = regularPay / totalHours
        overtimePay = totalOvertimeHours * effectiveHourlyRate * 0.5
      }
    }

    grossPay = regularPay + overtimePay
  } else {
    // SALARIED: hourly rate = annual_salary / expected_annual_hours
    const annualSalary = employee.annualSalary ?? 0
    const expectedHours = employee.expectedAnnualHours ?? 2080
    const hourlyRate = expectedHours > 0 ? annualSalary / expectedHours : 0

    if (employee.exemptStatus === 'EXEMPT') {
      // EXEMPT: straight-time for all hours
      const totalHours = totalRegularHours + totalOvertimeHours
      regularPay = totalHours * hourlyRate
      overtimePay = 0
    } else {
      // NON_EXEMPT: regular rate + 1.5x overtime
      regularPay = totalRegularHours * hourlyRate
      overtimePay = totalOvertimeHours * hourlyRate * 1.5
    }

    grossPay = regularPay + overtimePay

    // Reallocate gross pay by fund proportional to hours
    const totalHours = totalRegularHours + totalOvertimeHours
    if (totalHours > 0) {
      for (const [fundId, data] of fundMap) {
        const fundHours = data.regularHours + data.overtimeHours
        data.amount = (fundHours / totalHours) * grossPay
        fundMap.set(fundId, data)
      }
    }
  }

  // Build fund allocations
  const fundAllocations = Array.from(fundMap.entries()).map(
    ([fundId, data]) => ({
      fundId,
      fundName: fundNames.get(fundId) ?? `Fund ${fundId}`,
      amount: Math.round(data.amount * 100) / 100,
      hours: Math.round((data.regularHours + data.overtimeHours) * 100) / 100,
    })
  )

  return {
    employeeId: employee.id,
    grossPay: Math.round(grossPay * 100) / 100,
    fundAllocations,
    regularHours: Math.round(totalRegularHours * 100) / 100,
    overtimeHours: Math.round(totalOvertimeHours * 100) / 100,
    regularPay: Math.round(regularPay * 100) / 100,
    overtimePay: Math.round(overtimePay * 100) / 100,
    stagingRecordIds,
  }
}
