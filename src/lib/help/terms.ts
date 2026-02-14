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

  // --- Phase 6: Vendors, Tenants, Donors ---

  vendor:
    'A supplier or contractor that provides goods or services to the organization. Vendors are tracked for payment history and IRS 1099-NEC reporting (IRC § 6041).',

  '1099-eligible':
    'A vendor eligible for IRS Form 1099-NEC reporting. Filing threshold is per calendar year: $600 for TY2025 and prior, $2,000 for TY2026+ per the One Big Beautiful Bill Act (OBBBA § 103, amending IRC § 6041). Threshold is inflation-indexed starting TY2027.',

  'w9-status':
    'Tracking status for IRS Form W-9 (Request for Taxpayer Identification Number). Must be collected from 1099-eligible vendors before year-end to file 1099-NEC forms.',

  'entity-type':
    'Vendor classification (individual, LLC, S-corp, C-corp, partnership, government). Determines 1099 reporting requirements — corporations are generally exempt per Treas. Reg. § 1.6041-3(p)(1). Exceptions: medical/legal payments to corps still reportable.',

  tenant:
    'An individual or household occupying a unit in the property. Tracked for lease terms, rent collection, funding source, and security deposit compliance.',

  'funding-source-type':
    'The payment source for tenant rent: tenant-direct (self-pay), VASH (VA Supportive Housing), MRVP (MA Rental Voucher Program), Section 8 (HUD Housing Choice Voucher), or other voucher program.',

  'security-deposit':
    'Refundable deposit held in a separate interest-bearing escrow account per MA G.L. c. 186 § 15B. Maximum is first month\'s rent. Must earn interest at lesser of actual bank rate or 5%.',

  'tenancy-anniversary':
    'Annual anniversary of the tenant\'s move-in date. Triggers security deposit interest payment obligation under MA G.L. c. 186 § 15B. Non-compliance carries treble damages.',

  'escrow-bank-ref':
    'Reference to the separate interest-bearing bank account holding security deposits. MA law requires deposits be held in a Massachusetts bank, separate from operating funds.',

  donor:
    'An individual, corporation, foundation, or government entity making charitable contributions. Tracked for giving history and IRS-required acknowledgment letters (IRC § 170(f)(8)).',

  'donor-type':
    'Classification of contribution source: individual, corporate, foundation, or government. Affects Schedule A public support test (IRC § 509(a)) — the 2% threshold applies to ALL donors.',

  // --- Phase 9: Ramp Credit Card ---

  categorization:
    'Assigning a GL account and fund to a Ramp credit card transaction so it can be posted to the general ledger.',

  'auto-categorization-rule':
    'A pattern-matching rule that automatically assigns GL account and fund to Ramp transactions based on merchant name or description keywords.',

  'credit-card-payable':
    'Liability account tracking the balance owed on the Ramp credit card. Increases when expenses are categorized, decreases when Ramp autopay settlement clears the bank.',

  // --- Phase 11: Fixed Assets, Depreciation & CIP ---

  depreciation:
    'Systematic allocation of a fixed asset\'s cost over its useful life. RI uses straight-line method per D-127: (cost - salvage) / useful life months. Per ASC 360-10-35 / ASC 958-360-35 (GAAP for nonprofits). MACRS tax lives (IRC § 168) do NOT apply — they are for computing taxable income, which 501(c)(3)s generally do not have.',

  'useful-life':
    'Management\'s best estimate of the period an asset will provide economic benefit, per ASC 360-10-35 / 2 CFR 200.436. GAAP defaults: Building structure: 40yr (480mo), Roof: 20-25yr, HVAC/MEP: 20yr, Electrical/Plumbing/Windows: 20-25yr, Flooring: 5-15yr, Equipment: 5-10yr. These are longer than MACRS tax lives because they reflect actual expected use, not accelerated tax recovery periods.',

  'net-book-value':
    'An asset\'s cost minus accumulated depreciation. Represents the remaining undepreciated balance on the books.',

  'salvage-value':
    'Estimated residual value of an asset at the end of its useful life. RI defaults to $0 for all fixed assets per D-127.',

  'date-placed-in-service':
    'The date an asset begins being used for its intended purpose. Depreciation starts the month following PIS date. For CIP conversions, this is the date the structure is ready for occupancy.',

  'cip-conversion':
    'The process of reclassifying Construction in Progress costs to fixed asset accounts when a structure is placed in service. Generates a reclassification JE: DR Building, CR CIP. Per DM-P0-030.',

  'component-depreciation':
    'Depreciating a building\'s major components (structure, roof, HVAC, etc.) separately, each with its own useful life. Required for the Lodging building per DM-P0-020.',

  'interest-capitalization':
    'During construction, AHP loan interest is capitalized to CIP - Construction Interest rather than expensed. Per ASC 835-20. Switches to expense mode when all structures are placed in service.',

  'prepaid-amortization':
    'Monthly recognition of a prepaid expense over its coverage period. DR Expense, CR Prepaid. Auto-generated via cron. Per TXN-P0-054.',

  'developer-fee':
    'RI\'s development fee ($827K) — partially paid in cash during construction, remainder deferred as a long-term liability (Deferred Developer Fee Payable). Related-party transaction. Per DM-P0-033.',

  'ahp-loan':
    'Affordable Housing Program loan from FHLBB. $3.5M credit facility. Interest accrues monthly, paid annually Dec 31. Available credit = limit - drawn. Per DM-P0-025.',
}

/** Get a help term by its slug. Returns undefined for unknown terms. */
export function getHelpTerm(slug: string): string | undefined {
  return helpTerms[slug]
}
