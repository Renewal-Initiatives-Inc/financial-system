# Decisions Log — Financial System Project

*Record of choices made with rationale. Prevents relitigating settled questions across sessions.*

---

## How to Use This File

Each entry captures: what was decided, why, what alternatives were considered, and what it affects downstream. Entries are numbered for easy reference.

---

## Decisions

### D-001: Start from workflows, not from QuickBooks feature list
- **Date:** 2026-02-07
- **Decision:** Scope the system by mapping actual money flows and reporting obligations at Renewal Initiatives, not by evaluating/subtracting QuickBooks features.
- **Rationale:** Starting from a COTS product's feature map imports their architectural assumptions and creates a scoping problem (hundreds of irrelevant features to evaluate). Starting from actual operations produces tighter, more relevant requirements.
- **Affects:** All downstream scoping and chunk definitions.

### D-002: Build personal software, not a general-purpose accounting system
- **Date:** 2025-02-07
- **Decision:** The system is purpose-built for Renewal Initiatives only. No multi-tenant design, no generic feature set, no concern for other orgs' needs.
- **Rationale:** "Personal software" philosophy — build only what's needed, go 10x deeper on those features. Eliminates entire categories of complexity (user management, configurability, marketplace features).
- **Affects:** Architecture, scope, feature selection at every level.

### D-003: Use persistent project files as cross-session memory
- **Date:** 2025-02-07
- **Decision:** Maintain structured markdown files (company_facts.md, decisions_log.md, chunks.md) in the financial-system folder. Each session begins by reading these files to rebuild context.
- **Rationale:** Opus token limits make long continuous conversations impractical. File-first approach means context lives in files, not conversation history. Also model-agnostic — works regardless of which model is used in future sessions.
- **Affects:** Working methodology for entire project.

### D-004: System may be multiple loosely-coupled tools, not one monolith
- **Date:** 2025-02-07
- **Decision:** Keep open the possibility that the "financial system" is actually several small apps (ledger, reporting, donor tracking, budgeting) sharing a data layer, rather than one large application.
- **Rationale:** Matches the personal software philosophy and Jeff's existing pattern (separate apps for timesheets, expense reports, etc.). Smaller apps are easier to build, test, and evolve independently.
- **Affects:** Architecture decisions, integration strategy, how chunks are defined.

### D-005: Move to accrual-basis accounting in 2026
- **Date:** 2026-02-07
- **Decision:** The new financial system will use accrual-basis accounting. FY25 was cash-basis (via QuickBooks), but there's no reason to continue that approach.
- **Rationale:** Accrual basis better reflects the org's actual financial position — particularly important for the AHP loan interest (accrues monthly, paid annually), grant revenue recognition when restricted funds are involved, and accounts payable/receivable as the org scales. Starting accrual from the beginning of the custom system avoids a messy mid-stream conversion later.
- **Affects:** Core ledger design (Chunk 1), loan tracking (interest accrual entries), revenue recognition logic, reporting module. The system should generate accrual-basis financial statements from day one.

### D-006: Use existing app-portal for access control; no in-app permissions
- **Date:** 2026-02-07
- **Decision:** The financial system will use the shared authentication regime from the `app-portal` project. Two roles exist: Admin (automatic access to all apps) and User (access to specifically assigned apps). Once a user has access to the financial system, they have full access — no granular in-app permissions, no read-only views, no role-based restrictions within the app.
- **Rationale:** The org has 2-5 users. Building in-app permission layers (e.g., "Treasurer can view but not edit") adds complexity that doesn't match the actual trust model of a tiny organization. The auth boundary is at the app level: either you're allowed in, or you're not. This is a deliberate simplification with understood trade-offs — anyone with access can do anything in the system.
- **Affects:** Eliminates entire categories of feature work: no permission model, no role-based UI, no approval workflows enforced by the system, no audit trail of "who approved what" (unless added for other reasons). Treasurer access becomes simply assigning Damien Newman as a User with financial-system access in app-portal.

### D-007: Expense reports integrate into financial-system, not QBO
- **Date:** 2026-02-07
- **Decision:** The `expense-reports-homegrown` app's final two build phases will be pivoted from QBO API integration to `financial-system` integration. Approved expense reports will flow into the financial system via API for accounting and payment.
- **Rationale:** The original plan was to API into QuickBooks Online, but since we're building a custom financial system to replace QBO, there's no reason to complete that integration. Build the bridge to the new system instead.
- **Affects:** Chunk 8 (Integration Layer) — expense-reports-homegrown becomes a primary data source feeding the ledger. Need to define the API contract: what data does an approved expense report send to the financial system? (likely: payee, amount, expense category, program allocation, date, receipt references). Also affects bill pay — payment execution needs to be solved either in financial-system or separately.

### D-008: Timesheets integrate into financial-system for payroll
- **Date:** 2026-02-07
- **Decision:** Approved timesheets from `renewal-timesheets` will API into `financial-system` to create payroll obligations. The flow is: user submits timesheet → admin approves → approved timesheet creates a payroll entry in financial-system → payroll gets paid out (mechanism TBD).
- **Rationale:** Timesheets are fully functional and complete but currently dead-end into their own database. Connecting them to the financial system closes the loop from time worked → payroll expense → payment.
- **Affects:** Chunk 8 (Integration Layer) and Chunk 3 (Expense Tracking). Need to define: what data does an approved timesheet send? (likely: employee, hours, rate, period, program allocation). Payroll processing/payment mechanism is a separate question — could be in-system, could be via external payroll provider.

### D-009: Proposal-rodeo does NOT integrate into financial-system
- **Date:** 2026-02-07
- **Decision:** The `proposal-rodeo` app will not feed directly into the financial system. No CRM-to-proposal-to-project pipeline.
- **Rationale:** At the org's scale (a few people, a few projects at a time), the overhead of tracking opportunities → proposals → projects as a connected pipeline isn't worth the complexity. Everyone knows what they're working on. If a project tracking capability is built into financial-system, won-work will be entered directly there rather than flowing from proposal-rodeo.
- **Affects:** Simplifies Chunk 8 (Integration Layer) — one fewer integration to build. Means project tracking in financial-system (if built) is standalone, not dependent on upstream apps.

### D-010: Bill pay mechanism is TBD
- **Date:** 2026-02-07
- **Decision:** How approved expenses and payroll actually get paid is not yet decided. Could be built into financial-system, could use an external service, could remain manual (write checks, send wires). Deferring this decision until the core ledger and integration layer are better defined.
- **Rationale:** Payment execution is a different problem from payment recording. The financial system needs to record what's owed and what's been paid. Whether it also initiates the payment is a separate architectural question with security and banking integration implications.
- **Affects:** Chunk 3 (Expense Tracking), Chunk 8 (Integration Layer). Doesn't block core ledger or reporting work.

### D-011: AHP loan interest — accrue monthly at last known rate, true up at year-end
- **Date:** 2026-02-07
- **Decision:** The system will accrue AHP loan interest monthly using the most recent established rate, then record a true-up entry when the actual rate for the year is confirmed. For 2026, start accruing at 4.75% (the 2025 rate). When AHP provides the 2026 rate, calculate the cumulative difference between what was accrued and what should have been, record a single adjustment, and accrue at the new rate going forward.
- **Rationale:** Under accrual accounting (D-005), not accruing interest monthly would understate expenses in quarterly board reports. The AHP loan rate-setting process is nonstandard and unreliable — AHP is contractually supposed to issue a rate at the beginning of the year based on their prior-year savings rate, but in practice they don't do this on time (2025 rate was never formally issued; RI proactively applied 4.75% as the highest known reference, which the AHP CEO verbally approved after the fact). The 2026 rate is expected to drop significantly (possibly to 4% or 3.25%) because AHP's savings rates are declining. Using last known rate as the accrual basis is standard GAAP treatment for variable-rate debt. At current draw ($100K), the monthly difference between 4.75% and 3.25% is ~$125 — visible but not material. As draws increase toward $3.5M, monthly accrual becomes essential.
- **Context:** Damien Newman (AHP Treasurer and RI Treasurer) is not consistently timely on rate-setting details. It may be strategically advantageous for RI to wait for a year-end rate confirmation rather than pressing for an early-year rate, since rates are trending downward. The loan agreement technically requires an annual rate set from AHP, but operational practice has been more informal.
- **Affects:** Chunk 1 (Core Ledger — needs loan module with configurable rate and auto-accrual). System design needs: a current effective rate field, monthly accrual journal entry generation, rate change history, and true-up calculation when rate is revised.

### D-012: Program Classes — Single "Property Operations" Class
- **Date:** 2026-02-10
- **Decision:** Renewal Initiatives' chart of accounts will use exactly one program class: "Property Operations." No separate tracking for training, farm operations, community engagement, or energy — these are all dimensions of the single property/program.
- **Rationale:** RI is a landlord and property manager, not a direct operator of training, farming, or community engagement. Those functions are either FVC-managed (training, farm operations) or integrated into property management (community engagement, energy systems). The Form 1023 lists 5 program areas, but these are descriptive aspects of the same property, not separate business lines. Forcing a multi-class structure would be over-design. For 990 reporting, the functional category split (Program/Admin/Fundraising) is sufficient — RI will note in the 990 that training/farming operations are partnership-managed.
- **Affects:** Chunk 1 (Chart of Accounts design is greatly simplified). Chunk 5 (Compliance Reporting) will map the single property operations class to the 5 Form 1023 program areas for funder/IRS reporting. Chunk 6 (Board Reporting) will report property operations consolidated.

### D-013: Fund Accounting — Full Structure from Day One with Dynamic Fund Creation
- **Date:** 2026-02-10
- **Decision:** The ledger will support full fund accounting from day one. RI will start with two funds (General Fund [Unrestricted] and AHP Fund [Restricted]), with a dynamic fund creation mechanism that allows adding new restricted funds (Historic Tax Credits, CPA, SARE, etc.) post-closing without system redesign. Each fund is designated Restricted or Unrestricted at creation time.
- **Rationale:** RI will definitely have multiple restricted funding sources after the Easthampton property closes (Historic Tax Credits, CPA, CDBG applied-for, others). Building the full fund structure now, with the ability to add funds dynamically, avoids mid-stream redesign. Starting simple (2 funds) prevents over-complication while remaining ready to scale. Compliance requirement extraction and detailed funder reporting (how those requirements are tracked) are deferred to Chunk 5.
- **Affects:** Chunk 1 (Core Ledger — GL chart must have fund structure; transactions coded to funds). Chunk 5 (Compliance Reporting — attaches compliance requirements to funds). Chunk 8 (Integration Layer — inbound data from expense-reports and timesheets must be coded to funds).

### D-014: Net Assets — Split "Without Donor Restrictions" and "With Donor Restrictions" from Day One
- **Date:** 2026-02-10
- **Decision:** The ledger will maintain two net asset accounts from day one: "Net Assets Without Donor Restrictions" (equity from unrestricted sources) and "Net Assets With Donor Restrictions" (equity from restricted sources). These will roll up from individual funds at reporting time.
- **Rationale:** The IRS (990 reporting) requires the restricted/unrestricted split. The board needs visibility into "how much money is actually ours to spend vs. how much is earmarked by donors." With multiple restricted funding sources arriving post-closing, the split is essential for compliance tracking and financial oversight. Starting with the split from day one avoids mid-stream restructuring and matches nonprofit accounting standards. Currently, only unrestricted (General Fund) exists; "With Donor Restrictions" will populate once restricted grants arrive.
- **Affects:** Chunk 1 (Chart of Accounts — 2 net asset accounts instead of 1). Chunk 5 (Compliance Reporting — restricted net assets are monitored for covenant violations). Chunk 6 (Board Reporting — board sees restricted vs. unrestricted split in financial statements).

### D-015: Opening Balance Equity — AHP In-Kind Contribution ($12,835)
- **Date:** 2026-02-10
- **Decision:** The $12,835 opening balance equity in RI's FY25 financials represents consultant costs (Mecky contract, professional development) that AHP agreed to cover as an early sponsoring organization before RI had operational infrastructure (bank account, accounting system, 501c3 designation). RI will record these as an AHP in-kind contribution (equity) offset by professional services expense, creating a $0 net cash impact but documenting the cost for capital stack purposes (consultant costs are allowable project development expenses under historic and low-income tax credit regimes).
- **Rationale:** RI has invoices and receipts for all costs. The contribution-expense approach preserves the cost detail (important for tax credit substantiation) while reflecting the zero cash impact (AHP paid, so RI had no outflow). Treating it as a contribution (not a loan) reflects the informal sponsorship arrangement and avoids future repayment complications.
- **Affects:** Chunk 1 (Opening balance equity setup). No ongoing effect unless RI needs to adjust the opening balance later.

### D-016: Capital Cost Coding — Fund-Level Transaction Tagging; Detailed Cost Codes Deferred to Chunk 5
- **Date:** 2026-02-10
- **Decision:** The ledger will support fund-level transaction tagging (each transaction is coded to a fund — AHP Fund, Historic Tax Credit Fund, etc.). Detailed cost-code tracking (e.g., "Building — Gable Restoration," "Building — Accessible Systems") is deferred. When restricted grants arrive post-closing, transactions will be coded to their respective funds. If funder reporting requirements (discovered in Chunk 5) demand itemized cost-code tracking, the ledger can be retrofitted without architectural change.
- **Rationale:** RI doesn't yet know exactly how detailed funders will require substantiation. Building full cost-code architecture now risks over-design if it's not needed, or under-design if requirements differ. Fund-level tagging is sufficient for basic compliance and allows flexibility. When Chunk 5 (Compliance Reporting) researches funder requirements, cost-code needs will be clear, and implementation is straightforward (add sub-accounts to Building or create cost-center dimension).
- **Affects:** Chunk 1 (Ledger design stays simple; transactions coded to funds, not detailed cost codes). Chunk 5 (Will research funder substantiation requirements and specify cost-code structure if needed). Future retrofitting is low-cost if required.

### D-017: Employee Master Data — Owned by app-portal, Consumed by financial-system
- **Date:** 2026-02-10
- **Decision:** Employee master data (legal name, federal/state tax IDs, pay frequency, withholding elections) will be captured and maintained in `app-portal` (the shared auth system). The financial-system will consume this data via API when generating payroll entries. RI will not duplicate employee data in the financial-system.
- **Rationale:** Single source of truth for employee records. app-portal already manages user accounts for all RI apps; extending it to capture payroll data is low overhead. Avoids sync headaches and duplication. Scales well if RI adds more apps in the future — all consume the same employee master. The "Add User" flow in auth system will be enhanced to capture: legal name, federal tax ID, state tax ID, pay frequency, withholding elections (federal tax, state tax, Social Security, Medicare, workers comp, 401k, HSA, other).
- **Affects:** Chunk 1 (payroll GL structure) and Chunk 3 (payroll processing — how timesheets map to pay periods). Chunk 8 (Integration Layer — financial-system must query auth-system API for employee data). A separate spec will be created for app-portal enhancements (employee-payroll-data-spec.md).

### D-018: Payroll GL Structure — Simple, No Functional Split at Transaction Level
- **Date:** 2026-02-10
- **Decision:** The payroll GL structure will be deliberately simple to match RI's small size. No functional split (Program/Admin/Fundraising) of salary expenses at the transaction level. Instead: single "Salaries & Wages" expense account, with payroll-related liability accounts for taxes and withholdings. At year-end, salary allocation for 990 reporting will be done via manual journal entry (not transaction-level coding).
- **Rationale:** RI has 2-5 employees. There is no separate "Program staff," "Admin staff," or "Fundraising staff" — most employees perform mixed roles. Forcing transaction-level functional splits for payroll creates unnecessary complexity. Standard practice for small nonprofits: record all salary expense in one account, then allocate it to functional categories at year-end for 990 prep. This is simple, maintainable, and avoids over-design. If/when RI scales significantly and has dedicated staff in different functions, the GL structure can be revisited.
- **GL Accounts (Payroll-related):**
  - **Expenses:** Salaries & Wages (single account, no functional split)
  - **Liabilities:** Accrued Payroll Payable, Federal Income Tax Payable, State Income Tax Payable, Social Security Payable, Medicare Payable, Workers Comp Payable, 401(k) Withholding Payable, [Other Withholding Payable — added dynamically as needed]
- **Affects:** Chunk 1 (Chart of Accounts — simplified payroll structure). Chunk 3 (Expense Tracking — payroll entry generation). Chunk 6 (Board Reporting — 990 prep note that salary allocation happens at year-end, not at transaction level).
- **Future consideration:** If RI grows to have dedicated staff roles (e.g., full-time Training Program Director, full-time fundraiser), the GL structure can be enhanced to split Salaries & Wages by function. No architectural change required — just add new accounts.

### D-019: Depreciation GL Structure — Asset Accounts, Schedules, and Monthly Automation
- **Date:** 2026-02-10
- **Decision:** The ledger will support fixed asset depreciation via: (1) Fixed asset GL accounts (Building, Equipment, etc.); (2) Accumulated Depreciation contra-asset accounts; (3) Depreciation Expense accounts; (4) Depreciation schedule metadata storage (asset name, original cost, useful life, depreciation method, date placed in service); (5) Monthly depreciation entry generation based on configured schedules.
- **Rationale:** RI will own the Easthampton building (~$4-5M+) requiring depreciation accounting. Rather than manual year-end journal entries, the system will support configured depreciation schedules and automate monthly GL posting. This is straightforward accounting — no novel features, just standard GL structure that supports depreciation setup and execution.
- **Notes:** Depreciation rules are complex and change annually (component depreciation, accelerated depreciation, historic property rules, etc.). The system will NOT attempt to auto-calculate depreciation rules; instead, it will store and apply user-configured schedules. The AI depreciation assistant (D-020) helps users set up those schedules correctly.
- **Affects:** Chunk 1 (Chart of Accounts — fixed asset accounts + accumulated depreciation + depreciation expense; depreciation schedule configuration storage; monthly entry generation logic).

### D-020: AI Depreciation Assistant — Setup Feature in Chunk 1
- **Date:** 2026-02-10
- **Decision:** Chunk 1 will include an AI-assisted depreciation setup tool. When a user adds a fixed asset to the system, Claude can guide them through depreciation configuration: asking clarifying questions about the asset (year built, components, recent replacements), providing recommendations on useful lives and depreciation methods based on asset type and IRS rules, and helping allocate costs across components if needed. The assistant supports one-time setup; monthly GL entry generation is automatic.
- **Rationale:** Depreciation rules are complex and variable (roof vs. HVAC vs. building structure have different lives; historic properties have special rules; rules change yearly). A human bookkeeper shouldn't need to be a depreciation expert. Claude can provide just-in-time guidance when assets are entered. This is a discovery/setup feature, not a real-time automation feature — users configure schedules once with Claude's help, then the system executes them mechanically.
- **Scope notes:** Full discovery and spec of the AI assistant (what questions to ask, how to validate answers, what recommendations to generate) is deferred to later in Chunk 1 discovery. Initial Chunk 1 spec will include the GL structure and monthly automation; the AI assistant will be scoped in Phase 2+ once we understand asset types and funder requirements better.
- **Affects:** Chunk 1 (configuration UI + AI guidance feature). Future discovery will determine whether Claude can reliably make depreciation recommendations or if guardrails/disclaimers are needed.
- **Important caveat:** The system will NOT provide tax or accounting advice. Claude can provide guidance, but users (or an external CPA when RI eventually engages one) bear responsibility for compliance with IRS rules. The system should include clear disclaimers.

### D-021: Ramp Credit Card Integration — Scope Split Between Chunk 1 and Chunk 8
- **Date:** 2026-02-10
- **Decision:** Ramp credit card integration is split: Chunk 1 provides GL structure; Chunk 8 provides the integration workflow. Chunk 1 needs: Credit Card Payable liability account, transaction data model (merchant, description, amount, GL account, status field). Chunk 8 provides: Ramp API fetch, transaction queue (pending/closed status), AI categorization + rule engine, GL posting automation, payment tracking.
- **Rationale:** The ledger's job is to record transactions (debit expense, credit payable). The integration's job is to ingest, categorize, and validate Ramp data before it hits the ledger. Separating these concerns keeps Chunk 1 focused on GL structure and Chunk 8 focused on data pipeline/workflow.
- **Workflow (Chunk 8):**
  1. Ramp API fetches transactions (daily or on-demand)
  2. Transactions arrive in "pending" queue (awaiting categorization)
  3. User reviews each transaction, with AI categorization recommendations based on merchant/description
  4. User can accept recommendation, manually select GL account, or create/apply a rule (by merchant or keywords)
  5. Rule engine learns from user choices and auto-categorizes similar transactions
  6. Once categorized, transaction moves to "closed" status
  7. Closed transactions post to GL: Debit GL expense account, Credit Credit Card Payable
  8. When Ramp bill arrives and is paid, payment transaction is also tracked/marked
- **Chunk 1 implications:** GL accounts needed: Credit Card Payable (liability), categorization fields in transaction model (GL account assignment, status).
- **Chunk 8 implications:** Ramp API integration, transaction queue management, AI categorization engine, rule definition/storage, status tracking, GL posting logic.
- **Notes:** Ramp API availability will be confirmed during Chunk 8 discovery. If Ramp API is unavailable, fallback is manual CSV import + same workflow. Transactions do not appear in financial statements (P&L, balance sheet) until they are in "closed" status and posted to GL.
- **Affects:** Chunk 1 (GL account structure, transaction data model). Chunk 8 (primary integration responsibility). Chunk 3 (Expense Tracking — may receive Ramp-categorized transactions for further allocation if needed).

### D-022: AHP Loan Structure — Only Drawn Amount is Liability; Available Credit is Contingent Commitment
- **Date:** 2026-02-10
- **Decision:** The AHP loan is a $3.5M revolving line of credit. Only the **drawn amount** ($100K as of 12/31/2025) is recorded as a balance sheet liability. The **available but undrawn credit** ($3.4M) is NOT a liability — it is a contingent commitment tracked for budgeting and covenant compliance purposes but does not appear on the GL. When principal is drawn, it is added to the Loan Payable account. When principal is repaid, the amount is deducted from Loan Payable (principal reduction). The credit limit can be permanently reduced if AHP forgives portions (see D-023).
- **Rationale:** Under accrual accounting (D-005), only borrowed amounts create liabilities. Available but undrawn credit is a future option, not a present obligation. This matches GAAP treatment of revolving credit facilities. RI will track available credit for planning and compliance reporting (e.g., "we have $3.4M available if we need to draw"), but the GL only reflects what has actually been borrowed.
- **GL Treatment:**
  - **Liability account:** AHP Loan Payable = $100,000 (drawn amount only)
  - **Note disclosure:** "Credit facility up to $3,500,000; drawn $100K; available $3,400,000"
  - **Future draws:** When RI draws additional amounts (e.g., $500K for property closing), Debit Bank, Credit AHP Loan Payable $500K
  - **Prepayment/principal reduction:** When RI repays principal early, Debit AHP Loan Payable, Credit Bank
- **Affects:** Chunk 1 (GL account structure — single Loan Payable liability account; tracking of draws/repayments). Chunk 6 (Board Reporting — available credit disclosed in notes, not on balance sheet).

### D-023: Loan Forgiveness — Treated as Donation Income, Not Equity Adjustment
- **Date:** 2026-02-10
- **Decision:** When AHP exercises its discretionary option to forgive outstanding principal or interest on the loan, the forgiven amount is recorded as **Donation Income** (or "In-Kind Contribution Income"), not as an equity adjustment or debt reduction without revenue recognition. The AHP loan agreement explicitly states that forgiveness "may be characterized as a charitable contribution from Lender to Borrower" and "is intended as a donation to support Borrower's charitable mission." Upon forgiveness, RI will: (1) Reduce the Loan Payable liability by the forgiven amount; (2) Record the corresponding credit as Donation/Grant Income; (3) Obtain written documentation from AHP confirming the forgiveness; (4) Maintain records that "no goods or services were provided in return" (per IRS requirements for documenting charitable contributions).
- **Rationale:** The AHP loan agreement is explicit: forgiveness is a **charitable donation**, not a loan restructuring or refinancing. It represents actual value contributed to RI that increases net assets. Recording it as income (not equity adjustment) properly reflects the economic substance: RI's net worth increases because AHP forgave an obligation. This also aligns with how AHP treats the forgiveness (as a tax-deductible charitable contribution on their end). The loan agreement further notes that "the maximum available credit shall be permanently reduced by the amount forgiven," so RI cannot re-borrow forgiven amounts.
- **GL Treatment (Example: AHP forgives $50K of the $100K drawn):**
  - Debit: AHP Loan Payable $50,000
  - Credit: Donation Income (or Grant Income / In-Kind Contribution) $50,000
  - RI's net assets increase by $50K (the forgiven liability becomes income)
  - The remaining loan payable: $50,000
  - The maximum available credit permanently reduces by $50K (from $3.5M to $3.45M)
- **Documentation Requirements:** AHP must provide written notice confirming the amount, date, and nature of forgiveness (per Section 4.4 of the loan agreement). RI must maintain this documentation for IRS purposes (showing that the contribution was for "no goods or services in return").
- **Affects:** Chunk 1 (GL accounts for donation income; loan payable reduction logic). Chunk 5 (Compliance Reporting — documenting forgiveness for tax purposes and funder/IRS reporting). Chunk 6 (Board Reporting — board needs visibility into loan forgiveness events as they affect equity/net assets).
- **Important distinction:** This is revenue recognition (donation income), not an accounting adjustment. The forgiven debt increases RI's net assets because RI has received value (elimination of a $50K obligation) without providing goods/services in return.

### D-024: GL Entry Validation — Enforce Rules Selectively; Default to Unrestricted Fund
- **Date:** 2026-02-10
- **Decision:** The system will enforce GL entry validation rules selectively, not universally. Specific rules: (1) **Ramp transactions MUST be categorized and moved from "pending" to "closed" status before posting to GL** — no exceptions. (2) **Timesheet entries default to Unrestricted Fund** to reduce data entry burden, but employees can select a specific funding source via Task Codes (already implemented in renewal-timesheets) if the work is grant-specific. (3) **Rental income transactions MUST identify the funding source** (tenant, VASH subsidy, MVRAP subsidy, etc.) because different income sources may have different restrictions or accounting treatment. (4) **No universal "every transaction must have a fund" constraint** — most transactions will naturally code to a fund, but the system won't reject transactions that default.
- **Rationale:** RI is a 2-person org with low transaction volume. Strict universal validation creates friction without commensurate benefit. However, certain transaction types (Ramp, rental income) require explicit categorization because they have multiple possible sources or restrictions. Defaulting timesheets to Unrestricted saves data entry time while still allowing override when needed (via task codes). This is a pragmatic middle ground: enforce where it matters, default where it doesn't.
- **Implementation notes:**
  - Ramp: Transaction stays in "pending" queue until categorized; cannot post to GL without categorization
  - Timesheets: Default to Unrestricted Fund; display task code at data entry so employee can select grant/funding source if applicable
  - Rental income: Explicit fund/source selection at entry (tenant rent, VASH rent, MVRAP rent, FVC facilities rent, external farmer land lease, etc.)
  - Other transactions: Trust users to code correctly; system provides warnings but allows entry
- **Affects:** Chunk 1 (GL entry validation logic; Ramp categorization state machine; default fund handling). Chunk 3 (Expense Tracking — timesheet entry workflow and task code integration). Chunk 8 (Ramp workflow — categorization enforcement).
- **Future evolution:** If RI scales and transaction volume increases, validation rules can be tightened. For now, keep it light.

### D-025: Rental Income Recognition — Accrual Basis When Rent is Due; Payment Method Irrelevant
- **Date:** 2026-02-10
- **Decision:** Rental income (from tenant rent, VASH subsidies, MVRAP subsidies, FVC facilities/land rent, external farmer land leases, etc.) is recognized under accrual basis when rent is due, regardless of payment method. The system will generate Accounts Receivable when rent accrues and reduce AR when payment is received. RI will reconcile AR to actual collections and investigate delays/discrepancies, but the GL reflects earned income as of the due date, not the payment date.
- **Rationale:** Under accrual-basis accounting (D-005), revenue is recognized when earned, not when cash is received. For rent, "earned" means the rental period has transpired and the rent is due — payment method (direct tenant payment, VASH voucher, MVRAP subsidy, etc.) is irrelevant to the revenue recognition timing. This approach ensures RI's financial statements reflect the true economic position: tenants owe rent on specific dates regardless of whether payment has physically arrived. AR aging and collection follow-up are operational tracking concerns, not revenue recognition concerns.
- **GL Treatment:**
  - When rent is due (monthly): Debit Accounts Receivable (by funding source), Credit Rental Income
  - When payment arrives: Debit Bank/Cash, Credit Accounts Receivable
  - Payment discrepancies (VASH/MVRAP vouchers delayed, tenant non-payment): AR aging shows the gap; no GL adjustment until cash received or write-off decision made
- **AR Tracking by Source:** The system will track AR separately by income source (tenant direct rent, VASH rent, MVRAP rent, FVC facilities rent, external farmer lease) to support reconciliation and funder reporting. This supports D-024 (rental income MUST identify funding source).
- **Bad Debt / Write-offs:** Deferred to Chunk 5 (Compliance Reporting). RI's policy on tenant non-payment, bad debt reserves, and write-off timing TBD. Once policy is set, the GL can implement allowance-for-doubtful-accounts or direct write-off method.
- **Affects:** Chunk 1 (GL accounts: Accounts Receivable by source; Rental Income accounts). Chunk 2 (Revenue Tracking — AR aging and collection management). Chunk 4 (Bank Reconciliation — AR reconciliation to bank deposits). Chunk 6 (Board Reporting — AR disclosed on balance sheet; collections tracked for cash flow management).

### D-026: AR Tracking Granularity — By-Tenant/Unit with Aging and Collection Alerts
- **Date:** 2026-02-10
- **Decision:** AR will be tracked at the tenant/unit level (down to individual units in the 17-unit Easthampton building), not just aggregated by funding source. The system will support AR aging reports (30/60/90+ days) and will distinguish between "known delays" (e.g., VASH vouchers historically arriving in month N+1, with expected grace periods per funding source) and "delinquency risk" (e.g., direct tenant rent overdue beyond normal grace period). The system will generate collection alerts when tenant rent payments fall below expected amounts for a given month (e.g., "Tenant #5 paid $500 of $1,000 expected rent — partial payment received, $500 outstanding"). These alerts are informational warnings to Jeff for follow-up; the system does not auto-escalate or enforce collections.
- **Rationale:** RI collects rent from individual tenants/units, and different tenants have different payment patterns and funding sources. To manage collections effectively, Jeff needs visibility into "who owes what" and "what's the aging." Distinguishing known delays (VASH vouchers) from true delinquency prevents false alarms. Partial payment alerts are practical — tenants often split payments across weeks — and keep Jeff informed without requiring formal reconciliation machinery.
- **Scope notes:** Full AR reconciliation (matching AR to bank deposits dollar-for-dollar) is deferred to Chunk 4 (Bank Reconciliation). This decision covers AR aging reports and alert generation in Chunk 2 (Revenue Tracking).
- **Affects:** Chunk 1 (GL structure must support unit-level AR detail). Chunk 2 (Revenue Tracking — primary responsibility for aging reports, alerts, collection tracking). Chunk 4 (Bank Reconciliation — may reference AR aging for variance analysis).
- **Future evolution:** If RI implements online rent payment portal, the system can auto-detect and alert on partial payments in real-time.

### D-027: Rent Adjustments and Tenant Accommodations — Method and Annotation Required
- **Date:** 2026-02-10
- **Decision:** The system will support rent adjustments and forgiveness on a per-tenant basis with mandatory annotation. When a rent adjustment is recorded (e.g., proration for mid-month move-in, temporary rent reduction due to tenant hardship, mid-lease vacation refund), the GL entry must include a note explaining the reason and approver. Adjustments reduce accrued rental income (debit Rental Income Expense / Rent Adjustments account, credit AR) or reduce cash if paid after collection. All adjustments are tracked separately from core rent to support audit trail and landlord-tenant law compliance.
- **Rationale:** Massachusetts landlord-tenant law and affordable housing program rules require documented justification for rent modifications. Different adjustment categories (proration, hardship, vacate refunds, etc.) may have different MA law implications or funder compliance requirements. Requiring annotation at entry time ensures documentation is preserved and supports future compliance audits. Tracking adjustments separately allows RI to monitor trends (e.g., "we had 3 hardship reductions this quarter") and supports board reporting.
- **GL Treatment:**
  - Prorated rent reduction (tenant moves in mid-month): Debit Rental Income — Proration Adjustments, Credit Accounts Receivable
  - Hardship adjustment (temporary rent reduction): Debit Rental Income — Hardship Adjustments, Credit Accounts Receivable
  - Vacate refund (proration on move-out): Debit Rental Income — Vacate Adjustments, Credit Accounts Receivable (or Bank if already paid)
  - Annotation required: "Unit 5 — mid-month move-in, prorated 20 days of 30-day month" or "Unit 12 — 30-day hardship reduction per manager approval, 2/1/26–3/1/26"
- **Scope notes:** The legal framework governing when adjustments are required (MA landlord-tenant law, VASH/MVRAP program rules, lease provisions) is deferred to Chunk 5 (Compliance Reporting). Once Chunk 5 research is complete, specific adjustment categories and approval workflows may be formalized.
- **Affects:** Chunk 1 (GL account structure — separate adjustment accounts for each adjustment type). Chunk 2 (Revenue Tracking — adjustment entry workflow and annotation capture). Chunk 5 (Compliance Reporting — legal/program requirements for adjustments).

### D-028: Prepaid Expenses & Accrued Liabilities — Simple GL Structure with AI-Enhanced Entry
- **Date:** 2026-02-11
- **Decision:** The ledger will use a simplified GL structure for timing-related accounts (prepaids and accruals), with three accounts: (1) **Prepaid Expenses** (asset — insurance, PILOT, property taxes paid before due, etc.); (2) **Accrued Expenses Payable** (liability — reimbursements owed, utilities accrued, property taxes accrued, etc.); (3) **Deferred Revenue** (liability — prepaid rent from tenants/FVC, grant revenue received but not yet earned). Detail and categorization will be captured in transaction memos rather than separate GL accounts. The system will support AI-enhanced transaction entry: when a user enters a transaction, Claude asks clarifying questions ("What is this payment for?", "What period does it cover?", "Is this for the current month or a future month?"), writes detailed memos automatically, and sets up amortization schedules for prepaids/deferrals. This approach keeps the chart of accounts simple while ensuring detail is captured consistently.
- **Rationale:** RI is moving to accrual-basis accounting (D-005), which requires GL accounts to handle timing mismatches: expenses paid before they're incurred (prepaids), expenses incurred before they're paid (accruals), and revenue received before it's earned (deferred). The traditional accounting approach is to create separate GL accounts for each category (Prepaid Insurance, Prepaid Rent, Accrued Utilities, etc.), which provides self-documenting detail in the chart of accounts but creates clutter and rigidity. The AI-enhanced approach reverses this: keep the GL simple (one account per concept), but use intelligent conversation during transaction entry to ensure detailed memos are captured consistently. This leverages the "personal software" philosophy (D-002) — build a smarter system that adapts through conversation rather than replicating COTS products that front-load all decisions into rigid account structures. The AI can handle novel situations (e.g., MA nonprofit property tax abatement processes) through conversation rather than requiring pre-defined account categories. At RI's scale (2-5 users, low transaction volume), drill-down transaction reports are sufficient to see detail when needed.
- **Specific use cases:**
  - **Prepaid insurance:** $501 business insurance paid in FY25 covers periods into FY26 → AI records as prepaid, sets up monthly amortization with detailed memo
  - **Accrued reimbursements:** $4,472 owed to Heather at 12/31/25 → AI records liability with memo identifying payee and purpose
  - **Prepaid property insurance:** Expected $50K+ annual property insurance paid upfront → AI sets up 12-month amortization
  - **Deferred rent revenue:** Tenant pays February rent in January → AI records as deferred revenue, recognizes in February
  - **Property tax complexity:** MA nonprofit property tax abatement (billed → file abatement → forgiven) or voluntary PILOT payments → AI asks clarifying questions and records appropriately
- **AI Transaction Entry Assistant (scope deferred):** Full specification of the AI-enhanced transaction entry system is deferred to after Chunks 2 (Revenue), 3 (Expense), and 8 (Integration) are complete. The assistant needs to understand all transaction sources (rental income, donations, grants, expense reports, timesheets, Ramp credit card, bank feeds) before it can be fully designed. This decision establishes the simple GL structure that the assistant will use; detailed assistant behavior will be scoped in Chunk 8 or a separate mini-chunk. The assistant must: ask context-appropriate questions based on transaction type, write consistent detailed memos, set up amortization/deferral schedules automatically, handle edge cases through conversation (e.g., property tax abatements, mid-month rent prorations).
- **GL Accounts (3 total for timing-related transactions):**
  - **Prepaid Expenses** (asset) — covers insurance, PILOT, property taxes paid before due, other prepaid items
  - **Accrued Expenses Payable** (liability) — covers reimbursements owed, utilities accrued, property taxes accrued, other accrued items
  - **Deferred Revenue** (liability) — covers prepaid rent from tenants/FVC, grant revenue received but not yet earned
- **Affects:** Chunk 1 (GL account structure — 3 accounts instead of 10+). Chunk 2 (Revenue Tracking — deferred revenue mechanics). Chunk 3 (Expense Tracking — prepaid/accrual entry workflows). Chunk 8 (Integration Layer — AI transaction entry assistant, deferred until all transaction sources are understood). Dependencies.md updated to track AI assistant as cross-chunk feature requiring Chunks 2, 3, 8 completion before design.

### D-029: Restricted Net Assets Release — Automatic on Fund-Coded Expense
- **Date:** 2026-02-11
- **Decision:** When an expense is recorded against a restricted fund, the system automatically generates a net asset release entry. The release entry moves the expense amount from "Net Assets With Donor Restrictions" to "Net Assets Without Donor Restrictions," reflecting that the donor's restriction has been satisfied. This happens automatically at the time the expense is posted to the GL — no separate manual journal entry required. The fund coding structure (D-013) provides the tracking mechanism: each expense is coded to a specific fund (e.g., "SARE Fund," "Historic Tax Credit Fund"), so the system knows which restricted net asset pool to release from.
- **Rationale:** Nonprofit accounting requires tracking when restricted funds are released (restriction satisfied by spending the money for its intended purpose). D-014 created the two net asset accounts but didn't specify the release mechanics. Automatic release based on fund-coded expenses is the simplest and most reliable approach: when you spend money from a restricted fund, the restriction is automatically satisfied. This avoids manual tracking, reduces errors, and ensures the balance sheet correctly reflects remaining restrictions. The fund structure already captures which grant/source an expense relates to, so no additional coding is needed. Manual release entries would be error-prone (forgetting to record releases, recording the wrong amount, mismatching funds) and add unnecessary overhead for a 2-person org.
- **Example (SARE grant):**
  - **Receive grant:** DR: Cash $250,000 | CR: Grant Revenue $250,000 (increases "Net Assets With Donor Restrictions" by $250K)
  - **Spend on farm operations:** DR: Farm Expenses $50,000 | CR: Cash $50,000 (coded to "SARE Fund")
  - **Automatic release entry (system-generated):** DR: Net Assets With Donor Restrictions $50,000 | CR: Net Assets Without Donor Restrictions $50,000
  - **Result:** Restricted net assets decreased by $50K (restriction satisfied), unrestricted net assets increased by $50K, SARE Fund shows $50K spent against $250K budget
- **Fund-level tracking:** Each restricted fund maintains a cumulative spending total. Board reporting (Chunk 6) can show: "SARE Fund: $250K awarded, $50K spent, $200K remaining restricted." This provides visibility into grant draw-down without manual release tracking.
- **Edge cases deferred:** Multi-year grants with annual spend-down requirements (e.g., "$250K over 3 years, must spend $50K/year minimum") are a compliance monitoring issue, not a GL mechanics issue. Deferred to Chunk 5 (Compliance Reporting) to specify how these timing restrictions are tracked and reported (likely a dashboard or alert system, not a GL constraint). The GL will correctly show cumulative spending against the grant; Chunk 5 will add monitoring for "are we on pace with funder requirements?"
- **Affects:** Chunk 1 (GL posting logic — automatic release entry generation when expense is coded to restricted fund). Chunk 3 (Expense Tracking — must code expenses to funds; system generates release entries automatically). Chunk 5 (Compliance Reporting — multi-year grant spend-down tracking, funder requirement monitoring). Chunk 6 (Board Reporting — fund-level spending reports show draw-down against restricted grants; net asset statement shows releases).

### D-030: Grants Receivable — Separate Asset Account for Grant Award Timing
- **Date:** 2026-02-11
- **Decision:** The ledger will include a separate **Grants Receivable** asset account to handle timing mismatches when grants are awarded before cash is received. This is distinct from the general Accounts Receivable account (D-026), which tracks tenant rent and other operating receivables. When a grant is awarded but not yet received, the entry is: DR: Grants Receivable, CR: Grant Revenue (or Deferred Revenue, depending on revenue recognition policy). When cash is received: DR: Cash, CR: Grants Receivable. The **Deferred Revenue** account (created in D-028) handles the inverse timing scenario: grants received in cash before they are earned.
- **Rationale:** Grant funding often has timing gaps between award notification and cash receipt. For example, if SARE approves RI's $250K grant application in March 2026 but doesn't issue payment until May 2026, RI needs to record the receivable during the gap. A separate Grants Receivable account (vs. lumping grant AR into the general AR account) provides cleaner reporting: the board can see "we're owed $250K from SARE" separately from "Unit 5 owes us $1,000 in rent." Grant receivables also behave differently from tenant receivables (no aging/collection issues, different payment patterns, different funder relationships), so separating them simplifies AR management and reporting. At RI's scale, adding one GL account is low overhead and provides clarity.
- **Timing scenarios covered:**
  - **Grants Receivable (this decision):** Grant awarded → cash received later (asset account)
  - **Deferred Revenue (D-028):** Grant received → earned over time (liability account)
  - Together, these two accounts handle all grant timing mismatches
- **Revenue recognition policy deferred:** When to recognize grant revenue (award date vs. receipt date vs. expenditure date) is a **Chunk 2 decision** (revenue tracking). The GL structure supports all three approaches. Chunk 2 will specify the policy based on funder requirements, nonprofit accounting standards, and RI's operational preferences. Chunk 1 simply creates the GL accounts needed to execute whatever policy Chunk 2 selects.
- **Example (award before receipt):**
  - **March 2026: Grant awarded** → DR: Grants Receivable $250,000 | CR: Grant Revenue $250,000 (or Deferred Revenue if multi-year)
  - **May 2026: Cash received** → DR: Cash $250,000 | CR: Grants Receivable $250,000
  - **Board visibility:** Balance sheet shows "Grants Receivable: $250K" during the gap, then $0 after receipt
- **GL Account:** Grants Receivable (asset — separate from general Accounts Receivable)
- **Affects:** Chunk 1 (GL account structure — add Grants Receivable as asset). Chunk 2 (Revenue Tracking — must specify grant revenue recognition policy; will use Grants Receivable and Deferred Revenue accounts as needed). Chunk 4 (Bank Reconciliation — grant receipts may lag revenue recognition, creating AR timing gaps). Chunk 6 (Board Reporting — balance sheet shows Grants Receivable separately from tenant AR).

### D-031: Property Operating Expenses — Granular GL Structure for Operational Tracking
- **Date:** 2026-02-11
- **Decision:** The ledger will include granular GL accounts for property operating expenses to support operational optimization and budget variance tracking. Property operations is RI's primary business (17-unit affordable housing building), and the board needs visibility into expense breakdown for management decisions, variance analysis, and operational improvement initiatives (solar panel ROI tracking, electrification before/after measurement, utility optimization). The GL structure mirrors RI's property pro forma to enable direct budget-to-actual variance reporting without translation layers.
- **Rationale:** Unlike prepaid/accrual accounts (D-028), where simplicity was chosen because those are timing adjustments, property operating expenses are core business operations requiring detailed tracking and reporting. The board will regularly review these expenses to assess property performance, identify cost overruns, and measure operational improvements. Granular accounts enable: (1) Direct budget variance analysis (pro forma line items match GL accounts); (2) Operational optimization tracking (e.g., measure electric expense reduction after solar panel installation, measure gas reduction after electrification); (3) Trend analysis by expense category (utilities spiking? R&M costs increasing?); (4) Informed decision-making (should we invest in energy efficiency? Is landscaping contract competitive?). At RI's scale (one building, low transaction volume), managing 13 property expense accounts is low overhead and high value.
- **Operational use cases:**
  - **Solar panels:** RI is pursuing solar panel installation. Separate "Utilities - Electric" account allows before/after measurement of electric expense reduction and solar ROI calculation.
  - **Electrification:** RI is exploring full building electrification (replacing gas heating/appliances). Separate "Utilities - Gas" and "Utilities - Electric" accounts enable before/after comparison to measure electrification impact.
  - **Budget variance:** Pro forma budgets $5K/month for utilities. GL breakdown shows: Electric $2K, Gas $1.5K, Water/Sewer $800, Internet $200, Security/Fire $300, Trash $200. Board immediately sees which utilities are over/under budget.
  - **Seasonal trends:** Winter gas costs spike, summer electric costs spike (AC). Separate accounts make seasonal patterns visible for budgeting.
- **GL Accounts — Property Operating Expenses (13 accounts):**
  1. **Property Taxes** (or Property Taxes/PILOT if voluntary payments made)
  2. **Property Insurance**
  3. **Management Fees** (expected — property management contract fees)
  4. **Commissions** (likely — tenant placement, broker fees)
  5. **Landscaping & Grounds** (landscaping, snow removal, mowing, general grounds maintenance)
  6. **Repairs & Maintenance** (emergency repairs, routine maintenance, unit turnover work, general building maintenance)
  7. **Utilities - Electric** (building electric — separate for solar ROI tracking and electrification measurement)
  8. **Utilities - Gas** (building gas — separate for electrification before/after comparison)
  9. **Utilities - Water/Sewer** (municipal water and sewer charges)
  10. **Utilities - Internet** (building internet service)
  11. **Utilities - Security & Fire Monitoring** (security system + fire alarm monitoring — consolidated since both are fixed monthly fees)
  12. **Utilities - Trash** (trash removal service)
  13. **Other Operating Costs** (catch-all for miscellaneous property expenses not fitting other categories)
- **Vacancy Loss (contra-revenue, not expense):**
  - **Vacancy Loss** (contra-revenue account — reduces rental income on P&L for budgeting/planning purposes, not an operating expense)
  - Used in budgeting to account for expected vacancy (e.g., "assume 5% vacancy" reduces budgeted rental income by 5%)
  - GL treatment: Debit Vacancy Loss (contra-revenue), Credit Rental Income (or create as negative revenue line on P&L)
- **Building/unit tracking:** Not required at this scale. RI has one 17-unit building; the building is the unit of analysis. Fund-level tracking (D-013) already captures financial source. No need for unit-level expense allocation.
- **Affects:** Chunk 1 (GL account structure — 13 property operating expense accounts + 1 contra-revenue account). Chunk 3 (Expense Tracking — expense entry must code to appropriate property expense account). Chunk 6 (Board Reporting — property operating expense breakdown on P&L, budget variance by category). Chunk 7 (Budgeting — pro forma line items match GL accounts for direct variance analysis).

### D-032: Construction in Progress — Asset Account for Property Development Costs
- **Date:** 2026-02-11
- **Decision:** The ledger will include a **Construction in Progress (CIP)** asset account to accumulate development costs for the Easthampton property acquisition and renovation before the building is placed in service (ready for tenants). During the development phase, all acquisition costs, renovation expenses, soft costs (architecture, legal, permitting), and other capital expenditures are recorded in CIP. Once the building is placed in service, the accumulated CIP balance is transferred to the **Building** fixed asset account (created in D-019) and begins depreciating. The **capital vs. operating expense split** within funds (e.g., distinguishing "AHP Fund — capital acquisition costs" from "AHP Fund — operating support") is deferred to Chunk 5 (Compliance Reporting), pending research into funder substantiation requirements (Historic Tax Credits, Historic Tax Credit, CDBG, CPA).
- **Rationale:** CIP is standard fixed asset accounting for property development. Before a building is operational, development costs are not yet productive assets subject to depreciation — they are works-in-progress. Accumulating costs in CIP provides visibility into total project spending and ensures proper accounting treatment: (1) Balance sheet shows CIP as an asset during development; (2) No depreciation occurs until placed in service; (3) When complete, CIP transfers to Building and depreciation begins. This is GAAP-compliant and required for tax credit compliance (Historic, Historic Tax Credit). RI's $6.8M capital stack (AHP loan, Historic Tax Credits, Historic Tax Credit equity, CPA grant, CDBG) will flow through CIP before becoming a depreciable Building asset.
- **Example flow (simplified):**
  - **During development (2026):** DR: Construction in Progress $500,000 | CR: Cash $500,000 (coded to "Historic Tax Credit Fund" — acquisition costs)
  - **Ongoing development:** DR: Construction in Progress $200,000 | CR: Accounts Payable $200,000 (coded to "AHP Fund" — renovation work)
  - **Placed in service (late 2026):** DR: Building $4,500,000 | CR: Construction in Progress $4,500,000 (transfer accumulated costs to fixed asset)
  - **After placed in service:** Monthly depreciation begins on Building (per D-019 depreciation structure)
- **Capital vs. operating tracking within funds (deferred to Chunk 5):** D-016 already deferred detailed cost code tracking to Chunk 5 pending funder requirements research. This decision extends that deferral to the capital vs. operating split. Some funders (e.g., AHP) may provide both capital funding (acquisition/rehab) and operating support (ongoing property expenses). The GL currently supports fund-level tracking (D-013) — each transaction is coded to a fund. Whether funders require additional distinction between "AHP Fund — capital" and "AHP Fund — operating" is TBD. Chunk 5 will research funder substantiation requirements (Historic Tax Credit, Historic Tax Credit, CDBG, CPA compliance) and specify if/how to track capital vs. operating within funds (options: separate funds, transaction-level tags, sub-accounts, cost codes). For now, fund-level tagging is sufficient.
- **GL Account:** Construction in Progress (asset — accumulates development costs until building is placed in service)
- **Affects:** Chunk 1 (GL account structure — add CIP as fixed asset account). Chunk 3 (Expense Tracking — development costs flow through CIP, not expense accounts). Chunk 4 (Bank Reconciliation — CIP entries match capital draws and development payments). Chunk 5 (Compliance Reporting — research funder requirements for capital vs. operating tracking; specify additional structure if needed). Chunk 6 (Board Reporting — balance sheet shows CIP during development, then Building after placed in service; capital project spending reports track CIP accumulation).

### D-033: FY25 Cash-to-Accrual Conversion — Import All Transactions and System-Generated Adjustments
- **Date:** 2026-02-11
- **Decision:** The financial system will import all FY25 transactions from QuickBooks Online (cash basis) and automatically generate accrual-basis opening balances for 1/1/2026. RI will export all FY25 transactions from QBO (likely CSV format) and import them into the new system. The system will process the imported transactions, identify timing differences between cash and accrual accounting (prepaid expenses, accrued expenses, accounts receivable, accrued interest), calculate the necessary adjustments, and generate opening balances that correctly reflect RI's financial position on an accrual basis as of 1/1/2026. This approach provides full FY25 transaction history in the new system and automates the conversion calculation, avoiding manual journal entries.
- **Rationale:** FY25 was operated on cash basis in QuickBooks (D-005 established accrual basis for FY26 forward). To start FY26 with correct accrual-basis opening balances, the system needs to account for timing differences: prepaid insurance ($501 from D-028), accrued reimbursements ($4,472 to Heather from D-028), potential AR for December 2025 rent, accrued AHP loan interest, and any other cash vs. accrual mismatches. Rather than manually calculating adjustments and recording a one-time conversion journal entry, importing all FY25 transactions and letting the system calculate adjustments is simpler and more transparent. FY25 transaction volumes were low (under 990 reporting threshold), so importing everything is manageable. The imported history provides reference data for lookback queries and validates the conversion (FY25 closing = FY26 opening). RI is not GAAP-reporting yet and the board does not require precision on FY25 historical data, so minor conversion discrepancies are acceptable.
- **Import process:**
  1. Export all FY25 transactions from QuickBooks Online (CSV or QBO export format)
  2. Import transactions into financial system with "FY25 Import" flag to distinguish from ongoing FY26 entries
  3. System identifies timing differences: transactions recorded on cash basis that need accrual adjustments
  4. System generates automatic adjustments for known items (prepaid insurance, accrued reimbursements, AR, accrued interest)
  5. System produces accrual-basis opening balances for 1/1/2026
  6. User reviews conversion summary and approves opening balances
- **Known adjustments (from prior decisions):**
  - Prepaid insurance: $501 (D-028 — business insurance paid in FY25, covers into FY26)
  - Accrued reimbursements: $4,472 (D-028 — owed to Heather as of 12/31/25)
  - Accrued AHP loan interest: TBD based on last payment date (D-011 — 4.75% on $100K drawn)
  - AR for December 2025 rent: TBD based on rent due dates and payment timing (D-025, D-026)
- **GAAP compliance note:** RI is not currently GAAP-reporting (no audit requirement at current revenue levels), but all decisions made in Chunk 1 are GAAP-compliant. The accrual-basis accounting structure (D-005, D-014, D-019, D-022, D-025, D-028, D-029, D-030, D-032) aligns with FASB ASC 958 (nonprofit accounting standards). When RI eventually pursues GAAP-compliant audited financials, the system will require: (1) Documented accounting policies (capitalization, bad debt, depreciation, functional allocation — Chunk 5); (2) FASB-compliant financial statement presentation (Chunk 6). The underlying accounting is already GAAP-ready.
- **Affects:** Chunk 1 (opening balance setup for FY26). Chunk 4 (Bank Reconciliation — validate that FY25 ending cash = FY26 opening cash). Chunk 5 (Compliance — document accounting policies for future GAAP compliance). Chunk 6 (Board Reporting — FY25 history available for comparison reporting if needed).


### D-034: Grant Revenue Recognition — Revenue at Award Letter for Upfront and Reimbursement Models
- **Date:** 2026-02-11
- **Decision:** RI will recognize grant and contract revenue at the time of the award letter (when the grant/contract is formally awarded), not when cash is received or when expenses are incurred. This policy applies to both upfront payment grants (SARE/USDA example) and reimbursement contracts (USDA/VA example). When an upfront grant is awarded, revenue is recognized immediately and restricted net assets increase (D-014). When a reimbursement contract is awarded, revenue is recognized and a Grants Receivable (D-030) is created; the receivable is cleared when reimbursement is received. All grant/contract revenue is coded to the appropriate fund (D-013) and tracked against restricted net assets until the restrictions are satisfied through spending.
- **Rationale:** RI's government grants and contracts are structured as restricted but unconditional contributions (upfront grants) or enforceable contracts with right to payment (reimbursement contracts). For upfront grants like SARE, the money is awarded and received upfront with low clawback risk — government won't reclaim funds except for negligence/incompetence, and post-project audit disallowances would be negotiated via additional work rather than repayment. These meet the FASB ASC 958-605 test for unconditional contributions: RI has the money once awarded, with restrictions on use but no significant conditions or barriers. For reimbursement contracts, the award creates an enforceable right to payment once work is performed; recognizing revenue at award aligns with the contract value RI has secured. "Revenue at award" provides visibility into RI's secured funding pipeline for board reporting and cash flow planning, rather than deferring recognition until cash receipt or expense incurrence. This treatment may require CPA review when RI eventually pursues GAAP-compliant audited financials, particularly for reimbursement contracts which may be classified as exchange transactions rather than contributions. The system will support the "revenue at award" treatment and can be adjusted later if GAAP compliance requires a different approach.
- **Grant/contract structures supported:**
  - **Model 1: Upfront payment grants** (SARE example) — Cash received upfront, revenue recognized at award, restricted spending tracked against grant budget
  - **Model 2: Reimbursement contracts** (USDA/VA example) — Revenue recognized at award (creates Grants Receivable), expenses paid out of pocket, reimbursement clears receivable
- **GL Treatment:**
  - **Upfront grant awarded:** DR: Deferred Revenue (or Cash when received) | CR: Grant Revenue (restricted fund)
  - **Reimbursement contract awarded:** DR: Grants Receivable | CR: Contract Revenue (restricted fund)
  - **Reimbursement received:** DR: Cash | CR: Grants Receivable
  - **Expenses incurred (both models):** DR: Expense (coded to grant/contract fund) | CR: Cash/AP
  - **Restricted net assets release:** Automatic when expenses are coded to restricted fund (D-029)
- **GAAP caveat:** Reimbursement contracts may be conditional contributions or exchange transactions under FASB ASC 958-605. If classified as conditional, revenue recognition would shift from award to completion of conditions (performance). RI will implement "revenue at award" treatment now and defer GAAP refinement to future CPA engagement.
- **Affects:** Chunk 2 (Revenue Tracking — grant/contract award tracking, revenue recognition workflow). Chunk 3 (Expense Tracking — expenses must be coded to grant/contract fund for compliance). Chunk 4 (Bank Reconciliation — Grants Receivable tracked separately from AR). Chunk 5 (Compliance Reporting — funder reporting on spending vs. award amount). Chunk 6 (Board Reporting — secured funding pipeline, restricted vs. unrestricted revenue).

### D-035: Grant/Contract Expense Attribution — Mandatory Fund/Grant Coding for All Expenses
- **Date:** 2026-02-11
- **Decision:** The financial system will require all expenses to be coded to a specific fund or grant/contract for attribution tracking and compliance reporting. This applies to all expense sources: timesheets (D-008), expense reports (D-007), Ramp credit card transactions (D-021), and manual journal entries. When a grant or contract is established in the system, it creates a restricted fund (extension of D-013 fund accounting). All expenses related to that grant/contract must be coded to the corresponding fund. The system will track spending against grant/contract budgets by category (as specified in the grant document) and provide compliance reporting showing: what was spent, where (category), why (purpose/description), and attribution to the funder program. This supports both upfront grants (D-034 Model 1) and reimbursement contracts (D-034 Model 2).
- **Rationale:** Government grants and contracts require detailed expenditure tracking and compliance reporting. Funders need to see that their money was spent on approved categories (personnel, materials, subcontractors, travel, etc.) and within approved limits. Timesheets, expense reports, and credit card transactions must all trace back to the specific grant/contract for substantiation. Without mandatory fund/grant coding, compliance reporting becomes manual reconciliation and error-prone. The fund accounting structure (D-013) already supports this — grants/contracts are implemented as restricted funds. Extending the requirement to ALL expense sources ensures compliance data is captured at transaction time, not reconstructed later. Integration points with timesheets (D-008), expense reports (D-007), and Ramp (D-021) must all support fund/grant selection in their UIs.
- **Implementation details:**
  - **Grant/contract setup:** When a grant/contract is awarded, create a new restricted fund in the system (fund name = grant/contract name or identifier). Capture grant budget by category (personnel $X, materials $Y, travel $Z, etc.) from the grant document.
  - **Timesheet integration (D-008):** Approved timesheets create payroll entries coded to the appropriate fund. Timesheet UI must allow workers to specify which grant/contract (fund) their hours are attributable to.
  - **Expense report integration (D-007):** Approved expense reports create AP entries coded to the appropriate fund. Expense report UI must require users to specify which grant/contract (fund) each expense is for.
  - **Ramp integration (D-021):** Ramp transactions in the categorization workflow (Chunk 8) must include fund/grant selection. Each transaction is coded to both a GL account (expense type) and a fund (funding source).
  - **Budget tracking:** System tracks cumulative spending by category within each grant/contract fund. Alerts when spending approaches category limits (e.g., "Personnel budget 90% spent").
  - **Compliance reporting (Chunk 5 & 6):** Generate reports showing: total spending by grant/contract, spending by budget category, comparison to approved budget, detailed transaction listing for audit support.
- **Default behavior:** Unrestricted expenses (not tied to a specific grant/contract) are coded to the General Fund (D-013 unrestricted fund). Users are not forced to code everything to a grant — only when expenses are funded by a restricted grant/contract.
- **Affects:** Chunk 2 (Revenue Tracking — grant/contract setup creates restricted funds). Chunk 3 (Expense Tracking — expense entry workflow must support fund selection). Chunk 5 (Compliance Reporting — funder substantiation reports by grant/contract). Chunk 6 (Board Reporting — spending visibility by fund). Chunk 8 (Integration Layer — timesheets, expense reports, Ramp must all support fund coding).

### D-036: Donation Revenue Recognition — Immediate Recognition for Unrestricted and Restricted Donations
- **Date:** 2026-02-11
- **Decision:** RI will recognize donation revenue immediately when the donation is received (or when an unconditional pledge is made). Unrestricted donations increase "Net Assets Without Donor Restrictions" (D-014) and are coded to the General Fund (D-013). Restricted donations (tied to specific purposes like "Barn restoration campaign") increase "Net Assets With Donor Restrictions" and are coded to the appropriate restricted fund (or a new fund is created if needed). Restricted donations follow the same release mechanism as grants (D-029) — restrictions are released automatically as expenses coded to the restricted fund are incurred. Donor acknowledgment requirements and donor management needs are addressed in Chunk 5 (compliance) and Chunk 6 (reporting). RI does not require a full CRM system — donation tracking will be transaction-level (who gave, how much, restricted vs. unrestricted, date) without heavy donor relationship management features.
- **Rationale:** Donation revenue is straightforward under FASB ASC 958-605. Unrestricted donations are recognized immediately as contribution revenue. Restricted donations are also recognized immediately, with the restriction tracked via the net assets split (D-014) and fund accounting (D-013). Campaign-based giving (e.g., "Donate to rebuild the historic barn") creates a restricted fund; donations toward that campaign increase restricted net assets until barn expenses are incurred. RI's donation scale (<5% of total project costs over project lifetime) does not justify complex donor management tooling — simple transaction tracking is sufficient. Donor acknowledgment (IRS compliance for contributions over $250) and thank-you letters will be handled via manual or semi-automated processes in Chunk 5/6.
- **GL Treatment:**
  - **Unrestricted donation received:** DR: Cash | CR: Donation Revenue (General Fund, increases unrestricted net assets)
  - **Restricted donation received (campaign-based):** DR: Cash | CR: Donation Revenue (restricted fund, increases restricted net assets)
  - **Expenses incurred using restricted donations:** DR: Expense (coded to restricted fund) | CR: Cash/AP → automatic release of restrictions per D-029
- **Donor tracking needs (minimal):** Transaction-level data only: donor name, contact info, donation amount, date, restricted vs. unrestricted, campaign (if applicable). No relationship history, giving patterns, engagement scoring, or CRM-style features. Donor acknowledgment letters and thank-you notes generated via simple templates in Chunk 6.
- **Affects:** Chunk 2 (Revenue Tracking — donation entry workflow, restricted vs. unrestricted classification). Chunk 5 (Compliance — donor acknowledgment for contributions over $250, public support test calculations). Chunk 6 (Board Reporting — donation revenue by restricted/unrestricted, campaign performance).

### D-037: Earned Income Recognition — Revenue When Earned (Accrual Basis)
- **Date:** 2026-02-11
- **Decision:** RI will recognize earned income (program fees, farm lease revenue, management fees, etc.) on an accrual basis — revenue is recognized when the service is provided or the lease period is completed, not when cash is received. For farm lease revenue (FVC subleasing to local farmers in 2026), revenue is recognized monthly or as specified in the lease agreement, with AR created if payment is delayed. For any future fee-for-service income (training fees, management fees, workshop fees), revenue is recognized when the service is delivered. This is consistent with accrual accounting (D-005) and standard revenue recognition principles. Earned income is typically unrestricted and coded to the General Fund (D-013) unless a contract specifies otherwise.
- **Rationale:** Accrual basis accounting (D-005) requires revenue to be recognized when earned, not when received. For lease revenue, the earning event is the passage of time (monthly lease period). For service fees, the earning event is service delivery. This matches the treatment already decided for rental income (D-025 — recognize when due, not when paid). Earned income is straightforward and unlikely to have restrictions (unlike grants/donations), so it defaults to unrestricted General Fund revenue. If a specific contract creates restrictions (e.g., "management fee paid by funder X must be used for Y"), those would be handled via fund accounting on a case-by-case basis.
- **GL Treatment:**
  - **Farm lease revenue (monthly):** DR: AR (or Cash if paid immediately) | CR: Lease Revenue (General Fund, unrestricted)
  - **Fee-for-service (training, workshops, management):** DR: AR (or Cash if paid immediately) | CR: Fee Revenue (General Fund, unrestricted)
  - **Cash received (if AR was created):** DR: Cash | CR: AR
- **Affects:** Chunk 2 (Revenue Tracking — earned income entry workflow, AR for delayed payments). Chunk 4 (Bank Reconciliation — AR for earned income tracked separately from rental AR and Grants Receivable). Chunk 6 (Board Reporting — earned income reported separately from donations and grants).

### D-038: Donor Tracking and IRS Acknowledgment Letter Automation
- **Date:** 2026-02-11
- **Decision:** The financial system will track donors as entities (donor name, contact info, email) and link all donations to the corresponding donor. Users can view a donor's complete giving history (all donations, amounts, dates, restricted vs. unrestricted). For donations over $250, the system will automatically generate IRS-compliant acknowledgment letters using a letterhead template and Heather's signature image, then email the letter to the donor. The acknowledgment letter includes required IRS language: donation amount, date, statement that no goods or services were provided in exchange (or good faith estimate of value if goods/services were provided), and organization's EIN and 501(c)(3) status. Thank-you notes and relationship management beyond acknowledgment letters are not system requirements — Heather handles those manually as needed.
- **Rationale:** IRS requires written acknowledgment for contributions over $250 (IRC Section 170(f)(8)). Failure to provide timely acknowledgment can result in donors losing their tax deduction (and donors being unhappy). Automating acknowledgment generation and emailing saves Heather administrative time and ensures compliance. Tracking donations by donor (similar to QuickBooks "Customer" field) allows RI to see giving patterns, recognize repeat donors, and maintain basic donor relationships. At RI's donation scale (<5% of project budget), a full CRM is overkill — donor entity tracking + acknowledgment automation + giving history is sufficient. Campaign tracking is handled via fund coding (D-013, D-036) — "Barn restoration" donations are coded to the Barn Fund, no need for granular campaign IDs or marketing automation.
- **System requirements:**
  - **Donor entity data model:** Donor name (individual or organization), email, phone (optional), mailing address (optional), notes (optional). Each donor gets a unique ID.
  - **Donation entry workflow:** When recording a donation, user selects or creates a donor. If new donor, capture minimal info (name + email at minimum). Link donation transaction to donor ID.
  - **Donor history view:** Lookup donor by name, see all donations (date, amount, restricted/unrestricted, fund/campaign), total lifetime giving.
  - **IRS acknowledgment letter generation:** For donations >$250, system generates PDF letter using: (1) RI letterhead template (to be provided), (2) Heather's signature image (to be provided), (3) IRS-required language template. Letter includes: donor name, donation amount, date, "No goods or services were provided in exchange for this contribution" (or description/value if goods/services were provided), RI's EIN (39-3072501), 501(c)(3) statement.
  - **Email delivery:** System emails acknowledgment letter PDF to donor's email address. Email subject: "Tax Receipt — Donation to Renewal Initiatives" or similar. Email body: brief thank-you message + PDF attachment.
  - **Trigger options:** TBD — either (1) automatic on donation entry if >$250, (2) manual "Send Acknowledgment" button after donation entry, or (3) batch process at end of day/week. User preference to be determined during Chunk 2 spec phase.
  - **Acknowledgment tracking:** System records that acknowledgment was sent (date/time). Prevents duplicate acknowledgments for same donation.
- **Out of scope:** Thank-you notes (manual), detailed donor relationship management (lifecycle stages, engagement scoring, communication history), marketing campaign tracking (mailings, events, appeal codes), donor segmentation or analytics beyond basic giving history, planned giving or pledge tracking (future consideration if needed).
- **IRS compliance notes:** Acknowledgment must be provided by the earlier of: (1) the date RI files its tax return for the year of the contribution, or (2) the due date (including extensions) of RI's return. In practice, acknowledgments should be sent promptly after donation (within days or weeks). Donors need the acknowledgment to claim their deduction. Acknowledgment can be electronic (email PDF is acceptable).
- **Template customization:** Letterhead and signature provided by user. IRS language template built into system but user-editable for "goods/services provided" scenarios (e.g., fundraising event where donor received dinner valued at $50 — acknowledgment must state "You received goods/services valued at $50 in exchange for your $500 contribution").
- **Affects:** Chunk 2 (Revenue Tracking — donor entity data model, donation entry workflow, acknowledgment generation). Chunk 6 (Board Reporting — donor giving reports if needed for board visibility). Chunk 8 (Integration Layer — email delivery service for acknowledgment letters).

### D-039: Public Support Test Calculations — Deferred to Future CPA/990 Filing
- **Date:** 2026-02-11
- **Decision:** Public support test calculations (170(b)(1)(A)(vi) compliance) are deferred to future tax filing needs. The system will not auto-calculate the public support test, track large donors (>2% threshold), or generate Schedule A data. When RI reaches the stage of filing a full Form 990 with Schedule A (likely several years out), the calculation will be handled manually or with CPA assistance using revenue data exported from the system.
- **Rationale:** RI is in its initial 5-year test period (organized 2025), so the public support test doesn't become binding until after 2029. Current revenue levels (<$50K in FY25) qualify for 990-N (postcard) filing, not a full 990 with Schedule A. Building auto-calculation functionality now would be premature — the test is complex, IRS rules change, and RI won't need it for years. When the time comes, exporting revenue data by source (donations, grants, earned income) from the system will provide the raw data needed for manual calculation or CPA-assisted filing. The system's fund accounting (D-013) and revenue source tracking (D-034, D-036, D-037) already capture the necessary data dimensions.
- **Future considerations:** If/when RI approaches the threshold where public support test matters (later in the initial 5-year period or after), revisit whether to add: (1) large donor flagging (donations >2% of total support), (2) support type categorization (qualifying public support vs. excluded support), (3) 5-year rolling average calculations, (4) Schedule A data export. These features can be added incrementally if needed.
- **Affects:** Chunk 2 (Revenue Tracking — no public support test features required). Chunk 5 (Compliance Reporting — public support test is a future consideration, not immediate). Chunk 6 (Board Reporting — no Schedule A reporting required).

### D-040: Payment Execution Workflow — Outside System via Bank Portal
- **Date:** 2026-02-11
- **Decision:** Payment execution (actually disbursing cash to pay liabilities) happens outside the financial-system, in the UMass Five bank portal. Workflow: (1) User creates payable in financial-system (manual entry for direct expenses like AHP interest, utilities, property taxes, or automatic via expense report/vendor invoice approval), (2) User logs into UMass Five online banking separately and executes payment (ACH, wire, check), (3) Bank transactions are imported later via bank feed, (4) System flags potential matches between payables and bank transactions, (5) User confirms match, (6) Payable is cleared. This applies to all bank-initiated payments. Ramp credit card payments are handled separately via Ramp autopay (D-041).
- **Rationale:** At RI's scale (2-5 users, low transaction volume), integrating with UMass Five's payment API (if one even exists) adds complexity without benefit. Executing payments manually in the bank portal is simple, familiar, and provides direct bank confirmation. The financial-system focuses on liability tracking and GL accuracy; payment execution is delegated to the bank. Bank reconciliation (Chunk 4) handles the matching workflow. This separation also maintains control — users explicitly execute each payment in their bank interface rather than authorizing programmatic payments. No dual authorization is needed (D-006 — all users are fully authorized); payment execution is logged by the bank, and financial-system tracks payable creation/clearance via audit log (D-041).
- **Implementation details:**
  - **Anticipated expenses (vendor invoices, AHP interest, utilities):** User creates payable manually in financial-system before paying. Payable record includes: vendor/payee, amount, due date, GL account, fund, memo, supporting documents (invoice PDF, contract reference).
  - **Unanticipated expenses (bank fees, automatic deductions):** Handled during bank feed import. User categorizes unmatched bank transactions (assign GL account + fund), GL entry created retroactively.
  - **Matching workflow (Chunk 4):** When bank feed is imported, system compares bank transactions to outstanding payables (match by amount, date range, payee if available). User confirms matches. Matched payables are cleared (status: paid). Unmatched transactions are flagged for categorization.
- **Ramp exception:** Ramp credit card bill is paid via Ramp autopay (deducts from UMass Five automatically). Financial-system sees Ramp payment in bank feed and categorizes it as "Credit Card Payable — Ramp" payment (clearing the liability). No manual authorization needed.
- **Future enhancement:** If UMass Five offers payment API, could integrate in v2 to initiate ACH/wires directly from financial-system. For v1, manual execution in bank portal is sufficient.
- **Affects:** Chunk 3 (Expense Tracking — payable creation workflow, no built-in payment execution). Chunk 4 (Bank Reconciliation — matching payables to bank transactions is core workflow). Chunk 8 (Integration Layer — no UMass Five payment API integration needed for v1).

### D-041: Audit Logging for All Financial Actions
- **Date:** 2026-02-11
- **Decision:** The financial-system will implement comprehensive audit logging for all financial actions. Every action that creates, modifies, or deletes financial data will be logged with: user ID (who), timestamp (when), action type (what), affected records (transaction ID, account, amount), and before/after state for modifications. Audit logs are append-only (cannot be edited or deleted by users) and stored indefinitely for compliance and security purposes.
- **Rationale:** With no dual authorization or approval workflows (D-006, D-040), audit logging serves as the security backstop. If an incorrect, negligent, or fraudulent action occurs, the audit log provides a complete record of who did what and when. This satisfies basic internal control requirements for small nonprofits: segregation of duties is impractical at 2-person scale, so compensating control is comprehensive audit trail. Audit logs also support: (1) Troubleshooting and error correction ("Why does this account show $X? Let me check the audit log."), (2) Compliance reviews (CPA or MA AG audit requests), (3) Board oversight (Treasurer can review audit log periodically to spot anomalies), (4) Training and process improvement (review logs to identify common user errors).
- **What gets logged:**
  - **GL transactions:** Create, modify, void (who created transaction X on date Y, what accounts/amounts, what fund, what memo)
  - **Payable/receivable entries:** Create, modify, mark paid, write off (who created payable for vendor Z, who marked it paid, when)
  - **Vendor/donor/entity changes:** Create new vendor, edit vendor info, merge/delete entities
  - **Fund/account changes:** Create new fund, modify fund restrictions, create/modify GL accounts
  - **System configuration changes:** Change tax rates, modify chart of accounts structure, update allocation rules
  - **Data exports:** Who exported what data, when (for privacy/compliance tracking)
  - **Failed actions:** Login failures, permission denied events, validation errors (security monitoring)
- **What doesn't need logging:** Read-only actions (viewing reports, looking up transactions) — no need to log every page view, just data modifications.
- **Log retention:** Indefinite (or at minimum 7 years to match consultant contract retention requirements and IRS audit statute of limitations). Old logs can be archived to cold storage but must remain accessible.
- **Access controls:** Audit logs are visible to all users (transparency), but only system admin can export/download complete logs (privacy protection for sensitive actions). No user can edit or delete audit log entries (append-only).
- **Implementation:** Standard web app audit logging pattern. Database table: audit_log (id, user_id, timestamp, action_type, entity_type, entity_id, details_json, ip_address). Index on timestamp and user_id for query performance. Details stored as JSON blob for flexibility (different actions have different relevant data). Simple audit log viewer UI in financial-system: filter by user, date range, action type, entity.
- **Affects:** All chunks (every financial action must be logged). Chunk 1 (GL transaction logging). Chunk 2 (Revenue entry logging). Chunk 3 (Expense entry, payable creation logging). Chunk 4 (Bank reconciliation actions logged). Chunk 6 (Audit log viewer for Treasurer/board review).

### D-042: Payroll Processing Deferred to v2 — No Payroll Until 2028+
- **Date:** 2026-02-11
- **Decision:** Payroll processing (converting approved timesheets to payroll GL entries, calculating withholdings, generating paychecks, filing payroll tax forms) is deferred to financial-system v2. RI will not run payroll until at least 2028 when rental income begins. Current timeline: (1) ~6 months from now: one-time $15K developer fee payment to one employee (handled manually outside system using tax calculator), (2) 2028+: regular payroll when rents provide cash flow, (3) If grant/contract awarded before 2028: timesheets used for billable hours (invoice customers), not payroll. The GL structure for payroll (D-018: single "Salaries & Wages" account, withholding liability accounts) and employee master data schema (D-017) are architecturally sound and remain in place for future v2 implementation, but no payroll workflows will be built in v1.
- **Rationale:** Building payroll infrastructure (withholding calculations, tax deposit tracking, Form 941 generation, W-2 generation, etc.) for a problem that won't exist for 2+ years is premature. The $15K developer fee is a one-off that doesn't warrant full payroll automation. When regular payroll becomes necessary (~2028), RI can choose between: (1) Gusto or similar service ($600-750/year for 2-5 employees) with API integration to financial-system for GL entries, (2) Building full payroll engine in-system with comprehensive compliance features (see Chunk 3 Session 2 discovery notes for requirements), (3) Hybrid approach (Gusto for compliance, custom GL integration). Deferring the decision and the development work until the problem is imminent is the right trade-off.
- **Impact on Chunk 3 discovery:** Session 2 (Approved Timesheets → Payroll GL Entry Flow) remains architecturally correct but is marked as "v2 scope — deferred." The decisions made in that session (monthly batching, task code + separate fund selection, withholding liability structure) will guide v2 implementation when needed.
- **Impact on renewal-timesheets integration:** The renewal-timesheets → financial-system API integration (D-008) is deferred to v2. Timesheets will continue to accumulate in renewal-timesheets for grant/contract billing purposes (if applicable), but won't create payroll GL entries until v2.
- **Impact on internal-app-registry-auth:** Employee payroll master data enhancements (tax IDs, withholding elections, pay frequency — D-017) are deferred to v2. The API spec (employee-payroll-data-spec.md) remains valid for future reference but won't be used in v1.
- **What remains in v1:** All other expense flows (employee reimbursements via expense-reports, vendor invoices, Ramp credit card, manual entries) are still in scope and will be built. Functional split allocation (Session 3) is still needed for 990 filing regardless of payroll timing.
- **Affects:** Chunk 3 (Expense Tracking — Session 2 deferred to v2, other sessions remain active). Chunk 8 (Integration Layer — renewal-timesheets API integration deferred to v2, internal-app-registry-auth payroll data API deferred to v2). Dependencies.md updated to reflect v1/v2 split.

### D-043: Gusto Integration Planning Deferred to v2
- **Date:** 2026-02-11
- **Decision:** Planning and implementing Gusto API integration (or alternative payroll service integration) is deferred to financial-system v2, along with the broader payroll processing decision (D-042). If/when payroll becomes necessary (~2028), RI will evaluate: (1) External service (Gusto, Paychex, OnPay) with API integration for GL entries, (2) Full in-system payroll engine, (3) Manual payroll processing with accountant/CPA. The Gusto API research and integration architecture work is not needed for v1.
- **Rationale:** No payroll = no need for Gusto integration. Deferring this decision until 2027-2028 allows RI to: (1) Assess actual payroll complexity after running it for a year (via external service or manual), (2) Evaluate payroll service market at that time (pricing, features, API capabilities may change), (3) Decide whether the integration ROI justifies development effort vs. continuing with external service. Building the integration now would be speculative.
- **What this means for v1:** No Gusto API calls, no payroll service integration contracts, no GL entry automation from payroll runs. Payroll-related GL entries (if any one-off payments like the $15K developer fee occur) will be created manually in financial-system.
- **What this means for v2:** When payroll work resumes, revisit Gusto API documentation, design integration architecture (API keys, webhook handlers for payroll run notifications, GL entry mapping, fund attribution for payroll), and implement. The GL structure (D-018) and fund accounting (D-013) are already designed to support this.
- **Affects:** Chunk 8 (Integration Layer — Gusto integration deferred to v2). No impact on other chunks (GL structure is already in place for future payroll entries).

### D-044: No Approval Workflows in Financial-System — Upstream Approval Only
- **Date:** 2026-02-11
- **Decision:** The financial-system will have NO approval workflows, approval queues, or tiered authorization. All users with access to financial-system have full admin rights (consistent with D-006). Transactions post to GL immediately when created — no pending approval state, no manager review step, no dual authorization. Approval happens UPSTREAM in source systems (expense-reports-homegrown, renewal-timesheets) before data reaches financial-system via API. Any transaction that arrives at financial-system is already approved and posts immediately.
- **Rationale:** RI is a 2-5 person organization where approval hierarchies don't make sense. D-006 already established no in-app permissions (all users = full access). D-040 established no dual authorization for payments. D-041 established audit logging as the compensating control. Building approval workflows would add complexity without benefit. The trust model is: if you're authorized to access financial-system (controlled by internal-app-registry-auth), you're trusted to create transactions. Audit logging (D-041) creates accountability trail for post-hoc review if needed.
- **Upstream approval model:**
  - **Expense reports:** Approved in expense-reports-homegrown by admin BEFORE API call to financial-system. Only approved reports are sent via API. Financial-system receives approved reports and immediately creates GL entries + AP liability.
  - **Timesheets (v2):** Approved in renewal-timesheets by admin BEFORE API call to financial-system. Only approved timesheets trigger payroll GL entries.
  - **Vendor invoices:** No approval workflow. User who creates PO and matches invoice is effectively approving it. Invoice entry → immediate AP liability. Payment execution happens later via UMass Five portal (D-040).
  - **Ramp transactions:** No approval workflow. User categorizes → immediate GL posting. Ramp card issuance = pre-authorization (only authorized cardholders have cards).
  - **Manual GL entries:** No approval workflow. User creates entry → immediate posting. Audit log (D-041) tracks who created what.
- **Month-end close implications:** Since there's no approval queue, month-end close is simplified. All transactions posted = all transactions approved. No "waiting for approvals to clear" before closing period. Month-end lock (if implemented) prevents new entries to closed periods, but doesn't involve approval workflows.
- **Trade-offs accepted:** No approval workflows means: (1) No "manager must approve before posting" control, (2) No "pending approval" visibility in reports, (3) Errors require correcting journal entries (can't reject/return for revision). These trade-offs are acceptable at RI's scale with audit logging as compensating control.
- **Not affected by this decision:** Source system approval workflows (expense-reports-homegrown has 4-state workflow: open → submitted → approved → rejected; this remains unchanged). Financial-system just doesn't replicate that workflow internally.
- **Affects:** Chunk 3 (Expense Tracking — no approval queues for any expense type). Chunk 4 (Bank Reconciliation — all transactions are already "approved" when reconciling). Chunk 6 (Board Reporting — no "pending approval" category in reports). Chunk 8 (Integration Layer — API contracts simpler without approval state management).

### D-045: No Period Locking — Open Periods Forever
- **Date:** 2026-02-11
- **Decision:** The financial-system will NOT implement period locking or month-end close restrictions. All accounting periods remain open indefinitely. Users can create, edit, or void transactions dated to any period (past, present, or future) at any time. There is no automatic lock after X days, no manual "close period" function, and no restriction on posting to prior months.
- **Rationale:** At RI's scale (2-5 users, low transaction volume), period locking adds complexity without meaningful benefit. The typical concern with open periods — users posting late entries that change prior-month financials after board has reviewed them — is manageable through: (1) Audit logging (D-041) shows who posted what and when, making late entries easy to identify, (2) Small team size means communication is direct ("Hey, I just found a February receipt"), (3) Board reporting can include note: "These financials are as of [report generation date]; late entries may occur." Open periods also simplify error correction (no need to "reopen" a period to fix mistakes) and accommodate legitimate late entries (expense reports submitted after month-end, bank feeds arriving late, vendor invoices with timing delays).
- **Trade-offs accepted:**
  - **Board reporting variability:** February P&L could change after board receives it if late entries are posted. Mitigated by: (1) Audit log tracks timing, (2) Board can request "final" vs. "preliminary" reports if desired, (3) Month-over-month variance reports will show when historical periods change.
  - **Compliance risk:** IRS/MA AG expect consistent period reporting. Mitigated by: (1) Annual filings (Form 990, Form PC) are generated from finalized year-end data, not month-by-month snapshots, (2) Audit log provides trail if questioned about late entries, (3) Late entries are expected to be rare (not systemic).
  - **Troubleshooting complexity:** "Why did November expenses increase in April?" requires checking audit log for late entries. Acceptable trade-off for simplicity.
- **Implementation implications:**
  - No "period status" field in database (open/closed/locked)
  - No validation against transaction date (can post to any date)
  - Reports should display "as of [date/time]" to clarify snapshot timing
  - Audit log is critical for tracking late entries (who, when, what period)
- **Future consideration:** If RI scales significantly (10+ employees, external audit requirements, complex grant compliance), revisit period locking. At that stage, could implement: (1) Soft lock (warning when posting to prior months, but allow with justification), (2) Hard lock (prevent entries to closed periods without admin override), (3) Rolling lock (auto-lock periods >90 days old). For v1, open periods are sufficient.
- **Board visibility:** Board can request specific report date ranges if they want "final" numbers. Example: "February financials as of March 10" vs. "February financials as of April 15" (includes late entries). Audit log viewer (Chunk 6) can show "transactions posted to February after March 10" to highlight late entries.
- **Affects:** Chunk 3 (Expense Tracking — no period validation on transaction dates). Chunk 4 (Bank Reconciliation — can reconcile any month at any time, no lock-in). Chunk 6 (Board Reporting — reports include "as of" timestamp, note about potential late entries).

### D-046: Conditional Grant Revenue Recognition — Per-Grant Assessment with Refundable Advance
- **Date:** 2026-02-12
- **Decision:** Grant revenue recognition depends on whether the grant is conditional or unconditional (ASC 958-605 distinction). Each grant award letter must be analyzed at the time of award:
  - **Unconditional grants** (no barriers to entitlement): Recognize revenue at award per D-034. Cash received upfront or creates Grants Receivable if reimbursement model.
  - **Conditional grants** (matching requirements, cost-share, milestone barriers): Cash received goes to Refundable Advance (liability account). Revenue recognized progressively as conditions are met (e.g., matching funds raised, milestones completed).
- **Rationale:** Some grants (especially SARE and similar USDA programs) require RI to raise matching funds or meet performance milestones before the grant becomes RI's money. Recognizing revenue at award for these grants would overstate revenue and net assets. The conditional/unconditional distinction is fundamental to nonprofit accounting under ASU 2018-08. SARE grants typically have matching requirements — this is certain, not hypothetical.
- **GAAP treatment examples:**
  - **Conditional grant with matching requirement:** Grant awards $100K with 25% match required ($25K from RI). When grant award received: DR: Cash $100,000 | CR: Refundable Advance $100,000 (liability). As RI spends and meets match: DR: Refundable Advance | CR: Grant Revenue (in proportion to conditions met).
  - **Unconditional upfront grant:** DR: Cash | CR: Grant Revenue (restricted fund) — per D-034
- **Per-grant analysis required:** When a grant is awarded, user must assess: Does this grant have conditions (matching, milestones, performance requirements)? If yes → conditional. If no → unconditional. System must support both treatments.
- **GL accounts needed:** Refundable Advance (liability — separate from Deferred Revenue in D-028, which is for timing, not conditions)
- **Supersedes/refines D-034:** D-034's "revenue at award" policy applies to unconditional grants only. D-034's GAAP caveat acknowledged this issue but deferred resolution. This decision closes the gap by adding conditional grant treatment.
- **Affects:** Chunk 1 (GL accounts — add Refundable Advance liability account). Chunk 2 (Revenue Tracking — grant setup workflow must capture conditional vs. unconditional status; revenue recognition logic differs). Chunk 5 (Compliance Reporting — funder reports must show progress toward conditions). Chunk 6 (Board Reporting — balance sheet shows Refundable Advance separately from revenue).

### D-047: Fundraising Event Revenue Bifurcation — Exchange vs. Contribution Split with Quid Pro Quo Disclosure
- **Date:** 2026-02-12
- **Decision:** Fundraising event revenue (e.g., May 2026 event) must be bifurcated between exchange portion (fair market value of goods/services provided) and contribution portion (excess payment over FMV). IRS requires quid pro quo disclosure for any payment >$75 where donor receives goods/services. System will support:
  - **Revenue split:** Two GL accounts: Event Exchange Revenue (for FMV of meal/entertainment/benefits) and Event Contribution Revenue (for excess over FMV)
  - **Quid pro quo disclosure:** For payments >$75 receiving goods/services, donor receipt letter (D-038 workflow) must state: "You received goods/services valued at $[FMV] in exchange for your $[total] contribution." This is distinct from the >$250 acknowledgment letter — both may apply to same donation.
  - **FMV determination:** Event organizer determines FMV of event benefits (meal, entertainment, auction items, etc.) before event. This value is used to split all ticket sales.
- **Example:** Fundraising dinner with $150 ticket. Meal/entertainment FMV = $50. Split: $50 → Event Exchange Revenue (Line 8a on Form 990), $100 → Event Contribution Revenue (Line 1c on Form 990). Donor receives receipt: "You received dinner valued at $50. Your tax-deductible contribution: $100."
- **IRS compliance:** Quid pro quo disclosure required by IRC 6115. Penalty: $10 per contribution (up to $5,000 per event) for failure to disclose. This is separate from the >$250 substantiation requirement in IRC 170(f)(8).
- **Integration with D-038:** Donor acknowledgment letter workflow (D-038) must be enhanced to handle quid pro quo disclosure when event revenue is recorded. System needs: (1) FMV field when recording event donation, (2) conditional letter language based on whether FMV > $0.
- **Form 990 reporting:** Handled in Chunk 5. Event exchange revenue and contribution revenue reported separately (Part VIII Lines 8a and 1c).
- **Affects:** Chunk 2 (Revenue Tracking — event revenue entry workflow with FMV split; donor receipt letters with quid pro quo language). Chunk 5 (Compliance Reporting — Form 990 revenue bifurcation, Schedule G Part II if gross receipts + contributions from events exceed $15K).

### D-048: Interest Income Recognition — Investment Income GL Account, Unrestricted Revenue
- **Date:** 2026-02-12
- **Decision:** Interest earned on bank accounts (checking, savings, money market) is recognized as unrestricted revenue in an Investment Income (or Interest Income) GL account. Interest will be material as RI draws larger amounts from the AHP revolving line of credit and deposits into interest-bearing accounts.
- **GL Treatment:**
  - **Interest earned on unrestricted cash:** DR: Cash (or Interest Receivable if accrued) | CR: Investment Income (General Fund, unrestricted)
  - **Interest earned on restricted cash:** Interest follows the restriction of the underlying fund (e.g., interest on SARE grant funds → SARE restricted fund). However, this is rare — most restricted funds are spent quickly, not held long-term.
- **Form 990 classification:** Investment income reported on Part VIII Line 3. This counts differently in the public support test than contributions (Line 1) — relevant for 170(b)(1)(A)(vi) classification. Chunk 5 responsibility.
- **Current accounts earning interest:** Business Interest Savings (...0172) currently has $5 balance. As RI draws from AHP line of credit (up to $3.5M available), funds will be deposited into interest-bearing accounts while awaiting deployment.
- **Accrual treatment:** Under accrual basis (D-005), interest is recognized when earned (monthly accrual), not when paid/credited. Most banks credit interest monthly or quarterly — system should accrue based on account statements or bank feed data.
- **Affects:** Chunk 1 (GL accounts — add Investment Income revenue account). Chunk 2 (Revenue Tracking — interest income entry workflow, accrual logic if needed). Chunk 4 (Bank Reconciliation — interest transactions from bank feed). Chunk 5 (Compliance Reporting — Form 990 Part VIII Line 3). Chunk 6 (Board Reporting — investment income reported separately from contributions/grants).

### D-049: AHP Loan Forgiveness Treatment — Unconditional Donation, No Refundable Advance
- **Date:** 2026-02-12
- **Decision:** AHP loan forgiveness (per Section 4.4 of loan agreement) has no enduring financial conditions. Forgiveness is a discretionary act by AHP with no performance requirements, affordable housing maintenance obligations, or clawback provisions. When AHP forgives a portion of the loan, it is treated as an unconditional donation with no strings attached — revenue recognized immediately and classified as unrestricted.
- **Rationale:** This confirms and refines D-023. D-023 established that forgiveness = donation income (not equity adjustment). This decision clarifies that forgiveness is NOT a conditional contribution (no refundable advance treatment, unlike PPP loans or grants with performance requirements). The forgiven amount is fully discretionary and non-restricted — RI can use it for any purpose.
- **GL Treatment:** (same as D-023)
  - Debit: AHP Loan Payable $[forgiven amount]
  - Credit: Donation Income (General Fund, unrestricted) $[forgiven amount]
- **No tracking of forgiveness requirements:** The financial system does not need to track any ongoing obligations or conditions related to forgiveness. This is beyond the scope of the system — AHP's forgiveness decision is based on factors outside the financial system's purview.
- **Supersedes D-023's ambiguity:** D-023 treated forgiveness as donation income but didn't address the conditional vs. unconditional question raised in D-046. This decision explicitly classifies AHP forgiveness as unconditional, distinguishing it from conditional grants that require refundable advance treatment.
- **Affects:** Chunk 1 (GL treatment per D-023 — no new accounts needed). Chunk 2 (Revenue Tracking — forgiveness recorded as simple donation entry, no conditions to track). Chunk 6 (Board Reporting — forgiveness events increase unrestricted net assets and reduce long-term liabilities).


### D-050: Pledge/Promise-to-Give Mechanics — Deferred Until Multi-Year Pledges Materialize
- **Date:** 2026-02-12
- **Decision:** Multi-year pledge accounting mechanics (present value discounting, allowance for uncollectibles) are deferred until/unless major donor commitments with signed pledge agreements materialize. For initial fundraising (May 2026 event and capital campaigns), the system supports simple Pledges Receivable tracking for near-term committed donations only — no PV discounting, no allowance for uncollectibles.
- **Rationale:** Multi-year pledges require signed, legally enforceable commitments. Verbal promises ("I'll give $10K/year for 3 years") without binding agreements are not pledges under GAAP — no receivable recognition until cash is received or a signed commitment exists. Recurring automatic donations (monthly subscriptions) are payment mechanisms (cancellable at any time), not pledges. Based on RI's fundraising approach and donor culture, multi-year binding pledges are unlikely. Building complex PV/allowance mechanics before knowing they're needed violates the "personal software" philosophy (D-002) and wastes implementation time.
- **What the system supports now:**
  - **Pledges Receivable GL account:** For short-term committed donations (donor commits, payment pending within 90 days). Example: Donor pledges $50K at event, sends check 30 days later.
  - **Accounting:** DR: Pledges Receivable | CR: Donation Revenue (when commitment is made). DR: Cash | CR: Pledges Receivable (when received).
  - **No discounting, no allowance:** Assumes pledges are fulfilled within current fiscal year at face value.
- **What the system does NOT support now:**
  - Multi-year pledges with PV discounting (e.g., "$100K over 4 years" = recognize PV of $92K)
  - Allowance for uncollectible pledges (e.g., 10% won't pay)
  - Annual accretion of discount
  - Write-off workflows for uncollectible pledges
- **If multi-year pledges emerge:** System can be enhanced retroactively with CPA guidance. Add: (1) PV calculation at pledge entry, (2) allowance estimation logic, (3) annual accretion entries, (4) uncollectible write-off workflow. This is a straightforward retrofit — the GL structure (Pledges Receivable exists) supports it; just need to add the calculation/tracking features.
- **Recurring donations distinction:** Monthly automatic donations (via Stripe, PayPal, etc.) are payment automation, not pledges. Revenue recognized when payment is received each month. Donor can cancel at any time → no enforceable commitment → no receivable until cash arrives.
- **Supersedes D-036 ambiguity:** D-036 mentioned "unconditional pledge" recognition but didn't specify mechanics. This decision clarifies: simple near-term pledges only (no PV/allowance). Complex multi-year pledges deferred.
- **Affects:** Chunk 1 (GL accounts — Pledges Receivable asset account added; no contra-asset accounts for discount/allowance). Chunk 2 (Revenue Tracking — pledge entry workflow supports simple receivable tracking only). Chunk 6 (Board Reporting — balance sheet shows Pledges Receivable for pending committed donations, but no allowance detail).


### D-051: Multi-Fund Transaction Allocation — Support Fund Splits at Transaction Level
- **Date:** 2026-02-13
- **Decision:** Transactions support multi-fund allocation splits. A single expense can be allocated across multiple funds using percentages or amounts (e.g., property insurance invoice of $1,000 split 60% Historic Tax Credit Fund / 40% Unrestricted Fund). When posted to GL, one transaction creates separate GL entries per fund allocation. Implementation details (UI for entering splits, validation that percentages sum to 100%, whether to use percentages vs. amounts) are deferred to spec phase.
- **Rationale:** Shared costs are inevitable as restricted grants arrive: property insurance covering multiple funding sources, utilities during construction benefiting multiple grant-funded activities, professional fees (legal, accounting) serving the whole organization. The alternative (requiring users to manually create separate line items for each fund) creates worse UX (more clicks, duplicate data entry), harder audit trail (splits scattered across multiple transactions instead of linked to one source document), and complicates bank reconciliation (one bank payment matching to multiple transactions instead of one). Supporting fund splits at the transaction level matches accounting reality (one expense, multiple funding sources) and keeps the user workflow clean. The schema change is minimal: add `fund_allocations` table (transaction_id, fund_id, allocation_amount or allocation_percentage) instead of single `fund_id` column. GL posting logic iterates over fund allocations and creates one GL entry per fund. This is standard nonprofit accounting practice for shared costs.
- **Data model implications:**
  - **Transaction table:** Remove single `fund_id` column (if present), add one-to-many relationship to `fund_allocations` table
  - **Fund allocations table:** `transaction_id`, `fund_id`, `allocation_percentage` (0-100) or `allocation_amount` (dollar value), `created_at`, `created_by`
  - **Validation:** Fund allocations must sum to 100% (if using percentages) or equal transaction amount (if using amounts). At least one fund allocation required per transaction.
  - **GL posting:** When transaction is posted, iterate over fund allocations and create one GL entry per fund (debit/credit accounts same, fund differs, amount prorated)
- **Deferred to spec phase:**
  - UI/UX: How user enters splits (inline "Add fund" button? Modal? Percentage fields vs. amount fields?)
  - Default behavior: Does transaction default to single fund (user adds splits as needed)? Or always prompt for fund allocation?
  - Validation messages: What happens if percentages don't sum to 100%? Block submission or warn?
  - Reports/exports: How are split transactions displayed in reports (one line with fund breakdown? Separate lines per fund?)
- **Affects:** Chunk 1 (Core Ledger — GL posting logic must handle fund splits, schema includes fund_allocations table). Chunk 3 (Expense Tracking — all expense sources support fund splits: expense reports, vendor invoices, Ramp transactions, manual entries). Chunk 8 (Integration Layer — API contracts must support fund allocation arrays in transaction payloads).


### D-052: $20K Board Approval Threshold — Governance Process, Not System Enforcement
- **Date:** 2026-02-13
- **Decision:** The $20,000 board approval threshold for contracts (per organizational bylaws documented in company_facts.md) is enforced through governance process, not financial-system workflow. Users are trusted to obtain board approval before creating purchase orders exceeding $20,000. The system does not gate PO creation, require approval documentation upload, or generate compliance warnings for contracts above the threshold.
- **Rationale:** Consistent with D-044 (no approval workflows in financial-system) and D-006 (all users fully trusted with full access). At RI's scale (2-5 users who ARE the board or work directly with board members), board review of large contracts happens naturally in board meetings. Every expense is visible to the board in monthly financial reports, and any contract exceeding $20,000 will receive board attention given RI's overall transaction volume and budget scale. Building in-system enforcement (approval gates, required documentation uploads, compliance warnings) adds complexity without benefit when the users creating POs are also the board members reviewing them. Governance oversight through board meeting minutes (documenting approval of contracts >$20K) provides the compliance record. If a contract >$20K is created without proper board approval, audit logging (D-041) tracks who created it and when, supporting post-hoc review if needed. The board can identify and address any procedural gaps through normal oversight.
- **Trade-offs accepted:** No automated compliance warning when user creates $20K+ PO. No system-enforced documentation requirement. Relies on users knowing the bylaws and following governance process. This is acceptable at RI's scale where all users have fiduciary responsibilities and direct board involvement.
- **Not affected by this decision:** The $20K threshold remains in organizational bylaws and must be followed. Board meeting minutes should document approval of contracts >$20K. This decision only addresses whether the financial-system enforces the threshold programmatically (it does not).
- **Affects:** Chunk 3 Session 4 (PO system — no approval gate, documentation requirement, or compliance warning for $20K+ contracts). No impact on GL structure or reporting.


### D-053: GL Transaction Corrections and Reversals
- **Date:** 2026-02-13
- **Decision:** GL transactions can be **voided** or **edited** with comprehensive audit trail. **Void:** Transaction is marked as void, remains in audit log and transaction history but excluded from GL balances and all reports (balance sheet, P&L, fund reports). **Edit:** Allowed for unmatched transactions only (before bank reconciliation matching); after a transaction is matched to a bank feed entry, edits are prohibited and corrections require reversing journal entry. All modifications (voids, edits, reversals) are logged in audit trail (D-041) with before/after state, user ID, and timestamp.
- **Correction workflows by scenario:**
  - **Wrong GL account or fund (unmatched transaction):** Edit transaction in place. Change GL account and/or fund allocation. Audit log captures original values, new values, who changed, when. Transaction retains same transaction ID.
  - **Wrong GL account or fund (matched transaction):** Create reversing journal entry (offsets original transaction exactly, marked as "Reversal of Transaction #123") + create new correcting entry with correct GL account/fund. Original transaction remains in GL for audit trail. All three transactions (original, reversal, correction) are linked via memo/reference field.
  - **Duplicate entry or erroneous transaction:** Void transaction. Transaction status changed to "void," excluded from all GL calculations and reports, but remains visible in transaction history and audit log. Cannot be un-voided (if voided in error, create new transaction).
  - **Complex corrections (e.g., multi-account adjustments, prior-period corrections):** Create manual journal entry with detailed memo explaining the correction, referencing original transaction IDs, and documenting reason for adjustment. Manual journal entries support multi-line debits/credits and can span multiple funds if needed.
- **Bank reconciliation implications:** Once a transaction is matched to a bank feed entry, it becomes "locked" from editing to prevent reconciliation corruption (user edits transaction, breaking the match between GL and bank feed). Matched transactions require reversing entries for corrections. Unmatched transactions can be edited freely until matched.
- **Rationale:** Balances audit trail integrity (all financial actions are preserved and traceable) with practical error correction needs. Restricting edits after bank matching prevents reconciliation integrity issues (matched transaction changing underneath the match would create GL/bank discrepancies). Reversing entries are standard GAAP practice for correcting posted transactions and create clear audit trail. Void functionality provides clean way to nullify errors without deletion (voided transactions don't disappear, just excluded from calculations). Consistent with D-045 (open periods, no period locking) — users can always correct mistakes regardless of transaction date, but corrections are transparent via audit log. At RI's scale (2-5 trusted users), flexibility to correct errors quickly outweighs risk of inappropriate modifications, with audit logging as compensating control.
- **Implementation notes:**
  - Transaction status field: `active`, `void`, or `matched` (matched = locked from editing)
  - Void action: Changes status to `void`, sets `voided_at` timestamp, `voided_by` user ID. Does not delete transaction record.
  - Edit action: Only allowed if status = `active` (not void, not matched). Updates transaction fields, logs before/after in audit trail.
  - Reversing entry: System can provide "Reverse Transaction" button that auto-creates offsetting entry with reference to original transaction ID.
  - UI considerations: Voided transactions shown in transaction history with strikethrough or "VOID" badge but excluded from reports. Matched transactions show lock icon and "Create Reversal" option instead of "Edit" button.
- **Affects:** Chunk 1 (Core Ledger — transaction model includes status field, void/edit logic, reversal entry creation). Chunk 3 (Expense Tracking — expense corrections use same void/edit/reversal patterns). Chunk 4 (Bank Reconciliation — matching locks transactions from editing, unmatched transactions remain editable). Chunk 6 (Reporting — void transactions excluded from all reports; audit log viewer shows voids and modifications).

### D-054: Full GAAP Financial Statement Presentation from Day One
- **Date:** 2026-02-12
- **Decision:** Board reports use GAAP-compliant nonprofit financial statement format from launch. Four core statements: Statement of Financial Position (Balance Sheet), Statement of Activities (P&L), Statement of Cash Flows, Statement of Functional Expenses. Supplementary notes/schedules include fund detail, AHP loan disclosure, accounting policies, fixed asset schedule. Dashboard/summary layer provides quick-glance operational view for daily management use.
- **Rationale:** GL structure (Chunks 1-3) already captures everything needed for GAAP statements — the reporting layer just formats it. Building simplified reports first and GAAP later means building two things. Build GAAP once, add a dashboard layer. The 3-person board can learn the format — it's not materially different from what they already see (P&L, Balance Sheet).
- **Affects:** Chunk 6 (all financial reports follow GAAP format). Sets the standard for all financial output from the system.

### D-055: Consolidated + Fund Drill-Down Reporting Model
- **Date:** 2026-02-12
- **Decision:** Primary reporting view is consolidated across all funds. Every financial statement supports fund-level filtering/drill-down. No separate per-fund statement generation — same report, different filter. Restricted fund draw-down reports available per fund on demand.
- **Rationale:** Data is already fund-coded (D-013, D-035). Consolidated = sum all funds. Fund-level = filter by fund. One report engine, one template, configurable view. Avoids maintaining separate per-fund report templates.
- **Affects:** Chunk 6 (report architecture). Chunk 7 (budget vs. actuals uses same drill-down model by fund).

### D-056: Interactive Reports + PDF Export
- **Date:** 2026-02-12
- **Decision:** All reports are interactive on-screen (filterable, expandable, drillable). Any report can be exported to PDF for board distribution. Board pack = curated set of PDF exports (financial statements + operational dashboards). No separate board report codebase — PDF is a print/export view of the same interactive report.
- **Rationale:** Heather uses interactive reports daily. Board gets PDF snapshots quarterly. One codebase serves both needs. Avoids maintaining parallel report formats.
- **Affects:** Chunk 6 (delivery mechanism). No downstream architectural impact.

### D-057: "As Of" Timestamp on All Reports
- **Date:** 2026-02-12
- **Decision:** Every report header shows generation datetime ("These financials are as of [date/time]"). No "preliminary/final" mechanism. Audit log viewer enables "what changed since date X" queries for board members who want to understand the impact of late entries.
- **Rationale:** Direct consequence of D-045 (no period locking). Reports reflect current state at generation time. If the board wants to compare snapshots, they regenerate the same report at a later date and check the audit log for what changed.
- **Affects:** Chunk 6 (all reports). Extends D-045.

### D-058: Report Comparison Columns — Current Period + YTD + Budget
- **Date:** 2026-02-12
- **Decision:** Financial statements include three comparison columns: (1) Current period (month or quarter), (2) Year-to-date, (3) Budget. Budget column depends on Chunk 7 providing budget data — shows "—" until budgets are entered. Report layout is designed for all three columns from launch.
- **Rationale:** Gives the board context at three levels: what happened this period, the cumulative picture, and how it compares to plan. Budget column is a placeholder until Chunk 7 is built, but designing the layout now avoids a retrofit. Current + YTD + Budget is the standard nonprofit board report format.
- **Affects:** Chunk 6 (report layout). Chunk 7 (must provide budget data in a format these reports can consume — budget amounts by GL account by period).

### D-059: All Operational Reports Ship at Launch
- **Date:** 2026-02-12
- **Decision:** All 21 reports in the Chunk 6 inventory are launch scope — no tiering or phasing. This includes: 4 GAAP financial statements, 4 operational dashboards (cash position, AR aging, payables, rent collection), 3 fund/grant reports, 5 specialized reports (property expenses, utility trends, donor history, cash projection display, AHP loan summary), 3 audit/compliance views (audit log, transaction history, late entries), and 2 annual deliverables (AHP covenant package, 990/Form PC data support).
- **Rationale:** Jeff's direction: "build the whole thing right up front." The reports are standard, not fancy — effective and relevant. Most reports are variations on the same GL data (filter by fund, filter by date, filter by account type). The reporting layer is the primary reason for building the system — skimping here defeats the purpose.
- **Affects:** Scope commitment. All reports built as part of initial system delivery. No deferred reporting features.

### D-060: 3-Month Cash Projection Deferred to Chunk 7
- **Date:** 2026-02-12
- **Decision:** The 3-month forward cash projection (requested by the board at January 2026 meeting) is a budgeting/forecasting function, owned by Chunk 7. Chunk 6 provides the report container and display format; Chunk 7 provides the projection logic, assumptions, and data model.
- **Rationale:** Cash projection requires assumptions about future inflows and outflows — that's budgeting, not reporting. Keeping it in Chunk 7 avoids building forecasting logic in two places.
- **Affects:** Chunk 7 (must specify: projection data model, automation level, how projection data feeds into the Chunk 6 report display). Chunk 6 (provides display container for projection data).

### D-061: Functional Expense Allocation — Annual Worksheet with Stored Percentages
- **Date:** 2026-02-13
- **Decision:** Functional allocation (Program/Admin/Fundraising) for 990 Part IX is performed via an annual worksheet. The system stores allocation percentages per person (or per expense category) and generates year-end allocation journal entries. At RI's current scale (2 people, mixed roles), this means Heather and Jeff each get a % split across Program/Admin/Fundraising, applied to salary and shared expenses. The worksheet is completed once per year at 990 prep time.
- **Rationale:** With 2 employees doing mixed roles and payroll deferred to v2, there's no timesheet data to derive functional splits from. An annual estimate is standard practice for small nonprofits — the IRS expects "reasonable and consistent" methodology, not precision accounting. The key is documenting the basis (job descriptions, typical time allocation) and applying it consistently. Quarterly estimates were considered but add overhead without proportional value at this scale.
- **Affects:** Chunk 5 (allocation methodology documented). Chunk 6 (board reports can show functional split after year-end allocation runs). Chunk 1 (GL posting logic for allocation JEs). Extends D-018 (year-end payroll allocation).

### D-062: 990 Line Item Mapping — System-Level GL Account Configuration
- **Date:** 2026-02-13
- **Decision:** Each GL expense account is tagged with its corresponding 990 Part IX line item (1–24) at account creation time. This is a system-level configuration, not a year-end exercise. Reports can auto-generate Part IX expense data by rolling up GL accounts into their 990 line items, then applying D-061 functional allocation percentages to produce the four-column layout (Total / Program / Admin / Fundraising).
- **Rationale:** The mapping between GL accounts and 990 lines is mostly stable — "Utilities - Electric" always maps to Line 16 (Occupancy), "Insurance" always maps to Line 23. Building the mapping into the GL avoids annual re-mapping effort and enables on-demand compliance reporting. Edge cases can be handled with override capability at year-end.
- **Affects:** Chunk 1 (GL account schema needs a `form_990_line` field). Chunk 5 (compliance reporting pulls from this mapping). Chunk 6 (990-style expense report becomes a standard report, not a manual exercise).

### D-063: Public Support Test Data Capture from Day One
- **Date:** 2026-02-13
- **Decision:** Every contribution/donation/grant is tagged with source type (government, public, related party) and tracked by donor entity. This provides the data needed for Schedule A public support test calculations when RI exits its 5-year grace period (~FY2030). The actual public support test calculation is still deferred (D-039), but data capture begins immediately.
- **Rationale:** The public support test uses a 5-year rolling window. Data from FY2025 onward will be needed for the first real test. D-038 already tracks donors with giving history — adding a source type tag (government/public/related party) is minimal incremental effort. The 2% excess contribution rule requires knowing each donor's cumulative giving over the 5-year window, which is already supported by D-038's donor tracking. Deferring data capture would risk having to reconstruct years of contribution history from bank statements.
- **Affects:** Chunk 2 (donation/grant entry must include source type field). Chunk 5 (public support test calculation can be built when needed, with data already available). Extends D-038 (donor tracking) and D-039 (public support test deferral — calculation deferred, data capture not deferred).

### D-064: Form PC — Compliance Calendar Reminder Only, No Data Generation
- **Date:** 2026-02-13
- **Decision:** The system does not generate Form PC data or reports. Form PC filing is handled manually via the MA Online Charity Portal. The system's compliance calendar (D-065) reminds RI when Form PC is due and what to attach (990 if over $25K gross support).
- **Rationale:** Form PC is essentially "attach your 990 plus a cover sheet." At RI's current scale (under $25K), it's minimal. Even at higher revenue, the Form PC data requirements are a subset of what the 990 already provides. Building a Form PC generator would be over-engineering for a form that takes 15 minutes to complete manually.
- **Affects:** Chunk 5 (Form PC is out of system scope). Chunk 6 (no Form PC report needed).

### D-065: Built-In Compliance Calendar with Automated Reminders
- **Date:** 2026-02-13
- **Decision:** The financial system includes a compliance calendar that tracks all filing deadlines (990/990-N, Form PC, MA SOS Annual Report, AHP covenant deliverables, insurance renewal, COI attestations, ST-2 renewal). The calendar shows on the dashboard and sends email reminders at 30-day and 7-day marks before each deadline. Deadlines are configurable (add new obligations as they arise, e.g., new funder reporting requirements).
- **Rationale:** Missing a filing deadline can have serious consequences (automatic 501(c)(3) revocation after 3 missed 990s, loss of charitable registration). A built-in calendar with reminders is the simplest defense against administrative oversight. The compliance calendar from company_facts.md provides the initial data set. This is a core "justify building the system" feature — it protects the org.
- **Affects:** Chunk 5 (compliance calendar is a Chunk 5 deliverable). Chunk 6 (dashboard shows upcoming deadlines per D-059's operational dashboard scope).

### D-066: 990 Program Descriptions — Manual Narrative, No Sub-Program Tagging
- **Date:** 2026-02-13
- **Decision:** The 990's program service accomplishments section is written as a manual narrative. No sub-program tagging in the GL. RI's single program class ("Property Operations" per D-012) is described on the 990 as encompassing all five Form 1023 program areas (affordable housing, regen agriculture, workforce dev, public education, energy). The 990 is the vehicle for updating program descriptions as the org matures — no Form 1023 amendment needed unless exempt purpose changes.
- **Rationale:** The IRS expects program descriptions to evolve via the 990 — Form 1023 is the application, not a permanent constraint. RI's programs are dimensions of one property, not separate business lines. Adding sub-program tags would create data entry overhead with no reporting value (the 990 only asks for narrative descriptions and total program expenses, which are the same regardless of sub-program breakdown). If RI's program structure diversifies significantly in the future, sub-program tagging can be added then.
- **Affects:** Chunk 5 (no sub-program mapping needed). Chunk 1 (no GL structure change). Simplifies D-012 implementation.

### D-067: Officer Compensation Reporting — Derive from Payroll, Not Needed Pre-Payroll
- **Date:** 2026-02-13
- **Decision:** The 990 Part VII compensation table (officers, directors, key employees) will be populated from payroll data when the payroll module exists. No separate "officer compensation" data entry form is needed. For FY25-26, RI files 990-N which doesn't require compensation reporting. By the time RI files a 990-EZ or full 990 requiring Part VII, the payroll module will exist.
- **Rationale:** The 990-N e-Postcard requires zero compensation data. The 990-EZ/990 Part VII data is exactly what the payroll module will track — employee names, titles, hours, compensation.
- **Affects:** Chunk 5 (no separate compensation reporting feature needed). Payroll module (Chunk 3) provides the data.

### D-068: Payroll Processing Restored to V1 Scope — Full In-House Build
- **Date:** 2026-02-13
- **Decision:** Payroll processing is restored to v1 scope, reversing D-042 and D-043. RI will build the full payroll calculation engine in-house: gross-to-net calculations, federal and MA withholding, FICA, payroll tax deposits, W-2 generation, and payroll reporting. No Gusto or third-party payroll service integration. The renewal-timesheets API integration and internal-app-registry-auth payroll data (already built) are also restored to v1 scope.
- **Rationale:** The original deferral (D-042) was driven by uncertainty about payroll tax law complexity and perceived risk. After consultation with experienced practitioners, the risk was reassessed as manageable: (1) the payroll calculations are mechanical and well-documented, (2) the regulatory knowledge gap can be closed with dedicated upfront research, and (3) ongoing tax law changes can be managed through an AI-assisted annual review process — AI researches current year tax rates/thresholds, recommends system changes, human reviews and approves. This "AI-guided, human-involved" annual maintenance pattern fits RI's personal software philosophy and avoids recurring Gusto subscription costs.
- **Reverses:** D-042 (Payroll Processing Deferred to V2), D-043 (Gusto Integration Deferred to V2)
- **Affects:**
  - **Chunk 3:** V1/v2 split eliminated. Payroll processing, payroll tax compliance, W-2 generation, 1099-NEC generation are all v1 scope. Chunk 3 discovery needs a payroll-focused session to specify: federal withholding (Publication 15-T), FICA (Social Security + Medicare), MA state income tax, MA PFML, MA unemployment (SUTA), deposit schedules, quarterly returns (941), annual returns (940, W-2, W-3).
  - **Chunk 8:** renewal-timesheets API integration restored to v1. internal-app-registry-auth payroll data endpoints (already built) are v1 dependencies.
  - **Chunk 5:** Payroll tax compliance calendar entries added to D-065. Annual payroll tax rate review process needed (AI-assisted).
  - **Build scope:** Significant addition. Payroll is a research-heavy module with regulatory requirements that must be precisely implemented.
- **Annual maintenance pattern:** The compliance calendar (D-065) includes a January "Annual Payroll Tax Rate Review" entry. This triggers the annual process: AI researches current-year IRS Publication 15, MA DOR updates, FICA rate changes, wage base limits, and recommends system configuration updates. Human reviews recommendations and approves changes. System stores tax rate tables as configurable data (not hardcoded), enabling annual updates without code changes. The compliance calendar is both the reminder system and the trigger for the AI-assisted rediscovery process — no separate maintenance infrastructure needed.
- **Open question — Employee Data Source of Truth (OQ-001):** Where does employee setup and PII live? Currently, internal-app-registry-auth holds employee payroll master data (D-017, API already built at tools.renewalinitiatives.org). But full in-house payroll means the financial system needs deep, ongoing access to withholding elections, tax IDs, pay rates, employment status — and someone needs a workflow for setting up new employees, updating W-4s, onboarding/offboarding. Three sub-questions: (1) **PII security** — where is sensitive data stored/encrypted at rest? Who has access? (2) **Workflow origination** — where does Heather go to set up a new hire or update a W-4? (3) **API integration** — does financial-system consume from auth (current design), or own the data directly? **Status: Deferred. Do not decide until circumstances compel. Must be resolved before payroll module is built. Expected to surface during Chunk 8 discovery (integration architecture) or a dedicated Chunk 3 payroll discovery session.**

### D-069: Security Deposit Escrow — Pooled Account with Per-Tenant Tracking
- **Date:** 2026-02-13
- **Decision:** RI will use a single pooled interest-bearing escrow bank account at UMass Five (or other MA bank) to hold all tenant security deposits. The financial system tracks individual tenant deposit balances within the pooled account. This is legally permissible under MA G.L. c. 186 § 15B as long as individual deposits are properly identified and tracked.
- **Rationale:** With up to 20 units, maintaining 20 separate bank accounts is operationally impractical. A pooled account with per-tenant system tracking achieves the same compliance outcome — every tenant's deposit is identifiable, interest is calculable per deposit, and the total escrow balance is reconcilable against the sum of individual deposits.
- **GL structure:**
  - **Security Deposit Escrow (Asset):** Bank account holding tenant deposits. Reconciles to actual bank balance.
  - **Security Deposits Held (Liability):** Total obligation to return deposits. Sum of individual tenant balances.
  - **Interest Expense — Security Deposits:** Annual interest owed to tenants.
  - Per-tenant detail tracked at the data layer (tenant ID, deposit amount, date collected, annual interest accrued/paid).
- **MA law compliance requirements the system must enforce:**
  - Receipt at collection (amount, date, premises description, person receiving)
  - Second receipt within 30 days (bank name, location, account number)
  - Statement of condition within 10 days of tenancy start
  - Annual interest payment (lesser of bank rate or 5%)
  - 30-day return deadline after move-out with itemized deductions
  - Treble damages for non-compliance (automatic, no bad faith required)
- **Affects:** Chunk 1 (3 new GL accounts: escrow asset, deposit liability, interest expense). Chunk 4 (escrow bank account reconciliation — separate from operating account). Chunk 6 (security deposit liability on balance sheet; per-tenant deposit report).

### D-070: Security Deposit Interest — Fully Automated Annual Calculation
- **Date:** 2026-02-13
- **Decision:** The system automatically calculates annual interest per tenant deposit (lesser of actual bank rate or 5%), generates the journal entry (DR Interest Expense — Security Deposits, CR tenant credit or payable), and flags for payment or rent credit. The compliance calendar (D-065) reminds when annual interest is due for each tenant (based on tenancy anniversary).
- **Rationale:** The treble damages penalty for missing interest payments makes this a high-compliance-risk area. Automating the calculation and JE generation removes the risk of manual oversight. The calculation is simple (principal × rate × time) and the data is already in the system from D-069's per-tenant tracking.
- **Affects:** Chunk 5 (compliance calendar entries per tenant). Chunk 1 (interest calculation logic in GL engine).

### D-071: Rent Proration — Statutory Daily Rate Method
- **Date:** 2026-02-13
- **Decision:** Rent proration follows MA statutory requirement: daily rate = monthly rent ÷ actual days in month × days occupied. This applies to both move-in and move-out partial months. The system calculates prorated amounts automatically when move-in or move-out dates are recorded. Prorated AR entries are generated using D-027's rent adjustment GL structure.
- **Rationale:** MA law (G.L. c. 186 § 4) requires proration; it's not contractual or optional. Using actual calendar days (not 30-day month) is the legally correct method. Automated calculation prevents errors that could lead to tenant disputes. Proration entries flow through the existing rent adjustment accounts (D-027) to keep the audit trail clean — core rent vs. prorated adjustment is visible on reports.
- **Affects:** Chunk 2 (AR generation must support partial-month entries). Extends D-027 (rent adjustments).

### D-072: Move-Out Deposit Return Workflow — Deferred
- **Date:** 2026-02-13
- **Decision:** A structured move-out workflow (30-day countdown, inspection checklist, itemized deductions, return calculation) is deferred until closer to first tenant occupancy. The compliance calendar (D-065) will track the 30-day return deadline when a move-out is recorded, but the full workflow (inspection documentation, deduction itemization, return payment generation) is not built at launch.
- **Rationale:** Property closing is March 2026, but first tenants won't move in until after renovation. First move-outs are likely 1+ years away. Building the workflow now when the exact operational process isn't yet established is premature. The compliance calendar provides the safety net (30-day deadline tracking) while the detailed workflow can be designed based on actual experience.
- **Affects:** Chunk 5 (future scope). Compliance calendar (D-065) provides interim protection.

### D-073: VASH/Section 8 Subsidy Tracking — Financial System Records Payments, Property Management Data Lives Elsewhere
- **Date:** 2026-02-13
- **Decision:** The financial system does not store HAP contract terms, tenant income-based calculations, PHA recertification dates, or other property management data. It records rental income as it arrives, coded by funding source (tenant direct, VASH/HAP, MVRAP, FVC, etc.) per D-026's existing AR-by-source tracking. Variance detection is against total expected rent per unit (set as part of the AR accrual from D-025), not broken out by tenant vs. PHA contract terms.
- **Rationale:** HAP contracts, tenant income certifications, and recertification schedules are property management functions, not accounting functions. Storing them in the financial system creates scope creep and a maintenance burden for data that changes based on PHA actions, not financial transactions. The financial system's job is to record and reconcile money. Property management data (lease terms, HAP amounts, inspection schedules) will live in a separate system — whether that's a purpose-built tool, a spreadsheet, or a future project.
- **What's already covered:** D-026 tracks AR by tenant/unit with funding source. D-024 requires rental income to identify funding source. D-027 handles adjustments with annotation. These provide the GL-level tracking needed. The gap (expected HAP amount vs. actual) is an operational/property management concern, not an accounting one.
- **Affects:** Scopes financial-system boundary. Creates implicit requirement for separate property management tooling (future project, not part of financial-system scope).

### D-074: MVRAP Program Name Clarification — Likely MRVP or VHVP
- **Date:** 2026-02-13
- **Decision:** Research could not locate a Massachusetts program called "MVRAP." The most likely matches are MRVP (Massachusetts Rental Voucher Program — state-funded), VHVP (Section 8 Veterans Housing Voucher Program — state-managed), or AHVP (Alternative Housing Voucher Program — state-funded with veteran preference). All operate on the same basic model as Section 8: tenant pays ~30% of income, subsidy covers the rest, paid directly to landlord. For system design purposes, all voucher programs are treated identically — the funding source label differs but the GL mechanics are the same (AR by source, income by source).
- **Rationale:** The system doesn't need program-specific logic. All voucher programs produce the same accounting entries: tenant pays portion, PHA/state pays portion, both are rent income coded by source. The compliance calendar (D-065) can track program-specific reporting obligations as they're identified.
- **Affects:** No architectural impact. Funding source labels in the system are configurable (D-013 dynamic fund creation). Correct program name to be confirmed when RI enters HAP contracts.

### D-075: Capital vs. Operating Cost Categories — Deferred Until Funder Awards
- **Date:** 2026-02-13
- **Decision:** No capital vs. operating cost category tagging infrastructure is built now. Fund-level tracking (D-013) is sufficient. When specific funders (HTC, CDBG, CPA) award grants with cost categorization requirements, the system will be retrofitted with cost category fields as needed. This extends the D-016 deferral.
- **Rationale:** RI doesn't have HTC, CDBG, or CPA awards yet. Building a speculative cost category system risks designing for requirements that may not materialize or may differ from assumptions. The fund structure (D-013) already isolates spending by funding source. Adding cost categories within funds is a data-layer addition that doesn't require architectural changes — it's a field on transactions, not a GL redesign.
- **Affects:** Extends D-016 and D-032 deferrals. When awards arrive, Chunk 5 (or a mini-discovery) will specify the exact cost categories each funder requires.

### D-076: Grant Spend-Down Monitoring — Existing Fund Reports Sufficient
- **Date:** 2026-02-13
- **Decision:** No special spend-down monitoring dashboard or alerting system is built. Fund-level spending reports (already in D-059's report inventory) provide the data needed to assess grant spend-down pace. Users run the fund spending report when they want to check. The compliance calendar (D-065) can include periodic "review grant spending pace" reminders if desired.
- **Rationale:** At RI's current scale (1-2 active grants expected initially), a dedicated spend-down dashboard with pace indicators and alerts is over-engineering. The fund spending reports already show: fund name, total award, cumulative spending, remaining balance. A human can compare that to the grant timeline and assess pace. If RI eventually manages 10+ simultaneous grants with complex timing requirements, a dedicated monitoring tool can be built then.
- **Affects:** Simplifies Chunk 5 and Chunk 6 scope. D-029's multi-year spend-down tracking is handled by existing fund reports, not a dedicated system.

### D-077: Funder-Specific Reporting Requirements — Flexible Framework, Concrete Requirements Deferred
- **Date:** 2026-02-13
- **Decision:** The system does not pre-build funder-specific report formats. Instead, it provides the building blocks: fund-level spending reports, GL account detail by fund, transaction-level detail with memos and attachments, and the compliance calendar for deadline tracking. When specific funder reporting requirements are known (via award letters), custom reports or data exports can be built to match their formats. The compliance calendar (D-065) is the vehicle for tracking funder-specific reporting deadlines.
- **Rationale:** Funder reporting requirements vary widely and aren't known until award letters arrive. SARE may want quarterly narrative + financial reports. CDBG may want HUD-standard drawdown requests. CPA may want annual progress reports. AHP requires annual financials or 990 (already tracked in compliance calendar). Pre-building report templates for unknown requirements wastes effort. The system's fund-level and GL-level reporting provides the raw data; formatting for specific funders is a customization exercise when requirements are clear.
- **Affects:** Chunk 6 (no funder-specific report templates at launch). Compliance calendar (D-065) tracks funder reporting deadlines as they're established. Future mini-discoveries may be needed when major awards arrive.

### D-078: Capitalization Threshold — $2,500 (IRS De Minimis Safe Harbor)
- **Date:** 2026-02-13
- **Decision:** RI's capitalization policy threshold is $2,500 per item or invoice. Items below $2,500 are expensed immediately. Items at or above $2,500 are capitalized on the balance sheet and depreciated over their useful life. This matches the IRS de minimis safe harbor for taxpayers without applicable financial statements (Reg. §1.263(a)-1(f)).
- **Rationale:** $2,500 is the maximum safe harbor for organizations without audited financials. It provides maximum flexibility (fewer items to track as assets) while remaining IRS-compliant. When RI eventually has audited financials (Form PC $1M+ threshold), the safe harbor increases to $5,000 and the policy can be updated. The key requirement is consistent application and a written policy (this decision serves as that documentation).
- **Affects:** Chunk 1 (capitalization logic — system should flag entries to CIP or asset accounts when amount ≥ $2,500). Chunk 3 (expense vs. capital determination at entry time). D-032 (CIP accumulation threshold).

### D-079: Bad Debt Method — Direct Write-Off
- **Date:** 2026-02-13
- **Decision:** RI uses the direct write-off method for bad debts. Uncollectible receivables (tenant rent, other AR) are written off when determined to be uncollectible. No allowance-for-doubtful-accounts contra-asset account is maintained. Write-offs require a journal entry (DR Bad Debt Expense, CR Accounts Receivable) with mandatory annotation documenting the reason, collection efforts, and authorization.
- **Rationale:** Direct write-off is simpler and appropriate for RI's current scale. The allowance method (estimating uncollectible percentages from AR aging) is GAAP-preferred for audited financials but adds complexity without proportional benefit when RI has <20 tenants and no audit requirement. When RI reaches the audit threshold ($500K+ for reviewed statements, $1M+ for audited per Form PC), the method can be switched to allowance. The system should support both methods so the transition is a configuration change, not a rebuild.
- **GL accounts:** Bad Debt Expense (expense account, maps to 990 Part IX). No contra-asset account needed under direct write-off.
- **Affects:** Chunk 1 (one GL account, not two). Chunk 2 (AR write-off workflow — annotation required per D-027 pattern). Simplifies D-026 AR tracking (no estimated allowance calculation).

### D-080: Depreciation Policy — Component for Building, Single-Item for Everything Else
- **Date:** 2026-02-13
- **Decision:** Depreciation uses two approaches: (1) **Component depreciation for the Easthampton building** — major building components (roof, HVAC, electrical, plumbing, structure, windows, etc.) are tracked as separate assets with individual useful lives and depreciation schedules. (2) **Single-item depreciation for all other assets** — equipment, vehicles, furniture, and other personal property are each tracked as one asset with one useful life, using IRS-standard useful lives (equipment 5-7 years, vehicles 5 years, furniture 7 years, computers 3-5 years).
- **Useful lives (building components):** Structure 27.5 years (IRS residential rental), roof 20 years, HVAC 15 years, electrical 15-20 years, plumbing 15-20 years, windows 15-20 years, flooring 5-10 years. Exact lives per component to be finalized at property closing when renovation scope is known.
- **Method:** Straight-line for all assets (IRS standard for residential rental property).
- **Rationale:** Component depreciation for the building is likely required for HTC cost substantiation (Historic Tax Credits need to demonstrate qualified rehabilitation expenditures by component) and produces a more accurate balance sheet. It's more complex but D-019/D-020's AI depreciation assistant was specifically designed to manage this complexity. For non-building assets, component depreciation is unnecessary — a truck is a truck, not an engine + chassis + tires.
- **Affects:** Extends D-019 (depreciation GL structure) and D-020 (AI depreciation assistant). Chunk 1 (asset register must support component-level tracking for buildings). Chunk 6 (fixed asset schedule in notes to financials shows components).

### D-081: Historic Tax Credit Equity Accounting — Fully Deferred
- **Date:** 2026-02-13
- **Decision:** All HTC-related GL accounting is deferred to a mini-discovery when the HTC deal is actually structured. No HTC-specific GL accounts (investor equity revenue, partnership investment, QRE tracking) are built now. The existing fund structure (D-013) already supports an "HTC Fund" for tracking HTC-related spending. When RI hires an HTC consultant and structures the syndication deal (investor equity, partnership/LLC formation, credit allocation), a dedicated mini-discovery will specify: partnership accounting (consolidation vs. equity method), investor equity recognition timing, QRE classification requirements, and exit/buyout mechanics.
- **Rationale:** The HTC deal is very early stage — no consultant hired, no investors/syndicators identified, no credits approved, money unlikely until 2027+. The partnership structure (nonprofit + tax credit investor in an LLC) will bring complex accounting requirements (potentially consolidated financials under ASC 810, contribution recognition under ASC 958-605) that depend entirely on how the deal is structured. Building speculative GL infrastructure risks designing for the wrong structure. The fund-level tracking (D-013) and component depreciation (D-080) provide the foundation; HTC-specific accounting layers on top when the deal terms are known.
- **Affects:** Chunk 1 spec should note that HTC GL accounts are a future addition (not v1). Chunk 5 compliance calendar (D-065) should include a trigger: "When HTC consultant is engaged, schedule HTC accounting mini-discovery."

### D-082: QRE Tracking — Deferred with HTC
- **Date:** 2026-02-13
- **Decision:** Qualified Rehabilitation Expenditure (QRE) classification and tracking is deferred along with the rest of HTC accounting (D-081). No QRE-specific fields (e.g., `qre_eligible` flag on transactions) are built into the CIP or expense data model now. The existing CIP account (D-032) and component depreciation structure (D-080) capture costs by component, which provides the raw data needed for QRE classification. When the HTC consultant specifies exactly which costs qualify as QRE, the classification can be retrofitted as a data-layer addition (a field on transactions within CIP, not an architectural change).
- **Rationale:** QRE classification depends on HTC consultant guidance and NPS (National Park Service) certification requirements. The substantial rehabilitation test (QREs must exceed adjusted basis of building or $5,000) and specific qualifying/non-qualifying cost categories are HTC-deal-specific. Building QRE tracking before knowing the exact requirements risks wrong assumptions. The CIP and component depreciation infrastructure provides the foundation.
- **Affects:** Extends D-081. No impact on current Chunk 1/3 data model. When HTC mini-discovery runs, it will specify QRE fields as part of the overall HTC accounting design.

### D-083: In-Kind Contribution GL Structure — Three Separate Revenue Accounts
- **Date:** 2026-02-13
- **Decision:** The system creates three separate in-kind contribution revenue GL accounts: (1) **In-Kind Contributions — Goods** (donated physical assets: materials, equipment, supplies), (2) **In-Kind Contributions — Services** (donated specialized professional services that meet ASC 958-605 recognition criteria: specialized skills, volunteer possesses skills, nonprofit would normally purchase), (3) **In-Kind Contributions — Facility Use** (donated use of space, equipment, or other facilities). All three accounts map to 990 Part VIII Line 1g (Noncash contributions). Each entry requires fair market value documentation (valuation method, source of rate, supporting evidence). The existing D-015 AHP in-kind contribution ($12,835) would be classified under In-Kind Goods.
- **Rationale:** Three accounts provide the disaggregation needed for (a) 990 Schedule M reporting if noncash contributions exceed $25,000 in any year, (b) ASU 2020-07 disclosure requirements when RI reaches audited financial statement threshold, and (c) clear separation between goods (which may need appraisals), services (which require the specialized-skills test), and facility use (which requires rental rate documentation). At RI's current scale this is minimal overhead, and it avoids having to reclassify or split accounts later.
- **Affects:** Chunk 1 (3 new GL revenue accounts, all mapping to `form_990_line` for noncash contributions). Chunk 2 (contribution entry workflow should prompt for in-kind type when recording noncash donations). Extends D-036 (donation recognition) and D-038 (donor tracking).

### D-084: Volunteer Hour Tracking — Outside Financial System
- **Date:** 2026-02-13
- **Decision:** Volunteer hours are tracked outside the financial system (spreadsheet, separate tool, or future dedicated module). The financial system only records the dollar value of qualifying volunteer services as an in-kind contribution journal entry (to In-Kind Contributions — Services per D-083) when volunteer work meets ASC 958-605 specialized skills criteria or when dollar values are needed for grant matching reports. Volunteer hour summaries (name, dates, hours, tasks, rates) are maintained externally and referenced in JE memos.
- **Rationale:** Volunteer tracking is an operational/HR function, not a financial accounting function. At RI's projected scale ($4,200/year in volunteer hours), building a volunteer management module in the financial system is over-engineering. The financial system's role is recording the financial impact (in-kind revenue) when it occurs. Grant matching documentation (required by SARE and similar funders) can reference external volunteer logs. If RI eventually manages dozens of volunteers across multiple programs, a dedicated volunteer management tool can be evaluated then.
- **Affects:** No Chunk 1 GL impact beyond D-083's in-kind accounts. Compliance calendar (D-065) will include volunteer-related reminders (see D-085).

### D-085: Compliance Calendar — Annual In-Kind & Schedule M Review
- **Date:** 2026-02-13
- **Decision:** The compliance calendar (D-065) includes an annual reminder: "Review in-kind contributions for 990 Schedule M threshold ($25,000) and verify fair value documentation." Timing: January (as part of year-end close / 990 prep). The reminder prompts: (1) total noncash contributions for the year across all three in-kind accounts (D-083), (2) whether Schedule M filing is triggered, (3) whether all in-kind entries have adequate fair value documentation (valuation method, supporting evidence), (4) review of any volunteer hours that should have been recorded as in-kind services but weren't.
- **Rationale:** Low-effort annual hygiene. Catches potential Schedule M filing requirements before the 990 deadline. Ensures fair value documentation is current (not reconstructed months later). Consistent with the compliance calendar's role as the central "don't forget this" mechanism.
- **Affects:** Extends D-065 compliance calendar entries. No GL impact.

### D-086: Annual Budget Cycle — Standard Nonprofit Process with December Board Approval
- **Date:** 2026-02-13
- **Decision:** RI adopts a standard nonprofit annual budget cycle aligned with the calendar fiscal year. September: review current year actuals and assess priorities. October: ED drafts next year's budget. November: draft circulated to board. December board meeting: board reviews and approves budget before January 1. Quarterly: board reviews budget vs. actuals. Mid-year: optional revision if material changes occur. No approval workflow in the system (consistent with D-044).
- **Rationale:** Standard nonprofit best practice is to complete and approve the budget before the fiscal year starts. Compliance calendar (D-065) should include budget preparation reminders starting in September.
- **Affects:** Compliance calendar (D-065) gets budget cycle reminders. Chunk 6 (quarterly board reports include budget vs. actuals per D-058).

### D-087: Budget Entry — Annual Amounts with Monthly Spread Options
- **Date:** 2026-02-13
- **Decision:** Budget creation uses annual amounts per GL account per fund, with the system spreading across months. Four spread modes per line item: (1) Even spread (default), (2) Seasonal pattern, (3) One-time, (4) Custom monthly. Supports both predictable recurring items and irregular items. For 2027+, system offers "copy last year's budget" with percentage adjustment.
- **Rationale:** Keeps budget creation fast (~30-50 annual line items) while enabling monthly variance tracking.
- **Affects:** Budget data model stores annual amount + monthly breakdown per line. Chunk 6 reports consume monthly amounts (D-058).

### D-088: Full Budget — Operating + Capital + Financing
- **Date:** 2026-02-13
- **Decision:** Annual budget includes operating (P&L), capital (CIP, equipment), and financing (AHP draws, loan payments). Single source of truth for all planned financial activity. Cash projection (D-091) derives from this budget.
- **Rationale:** Cash projection needs capital and financing data. Single budget avoids disconnected data sources. Board gets complete picture.
- **Affects:** Budget data model supports non-P&L items. Cash projection pulls from full budget. Chunk 6 may need capital budget section.

### D-089: Variance Reporting — Color-Coded Thresholds
- **Date:** 2026-02-13
- **Decision:** Budget vs. actuals reports use color coding: green (within/under budget), yellow (moderately over, ~>10%), red (significantly over, ~>25%). Visual flags only, no active alerts. Thresholds configurable, exact values defined in spec.
- **Rationale:** At-a-glance visibility without notification noise. Appropriate for RI's 2-person operation.
- **Affects:** Chunk 6 report rendering needs conditional color formatting. Thresholds configurable.

### D-090: Budget Revisions — Simple Overwrite, No Version History
- **Date:** 2026-02-13
- **Decision:** One active budget per fiscal year. Mid-year revisions edit remaining months (actuals-to-date locked). No version history, no original vs. revised comparison.
- **Rationale:** Version tracking adds complexity without proportional value at RI's scale. Can be added later as data-layer enhancement.
- **Affects:** Simple budget data model: one record per GL account per fund per month per fiscal year.

### D-091: Cash Projection — Semi-Automated, Quarterly, Budget-First Pre-Fill
- **Date:** 2026-02-13
- **Decision:** 3-month cash projection (D-060) is semi-automated, updated quarterly before board meetings. Pre-fill: starting cash from bank balances, inflows from AR/Grants Receivable/budget, outflows from payables/budget/AHP interest. No budget → fall back to 3-month actuals average. Heather manually adjusts for pending grants, planned draws, one-time items. AHP available credit displayed as context only.
- **Rationale:** Data-grounded projection without building from scratch. Budget-first reflects the plan; GL-history handles gaps. Quarterly matches board cadence.
- **Affects:** Integrates with budget data (D-088), AR/AP (Chunks 2/3), bank data (Chunk 4). Chunk 6 provides display container.

### D-092: Grant Budgets — Fund-Level Budgets, No Funder Category Mapping
- **Date:** 2026-02-13
- **Decision:** Grant budgets are fund-level budgets in RI's GL structure. Org budget = sum of fund budgets. Multi-year grant support (budget entries span fiscal years). No funder-category-to-GL mapping in v1.
- **Rationale:** Consistent with D-077 and D-013. Zero active grants makes category mapping premature.
- **Affects:** Budget model supports multi-year entries. Fund drill-down (D-055) applies to budgets.

---

## Chunk 4: Bank Reconciliation Decisions

### D-093: Plaid API for Bank Feeds
- **Date:** 2026-02-13
- **Decision:** Use Plaid `/transactions/sync` API for bank transaction feeds from UMass Five Credit Union. Two accounts initially (checking, savings) at $0.30/account/month ($0.60/month total). Third account (escrow, per D-069) added when opened ($0.90/month).
- **Rationale:** Jeff confirmed Plaid access via direct call. Cursor-based incremental sync is efficient for low-volume accounts (<20 transactions/month). Rich transaction data (merchant, category, counterparties) supports matching. Cost is negligible. Alternative (OFX file import) was considered but API is cleaner and eliminates manual export step.
- **Affects:** Chunk 8 integration (Plaid token management, auth flow). Bank rec matching model. Cash projection (D-091) can read real-time balances.

### D-094: Daily Scheduled Bank Sync
- **Date:** 2026-02-13
- **Decision:** System syncs bank transactions once daily via scheduled job. Manual "sync now" button available for on-demand refresh. Not real-time webhook-driven.
- **Rationale:** <20 transactions/month makes real-time sync overkill. Daily sync keeps data current for reconciliation without unnecessary API calls. Manual sync available when user is actively reconciling and wants latest data. Plaid webhook (`SYNC_UPDATES_AVAILABLE`) could be added later if needed.
- **Affects:** Scheduling infrastructure (cron job or equivalent). Plaid API call frequency.

### D-095: Trust-Escalation Transaction Matching Model
- **Date:** 2026-02-13
- **Decision:** All bank transactions land in review queue. System suggests matches (amount, date, payee). User confirms or rejects suggestions. On confirmation, system offers to create a matching rule. If rule exists and future transaction matches rule criteria, match is auto-approved. Same pattern as Ramp categorization from Chunk 3.
- **Rationale:** Balances efficiency with control. New system starts with zero trust (everything requires confirmation). Trust builds through rules that the user explicitly creates. Auto-approval only happens when user has established a pattern. Consistent UX with Chunk 3 Ramp workflow — users learn one interaction pattern. Avoids the "auto-match then fix mistakes" model that hides errors.
- **Affects:** Matching engine design, rule storage, UX for reconciliation workflow. Chunk 3 Ramp categorization should use same rule engine if possible.

### D-096: Inline GL Creation from Bank Reconciliation
- **Date:** 2026-02-13
- **Decision:** Allow creating GL entries directly from the bank reconciliation screen for bank-originated transactions (fees, interest income, small ACH debits). Configurable threshold prompts user to use full journal entry workflow for larger amounts. Entries marked as "bank-originated" in audit trail. Fund assignment still required.
- **Rationale:** Bank-originated items (monthly service fees, interest credits) have no prior GL entry and are simple enough to categorize inline. Requiring users to leave rec screen, create a journal entry, then return to rec screen for a $5 bank fee is unnecessarily cumbersome. Threshold prompt prevents misuse for complex transactions. Audit marking enables review of all bank-originated entries.
- **Affects:** Reconciliation UI design. Audit trail schema. GL entry creation API must support this lightweight path.

### D-097: Two-Way Reconciliation (Bank-to-GL and GL-to-Bank)
- **Date:** 2026-02-13
- **Decision:** Reconciliation checks both directions: (1) every bank transaction has a GL match or explanation, AND (2) every GL cash entry has a bank match or explanation. Reconciliation is "complete" only when both sides are fully accounted for — matched, marked as timing difference (outstanding checks, deposits in transit), or marked as GL-only with explanation.
- **Rationale:** Standard bank-to-book reconciliation only catches bank-side discrepancies. The more common and dangerous errors are GL-side: journal entries hitting cash accounts incorrectly, mispostings between funds, entries that should be cash but hit the wrong account. Two-way rec catches both. GAAP doesn't mandate a specific format, but AU-C 315 and COSO framework treat bank rec as fundamental internal control. ASC 230 implicitly requires GL cash to tie to balance sheet.
- **Affects:** Reconciliation data model must track items from both directions. UI shows two panels (bank unmatched, GL unmatched). GL-only items (D-015, D-019, D-023) are pre-configured as known GL-only categories.

### D-098: Ramp Credit Card — 1-Level Bank Reconciliation with Statement Cross-Check
- **Date:** 2026-02-13
- **Decision:** At the bank rec layer, match Ramp's single autopay settlement debit to a single GL entry. Individual Ramp transactions are already categorized in GL via Chunk 3 workflow. Separately, system performs a Ramp statement cross-check: sum of categorized Ramp transactions for the period must equal the settlement amount. Mismatch flags for investigation.
- **Rationale:** 2-level reconciliation (verifying individual Ramp charges sum to settlement at bank rec time) duplicates work already done in Chunk 3 expense workflow. 1-level keeps bank rec clean. The statement cross-check catches the specific risk of Ramp discrepancies (disputed charges, mid-cycle refunds, missing categorizations) without burdening the bank rec workflow.
- **Affects:** Chunk 3 must expose categorized Ramp transaction totals per period. Ramp statement cross-check is a separate validation, possibly a monthly report or dashboard widget.

### D-099: Reconciliation Sign-Off with Auditable Edit History
- **Date:** 2026-02-13
- **Decision:** Reconciliation has a formal completion action recording: who reconciled, when, and the reconciled balance. Previously reconciled items can be edited if errors are discovered, but changes require an explanatory note and are logged in audit trail. Consistent with D-045 (no period locking) but adds accountability.
- **Rationale:** Formal sign-off creates clear accountability (who said these numbers are right?). Edit capability is necessary because D-045 keeps all periods open — mistakes discovered later need correction. Required note + audit logging prevents silent changes to reconciled data. This is the same pattern as D-053 (transaction corrections via reversing entries) applied at the reconciliation level.
- **Affects:** Reconciliation data model needs sign-off metadata. Audit trail schema. UI for reconciliation history and edit flow.

### D-100: Escrow Account — Third Plaid Connection When Opened
- **Date:** 2026-02-13
- **Decision:** Security deposit escrow account (D-069) will be a third account at UMass Five, connected via Plaid when opened. Same reconciliation workflow applies. Per-tenant sub-tracking is a GL-level concern (D-069), not a bank rec concern. Plaid cost increases to $0.90/month.
- **Rationale:** Same bank, same integration pattern, minimal incremental cost. Bank rec sees escrow as just another account. The complexity of per-tenant tracking lives in the GL layer where D-069 already specifies pooled account with per-tenant ledger entries.
- **Affects:** Plaid token may need to support multiple accounts at same institution. Escrow rec may have different cadence than operating accounts (quarterly vs. monthly). D-069 and D-070 feed GL-only items into the two-way rec.

### D-101: Outstanding Items — Simple Status, No Aging Rules
- **Date:** 2026-02-13
- **Decision:** GL entries without a bank match appear as "outstanding" in the reconciliation view. Single status — no system distinction between outstanding checks vs. deposits in transit. No aging logic, no stale check flags, no system-enforced timeframes. User assesses staleness from the transaction date and voids through normal D-053 workflow if needed.
- **Rationale:** RI writes very few checks and has minimal outstanding item volume. System rules for aging/stale checks add complexity without value at this scale. The transaction date is visible; the user can make their own judgment. Consistent with the project's "personal software" philosophy (D-002) — don't build features for edge cases that can be handled manually.
- **Affects:** Reconciliation UI shows outstanding items with dates. No scheduled jobs or alerts for aging. Void workflow (D-053) handles stale items.

### D-102: Full History Rebuild from Account Origination
- **Date:** 2026-02-13
- **Decision:** Bank reconciliation starts from $0 balance at account origination, not from a mid-stream FY25/FY26 cutover balance. RI will rebuild full transaction history from when accounts were opened. Initial reconciliation round covers the entire history.
- **Rationale:** RI's bank accounts were opened when the company had $0 net cash, so starting balance is unambiguous. Total transaction count is small enough to make full rebuild feasible. Plaid provides up to 24 months of history on initial sync, covering RI's full operating period. This eliminates the D-033 conversion complexity for bank rec — no need to validate a mid-stream opening balance or carry forward unreconciled items from QBO.
- **Affects:** Initial Plaid sync should request maximum history. First reconciliation session will be larger than normal but is a one-time effort. Supersedes D-033 bank rec concerns (FY25 conversion is still relevant for GL balances but not for bank rec starting point).

### D-103: Multi-Transaction Matching with Bank Transaction Splitting
- **Date:** 2026-02-13
- **Decision:** Support 1:many matching (one bank transaction to multiple GL entries) and many:1 matching (multiple bank transactions to one GL entry). For 1:many, user can "split" a bank transaction into multiple lines, each assigned to a GL account and fund. Split lines must sum to the original bank transaction amount (system validates).
- **Rationale:** Key use case: outside property manager deposits net amount as single bank transaction (rents minus management fee). User needs to split into individual revenue lines per tenant plus expense line for management fee. Also covers: consolidated deposits (multiple tenant checks deposited together), batch payments. Many:1 is simpler — just linking multiple bank items to one GL entry (e.g., two partial payments against one invoice).
- **Affects:** Reconciliation data model must support one-to-many and many-to-one relationships between bank transactions and GL entries. Split workflow needs UI for adding lines, assigning accounts/funds, and validating totals. This is a significant UX feature — spec should detail the split interaction carefully.

### D-104: AR Timing — Handled by AR Aging Report, Not Bank Rec
- **Date:** 2026-02-13
- **Decision:** Bank reconciliation has no special AR logic. Tenant rent accrued in month N and received in month N+1 matches through normal bank→GL matching (DR Cash, CR AR). AR timing gaps are investigated through the AR aging report (D-026), not through bank reconciliation.
- **Rationale:** Bank rec's job is matching bank transactions to GL entries. When cash arrives, the GL entry (cash debit, AR credit) matches the bank deposit normally. The question of *why* cash hasn't arrived for a particular tenant is an AR aging concern, not a bank rec concern. Keeping these responsibilities separate avoids cluttering bank rec with AR context it doesn't need.
- **Affects:** Bank rec UI does not show AR-related metadata. AR aging report (D-026) is the primary tool for investigating slow-paying tenants.

### D-105: AHP Loan Interest Accrual — Known GL-Only Category
- **Date:** 2026-02-13
- **Decision:** Monthly AHP loan interest accrual (DR Interest Expense, CR Accrued Interest Payable per D-011) is a known GL-only item in the two-way reconciliation, same treatment as depreciation (D-019), opening balance (D-015), and loan forgiveness (D-023). Annual interest payment matches through standard bank→GL matching.
- **Rationale:** Interest accrual is a textbook GL-only entry — it exists to match expense to the period it's incurred, with no bank transaction until the annual payment. Pre-configuring it as a known GL-only category means it doesn't show up as an "unmatched GL item" every month during reconciliation.
- **Affects:** Two-way reconciliation config needs a list of known GL-only categories. AHP interest accrual joins: depreciation, opening balance equity, loan forgiveness.

### D-106: Plaid Pending Transactions — Informational Display, Not Matchable
- **Date:** 2026-02-13
- **Decision:** Pending transactions from Plaid are displayed in a separate section of the reconciliation view (visually distinct — greyed out or similar). They are not matchable to GL entries while pending. When they post (Plaid transitions them from `removed` to `added` with new transaction_id), they enter the normal matching queue.
- **Rationale:** Showing pending transactions helps users understand why a recent GL entry doesn't have a bank match yet ("it's still pending at the bank"). Not making them matchable avoids creating matches against items that might change amount or be reversed before posting. Best of both worlds: visibility without premature matching.
- **Affects:** Reconciliation UI needs a "pending" section. Plaid sync logic must track pending-to-posted transitions (existing `removed`/`added` mechanism handles this). No additional data model complexity — pending items are just bank_transactions with `pending = true`.

### D-107: Match Confidence Scoring — Exact Amount, ±3 Day Window, Merchant Tiebreaker
- **Date:** 2026-02-13
- **Decision:** Match suggestions use: (1) exact amount match (no fuzzy matching), (2) ±3 day window between GL entry date and bank transaction date, (3) merchant/payee name similarity as tiebreaker when multiple candidates exist. For split transactions (D-103), system also checks if unmatched GL entries sum to the bank transaction amount. Criteria refined after launch based on usage patterns.
- **Rationale:** Fuzzy amount matching is too risky for financial data — a $500 expense and a $500.50 bank fee are different transactions. Exact matching eliminates false positives. ±3 day window accounts for normal bank processing delays. Merchant name tiebreaker handles the case where two $1,200 rent deposits hit in the same week. Starting simple and iterating is consistent with the personal software approach (D-002).
- **Affects:** Matching engine implementation. Rule engine (D-095) stores match criteria per rule. Split matching (D-103) needs sum-check logic. Post-launch: analytics on match suggestion acceptance rate informs criteria tuning.

---

## Chunk 6: Board & Management Reporting Decisions (Session 2 — Gap Analysis)

### D-108: Security Deposit Register Report
- **Date:** 2026-02-13
- **Decision:** Per-tenant Security Deposit Register is report #22. Shows: deposit amount, date collected, escrow bank, interest rate, interest accrued/paid, tenancy anniversary, next interest due. Summary totals must reconcile to GL liability (Security Deposits Held) and escrow bank balance. 30-day anniversary alert.
- **Rationale:** MA G.L. c. 186 § 15B imposes treble damages for any non-compliance with security deposit rules. Compliance-grade per-tenant tracking with proactive anniversary alerts is essential.
- **Affects:** Extends D-069, D-070. Compliance calendar (D-065) also tracks anniversaries; this report provides the detail view.

### D-109: Compliance Calendar — Full Page + Dashboard Widget
- **Date:** 2026-02-13
- **Decision:** Compliance calendar (D-065 data) displayed as both a dedicated full-page view (filterable by type: tax, tenant, grant, budget) and a "next 30 days" summary widget on the dashboard home screen. Report #23.
- **Rationale:** Multiple deadline types (990 filing, Form PC, budget cycle, per-tenant interest, grant reviews, Schedule M) warrant a dedicated page. Dashboard widget ensures daily visibility.
- **Affects:** Extends D-065. Dashboard design (D-113).

### D-110: Universal Color-Coded Budget Variance
- **Date:** 2026-02-13
- **Decision:** Any report displaying a budget comparison column gets conditional color-coded variance highlighting. Universal application — P&L, fund-level P&L, property expense breakdown, capital budget summary, etc. Specific thresholds and color scheme deferred to spec.
- **Rationale:** Consistent visual treatment across all budget reports. Extends D-089.
- **Affects:** All reports with budget columns. Spec must define threshold values and color scheme.

### D-111: Capital & Financing Budget Summary Report
- **Date:** 2026-02-13
- **Decision:** Dedicated Capital & Financing Budget Summary (report #24) showing planned vs. actual for: loan draws, capital spending by fund, and debt service.
- **Rationale:** Capital and financing activities are balance sheet movements, not P&L items. Operating budget vs. actuals on the P&L covers operating needs; capital/financing needs its own view.
- **Affects:** Extends D-088. Chunk 7 must provide capital and financing budget data.

### D-112: Cash Projection Display — Auto-Fill + Manual Override
- **Date:** 2026-02-13
- **Decision:** Report #15 (cash projection) uses auto-fill + manual override pattern. Sections: starting cash (bank balances), expected inflows (rent from AR, grants from GR, budget revenue, manual "other"), expected outflows (payables, budget expenses, AHP interest, capital spending, manual "other"). Each line auto-populated with editable override. Adjustment notes visible. Monthly columns for 3 months. AHP available credit shown as informational context.
- **Rationale:** Data-grounded projection with human judgment on uncertain items. Adjustment notes provide audit trail for board questions.
- **Affects:** Extends D-060, D-091. Chunk 7 provides projection logic and pre-fill data; Chunk 6 provides display container and override mechanism.

### D-113: Dashboard Home Screen — Five-Section Composite View
- **Date:** 2026-02-13
- **Decision:** System landing page has five sections: (1) Cash snapshot (bank balances, net available cash), (2) Alerts/attention items (overdue rent, compliance deadlines, payroll deposits, unmatched bank transactions), (3) Rent collection this month (billed vs. collected by unit), (4) Fund balances (restricted vs. unrestricted, per-fund), (5) Recent activity (last 5-10 transactions). Each section links to full report.
- **Rationale:** Most-used screen in the system. Must answer "what do I need to know right now?" at a glance.
- **Affects:** References reports #5, #6, #8, #9, #18, #23.

### D-114: No Role-Based Report Views
- **Date:** 2026-02-13
- **Decision:** All users see the same home screen, reports, and data. No role-based filtering or restricted views. Consistent with D-006 (all users fully trusted, all-or-nothing access).
- **Rationale:** 3-person board with full trust. Role-based views add complexity for zero benefit.
- **Affects:** Simplifies UI — one view, one codebase. No permission logic in reporting layer.

### D-115: PDF + CSV Export, Manual Board Pack Delivery
- **Date:** 2026-02-13
- **Decision:** All reports exportable as PDF (formatted) and CSV (raw data). Board pack generated manually by Heather on demand — no automated generation or email distribution.
- **Rationale:** CSV covers CPA "give me the data" use case. Manual delivery is appropriate for a quarterly task with a 3-person board. Compliance calendar email reminders (D-065) are the only automated delivery.
- **Affects:** Extends D-056 (adds CSV alongside PDF).

### D-116: 990-Format Toggle on Functional Expense Report
- **Date:** 2026-02-13
- **Decision:** Statement of Functional Expenses (report #4) has GAAP format (RI chart of accounts rows) and 990 format (IRS Part IX 23 line items rows) toggle. Same data, same functional allocation, different row groupings. 990 format uses D-062 `form_990_line` field.
- **Rationale:** One report, two views. CPA gets 990 format for filing; board gets GAAP format for statements.
- **Affects:** Depends on D-061 (allocation) and D-062 (990 mapping).

### D-117: Payroll Reports — Five Reports Added
- **Date:** 2026-02-13
- **Decision:** Five payroll reports (#25-29): Payroll Register, Tax Liability Summary, W-2 Verification, Employer Cost Summary, Quarterly 941/M-941 Prep. Added because D-068 restored payroll to v1.
- **Rationale:** In-house payroll requires operational reports for verification, compliance, and cost management.
- **Affects:** Chunk 3 payroll processing must produce the data. Updates D-059 scope from 21 to 29 reports.

### D-118: Integration Architecture — Database-Mediated, Not API-Mediated
- **Date:** 2026-02-13
- **Decision:** Internal app integrations (renewal-timesheets, expense-reports-homegrown) communicate with financial-system via shared database access, not REST APIs. Financial-system owns its database. Source apps get a restricted Postgres role with: (1) SELECT on reference tables (GL accounts, funds, vendors) for populating dropdowns and autocomplete, (2) INSERT + SELECT on a staging table for submitting approved financial data and reading back processing status. Financial-system processes staged records into GL entries and updates status (received → posted → matched to payment → paid). Source apps read status back to surface payment/posting updates to their users. No UPDATE or DELETE granted to source apps. External integrations (Ramp, Plaid) are accessed via their own APIs directly by financial-system — they do not use the staging pattern.
- **Rationale:** REST APIs between internal apps add unnecessary complexity for a 2-5 user system where all apps already use Postgres. The only existing inter-app "API" (payroll data on auth portal) isn't in production yet, so there's no established REST pattern to follow. Database-mediated integration is simpler: no API endpoints to build/maintain, no serialization overhead, live reference data without sync. The staging table provides a natural audit trail and a clean security boundary — source apps can only INSERT financial summaries (not receipts, metadata, or work-in-progress data), and financial-system controls all processing and status updates. Read-only access to reference tables lets source apps populate GL account and fund dropdowns without any API layer.
- **Alternatives Considered:**
  - REST APIs over HTTPS (Option A): Each app calls HTTP endpoints. Standard but adds code to build, authenticate, and maintain on both sides. Overkill at this scale.
  - Shared database with full access (rejected): Security risk — source apps could edit or delete financial data.
  - Financial-system pulls from source app databases (Option 3): Elegant but requires financial-system to understand source app schemas, which couples them.
- **Affects:** Chunk 8 (all internal integration contracts use this pattern). Timesheets and expense-reports apps need code changes to write to staging table and read from reference tables/status. Staging table schema design deferred to spec phase. Ramp and Plaid integrations unaffected (they use external APIs).

### D-119: Dual Compensation Model — Per-Task Rates and Salaried Hourly Rate
- **Date:** 2026-02-13
- **Decision:** The People API (internal-app-registry-auth) stores a compensation type per employee: `PER_TASK` or `SALARIED`. For salaried employees, the People API also stores annual salary and expected annual hours (default 2,080, editable). The People API calculates the hourly rate (salary ÷ expected hours) and passes the pre-calculated hourly rate to renewal-timesheets — not the salary itself. For per-task employees, the existing task code rate system applies (each task code has its own hourly rate with effective dates). Renewal-timesheets uses the compensation type to determine which rate to apply when calculating gross pay at approval time.
- **Rationale:** The current timesheets app was built for youth workers (ages 12-17) with per-task agricultural/non-agricultural rates. Adult salaried employees (Heather, Jeff) work differently — one rate regardless of task. The compensation model is an employee attribute, so the People API is the right place for it. Passing the pre-calculated hourly rate (not salary) to timesheets keeps salary data out of the timesheets app and simplifies the calculation.
- **Affects:** internal-app-registry-auth (new People API fields: compensation_type, annual_salary, expected_annual_hours). renewal-timesheets (receive hourly rate from People API, updated calculation logic). Chunk 8 staging table (receives calculated earnings regardless of which model produced them). Chunk 3 (payroll processing starts from gross earnings in staging table).

### D-120: Overtime Exempt Status — Per-Employee Field in People API
- **Date:** 2026-02-13
- **Decision:** The People API stores an exempt_status per employee: `EXEMPT` or `NON_EXEMPT`. This is passed to renewal-timesheets along with the hourly rate. Timesheets calculation logic applies overtime rules (1.5× for hours over 40/week) only for non-exempt employees. Exempt employees get straight-time regardless of hours worked.
- **Rationale:** Overtime applicability is a per-employee attribute determined by job duties and salary level (FLSA rules). The People API is the right place for this since it's part of the employee's compensation profile. Timesheets needs this to calculate gross pay correctly at approval time.
- **Affects:** internal-app-registry-auth (new People API field: exempt_status). renewal-timesheets (updated overtime calculation logic — check exempt status before applying OT). Staging table (overtime hours/earnings will be zero for exempt employees).

### D-121: Timesheet Staging — Approval Trigger, Per-Fund Aggregation
- **Date:** 2026-02-13
- **Decision:** When a supervisor approves a timesheet in renewal-timesheets, the app immediately INSERTs summary records into the financial-system staging table. Records are aggregated by fund — one staging row per fund per approved timesheet. Each row includes both hours (regular + overtime) and dollars (regular earnings + overtime earnings + total). Entry-level detail (individual time entries with start/end times, task codes, compliance checks) stays in the timesheets database and is available for audit if needed. Fund allocation is per time entry — each entry in renewal-timesheets gets a funding source selection (defaults to Unrestricted Fund per D-024). The staging aggregation rolls up all entries for the same fund within one timesheet.
- **Rationale:** Approval is the natural trigger — it's the moment the data is verified and ready for financial processing. Per-fund aggregation gives financial-system what it needs (dollars and hours by fund) without flooding the staging table with individual 30-minute time entries. Aggregating both hours and dollars provides flexibility — hours for labor reporting, dollars for GL posting. Entry-level detail is a timesheets concern, not a financial-system concern.
- **Affects:** renewal-timesheets (fund selection per time entry, aggregation logic on approval, INSERT to staging table). Financial-system staging table schema (must support per-fund rows with hours and dollar amounts). Chunk 3 (payroll processing picks up staged records, fetches withholding data from People API, calculates net pay, creates GL entries).

### D-122: Expense Report Staging — Per-Line-Item, No Receipts, No QBO
- **Date:** 2026-02-13
- **Decision:** When an admin approves an expense report in expense-reports-homegrown, the app immediately INSERTs one staging row per expense line item into the financial-system staging table. Each row includes: employee ID, expense report reference, date incurred, amount, merchant, memo, GL account code, fund ID, expense type (out_of_pocket or mileage), and mileage details if applicable. Receipt URLs, thumbnails, AI confidence data, email receipt metadata, and all other operational data stay in the expense-reports database — financial-system does not need them. Verification evidence lives in the source app and is available for audit there. All QBO-related artifacts in expense-reports-homegrown (qboBillId field, QBO API integration, category/project mappings to QBO) should be deprecated and removed. The financial-system integration fully replaces QBO.
- **Rationale:** Per-line-item granularity is necessary because each expense has its own GL account, fund, amount, and date — financial-system needs to create individual GL entries per expense. Unlike timesheets (which aggregate hours into dollar totals by fund), expense items are already in dollars and each one represents a distinct financial event. Receipt and attachment data is an expense-reports operational concern, not a financial posting concern. QBO is being fully replaced by the in-house financial system; retaining QBO artifacts creates confusion and technical debt.
- **Affects:** expense-reports-homegrown (INSERT per line item on approval, deprecate all QBO integration code and fields, rename projectId/projectName to fundingSourceId/fundingSourceName, add GL account selection field populated from financial-system reference tables). Financial-system staging table (must support per-line-item expense rows with GL account + fund). Chunk 3 (expense processing creates GL entries: DR expense account, CR Reimbursements Payable).

### D-124: Employee Data Source of Truth — internal-app-registry-auth Owns, Others Read via DB
- **Date:** 2026-02-13
- **Decision:** internal-app-registry-auth (app-portal) is the single source of truth for all employee data, including PII (tax IDs, SSNs), compensation profiles (D-119, D-120), and withholding elections. New hires are set up in the app-portal. Financial-system and renewal-timesheets access employee data via read-only database access to the auth portal's employee/payroll tables — not via the REST API. The existing REST API (employee-payroll-data-spec.md) is deprecated in favor of direct database reads with restricted Postgres roles, consistent with D-118's database-mediated integration pattern. Neon's built-in encryption and access controls provide sufficient PII protection for RI's scale.
- **Rationale:** D-118 established database-mediated as the integration pattern for internal apps. Applying the same pattern to employee data is simpler and more consistent than maintaining a separate REST API that isn't in production yet. Direct DB reads eliminate API code to build and maintain on both sides. The auth portal already has the data; giving consumers read-only access is the most direct path. Neon provides encryption at rest, TLS in transit, and role-based access — sufficient for a 2-5 person nonprofit.
- **Affects:** internal-app-registry-auth (provision read-only Postgres roles for financial-system and renewal-timesheets on employee/payroll tables). financial-system (reads employee master data directly from auth portal DB for withholding calculations — no API client needed). renewal-timesheets (reads compensation type, hourly rate, exempt status directly from auth portal DB). employee-payroll-data-spec.md (deprecated — REST API no longer needed). Resolves OQ-001 from dependencies.md.

### D-123: Ramp Integration — API with Daily Polling
- **Date:** 2026-02-13
- **Decision:** Financial-system integrates with Ramp via their REST API using daily scheduled polling (same cadence as Plaid bank sync per D-094). Transactions pulled from Ramp API land in the existing Ramp pending queue (D-021) for categorization before GL posting. Refund/reversal handling and other API-specific mechanics deferred to spec/build phase.
- **Rationale:** API is cleaner than CSV export and Ramp provides developer API access. Daily polling matches the Plaid pattern (D-094) and is sufficient for RI's low transaction volume (est. 20-50/month). Webhooks add infrastructure complexity without meaningful benefit at this scale. Implementation details (authentication, pagination, refund representation) are build-phase concerns.
- **Affects:** Chunk 8 (Ramp API client implementation). Chunk 3 (categorization queue and rule engine per D-095). Chunk 4 (bank rec cross-check per D-098).

### D-125: Integration Error Handling — DB Constraints + Sync Failure Alerts
- **Date:** 2026-02-13
- **Decision:** Error handling for integrations follows two patterns: (1) Internal staging INSERTs rely on Postgres mechanisms — FK constraints catch invalid GL accounts/funds, unique constraints on (source_app, source_record_id) prevent duplicate submissions, database transactions ensure atomicity of financial-system processing (GL entry creation + status update). Source apps get immediate database errors on failed INSERTs and can surface them to users. (2) External API sync failures (Ramp, Plaid daily polling) trigger a dashboard notification and email alert. Failed syncs retry on the next daily poll — no data loss since transactions persist in the external system. Detailed error handling mechanics (retry strategies, dead letter patterns, specific error messages) deferred to spec/build phase.
- **Rationale:** The database-mediated pattern (D-118) makes most error handling automatic — Postgres constraints and transactions handle integrity. External API failures are the only case needing explicit alerting, and dashboard + email is sufficient for a system where Jeff is the primary operator. Further error handling detail is implementation, not discovery.
- **Affects:** Chunk 8 (staging table constraints, alert infrastructure). Chunk 6 (dashboard notification widget per D-113). Email delivery service (sync failure alerts).

### D-126: Email Delivery — Postmark for Outbound
- **Date:** 2026-02-13
- **Decision:** Financial-system uses Postmark for all outbound email: donor acknowledgment letters (D-038) and operational alerts (D-125 sync failure notifications). Postmark is already used by renewal-timesheets for transactional email.
- **Rationale:** Keeps it simple. Postmark is already in the ecosystem (renewal-timesheets uses it), reliable for transactional email, and RI's email volume is minimal (handful per month).
- **Affects:** Chunk 2 (donor acknowledgment letter generation + delivery). Chunk 8 (sync failure alert emails). Deployment (Postmark API key in environment variables).

### D-127: Depreciation Policy — Straight-Line, IRS Standard Lives, No Accelerated Methods
- **Date:** 2026-02-13
- **Decision:** RI uses straight-line depreciation at IRS-standard useful lives for all assets. No accelerated methods (200% DB, 150% DB). No Section 179 expensing. No bonus depreciation. This is an organizational-level policy position applied to all current and future assets.
- **Rationale:** RI is a 501(c)(3) nonprofit exempt from federal income tax. The entire universe of accelerated depreciation options (Section 179, bonus depreciation, MACRS accelerated methods) exists as tax incentives to reduce taxable income — RI has no taxable income to reduce. Conservative depreciation (longest useful lives, straight-line) produces: (1) higher book value of assets = stronger balance sheet for funders and lenders, (2) better insurance basis documentation, (3) simpler accounting with predictable monthly entries, (4) no need to track annually changing acceleration rules. There is no benefit to RI from accelerating depreciation and positive benefit from keeping asset values higher longer.
- **HTC exception:** When the Historic Tax Credit deal is structured (D-081), the for-profit investor partner may use accelerated depreciation for their tax benefit. That is the investor's accounting within the partnership/LLC, not RI's. RI's books use straight-line regardless.
- **Affects:** Simplifies D-019 (depreciation automation — only straight-line needed). Simplifies D-080 (building components all use straight-line). Reduces scope of annual compliance calendar depreciation review to "did IRS change standard useful lives?" rather than "which acceleration method is optimal?"

### D-128: AI Depreciation Assistant (D-020) Superseded by System-Wide AI Copilot
- **Date:** 2026-02-13
- **Decision:** The standalone AI Depreciation Assistant described in D-020 is superseded. There will be no bespoke depreciation AI feature. Instead, the depreciation setup form gets context-aware copilot support as part of the system-wide AI copilot pattern (D-129). The copilot on the depreciation/fixed asset form has access to: current form state, asset register, IRS publication search tools. For the building (the one complex asset), the copilot helps think through components and standard useful lives. For equipment/vehicles, it's a simple form with minimal copilot interaction needed.
- **Rationale:** D-127 (straight-line only, no accelerated methods) eliminates most of the complexity that originally justified a dedicated AI depreciation assistant. With a fixed policy of "straight-line at IRS standard lives," depreciation setup reduces to: asset name, cost, date placed in service, asset type → lookup standard useful life → done. The remaining value of AI guidance (component identification for the building, standard useful life lookup) is better served by the general copilot pattern than a custom-built feature.
- **What remains from D-020:** (1) The form model for asset setup (structured inputs, not conversational). (2) A sidebar copilot (per D-129) with page context + IRS search access. (3) Annual compliance calendar check for IRS rule changes (triggered by D-065 compliance calendar, executed by copilot with web search tools).
- **Affects:** D-020 scope notes ("full discovery deferred") are now resolved — no further depreciation AI discovery needed. GL-P1-001 in spec is replaced by the copilot pattern. D-019 mechanical automation (monthly GL posting) unchanged.

### D-129: System-Wide AI Copilot — Architectural Pattern
- **Date:** 2026-02-13
- **Decision:** Every screen in the financial-system UI includes a right-panel chatbot (AI copilot) with: (1) page-specific context (understands what the page is, its inputs, how data is constructed and shaped), (2) connections to relevant knowledge sources (varies by page), and (3) access to a configurable toolkit of capabilities. Rather than building bespoke AI features per domain (depreciation helper, transaction entry helper, categorization assistant), the system provides one copilot that adapts to context.
- **Design approach:** The copilot does not receive page-specific hardcoded instructions. Instead, each page defines a "context package" that specifies: (a) what data/state to share with the copilot, (b) what tools/skills are available (e.g., IRS publication search, GL account lookup, vendor history), (c) what knowledge resources are relevant. The copilot uses general intelligence plus context to provide useful help. The list of available tools/resources grows over time as the system is built.
- **Example context packages:**
  - Fixed asset form: form state, asset register, IRS publication search, standard useful life lookup table
  - Ramp categorization queue: transaction details, GL chart of accounts, categorization rule history, merchant patterns
  - PO/vendor invoice: contract details, compliance warnings, budget remaining by fund
  - Compliance calendar: current deadlines, web search for regulatory updates
  - Bank reconciliation: unmatched items, matching rules, transaction history
- **Tooling approach:** Tools are defined generically (e.g., "search IRS publications" implies web fetch or search capability, not a hardcoded URL). Spec for each page considers what context is relevant and what tooling the copilot needs. Tooling should be capability-based (web search, database query, document lookup) not implementation-specific.
- **Cross-application access (v2):** In a future version, the copilot could access data across the full application family (timesheets, expense reports, payroll/people, auth portal). v1 scope: copilot operates within financial-system data only.
- **Rationale:** Bespoke AI features (D-020 depreciation assistant, D-028 transaction entry assistant) are harder to build, maintain, and extend than a single copilot with configurable context. The copilot pattern scales: new pages get AI support by defining a context package, not by building a new AI feature. Users get consistent interaction (always a right-panel chat) rather than learning different AI interfaces per workflow.
- **Affects:** Supersedes D-020 (AI Depreciation Assistant) via D-128. Supersedes D-028's AI Transaction Entry Assistant concept via D-130. Impacts every chunk's spec phase — each page/screen specification should include a "copilot context package" section defining what data, tools, and knowledge resources the copilot gets on that page.

### D-130: AI Transaction Entry Assistant (D-028) Absorbed into Copilot Pattern
- **Date:** 2026-02-13
- **Decision:** The standalone AI Transaction Entry Assistant described in D-028 and elaborated in the Chunk 3 Session 5 Ramp categorization workflow and the dependencies.md "Deferred Cross-Chunk Features" section is absorbed into the system-wide copilot pattern (D-129). There will be no bespoke transaction entry AI feature. Instead, pages where transaction entry occurs (manual GL entry, Ramp categorization, bank feed matching, PO invoice processing) get copilot context packages with relevant tools: GL account suggestions, memo writing assistance, amortization schedule setup, vendor pattern matching, fund allocation guidance.
- **Rationale:** The copilot pattern (D-129) provides the same capabilities with better architecture. The transaction entry assistant's value propositions — asking context-appropriate questions, writing detailed memos, setting up amortization/deferral schedules, handling edge cases — are all deliverable through a copilot with the right context package (transaction data, GL structure, historical patterns, amortization rules). Building this as a separate AI feature duplicates infrastructure and creates a different UX from the rest of the system.
- **What remains from D-028:** (1) The GL structure (Prepaid Expenses, Accrued Expenses Payable, Deferred Revenue) is unchanged. (2) The principle of "simple GL accounts + detailed memos" is unchanged. (3) The copilot on transaction entry pages gets tools for memo generation, amortization calculation, and account suggestion — delivering the same user value through the general pattern.
- **Chunk 3 impact:** Session 5 Ramp categorization workflow (AI auto-suggestions, user-defined rules, batch categorization) remains valid as the UX design for that page. The "AI" piece becomes the copilot's context on that page rather than a standalone feature. Rule engine and auto-suggestion logic are system features (not copilot features) that the copilot can explain and help configure.
- **Affects:** D-028 scope notes updated. Dependencies.md "Deferred Cross-Chunk Features" section for AI Transaction Entry Assistant is resolved. Chunk 3 spec should reference copilot pattern (D-129) instead of standalone AI assistant.

### D-131: Deployment Topology — Same Stack as Existing Apps (Vercel + Neon)
- **Date:** 2026-02-13
- **Decision:** Financial-system deploys on the same stack as the existing RI apps: Vercel for hosting and serverless functions, Neon (Vercel Postgres) for the database. No special infrastructure is required for the expanded scope. Scheduled jobs (daily Plaid sync per D-094, daily Ramp sync per D-123, monthly depreciation automation per D-019, compliance calendar reminders per D-065) run via Vercel's cron capability or equivalent. The AI copilot (D-129) connects to the Anthropic API via server-side proxy. Secrets (API keys for Anthropic, Plaid, Ramp, Postmark; database connection strings) are managed through standard environment variables. Cross-database access mechanics (how financial-system reads from auth portal's Neon DB, how source apps read/write financial-system's Neon DB per D-118/D-124) are implementation details to be resolved during spec/build — the integration pattern is decided, the Neon-specific connectivity approach is not.
- **Rationale:** Nothing in the financial-system's scope (copilot, cross-DB reads, API polling, cron jobs) requires a fundamentally different hosting approach from the existing apps. Vercel + Neon handles all of it. The one area that needs implementation-phase attention is cross-Neon-project database connectivity — Neon projects are isolated by default, so the "restricted Postgres role" concept from D-118 may translate to cross-project connection strings rather than roles within a single cluster. This is a design option to explore during spec, not a discovery-level architectural decision.
- **Affects:** All chunks (deployment target confirmed). Chunk 8 spec (must address Neon cross-project connectivity mechanics). No impact on any prior decisions.
