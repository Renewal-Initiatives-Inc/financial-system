import { describe, it, expect } from 'vitest'
import { calculateGrossPay, type StagingRecordForPayroll } from '../gross-pay'
import type { EmployeePayrollData } from '@/lib/integrations/people'

const fundNames = new Map([[1, 'General Fund'], [2, 'Housing Fund']])

const salariedExempt: EmployeePayrollData = {
  id: 'emp-001',
  name: 'Test Salaried',
  email: 'test@test.com',
  compensationType: 'SALARIED',
  annualSalary: 52000,
  expectedAnnualHours: 2080,
  exemptStatus: 'EXEMPT',
  federalFilingStatus: 'single',
  federalAllowances: 0,
  stateAllowances: 1,
  additionalFederalWithholding: 0,
  additionalStateWithholding: 0,
  isHeadOfHousehold: false,
  isBlind: false,
  spouseIsBlind: false,
  contractorType: 'W2',
  isOfficer: false,
  isBoardMember: false,
}

const salariedNonExempt: EmployeePayrollData = {
  ...salariedExempt,
  id: 'emp-002',
  exemptStatus: 'NON_EXEMPT',
}

const perTaskNonExempt: EmployeePayrollData = {
  id: 'emp-003',
  name: 'Test Per Task',
  email: 'task@test.com',
  compensationType: 'PER_TASK',
  annualSalary: null,
  expectedAnnualHours: null,
  exemptStatus: 'NON_EXEMPT',
  federalFilingStatus: 'single',
  federalAllowances: 0,
  stateAllowances: 1,
  additionalFederalWithholding: 0,
  additionalStateWithholding: 0,
  isHeadOfHousehold: false,
  isBlind: false,
  spouseIsBlind: false,
  contractorType: 'W2',
  isOfficer: false,
  isBoardMember: false,
}

function makeRecord(overrides: Partial<StagingRecordForPayroll> = {}): StagingRecordForPayroll {
  return {
    id: 1,
    employeeId: 'emp-001',
    fundId: 1,
    amount: '1000.00',
    metadata: {
      regular_hours: 40,
      overtime_hours: 0,
      regular_earnings: 1000,
      overtime_earnings: 0,
      week_ending_dates: ['2026-01-04'],
    },
    ...overrides,
  }
}

describe('calculateGrossPay', () => {
  it('SALARIED employee: hourly rate = salary / expected_hours × hours', () => {
    const result = calculateGrossPay({
      employee: salariedExempt,
      stagingRecords: [
        makeRecord({ metadata: { regular_hours: 160, overtime_hours: 0 } }),
      ],
      fundNames,
    })
    // Hourly rate = $52,000 / 2,080 = $25/hr
    // 160 hours × $25 = $4,000
    expect(result.grossPay).toBeCloseTo(4000, 2)
    expect(result.regularPay).toBeCloseTo(4000, 2)
    expect(result.overtimePay).toBe(0)
  })

  it('PER_TASK employee: sum staging amounts', () => {
    const result = calculateGrossPay({
      employee: perTaskNonExempt,
      stagingRecords: [
        makeRecord({ employeeId: 'emp-003', amount: '500.00', metadata: { regular_hours: 20, overtime_hours: 0 } }),
        makeRecord({ id: 2, employeeId: 'emp-003', amount: '750.00', fundId: 2, metadata: { regular_hours: 30, overtime_hours: 0 } }),
      ],
      fundNames,
    })
    expect(result.grossPay).toBeCloseTo(1250, 2)
  })

  it('NON_EXEMPT SALARIED overtime: 1.5x for OT hours', () => {
    const result = calculateGrossPay({
      employee: salariedNonExempt,
      stagingRecords: [
        makeRecord({
          employeeId: 'emp-002',
          metadata: { regular_hours: 160, overtime_hours: 10 },
        }),
      ],
      fundNames,
    })
    // Rate = $25/hr, 160 regular + 10 OT
    // Regular: 160 × $25 = $4,000
    // OT: 10 × $25 × 1.5 = $375
    expect(result.regularPay).toBeCloseTo(4000, 2)
    expect(result.overtimePay).toBeCloseTo(375, 2)
    expect(result.grossPay).toBeCloseTo(4375, 2)
  })

  it('EXEMPT: no overtime premium regardless of hours', () => {
    const result = calculateGrossPay({
      employee: salariedExempt,
      stagingRecords: [
        makeRecord({ metadata: { regular_hours: 160, overtime_hours: 10 } }),
      ],
      fundNames,
    })
    // Rate = $25/hr, all hours at straight time
    // 170 total hours × $25 = $4,250
    expect(result.grossPay).toBeCloseTo(4250, 2)
    expect(result.overtimePay).toBe(0)
  })

  it('multi-fund allocation: records on different funds', () => {
    const result = calculateGrossPay({
      employee: salariedExempt,
      stagingRecords: [
        makeRecord({ metadata: { regular_hours: 80, overtime_hours: 0 } }),
        makeRecord({ id: 2, fundId: 2, metadata: { regular_hours: 80, overtime_hours: 0 } }),
      ],
      fundNames,
    })
    // Total: 160 hours × $25 = $4,000
    // 50/50 split between funds
    expect(result.fundAllocations).toHaveLength(2)
    expect(result.fundAllocations[0].amount).toBeCloseTo(2000, 2)
    expect(result.fundAllocations[1].amount).toBeCloseTo(2000, 2)
  })

  it('no staging records → $0 gross pay', () => {
    const result = calculateGrossPay({
      employee: salariedExempt,
      stagingRecords: [],
      fundNames,
    })
    expect(result.grossPay).toBe(0)
    expect(result.fundAllocations).toHaveLength(0)
  })

  it('tracks staging record IDs for consumption', () => {
    const result = calculateGrossPay({
      employee: salariedExempt,
      stagingRecords: [
        makeRecord({ id: 10 }),
        makeRecord({ id: 20, fundId: 2, metadata: { regular_hours: 40, overtime_hours: 0 } }),
      ],
      fundNames,
    })
    expect(result.stagingRecordIds).toEqual([10, 20])
  })
})
