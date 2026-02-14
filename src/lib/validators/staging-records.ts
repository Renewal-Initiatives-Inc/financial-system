import { z } from 'zod'

const sourceApps = ['timesheets', 'expense_reports'] as const
const recordTypes = ['timesheet_fund_summary', 'expense_line_item'] as const
const stagingStatuses = ['received', 'posted', 'error'] as const

export const timesheetMetadataSchema = z.object({
  regular_hours: z.number().min(0),
  overtime_hours: z.number().min(0),
  regular_earnings: z.number().min(0),
  overtime_earnings: z.number().min(0),
  week_ending_dates: z.array(z.string()),
})

export const insertStagingRecordSchema = z.object({
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
  status: z.enum(stagingStatuses).default('received'),
})

export type InsertStagingRecord = z.infer<typeof insertStagingRecordSchema>
export type TimesheetMetadata = z.infer<typeof timesheetMetadataSchema>
