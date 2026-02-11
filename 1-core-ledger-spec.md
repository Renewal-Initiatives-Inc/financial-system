# Chunk 1: Core Ledger / Chart of Accounts — Specification

**Status:** 🟡 Draft in Progress
**Version:** 0.1
**Last Updated:** 2026-02-11

---

## 1. Problem Statement

QuickBooks Online provides general-purpose accounting software designed for thousands of business types, but Renewal Initiatives needs depth on 501(c)(3) nonprofit fund accounting, not breadth across irrelevant features. While QBO is functional, it forces workarounds for core nonprofit requirements: weak fund accounting (restricted vs. unrestricted tracking is bolted on through classes/locations), no native support for grant revenue recognition with donor restrictions, and limited visibility into multi-funder capital stacks. At nonprofit subscription rates, QBO is also a recurring cost that doesn't align with RI's small scale (2-5 users, one property, low transaction volume).

More importantly, **Claude Code and Cowork make it economically viable to build custom financial software** that goes 10x deeper on what RI actually needs. Rather than accepting QBO's constraints and paying for features RI will never use, RI can build personal software optimized for affordable housing operations, fund accounting for restricted grants, and integration with existing internal tools (renewal-timesheets, expense-reports-homegrown, internal-app-registry-auth).

This matters because:
- **Compliance risk**: RI will manage ~$6.8M in restricted funding from multiple sources (AHP loan, Historic Tax Credits, CPA, CDBG) post-closing. Fund accounting errors or inadequate tracking create audit risk and jeopardize funder relationships.
- **Board oversight**: The board requires fund-level financial statements showing restricted vs. unrestricted net assets, per-fund spending, and multi-year grant draw-down. QBO's reporting is inadequate for this without manual reconciliation.
- **Operational efficiency**: Moving to accrual-basis accounting (required as RI scales) reveals RI's true financial position with accounts receivable, prepaid expenses, and accrued liabilities. QBO's accrual support is weak, particularly for nonprofit-specific needs like automatic restricted net asset releases.
- **Integration**: RI has already built renewal-timesheets and expense-reports-homegrown. These should feed directly into the GL, not dead-end into separate databases or require manual QBO data entry.

The cost of not solving this: continued manual workarounds, compliance exposure when restricted grants arrive, inability to produce fund-level financial statements the board needs, and ongoing subscription costs for software that doesn't fit RI's actual workflows.

**Evidence**:
- FY25 operated on cash basis in QBO with minimal transactions (under 990 filing threshold). This worked when RI was pre-operational, but post-closing (March 2026 anticipated), RI will manage 17-unit rental operations, multiple restricted funding sources, construction-in-progress tracking, and payroll.
- Board meeting minutes (October 2025, January 2026) show requests for: fund-level reporting, 3-month forward cash projections, AR aging, and visibility into loan draw availability — none easily producible from QBO.
- Discovery revealed 21 decisions (D-012 through D-033) addressing nonprofit-specific requirements that QBO either doesn't support or requires extensive workarounds to implement.

---

## 2. Goals

### User Goals (what users get)

1. **Accurate fund-level financial statements on demand**: Heather can generate Balance Sheet and Profit & Loss statements showing "Net Assets Without Donor Restrictions" and "Net Assets With Donor Restrictions" with per-fund detail (General Fund, AHP Fund, Historic Tax Credit Fund, etc.) at any time, without manual reconciliation or spreadsheet adjustments.

2. **Accrual-basis accounting without manual journal entries**: The system automatically handles accrual accounting mechanics (AR when rent is due, automatic depreciation entries, loan interest accrual, prepaid expense amortization, restricted net asset releases when funds are spent) so Heather doesn't need deep accounting expertise to maintain GAAP-compliant books.

3. **Integrated data flow from timesheets and expense reports**: Approved timesheets and expense reports automatically create GL entries, eliminating double-entry between systems and ensuring payroll obligations and AP accurately reflect approved transactions.

4. **Visibility into restricted vs. unrestricted funds**: Damien (Treasurer) and the board can see at a glance: total restricted net assets, per-fund spending against grant budgets, available unrestricted cash, and compliance with donor restrictions — enabling informed financial oversight.

5. **Property operations tracking for management decisions**: The board can track property operating expenses by category (utilities broken out by electric/gas/water, R&M, landscaping, insurance, etc.) to support operational optimization (solar panel ROI, electrification impact measurement, budget variance analysis).

### Business Goals (what the organization gets)

1. **Compliance-ready fund accounting from day one**: When restricted grants arrive post-closing, RI's books are already structured to track donor restrictions, produce compliant financial statements, and support funder audits without retroactive restructuring.

2. **Reduced recurring costs**: Eliminate $200/year QuickBooks subscription and reduce bookkeeping overhead by automating entry generation and reconciliation.

3. **Foundation for future chunks**: Chunk 1 provides the GL foundation that Chunks 2-8 build on (revenue tracking, expense categorization, bank reconciliation, compliance reporting, board dashboards, budgeting, integrations).

---

## 3. Non-Goals

The following are explicitly **out of scope** for Chunk 1:

1. **User interface for transaction entry**: Chunk 1 specifies the data model and GL structure. UI/UX for how users enter transactions (forms, workflows, validation messages) is deferred to implementation phase. Claude Code will determine appropriate interface patterns during build.

2. **Revenue recognition policies for grants and donations**: Chunk 1 creates the GL accounts needed to handle grant revenue (Grants Receivable, Deferred Revenue, Grant Income), but the policy decision of *when* to recognize revenue (award date vs. receipt vs. expenditure) is a **Chunk 2 decision**. The GL structure supports all approaches.

3. **Bank reconciliation workflow**: Chunk 1 creates the GL that must reconcile to bank statements, but the reconciliation process (importing bank feeds, matching transactions, resolving discrepancies) is **Chunk 4**.

4. **Reporting and dashboards**: Chunk 1 ensures the GL can *produce* fund-level financial statements with accurate balances, but the design of board reports, dashboards, and management metrics is **Chunk 6**.

5. **Integration APIs and data pipelines**: Chunk 1 specifies that the GL will receive data from renewal-timesheets, expense-reports-homegrown, Ramp credit card, and bank feeds, but the integration layer (API contracts, data validation, error handling) is **Chunk 8**.

6. **Compliance reporting formats (Form 990, Form PC)**: The GL structure is compliant with nonprofit accounting standards (FASB ASC 958), but generating specific compliance reports (IRS Form 990, MA Attorney General Form PC) is **Chunk 5**.

7. **Security deposits, bad debt policy, tax credit equity accounting, in-kind contributions, volunteer time tracking**: Per discovery, these are deferred to **Chunk 5** pending research into MA law and funder requirements. Chunk 1 does not create GL structure for these items.

8. **Budgeting and variance tracking**: Chunk 1 designs the GL to align with RI's property pro forma structure (enabling variance reporting), but budget creation, variance calculation, and forecast workflows are **Chunk 7**.

Each non-goal is out of scope because it is either:
- The responsibility of a different chunk (clean separation of concerns)
- A policy decision requiring research not yet completed (Chunk 5 compliance deep-dive)
- An implementation detail better determined during build phase (UI patterns, database optimization)

---

## 4. User Stories

### Primary Personas
- **Heather Takle** (Executive Director / Bookkeeper): Day-to-day GL entry, transaction review, month-end close
- **Damien Newman** (Treasurer): Financial oversight, board reporting review, GL spot-checking
- **Jeff Takle** (System Admin / Power User): System configuration, troubleshooting, depreciation setup, migration execution

### Core Ledger Operations

**As Heather**, I want to record a rent payment from a tenant so that AR decreases and the cash balance increases, with the system automatically handling the accrual mechanics (DR: Cash, CR: AR).

**As Heather**, I want to record an expense against a specific restricted fund (e.g., "SARE Fund") so that the system automatically generates the net asset release entry and I don't have to remember the accounting mechanics.

**As Heather**, I want to see which fund a transaction belongs to at a glance so that I can verify expenses are coded to the correct funding source before finalizing entries.

**As Jeff**, I want to configure a depreciation schedule for the Easthampton building (useful life, depreciation method, components) so that the system automatically generates monthly depreciation entries without manual journal entries.

**As Jeff**, I want Claude to guide me through depreciation setup by asking clarifying questions about the asset (year built, recent component replacements, historic property status) so that I configure depreciation correctly without needing to be an IRS depreciation expert.

**As Damien**, I want to view the current balance of "Net Assets With Donor Restrictions" broken down by fund (AHP Fund, Historic Tax Credit Fund, SARE Fund) so that I can verify RI is complying with donor restrictions and not overspending restricted grants.

**As Heather**, I want the system to prevent me from posting a Ramp credit card transaction to the GL until it's been categorized (assigned to a GL expense account) so that uncategorized expenses don't pollute the financial statements.

**As Heather**, I want to record a prepaid expense (like annual property insurance paid upfront) and have the system ask me clarifying questions ("What period does this cover?") so that it automatically sets up monthly amortization entries with detailed memos.

### Fund Accounting

**As Heather**, I want to create a new restricted fund (e.g., "CPA Grant Fund") when a new grant is awarded so that I can start coding transactions to that fund without waiting for system changes or developer intervention.

**As Heather**, I want to designate a fund as "Restricted" or "Unrestricted" at creation time so that the system knows which net asset account (With Donor Restrictions vs. Without Donor Restrictions) to affect when transactions hit that fund.

**As Damien**, I want to see cumulative spending against each restricted fund (e.g., "SARE Fund: $250K awarded, $50K spent, $200K remaining") so that I can monitor grant draw-down and ensure RI is on pace with funder requirements.

### Loan Tracking

**As Heather**, I want the system to automatically accrue AHP loan interest monthly at the current rate (4.75% or whatever rate is configured) so that the P&L reflects interest expense even though RI only pays interest annually.

**As Jeff**, I want to update the AHP loan interest rate when AHP provides the new annual rate so that the system recalculates the year-to-date accrual difference and generates a true-up adjustment entry.

**As Heather**, I want to record a loan draw (RI borrows additional funds from the AHP line of credit) so that the Loan Payable liability increases and the cash balance increases.

**As Heather**, I want to record loan forgiveness (AHP forgives $X of outstanding principal) so that the system reduces the Loan Payable liability and records Donation Income, reflecting the economic substance of the gift.

### Accounts Receivable

**As Heather**, I want to see AR aging by tenant/unit (Unit 5 owes $1,000 for 30 days, Unit 12 VASH voucher delayed 15 days) so that I can prioritize collection follow-up and distinguish delinquency risk from known payment delays.

**As Jeff**, I want to receive an alert when a tenant makes a partial rent payment (e.g., "Unit 5 paid $500 of $1,000 expected") so that I can follow up with the tenant about the remaining balance.

**As Heather**, I want to record a rent adjustment (proration for mid-month move-in, hardship reduction) with a mandatory note explaining the reason so that the adjustment is documented for landlord-tenant law compliance and audit trail purposes.

### FY25 Migration

**As Jeff**, I want to import all FY25 transactions from QuickBooks Online (CSV export) so that the new system has full historical context and can calculate accrual-basis opening balances for 1/1/2026.

**As Jeff**, I want the system to automatically identify timing differences between cash and accrual accounting (prepaid insurance, accrued reimbursements, December rent AR, accrued loan interest) and generate the necessary adjustment entries so that FY26 opening balances are correct without manual calculation.

**As Jeff**, I want to review a conversion summary showing FY25 ending balances (cash basis) vs. FY26 opening balances (accrual basis) with a list of all adjustments made so that I can verify the conversion is accurate before approving it.

### Edge Cases and Error States

**As Heather**, I want the system to warn me (but not block me) if I try to post a transaction without coding it to a fund so that I'm reminded to categorize it but can override if it's truly general/unrestricted.

**As Heather**, I want the system to prevent me from deleting a GL account that has transaction history so that I don't accidentally corrupt the ledger.

**As Jeff**, I want to see which GL accounts are used for automated entries (depreciation, loan interest accrual, net asset releases) so that I know which accounts should not be manually edited or deleted.

**As Damien**, I want to see a clear error message if I try to view a fund-level P&L for a date range before the fund was created so that I understand why data is missing rather than seeing blank reports.

---

## 5. Requirements

### Must-Have (P0) — Cannot Ship Without

These requirements represent the minimum viable core ledger. If any P0 is cut, the ledger cannot fulfill its core function: accurate fund accounting on an accrual basis for a 501(c)(3) nonprofit.

#### GL-P0-001: Double-Entry Bookkeeping Foundation
**Requirement**: Every transaction must consist of balanced debits and credits. The system enforces that total debits = total credits for each GL entry.

**Acceptance Criteria**:
- [x] System rejects any transaction where debits ≠ credits
- [x] Multi-line journal entries supported (e.g., one debit, three credits)
- [x] Running trial balance (sum of all debits = sum of all credits) can be generated at any time

**Decision Reference**: Core accounting principle (not explicitly decided, but foundational)

---

#### GL-P0-002: Chart of Accounts Structure
**Requirement**: The GL must support the five account types required for nonprofit accounting: Assets, Liabilities, Net Assets (Equity), Revenue, Expenses. Each account has a unique ID, name, type, and normal balance (debit or credit).

**Acceptance Criteria**:
- [x] System supports account types: Asset, Liability, Net Asset, Revenue, Expense
- [x] Each account has: unique ID, name, account type, normal balance (debit/credit), active/inactive status
- [x] Accounts can be marked inactive (preventing new transactions) but not deleted if transaction history exists
- [x] Account list can be filtered by type and status

**Decision Reference**: D-018 (payroll GL structure), D-031 (property operating expenses), other decisions specify individual accounts

---

#### GL-P0-003: Fund Accounting Structure
**Requirement**: The ledger supports full fund accounting with dynamic fund creation. Each transaction is coded to exactly one fund. Funds are designated "Restricted" or "Unrestricted" at creation. Fund-level balances roll up to net asset accounts ("Net Assets With Donor Restrictions" and "Net Assets Without Donor Restrictions").

**Acceptance Criteria**:
- [x] System includes two initial funds: "General Fund" (Unrestricted) and "AHP Fund" (Restricted)
- [x] Users can create new funds dynamically without system changes
- [x] Each fund has: unique ID, name, restriction type (Restricted/Unrestricted), creation date, optional description
- [x] Every transaction is coded to exactly one fund (enforced at entry time)
- [x] Fund-level trial balance can be generated for any fund
- [x] Net asset balances roll up correctly: restricted funds → "Net Assets With Donor Restrictions", unrestricted funds → "Net Assets Without Donor Restrictions"

**Decision Reference**: D-013 (fund accounting structure), D-014 (net assets split)

---

#### GL-P0-004: Accrual-Basis Accounting
**Requirement**: The system operates on accrual basis: revenue is recognized when earned (not when cash is received), expenses are recognized when incurred (not when cash is paid). The GL supports AR, AP, prepaid expenses, accrued liabilities, and deferred revenue.

**Acceptance Criteria**:
- [x] GL accounts exist for: Accounts Receivable, Accounts Payable, Prepaid Expenses, Accrued Expenses Payable, Deferred Revenue
- [x] Rental income creates AR when rent is due, reduces AR when payment is received (D-025)
- [x] System can generate accrual-basis financial statements (Balance Sheet, P&L) at any time

**Decision Reference**: D-005 (accrual-basis decision), D-025 (rental income recognition), D-028 (prepaid/accrued structure)

---

#### GL-P0-005: Automatic Restricted Net Asset Releases
**Requirement**: When an expense is posted against a restricted fund, the system automatically generates a net asset release entry moving the expense amount from "Net Assets With Donor Restrictions" to "Net Assets Without Donor Restrictions".

**Acceptance Criteria**:
- Given an expense transaction coded to a restricted fund (e.g., $50K to "SARE Fund")
- When the expense is posted to the GL
- Then the system automatically generates: DR: Net Assets With Donor Restrictions $50K | CR: Net Assets Without Donor Restrictions $50K
- And the fund's cumulative spending total increases by $50K
- And the balance sheet correctly shows reduced restricted net assets and increased unrestricted net assets

**Decision Reference**: D-029 (automatic release mechanics)

---

#### GL-P0-006: Payroll GL Structure
**Requirement**: The GL supports simplified payroll accounting with a single "Salaries & Wages" expense account and separate liability accounts for withholdings and payroll taxes.

**Acceptance Criteria**:
- [x] GL accounts exist for:
  - Expenses: "Salaries & Wages" (single account, no functional split)
  - Liabilities: Accrued Payroll Payable, Federal Income Tax Payable, State Income Tax Payable, Social Security Payable, Medicare Payable, Workers Comp Payable, 401(k) Withholding Payable
- [x] Additional withholding liability accounts can be added dynamically as needed
- [x] Payroll entries from renewal-timesheets are accepted (integration contract TBD in Chunk 8)

**Decision Reference**: D-018 (simple payroll structure, year-end allocation)

---

#### GL-P0-007: Property Operating Expense Accounts
**Requirement**: The GL includes granular accounts for property operating expenses aligned with RI's property pro forma structure.

**Acceptance Criteria**:
- [x] GL accounts exist for the 13 property operating categories:
  1. Property Taxes
  2. Property Insurance
  3. Management Fees
  4. Commissions
  5. Landscaping & Grounds
  6. Repairs & Maintenance
  7. Utilities - Electric
  8. Utilities - Gas
  9. Utilities - Water/Sewer
  10. Utilities - Internet
  11. Utilities - Security & Fire Monitoring
  12. Utilities - Trash
  13. Other Operating Costs
- [x] Vacancy Loss account exists as contra-revenue (not expense)

**Decision Reference**: D-031 (granular property expense structure)

---

#### GL-P0-008: Fixed Asset and Depreciation Structure
**Requirement**: The GL supports fixed asset tracking with component breakdown, accumulated depreciation, and monthly automated depreciation entry generation.

**Acceptance Criteria**:
- [x] GL accounts exist for: Building (fixed asset), Equipment (fixed asset), Accumulated Depreciation - Building (contra-asset), Accumulated Depreciation - Equipment (contra-asset), Depreciation Expense
- [x] System stores depreciation schedules: asset name, original cost, useful life (years), depreciation method (straight-line, etc.), date placed in service, monthly depreciation amount
- [x] System generates monthly depreciation entries automatically based on configured schedules
- [x] Net book value (original cost - accumulated depreciation) can be calculated for any asset at any time

**Decision Reference**: D-019 (depreciation structure), D-032 (construction in progress)

---

#### GL-P0-009: Construction in Progress (CIP) Account
**Requirement**: The GL includes a Construction in Progress asset account to accumulate development costs before the building is placed in service.

**Acceptance Criteria**:
- [x] GL account "Construction in Progress" exists (asset type)
- [x] Development costs (acquisition, renovation, soft costs) can be recorded to CIP
- [x] When building is placed in service, CIP balance can be transferred to "Building" fixed asset account
- [x] Depreciation does NOT occur on CIP balances (only on Building after placed in service)

**Decision Reference**: D-032 (CIP for property development)

---

#### GL-P0-010: AHP Loan Tracking
**Requirement**: The GL tracks the AHP revolving line of credit with support for draws, repayments, interest accrual, and forgiveness.

**Acceptance Criteria**:
- [x] GL account "AHP Loan Payable" exists (liability)
- [x] Only drawn amounts appear as liability; available but undrawn credit is NOT recorded
- [x] Loan draws increase liability: DR: Cash, CR: AHP Loan Payable
- [x] Principal repayments decrease liability: DR: AHP Loan Payable, CR: Cash
- [x] System stores loan metadata: credit limit ($3.5M), current drawn amount, available credit (calculated), current interest rate

**Decision Reference**: D-022 (loan structure — drawn amount only is liability)

---

#### GL-P0-011: Monthly Loan Interest Accrual
**Requirement**: The system automatically generates monthly interest accrual entries for the AHP loan at the configured rate, with support for rate changes and true-up adjustments.

**Acceptance Criteria**:
- Given the AHP loan has a configured interest rate (e.g., 4.75%)
- When month-end processing runs
- Then the system generates: DR: Interest Expense (calculated monthly), CR: Accrued Interest Payable
- And when the interest rate changes, the system calculates YTD accrual difference and generates a true-up adjustment entry

**Decision Reference**: D-011 (monthly accrual at last known rate, true-up at year-end)

---

#### GL-P0-012: Loan Forgiveness as Donation Income
**Requirement**: When AHP forgives outstanding principal or interest, the system records the forgiveness as Donation Income (not a silent equity adjustment).

**Acceptance Criteria**:
- Given AHP forgives $50K of outstanding principal
- When the forgiveness transaction is recorded
- Then the entry is: DR: AHP Loan Payable $50K | CR: Donation Income $50K
- And net assets increase by $50K (the forgiven debt becomes revenue)
- And the maximum available credit permanently reduces by the forgiven amount

**Decision Reference**: D-023 (forgiveness as donation income)

---

#### GL-P0-013: Accounts Receivable by Tenant/Unit
**Requirement**: AR is tracked at the tenant/unit level (not just aggregated by funding source) to support collections management and aging analysis.

**Acceptance Criteria**:
- [x] AR records include: tenant/unit identifier, amount due, due date, funding source (tenant direct, VASH, MVRAP, etc.)
- [x] AR aging report can be generated showing balances by tenant/unit in buckets: current, 30 days, 60 days, 90+ days
- [x] System distinguishes known payment delays (e.g., VASH vouchers historically arrive in N+1) from delinquency risk

**Decision Reference**: D-026 (by-tenant/unit tracking with aging)

---

#### GL-P0-014: Grants Receivable (Separate from AR)
**Requirement**: The GL includes a separate "Grants Receivable" asset account distinct from general Accounts Receivable for tracking grant awards before cash is received.

**Acceptance Criteria**:
- [x] GL account "Grants Receivable" exists (asset type, separate from Accounts Receivable)
- [x] When a grant is awarded but not yet received: DR: Grants Receivable, CR: Grant Revenue (or Deferred Revenue)
- [x] When grant cash is received: DR: Cash, CR: Grants Receivable
- [x] Balance sheet shows Grants Receivable separately from tenant/operations AR

**Decision Reference**: D-030 (grants receivable for award timing)

---

#### GL-P0-015: Prepaid Expenses and Accrued Liabilities (Simple Structure)
**Requirement**: The GL uses three simplified accounts for timing-related transactions: Prepaid Expenses (asset), Accrued Expenses Payable (liability), Deferred Revenue (liability). Detail is captured in transaction memos, not separate GL accounts.

**Acceptance Criteria**:
- [x] GL accounts exist: Prepaid Expenses (asset), Accrued Expenses Payable (liability), Deferred Revenue (liability)
- [x] Transactions posted to these accounts include detailed memos explaining the item and period covered
- [x] System can query transactions by GL account and display memos for drill-down reporting

**Decision Reference**: D-028 (simple GL structure with AI-enhanced memos)

---

#### GL-P0-016: Rent Adjustments with Mandatory Annotation
**Requirement**: Rent adjustments (prorations, hardship reductions, vacate refunds) must include a mandatory note explaining the reason and are tracked in separate GL adjustment accounts.

**Acceptance Criteria**:
- [x] GL accounts exist: Rental Income - Proration Adjustments, Rental Income - Hardship Adjustments, Rental Income - Vacate Adjustments
- [x] When recording a rent adjustment, the system requires a note field (cannot be blank)
- [x] Adjustment entries include: tenant/unit identifier, adjustment type, amount, date, explanatory note
- [x] Adjustments can be reported separately (e.g., "total hardship adjustments this quarter")

**Decision Reference**: D-027 (adjustments with mandatory annotation)

---

#### GL-P0-017: FY25 Transaction Import
**Requirement**: The system can ingest all FY25 transactions from QuickBooks Online via a one-time import script. Imported transactions are stored with an "FY25 Import" flag for reference and opening balance calculation.

**Acceptance Criteria**:
- [x] Import script accepts transaction data (CSV or direct data structure)
- [x] Script validates: debits = credits for each transaction
- [x] Script validates: all referenced account IDs exist in the GL
- [x] Imported transactions are flagged "FY25 Import" to distinguish from ongoing FY26 entries
- [x] Import errors halt the process and report line numbers/reasons (rollback on failure)
- [x] Script is documented (can be run by Jeff or Claude Code in future if needed)

**Implementation Note**: This is a one-time migration, not a production feature. No UI required—Jeff provides transaction data, Claude Code writes and executes import script.

**Decision Reference**: D-033 (FY25 cash-to-accrual conversion)

---

#### GL-P0-018: Accrual-Basis Opening Balance Generation
**Requirement**: After importing FY25 transactions, the system automatically identifies timing differences (prepaid, accrued, AR, accrued interest) and generates adjustment entries to produce correct accrual-basis opening balances for 1/1/2026.

**Acceptance Criteria**:
- Given all FY25 transactions are imported
- When conversion processing runs
- Then the system generates adjustment entries for known items:
  - Prepaid insurance: $501 (per D-028)
  - Accrued reimbursements: $4,472 to Heather (per D-028)
  - December 2025 rent AR (if rent was due but not received by 12/31/25)
  - Accrued AHP loan interest (based on last payment date and 4.75% rate)
- And the system produces a conversion summary showing: FY25 ending balances (cash basis), adjustments made, FY26 opening balances (accrual basis)
- And user can review and approve the conversion before finalizing

**Decision Reference**: D-033 (system-generated adjustments for opening balances)

---

#### GL-P0-019: Transaction-Level Fund Coding
**Requirement**: Every transaction is coded to exactly one fund. Fund coding is enforced for certain transaction types (Ramp, rental income) and defaulted but overridable for others (timesheets).

**Acceptance Criteria**:
- [x] Every GL transaction record includes a fund_id field
- [x] Ramp credit card transactions MUST be categorized (GL account assigned) before posting; system prevents posting if uncategorized
- [x] Rental income transactions MUST identify funding source (tenant, VASH, MVRAP, etc.) at entry time
- [x] Timesheet-based payroll entries default to "General Fund" (Unrestricted) but can be overridden via task codes
- [x] System warns (but does not block) if a transaction has no fund coded, allowing override for general/unrestricted entries

**Decision Reference**: D-024 (selective validation, defaults)

---

#### GL-P0-020: Ramp Credit Card GL Structure
**Requirement**: The GL supports Ramp credit card integration with a "Credit Card Payable" liability account and transaction status tracking (pending/closed).

**Acceptance Criteria**:
- [x] GL account "Credit Card Payable" exists (liability)
- [x] Ramp transactions have status field: "pending" (awaiting categorization) or "closed" (categorized and posted)
- [x] Transactions in "pending" status do NOT appear in financial statements
- [x] When a Ramp transaction is categorized: DR: GL Expense Account (user-selected), CR: Credit Card Payable
- [x] Payment of Ramp bill reduces liability: DR: Credit Card Payable, CR: Cash

**Decision Reference**: D-021 (Ramp GL structure, Chunk 8 handles workflow)

---

### Nice-to-Have (P1) — Significant Improvements, Fast-Follow Candidates

These requirements significantly improve user experience or operational efficiency but are not required for the ledger to function. P1s are strong candidates for fast-follow releases after P0 launch.

#### GL-P1-001: AI Depreciation Assistant
**Requirement**: When a user adds a fixed asset, Claude guides them through depreciation configuration by asking clarifying questions (year built, components, recent replacements, historic property status) and recommending useful lives and methods based on asset type and the most recent IRS rules.

**Acceptance Criteria**:
- [x] When user initiates "Add Fixed Asset", Claude asks: asset type, year built/acquired, components (if building), recent major replacements, historic property status
- [x] Claude provides depreciation recommendations: suggested useful life, depreciation method (straight-line, etc.), component breakdown if applicable
- [x] User can accept recommendations or override with custom values
- [x] System includes disclaimer: "This is guidance, not tax advice. Consult a CPA for compliance."
- [x] Configured depreciation schedule is stored and monthly entries begin automatically

**Decision Reference**: D-020 (AI depreciation assistant)

**Why P1 (not P0)**: The building won't be placed in service until late 2026. Depreciation setup can be done manually for the first few months if the AI assistant isn't ready at launch. This feature is high-value but not blocking.

---

#### GL-P1-002: AI Transaction Entry Assistant for Prepaid/Accruals
**Requirement**: When a user enters a transaction that might involve timing adjustments (prepaid, accrued, deferred), Claude asks clarifying questions and writes detailed memos automatically, setting up amortization schedules as needed.

**Acceptance Criteria**:
- [x] When user enters a transaction, Claude detects potential timing issues (e.g., insurance payment, reimbursement owed, prepaid rent received)
- [x] Claude asks: "What is this payment for?", "What period does it cover?", "Is this for the current month or future months?"
- [x] Claude generates detailed memo based on answers (e.g., "Property insurance $50K paid 3/1/26, covers 3/1/26–2/28/27, $4,167/month amortization")
- [x] For prepaids spanning multiple months, Claude sets up amortization schedule and generates monthly entries automatically
- [x] User can review and approve before posting

**Decision Reference**: D-028 (AI-enhanced entry for prepaid/accruals)

**Why P1 (not P0)**: Full AI assistant requires understanding all transaction sources (revenue, expense, integrations) which won't be complete until Chunks 2, 3, and 8 are finished. Manual entry with user-written memos is sufficient for P0.

---

#### GL-P1-003: Partial Rent Payment Alerts
**Requirement**: When a tenant makes a partial rent payment (amount received < amount expected), the system generates an alert for follow-up.

**Acceptance Criteria**:
- Given Unit 5 rent is $1,000/month due on the 1st
- When a payment of $500 is received and posted against Unit 5 AR
- Then the system generates alert: "Unit 5 partial payment: $500 of $1,000 received, $500 outstanding"
- And alert is visible to Jeff (property manager) for follow-up

**Decision Reference**: D-026 (partial payment detection)

**Why P1 (not P0)**: Collections management is valuable but not critical for ledger accuracy. RI can manually track partial payments in the first few months if needed.

---

#### GL-P1-004: Known Payment Delay Tracking (VASH/MVRAP Grace Periods)
**Requirement**: The system distinguishes "known delays" (e.g., VASH vouchers historically arrive in month N+1) from true delinquency risk in AR aging reports.

**Acceptance Criteria**:
- [x] AR records include funding source (tenant direct, VASH, MVRAP, etc.)
- [x] System configuration includes expected grace periods by funding source (e.g., "VASH: 30-day grace expected")
- [x] AR aging report shows: "30 days overdue (within VASH grace)" vs. "30 days overdue (tenant delinquency risk)"
- [x] Alerts prioritize true delinquency risk over known delays

**Decision Reference**: D-026 (distinguish known delays from delinquency)

**Why P1 (not P0)**: This is a reporting/alerting enhancement. Basic AR aging (without smart delinquency detection) is sufficient for P0.

---

### Future Considerations (P2) — Architectural Planning, Not Implemented in V1

These are explicitly out of scope for V1 but documented to ensure the GL architecture doesn't preclude them. P2s guide design decisions (e.g., "make sure the data model can support this later") without requiring implementation now.

#### GL-P2-001: Detailed Capital Cost Codes
**Requirement**: Support itemized cost-code tracking within funds (e.g., "Historic Tax Credit Fund — Gable Restoration" vs. "Historic Tax Credit Fund — Accessible Systems").

**Rationale**: D-016 deferred detailed cost codes to Chunk 5 pending funder substantiation requirements research. The current fund-level tagging structure (every transaction coded to a fund) can be enhanced with sub-accounts or cost-center dimensions if funders require itemized tracking.

**Architectural Consideration**: Ensure transaction data model can accommodate additional tagging dimensions (e.g., fund_id + cost_code_id) without schema redesign.

**Decision Reference**: D-016 (capital cost coding deferred)

---

#### GL-P2-002: Capital vs. Operating Split Within Funds
**Requirement**: Distinguish "AHP Fund — Capital" from "AHP Fund — Operating" if funders provide both acquisition/rehab funding and ongoing operating support.

**Rationale**: D-032 deferred this split pending Chunk 5 funder requirements research. Options include: separate funds (AHP Capital Fund, AHP Operating Fund), transaction-level tags, or sub-accounts.

**Architectural Consideration**: Fund structure should support either approach (multiple funds or sub-fund tagging).

**Decision Reference**: D-032 (capital vs. operating deferred)

---

#### GL-P2-003: Security Deposits and Escrow Accounts
**Requirement**: Track tenant security deposits as restricted cash (liability owed to tenant) and handle MA law requirements for security deposit accounting.

**Rationale**: Deferred to Chunk 5 pending MA landlord-tenant law research.

**Architectural Consideration**: Ensure GL can handle restricted cash accounts (asset with offsetting liability) and per-tenant security deposit tracking.

**Decision Reference**: Deferred items list (Chunk 1 discovery summary)

---

#### GL-P2-004: Bad Debt Reserves and Write-Off Policy
**Requirement**: Support allowance-for-doubtful-accounts (reserve-based) or direct write-off method for uncollectible tenant rent.

**Rationale**: Deferred to Chunk 5 pending policy decision and nonprofit accounting best practices research.

**Architectural Consideration**: Ensure AR structure can accommodate both methods (reserve account or direct write-off journal entries).

**Decision Reference**: D-025 (bad debt deferred)

---

#### GL-P2-005: Historic Tax Credit Equity Accounting
**Requirement**: Track equity investments from Historic Tax Credit investors, including capital contributions, equity partner distributions, and exit/redemption scenarios.

**Rationale**: Deferred to Chunk 5 pending tax credit deal structure and accounting requirements research. RI's capital stack includes Historic equity, but the accounting treatment depends on deal terms not yet finalized.

**Architectural Consideration**: Ensure net asset structure can handle equity partner accounts (partner capital, distributions, etc.) if required.

**Decision Reference**: Deferred items list (Chunk 1 discovery summary)

---

#### GL-P2-006: In-Kind Contributions and Volunteer Time Tracking
**Requirement**: Record in-kind donations (donated goods, services, pro-bono professional fees) and volunteer time (for Form 990 reporting).

**Rationale**: Deferred to Chunk 5 pending IRS and funder reporting requirements research.

**Architectural Consideration**: Ensure GL can handle non-cash contribution revenue and offsetting expense (or note disclosure).

**Decision Reference**: Deferred items list (Chunk 1 discovery summary)

---


## 6. Success Metrics

### Primary Success Metric (Leading Indicator)

**Accurate fund-level financial statements pass CPA review**

- **Target**: Within 2 weeks of V1 launch, generate Balance Sheet and P&L for a test period (e.g., 1/1/2026–3/31/2026), including fund-level detail, and have an external CPA review for GAAP compliance and accuracy.
- **Success threshold**: CPA confirms: (1) Net asset split (restricted/unrestricted) is correct, (2) Fund balances reconcile, (3) No material accounting errors, (4) Structure is audit-ready.
- **Stretch target**: CPA confirms the books are cleaner and more compliant than typical small nonprofit QBO setups they've reviewed.
- **Measurement method**: Engage a CPA (cost estimate: $500-1,000 for review) to spot-check V1 output. Document findings and remediation.
- **Why this metric**: Fund accounting complexity was identified as the riskiest assumption (user question response). External validation from a CPA provides confidence that the core ledger is implementing nonprofit accounting correctly, reducing compliance risk before restricted grants arrive.

### Secondary Success Metrics (Leading Indicators)

**FY25-to-FY26 accrual conversion accuracy**

- **Target**: FY26 opening balances match expected values within $500 total variance across all accounts.
- **Success threshold**: Known timing differences (prepaid insurance $501, accrued reimbursements $4,472, AR, accrued interest) are correctly reflected in opening balances. Cash balance matches QBO FY25 ending cash exactly.
- **Measurement method**: Compare system-generated FY26 opening balances to manually calculated expected values. Investigate any discrepancies >$100.
- **Evaluation timing**: Immediately after FY25 import and conversion process completes.

**Time to generate fund-level financial statements**

- **Target**: <60 seconds to generate Balance Sheet + P&L with fund-level detail for any date range.
- **Success threshold**: Heather can generate board-ready financial statements on demand during board meetings without waiting for batch processing or manual reconciliation.
- **Measurement method**: Time from "generate report" click to rendered output for a typical 3-month period.
- **Evaluation timing**: 1 week post-launch with real transaction data.

**Automatic entry generation reliability**

- **Target**: 100% reliability for automatic entries (depreciation, loan interest accrual, net asset releases). Zero missed entries, zero incorrect amounts.
- **Success threshold**: Month-end close process runs automatically with no manual intervention required to post depreciation or interest accrual.
- **Measurement method**: Manual inspection of GL after first 3 month-ends. Verify: depreciation posted, interest accrued, net asset releases generated correctly.
- **Evaluation timing**: Monthly review for first 3 months post-launch.

### Lagging Indicators (Tracked Over Time)

**Reduced bookkeeping overhead** (Target: 3 months post-launch)
- **Hypothesis**: Heather spends 25% less time on monthly bookkeeping tasks (transaction entry, reconciliation, month-end close) compared to QBO baseline.
- **Measurement**: Time tracking for first 3 months in new system vs. retrospective estimate of QBO time. Qualitative feedback from Heather on pain points eliminated.

**Board confidence in financial oversight** (Target: 6 months post-launch)
- **Hypothesis**: Board meeting minutes show reduced questions about fund accounting, restricted net assets, and grant draw-down — indicating trust in the system's reporting.
- **Measurement**: Review board meeting minutes for Q2-Q3 2026. Count questions/clarifications requested vs. Q4 2025 / Q1 2026 baseline.

**Zero compliance findings related to fund accounting** (Target: 12 months post-launch / first funder audit)
- **Hypothesis**: When RI undergoes first funder audit (Historic Tax Credit, Historic Tax Credit, or CDBG compliance review), there are zero findings related to fund accounting, restricted net asset tracking, or GL structure.
- **Measurement**: Audit results. Track whether fund accounting is flagged as an issue.

---

## 7. Open Questions

### Blocking Questions (Must Answer Before Launch)

**[Engineering]** What is the minimal viable data model for the GL?
- Tables: accounts, transactions, transaction_lines, funds, depreciation_schedules. Is this sufficient or are additional tables needed (e.g., separate AR tracking table vs. embedded in transaction_lines)?
- **Impact**: Core schema design. Blocking for implementation start.
- **Owner**: Claude Code during build phase.

**[Jeff]** What is the exact FY25 ending cash balance from QuickBooks?
- Needed to validate conversion accuracy. Opening cash balance for FY26 must match QBO FY25 ending cash exactly.
- **Impact**: Conversion validation (GL-P0-018).
- **Owner**: Jeff to confirm from QBO final FY25 reports.

**[Engineering / Product]** Should the system enforce "no duplicate fund names" or allow duplicates?
- Example: Could there be two "AHP Fund" entries (e.g., AHP 2026, AHP 2027)? Or should fund names be unique?
- **Impact**: Fund creation validation logic.
- **Owner**: Jeff to decide based on operational preference.

### Non-Blocking Questions (Can Resolve During Implementation)

**[CPA / Accounting]** Should depreciation start immediately when an asset is placed in service, or the following month?
- IRS allows depreciation to begin the month an asset is placed in service. Confirm RI's preference (immediate vs. following month).
- **Impact**: Depreciation calculation logic. Can be configured either way.
- **Owner**: External CPA or Jeff decision based on tax strategy.

**[Design]** How should the system handle "voiding" or "reversing" a transaction?
- Should voided transactions be marked void (retained in GL) or deleted? How are reversing entries distinguished from corrections?
- **Impact**: Error correction workflows. Not blocking — manual journal entries can handle corrections initially.
- **Owner**: Implementation decision based on UX patterns.

**[Product]** Should inactive GL accounts be hidden by default or always visible?
- When an account is marked inactive (no longer accepting new transactions), should it still appear in account dropdowns and lists?
- **Impact**: UI/UX for account selection. Non-blocking — can be a filter toggle.
- **Owner**: Implementation decision.

**[Integration / Chunk 8]** What is the exact API contract between financial-system and renewal-timesheets for payroll entries?
- Fields expected: employee_id, hours, rate, period_start, period_end, fund_id (from task code). Anything else?
- **Impact**: Payroll entry generation. Deferred to Chunk 8, but flagging now for awareness.
- **Owner**: Chunk 8 discovery.

**[Chunk 2]** When should grant revenue be recognized: at award date, receipt date, or expenditure date?
- This is a revenue recognition policy decision, not a GL structure decision. Chunk 1 supports all three approaches via Grants Receivable and Deferred Revenue accounts.
- **Impact**: Revenue workflow in Chunk 2. Flagging here for awareness that Chunk 1 is ready for any policy.
- **Owner**: Chunk 2 discovery.

---

## 8. Risks and Mitigations

### High-Risk Items

**Risk: Fund accounting implementation errors create compliance exposure**

- **Likelihood**: Medium — Fund accounting is subtle, and RI doesn't currently have a CPA relationship to validate.
- **Impact**: High — Errors could violate donor restrictions, trigger funder audits, or require retroactive GL corrections.
- **Mitigation**:
  - Primary: Engage external CPA for spot-check review of V1 fund-level financial statements (success metric)
  - Secondary: Test with small transactions in multiple funds before processing large restricted grants
  - Tertiary: Document all fund accounting logic decisions in code comments for future CPA review
- **Decision Reference**: User identified this as the riskiest assumption.

**Risk: FY25-to-FY26 accrual conversion produces incorrect opening balances**

- **Likelihood**: Medium — Conversion is complex, involving timing adjustments and data quality unknowns from QBO export.
- **Impact**: Medium-High — Incorrect opening balances propagate errors forward, undermining trust in the system.
- **Mitigation**:
  - Require manual review and approval of conversion summary before finalizing (GL-P0-018 acceptance criteria)
  - Cross-check opening cash balance against QBO FY25 ending cash (must match exactly)
  - Budget time for manual corrections if conversion is off by more than $500
  - Fallback: If conversion fails, manually enter FY26 opening balances and skip FY25 import

**Risk: Depreciation rules are implemented incorrectly, creating IRS audit risk**

- **Likelihood**: Low-Medium — Depreciation is complex and rules change annually. AI assistant may provide incorrect guidance.
- **Impact**: Medium — Incorrect depreciation affects taxable income and could trigger IRS audit or penalties.
- **Mitigation**:
  - Include clear disclaimer in AI depreciation assistant (GL-P1-001): "This is guidance, not tax advice. Consult a CPA."
  - Defer AI assistant to P1 (nice-to-have), allowing manual depreciation setup with external CPA guidance for P0
  - When building is placed in service (late 2026), engage CPA specifically for depreciation schedule review

### Medium-Risk Items

**Risk: Integration APIs between financial-system and other apps (timesheets, expense-reports) are fragile or incomplete**

- **Likelihood**: Medium — Integration is always risky. Employee payroll data sync from internal-app-registry-auth adds complexity.
- **Impact**: Medium — Failed integrations force manual data entry, defeating the purpose of the custom system.
- **Mitigation**:
  - Defer integration to Chunk 8 (out of scope for Chunk 1)
  - Design GL to accept manual entries if integrations fail (fallback workflow)
  - Test integrations with small data volumes before full cutover

**Risk: Users are confused by accrual accounting concepts (AR, prepaid, accrued, deferred)**

- **Likelihood**: Medium — Heather has bookkeeping experience but may not be deeply familiar with accrual mechanics.
- **Impact**: Low-Medium — Data entry errors, but correctable via journal entries.
- **Mitigation**:
  - AI transaction entry assistant (GL-P1-002) guides users through timing adjustments
  - Provide training / documentation on accrual concepts
  - Enable Jeff (power user) to review and correct entries during early months

### Low-Risk Items (Monitored but Not Actively Mitigated)

**Risk: GL account structure needs to be revised after launch**

- **Likelihood**: Low — Discovery was thorough; 21 decisions cover most scenarios.
- **Impact**: Low — Adding accounts is low-effort; renaming or restructuring is more disruptive but manageable.
- **Monitoring**: Track requests for new GL accounts in first 3 months. If >5 accounts need to be added, revisit structure.

**Risk: Restricted grants arrive with unexpected funder requirements not anticipated in Chunk 1**

- **Likelihood**: Medium-Low — Chunk 5 will research funder requirements, but unknowns exist.
- **Impact**: Low — GL structure is flexible (fund-level tagging + P2 architecture for cost codes/sub-accounts).
- **Monitoring**: When grants arrive, review compliance requirements and confirm GL can accommodate. Retrofit if needed (P2 items are designed for this).

---

## 9. Timeline Considerations

### Hard Deadlines

**March 2026: Easthampton Property Closing (Anticipated)**

- RI will begin managing 17-unit rental operations, construction-in-progress spending, and multi-funder draw-down.
- **Impact on Chunk 1**: Core ledger must be operational before closing to handle:
  - Construction in Progress tracking for development costs
  - Fund-coded transactions as restricted grants are drawn
  - AR for rental income starting immediately post-closing
  - Loan draws from AHP line of credit
- **Recommendation**: Target Chunk 1 V1 launch for **mid-February 2026** (2-3 weeks before closing) to allow buffer for testing and bug fixes.

**December 31, 2026: FY26 Year-End Close**

- First full fiscal year on accrual basis. Board will expect clean financial statements and Form 990 prep.
- **Impact on Chunk 1**: Depreciation, loan interest accrual, net asset releases, and all accrual mechanics must be functioning correctly by year-end.
- **Recommendation**: Chunks 1-6 should be complete by Q3 2026 to allow Q4 for Form 990 prep (Chunk 5).

### Dependencies on Other Teams/Chunks

**Chunk 8 (Integration Layer)** provides APIs for:
- renewal-timesheets → financial-system (payroll entry generation)
- expense-reports-homegrown → financial-system (AP entry generation)
- Ramp credit card → financial-system (transaction import and categorization)
- Bank feeds → financial-system (transaction import for reconciliation)

**Impact on Chunk 1**: GL must accept manually entered transactions if Chunk 8 integrations aren't ready. Design GL entry workflows to work standalone (not dependent on integrations).

**Chunk 2 (Revenue Tracking)** specifies grant revenue recognition policy (award vs. receipt vs. expenditure date).

**Impact on Chunk 1**: GL provides Grants Receivable and Deferred Revenue accounts that support any policy Chunk 2 selects. No blocking dependency, but Chunk 2 will consume Chunk 1 GL structure.

**Chunk 5 (Compliance Reporting)** researches funder requirements and may require GL enhancements (cost codes, capital vs. operating splits, security deposits, bad debt policy).

**Impact on Chunk 1**: P2 items (GL-P2-001 through GL-P2-006) are deferred pending Chunk 5 research. GL architecture is designed to accommodate these enhancements without schema redesign.

### Suggested Phasing

**Phase 1 (P0 Core - Target: Mid-February 2026)**
- All P0 requirements (GL-P0-001 through GL-P0-020)
- Excludes: AI assistants (depreciation, transaction entry), partial payment alerts, known delay tracking

**Phase 2 (P1 Enhancements - Target: Q2 2026)**
- AI depreciation assistant (GL-P1-001) — ready before building is placed in service
- AI transaction entry assistant (GL-P1-002) — after Chunk 2/3/8 complete
- Partial payment alerts (GL-P1-003)
- Known delay tracking (GL-P1-004)

**Phase 3 (P2 Retrofits - Target: As Needed Based on Chunk 5 Research)**
- Detailed cost codes (GL-P2-001) — if funders require
- Capital vs. operating splits (GL-P2-002) — if funders require
- Security deposits (GL-P2-003) — if RI begins collecting security deposits
- Bad debt accounting (GL-P2-004) — if delinquency becomes an issue
- Historic Tax Credit/Historic equity accounting (GL-P2-005) — when tax credit deals close
- In-kind contributions (GL-P2-006) — if significant in-kind donations occur

---

## 10. Appendix: Decision Cross-Reference

This spec is based on 21 decisions made during Chunk 1 discovery. For full rationale and context, see `decisions.md`.

| Decision ID | Summary | Spec Section |
|-------------|---------|--------------|
| D-005 | Accrual-basis accounting in 2026 | GL-P0-004 |
| D-011 | AHP loan interest accrual monthly | GL-P0-011 |
| D-012 | Single program class "Property Operations" | (Not GL requirement; affects reporting) |
| D-013 | Fund accounting structure | GL-P0-003 |
| D-014 | Net assets split (restricted/unrestricted) | GL-P0-003, GL-P0-005 |
| D-015 | Opening balance equity ($12,835 AHP in-kind) | (Initial data, not ongoing requirement) |
| D-016 | Capital cost coding deferred | GL-P2-001 |
| D-017 | Employee master data in auth system | (Integration, Chunk 8) |
| D-018 | Payroll GL structure | GL-P0-006 |
| D-019 | Depreciation GL structure | GL-P0-008 |
| D-020 | AI depreciation assistant | GL-P1-001 |
| D-021 | Ramp credit card integration | GL-P0-020 |
| D-022 | AHP loan structure (drawn amount only) | GL-P0-010 |
| D-023 | Loan forgiveness as donation income | GL-P0-012 |
| D-024 | GL entry validation (selective) | GL-P0-019 |
| D-025 | Rental income recognition (accrual when due) | GL-P0-004 |
| D-026 | AR tracking by tenant/unit | GL-P0-013, GL-P1-003, GL-P1-004 |
| D-027 | Rent adjustments with annotation | GL-P0-016 |
| D-028 | Prepaid/accrued simple structure | GL-P0-015, GL-P1-002 |
| D-029 | Automatic restricted net asset releases | GL-P0-005 |
| D-030 | Grants Receivable separate account | GL-P0-014 |
| D-031 | Property operating expenses granular | GL-P0-007 |
| D-032 | Construction in Progress account | GL-P0-009, GL-P2-002 |
| D-033 | FY25 cash-to-accrual conversion | GL-P0-017, GL-P0-018 |

---

**End of Specification**
