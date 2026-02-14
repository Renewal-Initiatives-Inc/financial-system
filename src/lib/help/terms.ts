/**
 * Static help term dictionary for inline tooltips (SYS-P0-021).
 *
 * Each term includes an authoritative reference where applicable.
 * Terms are keyed by slug (lowercase, hyphenated) for easy lookup.
 */
export const helpTerms: Record<string, string> = {
  fund: 'A self-balancing set of accounts used to track resources with specific purposes or restrictions. Per ASC 958, nonprofits must track net assets by restriction class.',

  'restriction-type':
    'Classifies a fund as Restricted (donor-imposed purpose or time restrictions per 26 CFR 1.501(c)(3)-1) or Unrestricted (available for general use). Set once at creation and immutable per INV-005.',

  'restricted-net-assets':
    'Net Assets With Donor Restrictions. Resources subject to donor-imposed stipulations that are more specific than the broad limits of the organization\'s purpose (FASB ASC 958).',

  'unrestricted-net-assets':
    'Net Assets Without Donor Restrictions. Resources available for the organization\'s general operations, not subject to donor-imposed restrictions.',

  'net-asset-release':
    'When a restricted fund expense is recorded, a corresponding entry reclassifies net assets from "With Donor Restrictions" to "Without Donor Restrictions" (ASC 958-205, INV-007).',

  'normal-balance':
    'The side of the ledger (Debit or Credit) that increases an account. Assets and Expenses have Debit normal balances; Liabilities, Net Assets, and Revenue have Credit normal balances.',

  'account-type':
    'One of five account categories: Asset, Liability, Net Asset, Revenue, or Expense. Determines the account\'s normal balance and financial statement placement.',

  'system-locked':
    'A system-locked account or fund cannot be deactivated, renamed, or deleted. Used for critical accounts like Cash, General Fund, and core net asset accounts.',

  'form-990-line':
    'Maps an account to a specific line on IRS Form 990 Part IX (Statement of Functional Expenses). Used for automated 990 data preparation.',

  cip: 'Construction in Progress. Capitalizable costs accumulated during building construction or renovation, tracked by CSI cost code categories (ASC 360).',

  'fund-balance':
    'The net balance of all transactions coded to a fund. A fund must have a zero balance before it can be deactivated (DM-P0-007).',

  'chart-of-accounts':
    'An organized listing of all general ledger accounts used by the organization, categorized by type (Asset, Liability, Net Asset, Revenue, Expense).',

  'parent-account':
    'A hierarchical grouping account that contains sub-accounts. For example, the CIP parent account contains sub-accounts for Hard Costs, Soft Costs, etc.',

  'sub-type':
    'A secondary classification within an account type. For example, Asset accounts may have sub-types like Cash, Current Asset, Fixed Asset, or CIP.',

  deactivation:
    'Soft-delete pattern used instead of deletion. Deactivated accounts/funds are hidden from selection dropdowns but preserved for historical reporting (INV-013).',

  'accrual-basis':
    'Revenue is recognized when earned and expenses when incurred, regardless of when cash changes hands. Required by GAAP for nonprofit financial statements.',

  'double-entry':
    'Every transaction must have equal total debits and credits (INV-001). This ensures the accounting equation (Assets = Liabilities + Net Assets) always balances.',

  'contra-account':
    'An account that offsets a related account. For example, Accumulated Depreciation is a contra-asset that reduces the net book value of fixed assets.',

  'multi-fund-split':
    'A single transaction with lines coded to different funds. Each line specifies its own fund, allowing expenses or revenue to be shared across funding sources (DM-P0-010).',

  'audit-trail':
    'Every data mutation is logged with who, what, when, before-state, and after-state. The audit log is append-only with no update or delete operations (INV-012).',

  'journal-entry':
    'A manual double-entry transaction recording. Every entry must balance: total debits must equal total credits (INV-001).',

  debit:
    'An entry on the left side of a ledger. Debits increase assets and expenses, decrease liabilities, net assets, and revenue.',

  credit:
    'An entry on the right side of a ledger. Credits increase liabilities, net assets, and revenue, decrease assets and expenses.',

  'source-type':
    'Indicates how a transaction entered the system: MANUAL (user-created), SYSTEM (auto-generated), TIMESHEET, EXPENSE_REPORT, RAMP, BANK_FEED, or FY25_IMPORT.',

  'voided-transaction':
    'A transaction excluded from all GL calculations and financial statements. Retained in audit trail with VOID badge. Cannot be unvoided — create a new entry instead.',

  'reversed-transaction':
    'A transaction corrected by creating an equal-and-opposite reversing entry. Both original and reversal remain visible. Used for matched transactions that cannot be edited in place.',

  'transaction-status':
    'Visual indicators: Active (normal), Voided (excluded from GL), Reversed (correction applied), System-Generated (auto-created, immutable).',

  'line-memo':
    'Optional note on an individual transaction line, providing detail beyond the transaction-level memo.',

  'percentage-split':
    'Convenience feature for multi-fund allocations. Enter fund percentages that sum to 100%, and the system calculates dollar amounts.',
}

/** Get a help term by its slug. Returns undefined for unknown terms. */
export function getHelpTerm(slug: string): string | undefined {
  return helpTerms[slug]
}
