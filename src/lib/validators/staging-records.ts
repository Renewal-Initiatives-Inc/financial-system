import { z } from 'zod'

// --- Constants ---

export const sourceApps = ['timesheets', 'expense_reports'] as const
export const recordTypes = ['timesheet_fund_summary', 'expense_line_item'] as const
export const stagingStatuses = [
  'received',
  'posted',
  'matched_to_payment',
  'paid',
] as const

export type StagingSourceApp = (typeof sourceApps)[number]
export type StagingRecordType = (typeof recordTypes)[number]
export type StagingStatus = (typeof stagingStatuses)[number]

// --- Metadata Schemas ---

export const timesheetMetadataSchema = z.object({
  regularHours: z.number().nonnegative(),
  overtimeHours: z.number().nonnegative(),
  regularEarnings: z.number().nonnegative(),
  overtimeEarnings: z.number().nonnegative(),
})

export const expenseMetadataSchema = z.object({
  merchant: z.string().min(1),
  memo: z.string().optional(),
  expenseType: z.enum(['out_of_pocket', 'mileage']),
  mileageDetails: z
    .object({
      miles: z.number().positive(),
      rate: z.number().positive(),
    })
    .optional(),
})

// --- Insert Schema ---

export const insertStagingRecordSchema = z
  .object({
    sourceApp: z.enum(sourceApps),
    sourceRecordId: z.string().min(1).max(255),
    recordType: z.enum(recordTypes),
    employeeId: z.string().min(1).max(255),
    referenceId: z.string().min(1).max(255),
    dateIncurred: z.string().date(),
    amount: z.string().regex(/^-?\d+(\.\d{1,2})?$/, 'Must be a valid decimal'),
    fundId: z.number().int().positive(),
    glAccountId: z.number().int().positive().nullable().optional(),
    metadata: z.record(z.string(), z.unknown()).default({}),
  })
  .refine(
    (data) => {
      if (data.sourceApp === 'timesheets') return data.recordType === 'timesheet_fund_summary'
      if (data.sourceApp === 'expense_reports') return data.recordType === 'expense_line_item'
      return true
    },
    { message: 'sourceApp and recordType must be consistent', path: ['recordType'] }
  )
  .refine(
    (data) => {
      if (data.recordType === 'expense_line_item') return !!data.glAccountId
      return true
    },
    { message: 'Expense line items must specify a GL account', path: ['glAccountId'] }
  )
  .refine(
    (data) => {
      if (data.recordType === 'timesheet_fund_summary') return !data.glAccountId
      return true
    },
    {
      message: 'Timesheet records must not specify a GL account (payroll engine assigns it)',
      path: ['glAccountId'],
    }
  )

export type InsertStagingRecord = z.infer<typeof insertStagingRecordSchema>
export type TimesheetMetadata = z.infer<typeof timesheetMetadataSchema>
export type ExpenseMetadata = z.infer<typeof expenseMetadataSchema>
