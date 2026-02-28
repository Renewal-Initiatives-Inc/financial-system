import { z } from 'zod'

const fundRestrictions = ['RESTRICTED', 'UNRESTRICTED'] as const
const fundingTypes = ['CONDITIONAL', 'UNCONDITIONAL'] as const
const fundingStatuses = ['ACTIVE', 'COMPLETED', 'CANCELLED'] as const
const revenueClassifications = ['GRANT_REVENUE', 'EARNED_INCOME'] as const
const fundingCategories = ['GRANT', 'CONTRACT', 'LOAN'] as const

export const insertFundSchema = z.object({
  name: z.string().min(1, 'Fund name is required').max(255),
  restrictionType: z.enum(fundRestrictions),
  description: z.string().nullable().optional(),
  isSystemLocked: z.boolean().optional().default(false),
})

export const insertFundingSourceSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(255),
    fundingCategory: z.enum(fundingCategories, {
      message: 'Category is required',
    }),
    restrictionType: z.enum(fundRestrictions),
    description: z.string().nullable().optional(),
    // Funding source fields — available for all categories
    funderId: z.number().int().positive('Funder is required'),
    amount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
      .nullable()
      .optional(),
    type: z.enum(fundingTypes).nullable().optional(),
    conditions: z.string().nullable().optional(),
    startDate: z.string().date().nullable().optional(),
    endDate: z.string().date().nullable().optional(),
    isUnusualGrant: z.boolean().optional().default(false),
    matchRequirementPercent: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid percentage')
      .nullable()
      .optional(),
    retainagePercent: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid percentage')
      .nullable()
      .optional(),
    reportingFrequency: z.string().max(50).nullable().optional(),
    // Loan-specific
    interestRate: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, 'Invalid rate')
      .nullable()
      .optional(),
    // Contract extraction fields
    contractPdfUrl: z.string().nullable().optional(),
    extractedMilestones: z.unknown().nullable().optional(),
    extractedTerms: z.unknown().nullable().optional(),
    extractedCovenants: z.unknown().nullable().optional(),
    // Revenue classification (GRANT + CONTRACT only; null for LOAN)
    revenueClassification: z.enum(revenueClassifications).nullable().optional(),
    classificationRationale: z.string().nullable().optional(),
  })
  .refine(
    (data) => {
      if (data.type === 'CONDITIONAL' && !data.conditions) {
        return false
      }
      return true
    },
    {
      message: 'Conditions are required for conditional funding sources',
      path: ['conditions'],
    }
  )

export const updateFundSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  isActive: z.boolean().optional(),
  description: z.string().nullable().optional(),
  fundingCategory: z.enum(fundingCategories).nullable().optional(),
  funderId: z.number().int().positive().nullable().optional(),
  amount: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount')
    .nullable()
    .optional(),
  type: z.enum(fundingTypes).nullable().optional(),
  conditions: z.string().nullable().optional(),
  startDate: z.string().date().nullable().optional(),
  endDate: z.string().date().nullable().optional(),
  status: z.enum(fundingStatuses).optional(),
  isUnusualGrant: z.boolean().optional(),
  matchRequirementPercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid percentage')
    .nullable()
    .optional(),
  retainagePercent: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/, 'Invalid percentage')
    .nullable()
    .optional(),
  reportingFrequency: z.string().max(50).nullable().optional(),
  interestRate: z
    .string()
    .regex(/^\d+(\.\d{1,4})?$/, 'Invalid rate')
    .nullable()
    .optional(),
})

export type InsertFund = z.input<typeof insertFundSchema>
export type InsertFundingSource = z.input<typeof insertFundingSourceSchema>
export type UpdateFund = z.infer<typeof updateFundSchema>
