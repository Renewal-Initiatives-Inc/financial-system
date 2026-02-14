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
