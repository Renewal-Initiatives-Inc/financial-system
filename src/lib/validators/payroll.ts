import { z } from 'zod'

const payrollRunStatuses = ['DRAFT', 'CALCULATED', 'POSTED'] as const

export const insertPayrollRunSchema = z.object({
  payPeriodStart: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  payPeriodEnd: z.string().date('Must be a valid date (YYYY-MM-DD)'),
  createdBy: z.string().min(1, 'Created by is required'),
})

export const fundAllocationSchema = z.object({
  fundId: z.number().int().positive(),
  fundName: z.string(),
  amount: z.string(),
  hours: z.string(),
})

export const payrollEntrySchema = z.object({
  payrollRunId: z.number().int().positive(),
  employeeId: z.string().min(1),
  employeeName: z.string().min(1),
  grossPay: z.string().regex(/^\d+(\.\d{1,2})?$/),
  federalWithholding: z.string().regex(/^\d+(\.\d{1,2})?$/),
  stateWithholding: z.string().regex(/^\d+(\.\d{1,2})?$/),
  socialSecurityEmployee: z.string().regex(/^\d+(\.\d{1,2})?$/),
  medicareEmployee: z.string().regex(/^\d+(\.\d{1,2})?$/),
  socialSecurityEmployer: z.string().regex(/^\d+(\.\d{1,2})?$/),
  medicareEmployer: z.string().regex(/^\d+(\.\d{1,2})?$/),
  netPay: z.string().regex(/^\d+(\.\d{1,2})?$/),
  fundAllocations: z.array(fundAllocationSchema),
})

export type InsertPayrollRun = z.infer<typeof insertPayrollRunSchema>
export type PayrollEntry = z.infer<typeof payrollEntrySchema>
export type FundAllocation = z.infer<typeof fundAllocationSchema>
export type PayrollRunStatus = (typeof payrollRunStatuses)[number]
