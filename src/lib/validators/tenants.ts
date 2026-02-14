import { z } from 'zod'

const fundingSourceTypes = [
  'TENANT_DIRECT',
  'VASH',
  'MRVP',
  'SECTION_8',
  'OTHER_VOUCHER',
] as const

export const insertTenantSchema = z
  .object({
    name: z.string().min(1, 'Tenant name is required').max(255),
    unitNumber: z.string().min(1, 'Unit number is required').max(20),
    leaseStart: z.string().date().nullable().optional(),
    leaseEnd: z.string().date().nullable().optional(),
    monthlyRent: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid rent amount'),
    fundingSourceType: z.enum(fundingSourceTypes),
    moveInDate: z.string().date().nullable().optional(),
    securityDepositAmount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid deposit amount')
      .nullable()
      .optional(),
    escrowBankRef: z.string().max(255).nullable().optional(),
    depositDate: z.string().date().nullable().optional(),
    interestRate: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, 'Invalid interest rate')
      .nullable()
      .optional(),
    statementOfConditionDate: z.string().date().nullable().optional(),
  })
  .refine(
    (data) => {
      if (!data.securityDepositAmount) return true
      return (
        parseFloat(data.securityDepositAmount) <= parseFloat(data.monthlyRent)
      )
    },
    {
      message:
        "Security deposit cannot exceed first month's rent (MA G.L. c. 186 § 15B)",
      path: ['securityDepositAmount'],
    }
  )

export const updateTenantSchema = z
  .object({
    name: z.string().min(1).max(255).optional(),
    unitNumber: z.string().min(1).max(20).optional(),
    leaseStart: z.string().date().nullable().optional(),
    leaseEnd: z.string().date().nullable().optional(),
    monthlyRent: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid rent amount')
      .optional(),
    fundingSourceType: z.enum(fundingSourceTypes).optional(),
    moveInDate: z.string().date().nullable().optional(),
    securityDepositAmount: z
      .string()
      .regex(/^\d+(\.\d{1,2})?$/, 'Invalid deposit amount')
      .nullable()
      .optional(),
    escrowBankRef: z.string().max(255).nullable().optional(),
    depositDate: z.string().date().nullable().optional(),
    interestRate: z
      .string()
      .regex(/^\d+(\.\d{1,4})?$/, 'Invalid interest rate')
      .nullable()
      .optional(),
    statementOfConditionDate: z.string().date().nullable().optional(),
    isActive: z.boolean().optional(),
  })
  .refine(
    (data) => {
      if (!data.securityDepositAmount || !data.monthlyRent) return true
      return (
        parseFloat(data.securityDepositAmount) <= parseFloat(data.monthlyRent)
      )
    },
    {
      message:
        "Security deposit cannot exceed first month's rent (MA G.L. c. 186 § 15B)",
      path: ['securityDepositAmount'],
    }
  )

export type InsertTenant = z.input<typeof insertTenantSchema>
export type UpdateTenant = z.infer<typeof updateTenantSchema>
