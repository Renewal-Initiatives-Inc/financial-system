import { z } from 'zod'

export const insertPrepaidScheduleSchema = z
  .object({
    description: z
      .string()
      .min(1, 'Description is required')
      .max(255),
    totalAmount: z
      .number()
      .positive('Total amount must be positive')
      .multipleOf(0.01, 'Total amount must have at most 2 decimal places'),
    startDate: z.string().date('Invalid start date'),
    endDate: z.string().date('Invalid end date'),
    glExpenseAccountId: z.number().int().positive(),
    glPrepaidAccountId: z.number().int().positive(),
    fundId: z.number().int().positive(),
  })
  .refine((data) => data.endDate > data.startDate, {
    message: 'End date must be after start date',
    path: ['endDate'],
  })
  .refine(
    (data) => {
      const start = new Date(data.startDate)
      const end = new Date(data.endDate)
      const monthsDiff =
        (end.getFullYear() - start.getFullYear()) * 12 +
        (end.getMonth() - start.getMonth())
      return monthsDiff >= 1
    },
    {
      message: 'Period must be at least 1 full month',
      path: ['endDate'],
    }
  )

export type InsertPrepaidSchedule = z.infer<typeof insertPrepaidScheduleSchema>
