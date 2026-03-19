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

export const projectionTypeEnum = pgEnum('projection_type', [
  'MONTHLY',
  'WEEKLY',
])

export const confidenceLevelEnum = pgEnum('confidence_level', [
  'HIGH',
  'MODERATE',
  'LOW',
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

export const revenueClassificationEnum = pgEnum('revenue_classification', [
  'GRANT_REVENUE',
  'EARNED_INCOME',
])

export const fundingCategoryEnum = pgEnum('funding_category', [
  'GRANT',
  'CONTRACT',
  'LOAN',
])

export const fundingTypeEnum = pgEnum('funding_type', [
  'CONDITIONAL',
  'UNCONDITIONAL',
])

export const fundingStatusEnum = pgEnum('funding_status', [
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
])

export const pledgeStatusEnum = pgEnum('pledge_status', [
  'PLEDGED',
  'RECEIVED',
  'WRITTEN_OFF',
])

export const poStatusEnum = pgEnum('po_status', [
  'DRAFT',
  'ACTIVE',
  'COMPLETED',
  'CANCELLED',
])

export const invoicePaymentStatusEnum = pgEnum('invoice_payment_status', [
  'PENDING',
  'POSTED',
  'PAYMENT_IN_PROCESS',
  'MATCHED_TO_PAYMENT',
  'PAID',
])

export const payrollRunStatusEnum = pgEnum('payroll_run_status', [
  'DRAFT',
  'CALCULATED',
  'POSTED',
])

export const complianceDeadlineCategoryEnum = pgEnum('compliance_deadline_category', [
  'tax',
  'tenant',
  'grant',
  'budget',
])

export const complianceDeadlineRecurrenceEnum = pgEnum('compliance_deadline_recurrence', [
  'annual',
  'monthly',
  'per_tenant',
  'one_time',
])

export const complianceDeadlineStatusEnum = pgEnum('compliance_deadline_status', [
  'upcoming',
  'reminded',
  'completed',
])

export const bankMatchTypeEnum = pgEnum('bank_match_type', [
  'auto',
  'manual',
  'rule',
])

export const reconciliationStatusEnum = pgEnum('reconciliation_status', [
  'in_progress',
  'completed',
])

export const bankTransactionStatusEnum = pgEnum('bank_transaction_status', [
  'pending',
  'posted',
])

export const importReviewStatusEnum = pgEnum('import_review_status', [
  'pending',
  'approved',
  'skipped',
])

export const workflowStateEnum = pgEnum('workflow_state', [
  'not_started',
  'checklist',
  'scan',
  'draft',
  'delivered',
])

export const workflowStepEnum = pgEnum('workflow_step', [
  'checklist',
  'scan',
  'draft',
  'delivery',
])

export const workflowTypeEnum = pgEnum('workflow_type', [
  'tax_form_990',
  'tax_form_pc',
  'tax_w2',
  'tax_1099_nec',
  'tax_941',
  'tax_m941',
  'annual_review',
  'annual_attestation',
  'budget_cycle',
  'grant_report',
  'grant_closeout',
  'grant_milestone',
  'tenant_deposit',
])
