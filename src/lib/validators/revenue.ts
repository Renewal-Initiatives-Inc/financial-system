import { z } from 'zod'

const contributionSourceTypes = ['GOVERNMENT', 'PUBLIC', 'RELATED_PARTY'] as const
const adjustmentTypes = ['PRORATION', 'HARDSHIP', 'VACATE'] as const
const inKindTypes = ['GOODS', 'SERVICES', 'FACILITY_USE'] as const

export const rentPaymentSchema = z.object({
  tenantId: z.number().int().positive('Tenant is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
  fundId: z.number().int().positive('Fund is required'),
})

export const rentAdjustmentSchema = z.object({
  tenantId: z.number().int().positive('Tenant is required'),
  adjustmentType: z.enum(adjustmentTypes),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
  fundId: z.number().int().positive('Fund is required'),
  note: z.string().min(1, 'Explanatory note is required for rent adjustments'),
})

export const donationSchema = z.object({
  donorId: z.number().int().positive('Donor is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
  fundId: z.number().int().positive('Fund is required'),
  contributionSourceType: z.enum(contributionSourceTypes, {
    message: 'Contribution source type is required',
  }),
  isUnusualGrant: z.boolean().optional().default(false),
})

export const earnedIncomeSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().date('Must be a valid date'),
  accountId: z.number().int().positive('Revenue account is required'),
  fundId: z.number().int().positive('Fund is required'),
})

export const investmentIncomeSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
})

export const inKindContributionSchema = z.object({
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  description: z.string().min(1, 'Description is required'),
  date: z.string().date('Must be a valid date'),
  fundId: z.number().int().positive('Fund is required'),
  inKindType: z.enum(inKindTypes, {
    message: 'In-kind contribution type is required',
  }),
})

export const fundCashReceiptSchema = z.object({
  fundId: z.number().int().positive('Funding source is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
})

export const fundConditionMetSchema = z.object({
  fundId: z.number().int().positive('Funding source is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
  note: z.string().min(1, 'Note is required for condition recognition'),
})

export type RentPayment = z.infer<typeof rentPaymentSchema>
export type RentAdjustment = z.infer<typeof rentAdjustmentSchema>
export type Donation = z.infer<typeof donationSchema>
export type EarnedIncome = z.infer<typeof earnedIncomeSchema>
export type InvestmentIncome = z.infer<typeof investmentIncomeSchema>
export type InKindContribution = z.infer<typeof inKindContributionSchema>
export const loanRateChangeSchema = z.object({
  fundId: z.number().int().positive('Loan funding source is required'),
  rate: z.string().regex(/^\d+(\.\d{1,4})?$/, 'Invalid rate (up to 4 decimal places)'),
  effectiveDate: z.string().date('Must be a valid date'),
  reason: z.string().min(1, 'Reason is required for rate changes'),
})

export const loanProceedsSchema = z.object({
  fundId: z.number().int().positive('Loan funding source is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
})

export const loanRepaymentSchema = z.object({
  fundId: z.number().int().positive('Loan funding source is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
  note: z.string().min(1, 'Note is required for loan repayment'),
})

export const loanInterestPaymentSchema = z.object({
  fundId: z.number().int().positive('Loan funding source is required'),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, 'Invalid amount'),
  date: z.string().date('Must be a valid date'),
})

export type FundCashReceipt = z.infer<typeof fundCashReceiptSchema>
export type FundConditionMet = z.infer<typeof fundConditionMetSchema>
export type LoanProceeds = z.infer<typeof loanProceedsSchema>
export type LoanRepayment = z.infer<typeof loanRepaymentSchema>
export type LoanInterestPayment = z.infer<typeof loanInterestPaymentSchema>
export type LoanRateChange = z.infer<typeof loanRateChangeSchema>
