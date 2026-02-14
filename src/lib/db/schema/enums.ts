import { pgEnum } from 'drizzle-orm/pg-core'

export const accountTypeEnum = pgEnum('account_type', [
  'ASSET',
  'LIABILITY',
  'NET_ASSET',
  'REVENUE',
  'EXPENSE',
])

export const normalBalanceEnum = pgEnum('normal_balance', ['DEBIT', 'CREDIT'])

export const fundRestrictionEnum = pgEnum('fund_restriction', [
  'RESTRICTED',
  'UNRESTRICTED',
])

export const sourceTypeEnum = pgEnum('source_type', [
  'MANUAL',
  'TIMESHEET',
  'EXPENSE_REPORT',
  'RAMP',
  'BANK_FEED',
  'SYSTEM',
  'FY25_IMPORT',
])

export const cipCostCategoryEnum = pgEnum('cip_cost_category', [
  'HARD_COST',
  'SOFT_COST',
])

export const auditActionEnum = pgEnum('audit_action', [
  'created',
  'updated',
  'voided',
  'reversed',
  'deactivated',
  'signed_off',
  'imported',
  'posted',
])

export const budgetStatusEnum = pgEnum('budget_status', ['DRAFT', 'APPROVED'])

export const spreadMethodEnum = pgEnum('spread_method', [
  'EVEN',
  'SEASONAL',
  'ONE_TIME',
  'CUSTOM',
])

export const projectionLineTypeEnum = pgEnum('projection_line_type', [
  'INFLOW',
  'OUTFLOW',
])

export const w9StatusEnum = pgEnum('w9_status', [
  'COLLECTED',
  'PENDING',
  'NOT_REQUIRED',
])

export const fundingSourceTypeEnum = pgEnum('funding_source_type', [
  'TENANT_DIRECT',
  'VASH',
  'MRVP',
  'SECTION_8',
  'OTHER_VOUCHER',
])

export const donorTypeEnum = pgEnum('donor_type', [
  'INDIVIDUAL',
  'CORPORATE',
  'FOUNDATION',
  'GOVERNMENT',
])

export const rampTransactionStatusEnum = pgEnum('ramp_transaction_status', [
  'uncategorized',
  'categorized',
  'posted',
])

export const contributionSourceTypeEnum = pgEnum('contribution_source_type', [
  'GOVERNMENT',
  'PUBLIC',
  'RELATED_PARTY',
])

export const depreciationMethodEnum = pgEnum('depreciation_method', [
  'STRAIGHT_LINE',
])
