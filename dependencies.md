# Cross-Chunk Dependencies & Interdependencies

*Single unified document tracking how decisions and discoveries in one chunk impact other chunks. Grows as each chunk goes through discovery and spec phases.*

*Updated during each chunk's discovery phase. Referenced during each chunk's spec phase to ensure all upstream and downstream impacts are considered.*

---

## How to Use This File

**During Discovery (🟡 status):**
When your chunk makes a decision that impacts other chunks, or discovers a dependency on another chunk's work:
1. Find or create your chunk section below
2. Add the decision/discovery with:
   - **Decision ID** (e.g., D-025)
   - **What we decided/discovered**
   - **Chunks affected** (list which chunks this impacts)
   - **Specific impact** (1-2 sentences on what downstream chunks need to know/do)
3. Cross-reference any dependencies on upstream chunks

**During Spec Phase (🟢 status):**
Before writing your chunk spec:
1. Read your chunk's section below
2. Verify all cross-chunk impacts are accounted for in your spec
3. If a dependency is on another chunk that hasn't started discovery yet (🔴), defer that aspect and note it
4. Reference this document in your spec file (e.g., "See cross-chunk-dependencies.md for Chunk X impacts on this design")

**For reviewers / project leads:**
1. Read your chunk section to understand what it impacts elsewhere
2. Scan all chunks to see the full dependency graph
3. Identify potential conflicts or sequencing issues

---

## Chunk 1: Core Ledger / Chart of Accounts

### D-012: Program Classes — Single "Property Operations"
- **Status:** ✅ Decided
- **Impacts:** Chunk 3, Chunk 5, Chunk 6
- **What Chunk 3 needs:** No functional split at GL account level (program/admin/fundraising). Allocation happens at year-end for 990 prep. Expense categorization system must support this "defer allocation" model.
- **What Chunk 5 needs:** Functional split allocation policy and mechanics for 990 Line 24.
- **What Chunk 6 needs:** Board reporting shows program/admin/fundraising split (derived from GL, not from transaction-level categories).

### D-013: Full Fund Accounting from Day One
- **Status:** ✅ Decided
- **Impacts:** Chunk 2, Chunk 3, Chunk 6, Chunk 7, Chunk 8
- **What Chunk 2 needs:** Revenue tracking must assign each transaction to a fund. AR, donations, grants all have fund attribution.
- **What Chunk 3 needs:** Expense tracking must assign transactions to funds. Timesheets default to Unrestricted (D-024). Payroll, Ramp, expense reports all code to funds.
- **What Chunk 6 needs:** All financial statements (P&L, Balance Sheet, Cash Flow) report by fund. Board sees General Fund vs. AHP Fund vs. future restricted funds separately.
- **What Chunk 7 needs:** Budgeting is fund-level (General Fund budget vs. AHP Fund budget, etc.).
- **What Chunk 8 needs:** API contracts with integration sources (timesheets, expense reports, Ramp) must include fund/task code mapping.

### D-014: Net Assets Split — With/Without Donor Restrictions
- **Status:** ✅ Decided
- **Impacts:** Chunk 2, Chunk 5, Chunk 6
- **What Chunk 2 needs:** When restricted grants arrive post-closing, they increase "Net Assets With Donor Restrictions." Revenue tracking must classify each grant as restricted or unrestricted at entry.
- **What Chunk 5 needs:** 990 reporting requires net assets split. Chunk 5 must specify GL mechanics for moving net assets from restricted to unrestricted as grants are expended (important 990 complexity).
- **What Chunk 6 needs:** Balance sheet shows both net asset accounts separately. Board understands restricted vs. unrestricted equity.

### D-015: Opening Balance Equity — AHP In-Kind Contribution
- **Status:** ✅ Decided
- **Impacts:** Chunk 4 (bank recon)
- **What Chunk 4 needs:** Opening balance is $12,835 (AHP contribution offset by expense). When reconciling opening balances to bank and receivables, this entry has no bank counterpart (GL-only entry).

### D-016: Capital Cost Coding — Fund-Level Tagging, Details Deferred
- **Status:** ✅ Decided (GL structure decided, detail deferred)
- **Impacts:** Chunk 5, Chunk 6
- **What Chunk 5 needs:** Once Chunk 5 researches funder substantiation requirements (Historic Tax Credit, historic tax credit, CDBG if applied for), it will specify detailed cost codes (e.g., "Building — Gable Restoration" vs. "Building — HVAC"). GL can be retrofitted without redesign.
- **What Chunk 6 needs:** Fund-level capital reporting (how much have we spent on Easthampton building infrastructure?). Details TBD.

### D-017: Employee Master Data in app-portal
- **Status:** ✅ Decided → ✅ **Implemented (D-132)**
- **Impacts:** Chunk 3, Chunk 8
- **What Chunk 3 needs:** Payroll entry generation depends on fetching employee data (name, tax IDs, withholding elections, pay frequency) from app-portal's `employee_payrolls` table via direct DB read (D-124).
- **What Chunk 8 needs:** ~~Must design/enhance app-portal API to provide employee data. Separate spec: employee-payroll-data-spec.md (TBD).~~ **DONE (D-132).** People Service schema and API built in app-portal. DB tables: `people`, `employee_payrolls`, `people_audit_logs`. Tax IDs encrypted with AES-256-GCM. Access: financial-system and timesheets read via restricted Postgres roles (D-124); app-portal admin UI uses REST API (`/api/v1/people/`). ~~employee-payroll-data-spec.md~~ archived.
- **Remaining work:** Add D-119/D-120 compensation fields (`compensation_type`, `annual_salary`, `expected_annual_hours`, `exempt_status`) to `people` table before timesheets integration build.

### D-018: Payroll GL — Single "Salaries & Wages" Account, Year-End Allocation
- **Status:** ✅ Decided
- **Impacts:** Chunk 3, Chunk 5, Chunk 6
- **What Chunk 3 needs:** All payroll entries (hourly timesheets, bonuses, etc.) post to single GL account. No transaction-level functional split. Timesheet integration must support this.
- **What Chunk 5 needs:** Year-end allocation policy to split Salaries & Wages by Program/Admin/Fundraising for 990 prep. At RI's scale (2-5 people, mixed roles), allocation may be a worksheet or journal entry.
- **What Chunk 6 needs:** Payroll reporting shows year-end functional split (derived from allocation, not from GL detail).

### D-019: Depreciation GL Structure — Assets, Accumulated Depreciation, Monthly Automation
- **Status:** ✅ Decided
- **Impacts:** Chunk 4, Chunk 6
- **What Chunk 4 needs:** Depreciation is monthly GL entry (no bank transaction). Reconciliation must accommodate GL-only entries.
- **What Chunk 6 needs:** Board sees depreciation expense on P&L, accumulated depreciation on balance sheet. Fixed asset schedule in notes to financials.

### D-020: AI Depreciation Assistant — **SUPERSEDED by D-128/D-129**
- **Status:** ✅ Superseded
- **Impacts:** None — replaced by system-wide copilot pattern (D-129)
- **Notes:** Standalone AI depreciation assistant no longer being built. D-127 established straight-line-only depreciation policy for RI (nonprofit, no tax benefit from acceleration). D-128 formally superseded D-020. The fixed asset setup form gets copilot support (D-129) like every other page — copilot has access to form state, asset register, IRS publication search, standard useful life lookup table. See GL-P1-001 in spec (updated).

### D-021: Ramp Credit Card Integration — GL Structure in Chunk 1, Workflow in Chunk 8
- **Status:** ✅ Decided (split scope)
- **Impacts:** Chunk 4, Chunk 8
- **What Chunk 8 needs:** Ramp API integration, transaction queue (pending/closed status), categorization workflow, rule engine. Transactions post to GL only after "closed" status.
- **What Chunk 4 needs:** Ramp card purchases appear in bank statement and must match GL (Credit Card Payable account). Reconciliation must account for timing (Ramp shows transaction, bank delays posting).

### D-022: AHP Loan Structure — Only Drawn Amount is Liability
- **Status:** ✅ Decided
- **Impacts:** Chunk 4, Chunk 6, Chunk 7
- **What Chunk 4 needs:** Loan draws appear in bank deposits and must match GL entries (Debit Bank, Credit Loan Payable). Available credit is tracked separately, not in GL.
- **What Chunk 6 needs:** Balance sheet shows Loan Payable ($100K as of FY25). Note disclosure: "Credit facility up to $3.5M; drawn $100K; available $3.4M."
- **What Chunk 7 needs:** Available credit is a planning/contingency resource (if we draw $1M, we can do X). Not assumed spending unless drawn.

### D-023: Loan Forgiveness — Treated as Donation Income
- **Status:** ✅ Decided
- **Impacts:** Chunk 4, Chunk 5, Chunk 6
- **What Chunk 4 needs:** Loan forgiveness is GL-only (no bank transaction). Entry: Debit Loan Payable, Credit Donation Income. Must be documented in GL with AHP's written notice.
- **What Chunk 5 needs:** IRS compliance verification. Loan forgiveness increases net assets and counts as contribution for public support test (170(b)(1)(A)(vi) calculations). RI must maintain documentation showing "no goods/services in return."
- **What Chunk 6 needs:** Loan forgiveness events appear on P&L as income (increasing net assets). Board visibility into when/how much forgiveness occurred.

### D-024: GL Entry Validation — Selective Enforcement
- **Status:** ✅ Decided
- **Impacts:** Chunk 3, Chunk 8
- **What Chunk 3 needs:** Timesheet entry defaults to Unrestricted Fund; user can override via Task Code. Expense reports and payroll must respect this rule.
- **What Chunk 8 needs:** Ramp transactions MUST categorize before posting (stay in pending queue until categorized). Rental income entries MUST identify funding source (strict validation). Other transactions are warned but allowed.

### D-025: Rental Income Recognition — Accrual Basis When Due
- **Status:** ✅ Decided
- **Impacts:** Chunk 2, Chunk 4, Chunk 6
- **What Chunk 2 needs:** AR is generated on the due date (month N), not payment date (month N+1). Revenue recognition timing is independent of payment method (tenant, VASH, MVRAP). Revenue tracking system must generate AR accruals on a schedule.
- **What Chunk 4 needs:** AR reconciliation to bank deposits may show gaps (AR from month N, cash from month N+1). System must support AR aging analysis to explain gaps.
- **What Chunk 6 needs:** P&L shows accrued rental income (month N revenue). Balance sheet shows AR (amounts due but not received). Board understands RI's financial position reflects earned rent, not received rent.

### D-026: AR Tracking Granularity — By-Tenant/Unit
- **Status:** ✅ Decided
- **Impacts:** Chunk 2, Chunk 4, Chunk 6
- **What Chunk 2 needs:** AR data model tracks (Unit #, Tenant, Amount Due, Due Date, Funding Source). Aging reports break out by unit (30/60/90+ days). Alerts fire at unit level (Unit 5 paid $500 of $1,000 expected).
- **What Chunk 4 needs:** AR reconciliation can match bank deposits to specific units. Variance analysis shows which units are slow-paying or partially paying.
- **What Chunk 6 needs:** AR aging report on balance sheet. Board sees "total AR $X by age bucket" and can drill to unit level if needed.

### D-027: Rent Adjustments & Forgiveness — Separate GL Accounts + Annotation
- **Status:** ✅ Decided
- **Impacts:** Chunk 2, Chunk 4, Chunk 5, Chunk 6
- **What Chunk 2 needs:** Adjustment entry form requires mandatory annotation (reason, approver, date). GL accounts separate by type (Proration, Hardship, Vacate). System tracks adjustments separately from core rent for trend analysis.
- **What Chunk 4 needs:** Adjustments may reduce AR (if tenant owes and adjustment is recorded) or reduce cash (if already collected and adjustment is refund). Reconciliation must account for adjustment types.
- **What Chunk 5 needs:** MA landlord-tenant law requires documentation of adjustments (especially vacate refunds and security deposit deductions). Chunk 5 will specify legal framework and approval workflows.
- **What Chunk 6 needs:** Adjustment reporting shows trends (3 hardship adjustments this quarter). Rental income P&L shows core rent vs. adjustments separately.

### D-028: Prepaid Expenses & Accrued Liabilities — Simple GL Structure with Copilot-Enhanced Entry
- **Status:** ✅ Decided (GL structure finalized; AI assistant **absorbed into copilot pattern per D-130**)
- **Impacts:** Chunk 2, Chunk 3
- **What Chunk 2 needs:** Deferred Revenue account handles prepaid rent from tenants/FVC and grant revenue received but not yet earned. Revenue recognition timing must respect deferral mechanics.
- **What Chunk 3 needs:** Prepaid Expenses and Accrued Expenses Payable accounts handle timing mismatches (insurance paid early, reimbursements owed). Expense entry workflow must support prepaid/accrual questions and amortization setup.
- **AI approach (D-129, D-130):** The standalone AI Transaction Entry Assistant is no longer a separate feature. Instead, transaction entry pages get system-wide copilot support with context-appropriate tools: transaction data, GL structure, historical patterns, amortization calculation, memo generation. The copilot asks clarifying questions and suggests memos through the standard right-panel chat, not a custom-built feature.
- **GL Accounts:** Prepaid Expenses (asset), Accrued Expenses Payable (liability), Deferred Revenue (liability).
- **Key principle:** Keep chart of accounts simple (3 accounts instead of 10+), capture detail in transaction memos, use copilot to ensure memo consistency. Drill-down transaction reports provide detail when needed.

### D-029: Restricted Net Assets Release — Automatic on Fund-Coded Expense
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 3, Chunk 5, Chunk 6
- **What Chunk 1 needs:** GL posting logic must automatically generate release entries when expenses are coded to restricted funds. When expense posted to restricted fund → system generates: DR: Net Assets With Donor Restrictions, CR: Net Assets Without Donor Restrictions (same amount as expense).
- **What Chunk 3 needs:** Expense entry workflow must code expenses to funds (already required by D-013). System automatically generates release entries based on fund coding — no user action needed.
- **What Chunk 5 needs:** Multi-year grant spend-down tracking (e.g., "$250K over 3 years, must spend $50K/year minimum") is a compliance monitoring issue, not a GL constraint. Chunk 5 must specify how to track whether RI is on pace with funder timing requirements (dashboard, alerts, periodic review). GL will correctly show cumulative spending; Chunk 5 adds compliance layer.
- **What Chunk 6 needs:** Fund-level spending reports show draw-down against restricted grants (e.g., "SARE Fund: $250K awarded, $50K spent, $200K remaining restricted"). Net asset statement shows both restricted and unrestricted balances. Release entries are visible in GL detail but typically summarized in board reports.

### D-030: Grants Receivable — Separate Asset Account for Grant Award Timing
- **Status:** ✅ Decided (GL account finalized; revenue recognition policy deferred to Chunk 2)
- **Impacts:** Chunk 1, Chunk 2, Chunk 4, Chunk 6
- **What Chunk 1 needs:** GL account structure includes separate Grants Receivable asset account (distinct from general Accounts Receivable). Used when grants are awarded before cash is received.
- **What Chunk 2 needs:** Must specify grant revenue recognition policy (award date? receipt date? expenditure date?). Policy determines when to use Grants Receivable vs. when to defer revenue recognition until cash receipt. D-030 creates the GL account; Chunk 2 specifies when/how to use it.
- **What Chunk 4 needs:** Grant receipts may lag revenue recognition (creating Grants Receivable timing gaps). Bank reconciliation must match grant deposits to Grants Receivable reductions, not directly to revenue.
- **What Chunk 6 needs:** Balance sheet shows Grants Receivable separately from tenant Accounts Receivable. Board sees "we're owed $250K from SARE" distinct from operating receivables.
- **Timing scenarios covered:** Grants Receivable (awarded before received) + Deferred Revenue from D-028 (received before earned) = full grant timing coverage.

### D-031: Property Operating Expenses — Granular GL Structure for Operational Tracking
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 3, Chunk 6, Chunk 7
- **What Chunk 1 needs:** GL account structure includes 13 property operating expense accounts (Property Taxes, Insurance, Management Fees, Commissions, Landscaping & Grounds, Repairs & Maintenance, 6 utility subcategories, Other Operating Costs) + 1 contra-revenue account (Vacancy Loss). Granular structure supports operational optimization tracking (solar ROI, electrification measurement) and budget variance analysis.
- **What Chunk 3 needs:** Expense entry workflow must code property expenses to appropriate GL accounts (electric vs. gas vs. water/sewer, etc.). Entry system should recognize vendor patterns (e.g., "Eversource" → Utilities - Electric).
- **What Chunk 6 needs:** Property operating expense breakdown on P&L. Budget variance reporting by expense category (budgeted $5K utilities, spent $5.8K — breakdown shows electric over, gas under). Operational tracking reports (electric expense trend for solar ROI measurement, gas expense trend for electrification impact).
- **What Chunk 7 needs:** Pro forma line items match GL accounts for direct variance analysis. Budget by property expense category (not just one "Property Operating Expenses" budget line).
- **Operational rationale:** Separate utility accounts enable measurement of operational improvements: solar panel electric expense reduction, electrification gas-to-electric shift, seasonal trends for budgeting accuracy.

### D-032: Construction in Progress — Asset Account for Property Development Costs
- **Status:** ✅ Decided (CIP account finalized; capital vs. operating tracking deferred to Chunk 5)
- **Impacts:** Chunk 1, Chunk 3, Chunk 4, Chunk 5, Chunk 6
- **What Chunk 1 needs:** GL account structure includes Construction in Progress (CIP) asset account. Development costs accumulate in CIP until building is placed in service, then transfer to Building asset account (D-019).
- **What Chunk 3 needs:** Development phase expenses (acquisition, renovation, soft costs) flow through CIP, not operating expense accounts. After placed in service, expenses flow through operating expense accounts (D-031).
- **What Chunk 4 needs:** CIP entries match capital draws (AHP loan, grant disbursements) and development payments. Bank reconciliation must track capital stack cash flows through CIP.
- **What Chunk 5 needs:** Research funder substantiation requirements (Historic Tax Credit, Historic Tax Credit, CDBG, CPA) to determine if capital vs. operating tracking within funds is required. If needed, specify structure: separate funds (e.g., "AHP Capital Fund" vs. "AHP Operating Fund"), transaction-level tags, sub-accounts, or cost codes (extends D-016 cost code deferral).
- **What Chunk 6 needs:** Balance sheet shows CIP during development phase, then Building after placed in service. Capital project spending reports track CIP accumulation and fund-by-fund capital deployment.
- **Deferral note:** Capital vs. operating expense split within funds deferred to Chunk 5 (same as D-016 detailed cost codes). Fund-level tracking (D-013) is sufficient for now.

### D-033: FY25 Cash-to-Accrual Conversion — Import All Transactions and System-Generated Adjustments
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 4, Chunk 5, Chunk 6
- **What Chunk 1 needs:** Import process for QBO transactions (CSV format). System logic to identify timing differences (prepaid, accrued, AR) and generate accrual adjustments. Opening balance setup for 1/1/2026.
- **What Chunk 4 needs:** Validate FY25 ending cash balance = FY26 opening cash balance. Bank reconciliation must account for imported FY25 transactions.
- **What Chunk 5 needs:** Document accounting policies for future GAAP compliance (capitalization, bad debt, depreciation, functional allocation).
- **What Chunk 6 needs:** FY25 transaction history available for comparison reporting if board requests year-over-year analysis.
- **Known adjustments:** Prepaid insurance ($501), accrued reimbursements ($4,472 to Heather), accrued AHP loan interest (TBD), AR for December 2025 rent (TBD).
- **GAAP compliance:** All Chunk 1 decisions are GAAP-compliant. System is ready for future GAAP audits with policy documentation (Chunk 5) and financial statement formatting (Chunk 6).

---

## Chunk 2: Revenue Tracking / Donations & Grants

### Q1: When is rental income recognized?
- **Status:** ✅ Answered (D-025)
- **Decision:** Accrual basis when due
- **Impacts:** Chunk 1 (decided), Chunk 4, Chunk 6
- **Notes:** Chunk 2 discovery and spec will build on this. See D-025, D-026, D-027 for GL structure implications.

### Q2a/Q2b/Q2c: AR Structure, Collection Tracking, Rent Adjustments
- **Status:** ✅ Answered (D-026, D-027)
- **Decisions:** By-tenant/unit tracking; aging and alerts; separate adjustment accounts
- **Impacts:** Chunk 4, Chunk 5, Chunk 6
- **What Chunk 4 needs:** AR reconciliation and variance analysis
- **What Chunk 5 needs:** MA law research on adjustment requirements (security deposits, proration, vacate refunds)
- **What Chunk 6 needs:** AR aging and adjustment trend reporting

### D-034: Grant/Contract Revenue Recognition — Revenue at Award Letter
- **Status:** ✅ Decided
- **Decision:** Revenue recognized at award letter for both upfront grants (SARE) and reimbursement contracts (USDA/VA)
- **Impacts:** Chunk 3, Chunk 4, Chunk 5, Chunk 6, Chunk 8
- **What Chunk 3 needs:** Expense tracking must support fund/grant coding (D-035) for compliance attribution
- **What Chunk 4 needs:** Grants Receivable tracked separately from rental AR; reimbursement contract tracking
- **What Chunk 5 needs:** Funder compliance reporting (spending vs. award, budget categories)
- **What Chunk 6 needs:** Grant/contract pipeline reporting, restricted vs. unrestricted revenue visibility
- **What Chunk 8 needs:** Timesheets (D-008), expense reports (D-007), Ramp (D-021) must all support fund/grant selection for expense attribution

### D-035: Grant/Contract Expense Attribution — Mandatory Fund Coding
- **Status:** ✅ Decided
- **Decision:** All expenses must be coded to a fund/grant for compliance tracking (timesheets, expense reports, Ramp, manual entries)
- **Impacts:** Chunk 3, Chunk 5, Chunk 6, Chunk 8
- **What Chunk 3 needs:** Expense entry workflow must support fund selection; budget tracking by category within grants
- **What Chunk 5 needs:** Compliance reporting by grant/contract (attribution, spending by category, budget variance)
- **What Chunk 6 needs:** Fund-level spending reports
- **What Chunk 8 needs:** All integration sources must include fund coding in their APIs

### D-036: Donation Revenue Recognition — Immediate Recognition
- **Status:** ✅ Decided
- **Decision:** Unrestricted and restricted donations recognized immediately when received
- **Impacts:** Chunk 5, Chunk 6
- **What Chunk 5 needs:** Donor acknowledgment compliance for contributions >$250
- **What Chunk 6 needs:** Donation revenue reporting by restricted/unrestricted, campaign performance

### D-037: Earned Income Recognition — Revenue When Earned
- **Status:** ✅ Decided
- **Decision:** Farm lease revenue and fee-for-service income recognized on accrual basis (when earned)
- **Impacts:** Chunk 4, Chunk 6
- **What Chunk 4 needs:** AR for earned income tracked separately
- **What Chunk 6 needs:** Earned income reporting separate from donations and grants

### D-038: Donor Tracking and IRS Acknowledgment Automation
- **Status:** ✅ Decided
- **Decision:** Donor entity tracking, giving history, auto-generated IRS acknowledgment letters (>$250) with letterhead + signature, email delivery
- **Impacts:** Chunk 6, Chunk 8
- **What Chunk 6 needs:** Donor giving history reports
- **What Chunk 8 needs:** Email delivery service for acknowledgment letters

### D-039: Public Support Test — Deferred to Future CPA/990 Filing
- **Status:** ✅ Decided
- **Decision:** Public support test calculations deferred; not a system requirement for 2026 launch
- **Impacts:** Chunk 5, Chunk 6
- **What Chunk 5 needs:** Future consideration when RI approaches full 990 filing requirements
- **What Chunk 6 needs:** No Schedule A reporting required initially

### D-051: Multi-Fund Transaction Allocation — Support Fund Splits at Transaction Level
- **Status:** ✅ Decided (2026-02-13)
- **Decision:** Transactions support multi-fund allocation splits. A single expense can be allocated across multiple funds using percentages or amounts.
- **Impacts:** Chunk 1 (Core Ledger), Chunk 3 (Expense Tracking), Chunk 8 (Integration Layer)
- **What Chunk 1 needs:** Schema change: Transaction → fund_allocations table (one-to-many) instead of single fund_id column. GL posting logic must iterate over fund allocations and create one GL entry per fund allocation. Validation: allocations must sum to 100% (percentages) or transaction amount (amounts). Transaction model must support both single-fund (default) and multi-fund (split) transactions.
- **What Chunk 3 needs:** All expense entry workflows (expense reports, vendor invoices, Ramp transactions, manual entries) must support fund splits. UI design for entering splits deferred to spec phase.
- **What Chunk 8 needs:** API contracts must support fund allocation arrays in payloads (not just single fund_id).

### D-053: GL Transaction Corrections and Reversals
- **Status:** ✅ Decided (2026-02-13)
- **Decision:** GL transactions can be voided, edited (unmatched only), or reversed (matched transactions)
- **Impacts:** Chunk 1 (Core Ledger), Chunk 4 (Bank Reconciliation), Chunk 6 (Reporting)
- **What Chunk 1 needs:** Transaction status field: `active`, `void`, `matched`. Void action implementation (status change, timestamp, exclusion from calculations). Edit action restrictions (only unmatched). Reversing entry creation logic (auto-generate offsetting entry).
- **What Chunk 4 needs:** Bank rec matching changes transaction status to `matched`, locking edits. Matched transactions require reversing entries.
- **What Chunk 6 needs:** Voided transactions excluded from reports but visible in transaction history. Audit log shows all voids/modifications.

### Deferred to Chunk 5

**Q6: Bad Debt Policy**
- Impacts: Chunk 1 (GL structure), Chunk 2, Chunk 5, Chunk 6
- ~~**What Chunk 5 needs to research:** MA landlord-tenant law on bad debt write-offs, CPA guidance, allowance vs. direct write-off method.~~ ✅ **Resolved by D-079:** Direct write-off method. One GL account (Bad Debt Expense), mandatory annotation on write-offs. Switch to allowance method when audit threshold reached.

**Q7: In-Kind Contributions & Volunteer Tracking**
- Impacts: Chunk 1 (GL structure), Chunk 2, Chunk 5, Chunk 6
- ~~**What Chunk 5 needs to research:** Funder volunteer hour matching requirements, valuation rules for in-kind contributions.~~ ✅ **Resolved by D-083, D-084, D-085:** Three in-kind GL revenue accounts (Goods, Services, Facility Use). Volunteer hours tracked outside system. Annual compliance calendar reminder for Schedule M threshold.

---

## Chunk 3: Expense Tracking & Categorization

### Status: 🟡 Discovery complete; payroll restored to v1 scope (as of 2026-02-13, updated by D-068)

**Full V1 Scope:** Employee reimbursements (expense-reports API), vendor invoices (PO system), Ramp card integration, functional split allocation, 1099-NEC prep, manual expense entry, audit logging, payment execution workflow, multi-fund transaction splits, transaction corrections/reversals, **payroll processing, payroll tax compliance (federal + MA), W-2 generation, renewal-timesheets API integration, employee payroll master data**

**V2 split eliminated per D-068.** Payroll restored to v1 after risk reassessment — regulatory complexity is manageable with dedicated research + AI-assisted annual tax rate review process. Chunk 3 needs a payroll-focused discovery session to specify federal/MA withholding, FICA, deposit schedules, quarterly/annual returns.

### Known Dependencies (from Chunk 1)

**D-012: Program Classes — Single Class**
- Expense tracking does not split by program class at entry level (only one class anyway)
- Functional split (Program/Admin/Fundraising) happens at year-end

**D-013: Fund Accounting**
- Expenses code to funds (General Fund, AHP Fund, future restricted funds)
- Timesheets default to Unrestricted Fund (D-024), can override via Task Code

**D-018: Payroll GL**
- All payroll posts to single "Salaries & Wages" account
- No transaction-level functional split

**D-024: GL Validation**
- Timesheet entries default to Unrestricted Fund (override via renewal-timesheets Task Code)
- System must map task codes to GL funds

**D-007: Expense Report Integration**
- Approved expense reports flow from expense-reports-homegrown → GL
- Data model: payee, amount, category, fund, date, receipt references (TBD)

**D-008: Timesheet Integration**
- Approved timesheets flow from renewal-timesheets → GL payroll entries
- Data: employee, hours, rate, period, task code (which maps to fund)

### Chunk 3 Decisions Impacting Other Chunks

**D-040: Payment Execution Workflow — Outside System via Bank Portal**
- **Status:** ✅ Decided (2026-02-11)
- **Impacts:** Chunk 4 (Bank Reconciliation)
- **What Chunk 4 needs:** Manual payable creation in financial-system creates AP liability. Payment executed separately in UMass Five portal. Bank rec must match bank transactions to payables (by amount, date range, payee). Unmatched bank transactions require retroactive categorization (GL account + fund assignment).

**D-041: Audit Logging for All Financial Actions**
- **Status:** ✅ Decided (2026-02-11)
- **Impacts:** Chunk 1, Chunk 6
- **What Chunk 1 needs:** GL transactions log: create, modify, void actions with user ID, timestamp, before/after state.
- **What Chunk 6 needs:** Audit log viewer UI for Treasurer/board review. Filter by user, date range, action type, entity.

**D-042, D-043: Payroll Processing Deferred to V2**
- **Status:** ✅ Decided (2026-02-11)
- **Impacts:** Chunk 8
- **What Chunk 8 needs:** ~~renewal-timesheets API integration deferred to v2. app-portal payroll data enhancements deferred to v2. No Gusto integration in v1.~~ **UPDATED by D-068:** renewal-timesheets API integration and app-portal payroll data restored to v1 scope. No Gusto integration (building in-house).

**D-044: No Approval Workflows in Financial-System**
- **Status:** ✅ Decided (2026-02-11)
- **Impacts:** Chunk 4, Chunk 6, Chunk 8
- **What Chunk 4 needs:** All transactions posted to GL are already approved (no pending approval queue to account for during bank rec).
- **What Chunk 6 needs:** No "pending approval" category in board reports. All posted transactions are approved.
- **What Chunk 8 needs:** API contracts simpler without approval state management. Upstream systems (expense-reports, timesheets) handle approvals.

**D-051: Multi-Fund Transaction Allocation — Support Fund Splits at Transaction Level**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 1 (Core Ledger), Chunk 8 (Integration Layer)
- **What Chunk 1 needs:** Schema change: Transaction → fund_allocations table (one-to-many) instead of single fund_id column. GL posting logic must iterate over fund allocations and create one GL entry per fund. Validation: fund allocations must sum to 100% (percentages) or equal transaction amount (amounts).
- **What Chunk 8 needs:** API contracts with integration sources must support fund allocation arrays in transaction payloads. Example: expense report line item can include `fund_allocations: [{fund_id: "HTC", percentage: 60}, {fund_id: "Unrestricted", percentage: 40}]` instead of single `fund_id`.
- **What Chunk 3 spec needs:** UI/UX design for entering fund splits (inline "Add fund" button? Modal? Percentage vs. amount fields?). Default behavior (single fund with option to add splits? Always prompt?). Validation messages. Report display format (one line with breakdown? Separate lines per fund?).

**D-052: $20K Board Approval Threshold — Governance Process, Not System Enforcement**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** None (architectural clarification only)
- **Rationale:** Bylaws threshold ($20K board approval for contracts) enforced through governance, not system workflow. No approval gate, documentation requirement, or compliance warning in PO system. Consistent with D-044 (no approval workflows) and D-006 (all users fully trusted).

**D-053: GL Transaction Corrections and Reversals**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 1 (Core Ledger), Chunk 4 (Bank Reconciliation), Chunk 6 (Reporting)
- **What Chunk 1 needs:** Transaction status field: `active`, `void`, `matched`. Void action: changes status to void, sets voided_at/voided_by, excludes from GL calculations but preserves in audit trail. Edit action: allowed only if status = active (not void, not matched). Reversing entry creation: system provides "Reverse Transaction" button that auto-creates offsetting entry.
- **What Chunk 4 needs:** Bank rec matching locks transactions from editing (status changes to `matched`). Matched transactions require reversing entries for corrections. Unmatched transactions can be edited freely.
- **What Chunk 6 needs:** Voided transactions excluded from all reports (balance sheet, P&L, fund reports) but visible in transaction history with strikethrough/"VOID" badge. Audit log viewer shows voids and modifications.

### Discovery Questions Resolved
1. ✅ How do approved expense reports create GL entries? → Per-line-item GL entries with immediate AP liability (Session 1)
2. ✅ How do timesheets create payroll entries? → Monthly batched GL entries (Session 2) — **DEFERRED TO V2**
3. ✅ How is functional split allocated? → Year-end per-GL-account allocation with stored percentages (Session 3)
4. ✅ What's the Ramp workflow? → Batch categorization with AI suggestions + rules (Session 5)
5. ✅ How are vendor invoices handled? → Full PO system with AI contract extraction, 3-way match (Session 4)
6. ✅ How are receipt requirements enforced? → $75 threshold with exceptions, 60-day substantiation rule (Session 6)
7. ✅ How are direct/manual expenses handled? → Manual payable creation via D-040 payment execution workflow (Session 7)
8. ✅ Can transactions split across multiple funds? → Yes, via D-051 multi-fund allocation (Session 7)
9. ✅ How are expense corrections handled? → Void/edit/reversal workflows via D-053 (Session 7)

---

## Chunk 4: Bank Reconciliation

### Status: ✅ Discovery complete (Session 1, 2026-02-13 — 15 decisions: D-093 through D-107)

### Known Dependencies (from Chunk 1)

**D-015: Opening Balance**
- $12,835 opening equity is GL-only (no bank counterpart)
- ✅ Handled: D-097 two-way rec treats this as known GL-only item

**D-019: Depreciation**
- Monthly depreciation is GL-only (no bank transaction)
- ✅ Handled: D-097 two-way rec treats this as known GL-only item

**D-021: Ramp Credit Card**
- Ramp transactions create GL entries (Debit Expense, Credit Credit Card Payable)
- ✅ Handled: D-098 — 1-level bank rec (match settlement only) with Ramp statement cross-check

**D-022: AHP Loan**
- Loan draws appear as bank deposits and GL entries
- Available credit is tracked separately (contingent, not GL)

**D-023: Loan Forgiveness**
- Forgiveness is GL-only (no bank transaction)
- ✅ Handled: D-097 two-way rec treats this as known GL-only item

**D-025: Rental Income Recognition — Accrual Basis**
- AR is generated on due date (month N), cash received month N+1
- Bank reconciliation shows gap: expected AR > received cash (explained by AR aging)
- 🟡 Open: AR-to-cash reconciliation tie-in still being discussed

**D-026: AR Tracking**
- AR reconciliation may show variance (units paying slowly or partially)
- System should alert when tenant rents come in lower than expected
- 🟡 Open: How AR variance surfaces in bank rec

**D-027: Rent Adjustments**
- Adjustments may reduce AR or cash
- Reconciliation must account for adjustment types

### Chunk 4 Decisions Impacting Other Chunks

**D-093: Plaid API for Bank Feeds**
- **Impacts:** Chunk 8
- **What Chunk 8 needs:** Plaid integration — token management, Link initialization, `/transactions/sync` polling, webhook handling. Authentication flow for connecting bank accounts.

**D-095: Trust-Escalation Matching Model**
- **Impacts:** Chunk 3
- **What Chunk 3 needs:** Same rule engine pattern as Ramp categorization. Consider shared rule infrastructure.

**D-097: Two-Way Reconciliation**
- **Impacts:** Chunk 1
- **What Chunk 1 needs:** GL entries hitting cash accounts should be identifiable for the GL→bank direction of reconciliation. Cash account GL entries need to be queryable by period.

**D-098: Ramp Statement Cross-Check**
- **Impacts:** Chunk 3
- **What Chunk 3 needs:** Must expose categorized Ramp transaction totals per period for cross-check against bank settlement amount.

**D-100: Escrow Account**
- **Impacts:** Chunk 5 (D-069, D-070)
- **What Chunk 5 needs:** Escrow account reconciliation is standard bank rec. Per-tenant tracking and interest calculation (D-069, D-070) feed GL-only items into the two-way rec.

### Discovery Questions — All Resolved
1. ~~Outstanding checks / deposits in transit~~ ✅ D-101 — simple "outstanding" status, no aging rules
2. ~~Opening balance validation~~ ✅ D-102 — full history rebuild from $0, supersedes D-033 for bank rec
3. ~~AR reconciliation tie-in~~ ✅ D-104 — AR timing handled by AR aging report, not bank rec
4. ~~AHP loan interest accrual~~ ✅ D-105 — known GL-only category, same as depreciation
5. ~~Plaid pending transactions~~ ✅ D-106 — show as informational, not matchable
6. ~~Match confidence scoring~~ ✅ D-107 — exact amount, ±3 days, merchant tiebreaker
7. ~~Multi-transaction matching~~ ✅ D-103 — 1:many and many:1 with bank transaction splitting

---

## Chunk 5: Compliance Reporting

### Status: ✅ Discovery complete (Sessions 1-5 complete, 2026-02-13)

### Session 1 Decisions (2026-02-13) — 990 Filing & Compliance Mechanics

**D-061: Functional Expense Allocation — Annual Worksheet**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 6
- **What Chunk 1 needs:** GL posting logic for year-end functional allocation JEs. System stores per-person (or per-expense-category) percentages for Program/Admin/Fundraising split. Extends D-018.
- **What Chunk 6 needs:** Functional split appears on board reports after year-end allocation runs. 990-style Statement of Functional Expenses report auto-generates from D-062 mapping + D-061 percentages.

**D-062: 990 Line Item Mapping — System-Level GL Config**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 6
- **What Chunk 1 needs:** GL account schema gets `form_990_line` field (integer 1-24 mapping to Part IX line items). Set at account creation.
- **What Chunk 6 needs:** Auto-generated 990-style expense report (roll up GL accounts by 990 line, apply D-061 functional percentages).

**D-063: Public Support Test Data Capture from Day One**
- **Status:** ✅ Decided
- **Impacts:** Chunk 2
- **What Chunk 2 needs:** Contribution/donation/grant entry must include source type field: `government`, `public`, or `related_party`. This extends D-038 donor tracking. Enables Schedule A public support test calculation when needed (~FY2030).

**D-064: Form PC — Compliance Calendar Reminder Only**
- **Status:** ✅ Decided
- **Impacts:** None (scope exclusion)

**D-065: Built-In Compliance Calendar with Automated Reminders**
- **Status:** ✅ Decided
- **Impacts:** Chunk 6
- **What Chunk 6 needs:** Dashboard shows upcoming compliance deadlines (per D-059 operational dashboard scope). Compliance calendar is a Chunk 5 deliverable displayed through Chunk 6 UI.

**D-066: 990 Program Descriptions — Manual Narrative**
- **Status:** ✅ Decided
- **Impacts:** None (simplifies D-012 — no sub-program tagging needed)

**D-067: Officer Compensation — Derives from Payroll**
- **Status:** ✅ Decided
- **Impacts:** Defers to Chunk 3 v2 payroll module

### Session 2 Decisions (2026-02-13) — MA Landlord-Tenant Law & Security Deposits

**D-069: Security Deposit Escrow — Pooled Account with Per-Tenant Tracking**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 4, Chunk 6
- **What Chunk 1 needs:** 3 new GL accounts: Security Deposit Escrow (asset), Security Deposits Held (liability), Interest Expense — Security Deposits. Per-tenant tracking at data layer (tenant ID, amount, date, interest accrued/paid).
- **What Chunk 4 needs:** Escrow bank account reconciliation (separate from operating accounts). Total escrow balance must match sum of individual tenant deposit balances.
- **What Chunk 6 needs:** Security deposit liability on balance sheet. Per-tenant deposit report for compliance.

**D-070: Security Deposit Interest — Fully Automated**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 5
- **What Chunk 1 needs:** Interest calculation logic: principal × min(bank_rate, 5%) × time. Auto-generates annual JE per tenant.
- **What Chunk 5 needs:** Compliance calendar entries per tenant (interest due on tenancy anniversary).

**D-071: Rent Proration — Statutory Daily Rate**
- **Status:** ✅ Decided
- **Impacts:** Chunk 2
- **What Chunk 2 needs:** AR generation supports partial-month entries. Proration flows through D-027 rent adjustment accounts.

**D-072: Move-Out Workflow — Deferred**
- **Status:** ✅ Decided (deferred)
- **Impacts:** None immediately. Compliance calendar (D-065) provides interim 30-day deadline tracking.

**D-073: VASH/Subsidy Data — Outside Financial System**
- **Status:** ✅ Decided
- **Impacts:** Scoping decision
- **Summary:** HAP contract terms, tenant income calcs, recertification dates live outside financial-system. GL tracking uses existing D-026 AR-by-source. Creates implicit future need for separate property management tooling.

**D-074: MVRAP Clarification — All Voucher Programs Treated Identically in GL**
- **Status:** ✅ Decided
- **Impacts:** None (architectural clarification)

### Session 3 Decisions (2026-02-13) — Funder Substantiation (All Deferred)

**D-075: Capital vs. Operating Cost Categories — Deferred Until Funder Awards**
- **Status:** ✅ Decided (deferred)
- **Impacts:** Extends D-016 and D-032
- **Summary:** No speculative cost category tagging. Fund-level tracking (D-013) sufficient. Mini-discoveries when awards arrive.

**D-076: Grant Spend-Down Monitoring — Existing Fund Reports Sufficient**
- **Status:** ✅ Decided
- **Impacts:** Simplifies Chunk 5 and Chunk 6 scope
- **Summary:** Fund spending reports (D-059) provide spend-down data. No dedicated monitoring dashboard.

**D-077: Funder-Specific Reporting — Flexible Framework, Concrete Requirements Deferred**
- **Status:** ✅ Decided (deferred)
- **Impacts:** Chunk 6 (no funder-specific report templates at launch)
- **Summary:** System provides building blocks (fund reports, GL detail, compliance calendar). Custom funder reports built when award letters specify requirements.

### Session 4 Decisions (2026-02-13) — GAAP Policy Documentation

**D-078: Capitalization Threshold — $2,500 (IRS De Minimis Safe Harbor)**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 3
- **What Chunk 1 needs:** System should flag entries to CIP/asset accounts when amount ≥ $2,500. Written policy documentation (this decision).
- **What Chunk 3 needs:** Expense vs. capital determination at entry time. Items ≥ $2,500 route to asset accounts, items < $2,500 expense immediately.

**D-079: Bad Debt Method — Direct Write-Off**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 2
- **What Chunk 1 needs:** One GL account (Bad Debt Expense), no contra-asset. System supports both direct write-off and allowance methods so future switch is config change.
- **What Chunk 2 needs:** AR write-off workflow with mandatory annotation (follows D-027 pattern).

**D-080: Depreciation Policy — Component for Building, Single-Item for Everything Else**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 6
- **What Chunk 1 needs:** Asset register supports component-level tracking for buildings (extends D-019). Straight-line method for all assets.
- **What Chunk 6 needs:** Fixed asset schedule in notes to financials shows building components with individual useful lives and depreciation.

### Session 5 Decisions (2026-02-13) — Tax Credit Mechanics & In-Kind Contributions

**D-081: HTC Equity Accounting — Fully Deferred**
- **Status:** ✅ Decided (deferred)
- **Impacts:** Chunk 1 (future GL accounts when deal structures), Chunk 5 (compliance calendar trigger)
- **Summary:** All HTC-specific GL accounting deferred to mini-discovery when deal is structured. D-013 fund structure and D-080 component depreciation provide foundation.

**D-082: QRE Tracking — Deferred with HTC**
- **Status:** ✅ Decided (deferred)
- **Impacts:** Extends D-081
- **Summary:** No QRE-specific fields now. CIP (D-032) and component depreciation (D-080) capture costs by component; QRE tagging retrofitted when HTC consultant specifies requirements.

**D-083: In-Kind Contribution GL — Three Revenue Accounts**
- **Status:** ✅ Decided
- **Impacts:** Chunk 1, Chunk 2
- **What Chunk 1 needs:** 3 new GL revenue accounts: In-Kind Goods, In-Kind Services (specialized only), In-Kind Facility Use. All map to `form_990_line` for noncash contributions (Part VIII Line 1g).
- **What Chunk 2 needs:** Contribution entry workflow prompts for in-kind type when recording noncash donations. Extends D-036/D-038.

**D-084: Volunteer Hours — Outside Financial System**
- **Status:** ✅ Decided
- **Impacts:** None (scoping decision)
- **Summary:** Volunteer tracking is operational, not financial. Dollar values enter financial system via D-083 in-kind JEs when qualifying.

**D-085: Compliance Calendar — Annual In-Kind & Schedule M Review**
- **Status:** ✅ Decided
- **Impacts:** Extends D-065
- **Summary:** Annual January reminder: review in-kind totals, check $25K Schedule M threshold, verify FMV documentation.

### Key Questions — All Resolved
1. ~~**MA Landlord-Tenant Law**~~ ✅ Resolved (D-069 through D-074)
2. ~~**VASH/MVRAP Program Rules**~~ ✅ Resolved (D-073, D-074)
3. ~~**Tax Credit Mechanics**~~ ✅ Resolved — deferred to mini-discovery (D-081, D-082)
4. ~~**Funder Requirements**~~ ✅ Resolved — deferred until awards arrive (D-075 through D-077)
5. ~~**In-Kind & Volunteer Tracking**~~ ✅ Resolved (D-083 through D-085)
6. ~~**GAAP Policies**~~ ✅ Resolved (D-078 through D-080)

---

## Chunk 6: Board & Management Reporting

### Status: ✅ Discovery complete (Sessions 1-2, 2026-02-12 through 2026-02-13 — 17 decisions: D-054 through D-060, D-108 through D-117)

### Report Consumers
- **Board (quarterly):** P&L, Balance Sheet, Cash Flow, 3-month cash projection, capital budget summary
- **Heather (daily):** Dashboard home screen, cash position, AR aging, payables, rent collection, grant status, payroll reports
- **AHP (annual):** Covenant-required financial package or Form 990
- **CPA (year-end):** 990-format functional expenses, W-2 verification, raw CSV exports

### Session 1 Decisions (2026-02-12)

**D-054: Full GAAP Financial Statement Presentation from Day One**
- **Status:** ✅ Decided
- **Impacts:** All downstream report consumers
- **Summary:** Four core GAAP statements + notes/schedules + dashboard summary layer

**D-055: Consolidated + Fund Drill-Down Reporting Model**
- **Status:** ✅ Decided
- **Impacts:** Chunk 7 (budget vs. actuals uses same drill-down by fund)
- **What Chunk 7 needs:** Budget data by GL account by period, compatible with fund-level filtering

**D-056: Interactive Reports + PDF Export**
- **Status:** ✅ Decided
- **Impacts:** None (delivery mechanism). Extended by D-115 (adds CSV export).

**D-057: "As Of" Timestamp on All Reports**
- **Status:** ✅ Decided
- **Impacts:** Extends D-045 (no period locking)

**D-058: Report Comparison Columns — Current + YTD + Budget**
- **Status:** ✅ Decided
- **Impacts:** Chunk 7 (must provide budget amounts by GL account by period)
- **What Chunk 7 needs:** Budget data format compatible with Current Period / YTD / Budget column layout

**D-059: All Operational Reports Ship at Launch (Updated)**
- **Status:** ✅ Decided (updated 2026-02-13)
- **Impacts:** Scope commitment — 29 reports + dashboard home screen, no phasing
- **Updated from:** Original 21 reports expanded to 29 after gap analysis (security deposits, compliance calendar, capital budget, payroll reports)

**D-060: 3-Month Cash Projection Deferred to Chunk 7**
- **Status:** ✅ Decided
- **Impacts:** Chunk 7 (owns projection logic + data model)
- **What Chunk 7 needs:** Projection data model, automation level, feed into Chunk 6 display container (D-112)

### Session 2 Decisions (2026-02-13 — Gap Analysis)

**D-108: Security Deposit Register Report**
- **Status:** ✅ Decided
- **Impacts:** Extends D-069, D-070
- **Summary:** Report #22. Per-tenant register with interest tracking and 30-day anniversary alerts. Compliance-critical.

**D-109: Compliance Calendar — Full Page + Dashboard Widget**
- **Status:** ✅ Decided
- **Impacts:** Extends D-065. Dashboard (D-113).
- **Summary:** Report #23. Full-page view filterable by deadline type + "next 30 days" dashboard widget.

**D-110: Universal Color-Coded Budget Variance**
- **Status:** ✅ Decided
- **Impacts:** Extends D-089. All reports with budget columns.
- **Summary:** Universal application. Thresholds deferred to spec.

**D-111: Capital & Financing Budget Summary Report**
- **Status:** ✅ Decided
- **Impacts:** Extends D-088. Chunk 7 (capital/financing budget data).
- **Summary:** Report #24. Planned vs. actual for loan draws, capital spending, debt service.

**D-112: Cash Projection Display — Auto-Fill + Manual Override**
- **Status:** ✅ Decided
- **Impacts:** Extends D-060, D-091. Chunk 7 (pre-fill data).
- **Summary:** Report #15 display design. Auto-populated line items with editable overrides and visible adjustment notes.

**D-113: Dashboard Home Screen — Five-Section Composite View**
- **Status:** ✅ Decided
- **Impacts:** References reports #5, #6, #8, #9, #18, #23.
- **Summary:** Cash snapshot, alerts, rent collection, fund balances, recent activity. System landing page.

**D-114: No Role-Based Report Views**
- **Status:** ✅ Decided
- **Impacts:** Simplifies reporting layer. Extends D-006.
- **Summary:** Everyone sees everything. No permission logic in reports.

**D-115: PDF + CSV Export, Manual Board Pack Delivery**
- **Status:** ✅ Decided
- **Impacts:** Extends D-056.
- **Summary:** All reports get PDF + CSV export. Board pack manually generated by Heather.

**D-116: 990-Format Toggle on Functional Expense Report**
- **Status:** ✅ Decided
- **Impacts:** Depends on D-061, D-062.
- **Summary:** Report #4 toggles between GAAP format (RI chart of accounts) and 990 format (IRS Part IX lines).

**D-117: Payroll Reports — Five Reports Added**
- **Status:** ✅ Decided
- **Impacts:** Chunk 3 (payroll must produce data). Updates D-059.
- **What Chunk 3 needs:** Payroll processing must produce: per-employee gross/withholding/net/fund data, tax liability running totals, W-2 box values, employer cost breakdowns, quarterly 941 aggregations.
- **Summary:** Reports #25-29. Payroll Register, Tax Liability, W-2 Verification, Employer Cost, 941/M-941 Prep.

### Upstream Dependencies (comprehensive)
**From Chunk 1:** D-012, D-013, D-014, D-016, D-018, D-019, D-022, D-023/D-049, D-025-027, D-028, D-029, D-030, D-031, D-032, D-033
**From Chunk 2:** D-034/D-046, D-035, D-036, D-037, D-038, D-047, D-048, D-050
**From Chunk 3:** D-040, D-041, D-044, D-045, D-051, D-053, D-068 (payroll data for reports #25-29)
**From Chunk 4:** D-093/D-094 (bank balances for dashboard), D-097 (unmatched items for alerts)
**From Chunk 5:** D-061/D-062 (functional allocation + 990 mapping → report #4), D-065 (compliance calendar → report #23), D-069/D-070 (security deposits → report #22), D-080 (fixed asset components), D-085 (Schedule M reminder)
**From Chunk 7:** D-087 (monthly budget data → D-058 columns), D-088/D-111 (capital budget → report #24), D-089/D-110 (variance colors), D-091/D-112 (cash projection data → report #15)

### All Questions Resolved (Q6-01 through Q6-18)
See 6-board-reporting-discovery.md for full details.

---

## Chunk 7: Budgeting

### Status: ✅ Discovery complete (Session 1, 2026-02-13 — 7 decisions: D-086 through D-092)

### Known Dependencies (from Chunk 1)

**D-013: Fund Accounting**
- Budgets are fund-level (General Fund budget, AHP Fund budget, future restricted fund budgets)
- Budget vs. actuals tracked by fund

**D-022: AHP Loan — Available Credit**
- Available credit ($3.4M) is a planning/contingency resource
- Budget does not assume draws unless planned. No scenario modeling in v1.

**D-031: Granular Property Expense GL**
- 13 property operating expense accounts → budget line items must match GL accounts
- Enables direct variance analysis at utility/category level

### Known Dependencies (from Chunk 2)

**D-034: Grant Revenue Recognition**
- Budget reflects awarded grant revenue

**D-035: Grant Expense Attribution**
- Restricted fund budgets track planned spending by expense category within grants

### Known Dependencies (from Chunk 3)

**D-018: Single Payroll GL Account**
- Salaries & Wages budgeted as single line; functional split is year-end, not budgeted

### Known Dependencies (from Chunk 6)

**D-055: Fund Drill-Down Model**
- Budget vs. actuals uses same fund drill-down as all other reports

**D-058: Report Comparison Columns — Current + YTD + Budget**
- Chunk 7 must provide budget amounts by GL account by period
- Financial statements show Current Period / YTD / Budget columns
- Budget column shows "—" until Chunk 7 budget data exists

**D-060: 3-Month Cash Projection Owned by Chunk 7**
- Semi-automated approach agreed (system pre-fills from budget/GL history, Heather adjusts)
- Board specifically requested this at January 2026 meeting

### Chunk 7 Decisions Impacting Other Chunks

**D-086: Annual Budget Cycle — September–December Process**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 5 (compliance calendar)
- **What Chunk 5 needs:** Compliance calendar (D-065) should include budget cycle reminders: September (review actuals, start planning), October (draft budget), November (circulate to board), December (board approval).

**D-087: Budget Entry — Annual with Monthly Spread**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 6
- **What Chunk 6 needs:** Monthly budget amounts per GL account per fund available for D-058 comparison columns.

**D-088: Full Budget — Operating + Capital + Financing**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 6
- **What Chunk 6 needs:** Report layout may need capital/financing budget section alongside operating budget vs. actuals.

**D-089: Variance Reporting — Color-Coded Thresholds**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 6
- **What Chunk 6 needs:** Conditional color formatting on budget vs. actuals reports. Configurable thresholds.

**D-091: Cash Projection — Semi-Automated, Quarterly**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** Chunk 4, Chunk 6
- **What Chunk 4 needs:** Cash projection reads current bank balances.
- **What Chunk 6 needs:** Display container for 3-month projection with auto-filled + manually adjusted line items.

**D-092: Grant Budgets — Fund-Level, Multi-Year**
- **Status:** ✅ Decided (2026-02-13)
- **Impacts:** None beyond existing fund structure (D-013)
- **Notes:** Multi-year budget entries are a data model consideration, not an architectural change.

### Discovery Progress (Session 1 — 2026-02-13)
- **All 8 questions resolved (Q7-01 through Q7-08)**
- **7 decisions finalized (D-086 through D-092)**
- **No scenario/what-if budgeting in v1**
- **Budget structure:** Budget = GL Account × Fund × Period
- **Grant budgets:** Treated as fund-level budgets (org budget = sum of fund budgets)
- **Discovery status:** ✅ Complete — ready for spec phase

---

## Chunk 8: Integration Layer

### Status: ✅ Discovery complete (Sessions 1-2, 2026-02-13 — 14 decisions: D-118 through D-131)

### D-127: Depreciation Policy — Straight-Line, No Accelerated Methods
- **Status:** ✅ Decided
- **Impacts:** Chunk 1 (simplifies D-019 automation — straight-line only), Chunk 5 (annual compliance calendar review simplified)
- **What Chunk 1 needs:** Depreciation automation only needs to support straight-line method. No MACRS accelerated, no Section 179, no bonus depreciation.
- **What Chunk 5 needs:** Annual compliance calendar review (D-065) simplified: "did IRS change standard useful lives?" rather than "which acceleration method is optimal?"

### D-128: AI Depreciation Assistant (D-020) Superseded
- **Status:** ✅ Decided
- **Impacts:** Chunk 1 (GL-P1-001 updated)
- **Notes:** No standalone depreciation AI feature. Fixed asset form gets copilot support via D-129 system-wide pattern. See GL-P1-001 in spec (updated).

### D-129: System-Wide AI Copilot — Architectural Pattern
- **Status:** ✅ Decided
- **Impacts:** All chunks (every page spec should include copilot context package)
- **What every chunk's spec needs:** Each page/screen specification should include a "copilot context package" section defining: (a) what data/state to share with copilot, (b) what tools/skills are available, (c) what knowledge resources are relevant.
- **Notes:** v1 scope: copilot operates within financial-system data only. v2: cross-application access (timesheets, expense reports, payroll/people, auth portal). Supersedes D-020 (via D-128) and D-028 AI concept (via D-130).

### D-130: AI Transaction Entry Assistant (D-028) Absorbed into Copilot
- **Status:** ✅ Decided
- **Impacts:** Chunk 3 (Ramp categorization UX unchanged; "AI" piece becomes copilot context)
- **What Chunk 3 needs:** Session 5 Ramp categorization workflow (AI auto-suggestions, user-defined rules, batch categorization) remains valid as system features. The copilot on the categorization page has access to transaction details, GL accounts, rule history, merchant patterns. Rule engine and auto-suggestion logic are system features the copilot can explain and help configure.

### D-118: Integration Architecture — Database-Mediated, Not API-Mediated
- **Status:** ✅ Decided
- **Impacts:** Chunk 8 (all internal integration contracts), renewal-timesheets app, expense-reports-homegrown app
- **What renewal-timesheets needs:** Code changes to connect to financial-system DB with restricted Postgres role. SELECT reference tables (GL accounts, funds) for UI dropdowns. INSERT approved timesheet summaries into staging table. SELECT staging table to read back payment/posting status.
- **What expense-reports-homegrown needs:** Same pattern — restricted DB role, SELECT references, INSERT to staging, SELECT status. Replaces planned QBO API pivot with simpler database-mediated approach.
- **What Chunk 1 (Core Ledger) needs:** Database schema must include reference tables and staging table designed for external SELECT/INSERT access. Postgres role provisioning for source apps.
- **Ramp and Plaid:** Unaffected — accessed via their own external APIs directly by financial-system.

### D-131: Deployment Topology — Same Stack (Vercel + Neon)
- **Status:** ✅ Decided
- **Impacts:** All chunks (deployment target confirmed)
- **Summary:** Financial-system deploys on Vercel + Neon, same as all other RI apps. Scheduled jobs (daily syncs, monthly automation) via Vercel cron. AI copilot via Anthropic API server-side proxy. Cross-Neon-project DB connectivity mechanics deferred to spec/build.

### Inter-App Dependencies Summary

Chunk 8 is the integration hub connecting financial-system to the existing app ecosystem. Three internal app integrations (all inbound to financial-system via database-mediated staging pattern per D-118), one external service integration (Ramp), and one bank data integration (UMass Five via Plaid).

#### 1. renewal-timesheets → financial-system (D-008)
- **Status:** 🟡 **RESTORED TO V1** (D-068 reverses D-042) — Full in-house payroll build
- **Trigger:** Admin approves timesheet in renewal-timesheets app
- **Data flow:** renewal-timesheets API → financial-system intake → accumulate in "pending payroll" state → batch process at pay period close → GL payroll entry
- **Expected data fields:**
  - Employee ID (to fetch payroll master data from auth system)
  - Hours worked (regular, overtime if applicable)
  - Hourly rate (from timesheet or from employee master? TBD)
  - Pay period (start date, end date)
  - Task code (determines pay rate, separate from fund attribution)
  - **Funding source** (per Chunk 3: separate dropdown, defaults to Unrestricted, user can override)
- **GL impact:** Batch per pay period → one entry per employee: DR "Salaries & Wages", CR "Payroll Payable" (net), CR [Withholding liability accounts]
- **Fund mapping logic:** Each time entry has explicit fund selection (Task Code + Funding Source are separate fields)
- **Validation rules (D-024):** Default to Unrestricted Fund, allow override via funding source dropdown
- **Dependencies:**
  - D-017: Employee master data (tax withholding, pay frequency) from app-portal
  - D-018: Single payroll GL account (no functional split at entry)
  - D-024: GL validation (default fund, task code override)
  - **Chunk 3 discovery:** Batching per pay period (not real-time per timesheet), task code + separate fund selection
- **renewal-timesheets improvements needed (from Chunk 3 discovery):**
  - Add "Funding Source" dropdown to time entry UI (separate from Task Code)
  - Receive fund list from financial-system API (dynamic, updates as new funds created)
  - Implement auto-suggestion logic (pre-populate fund based on task code + historical patterns)
  - Default to "Unrestricted Fund" when no pattern exists
  - Send fund attribution in approved timesheet API payload
- **Integration mechanism (D-118):** Database-mediated. renewal-timesheets INSERTs approved timesheet summaries into financial-system staging table. SELECTs reference tables for fund/GL dropdowns. SELECTs staging table for payment status.
- **Compensation model (D-119, D-120):** People API (app-portal) stores compensation_type (PER_TASK or SALARIED), annual_salary, expected_annual_hours (default 2080, editable), exempt_status (EXEMPT or NON_EXEMPT). For salaried employees, People API calculates hourly rate (salary ÷ expected hours) and passes the pre-calculated rate to timesheets. Timesheets uses compensation type to choose rate source (task code rates for PER_TASK, People API rate for SALARIED) and exempt status to determine overtime applicability.
- **Staging contract (D-121):** Approval triggers INSERT. One staging row per fund per approved timesheet. Each row includes: employee ID, timesheet reference, pay period, fund ID, regular hours, overtime hours, regular earnings, overtime earnings, total earnings. Entry-level detail stays in timesheets DB.
- **Open questions (resolved):**
  - ✅ Per-approval INSERT (D-121)
  - ✅ Timesheets sends calculated earnings; rate comes from People API for salaried, task codes for per-task (D-119)
  - ✅ Task codes are existing system (dropdown, predefined codes with rate versioning)

#### 2. expense-reports-homegrown → financial-system (D-007)
- **Status:** 🟡 Integration confirmed, API contract defined in Chunk 3 discovery (pivoting from QBO API to financial-system API)
- **Trigger:** Admin approves expense report in expense-reports-homegrown app
- **Data flow:** expense-reports-homegrown API → financial-system intake → GL expense entry per line item (immediate)
- **Expected data fields (per line item):**
  - Payee (employee ID)
  - Amount
  - Date incurred
  - Merchant
  - Memo
  - **GL account code** (user selects from list provided by financial-system)
  - **Funding source** (user selects from list provided by financial-system; renamed from "projectId/projectName")
  - Expense type (out_of_pocket or mileage)
  - Receipt URL / thumbnail URL
  - Mileage details (if applicable): origin, destination, miles
- **GL impact:** One entry per expense line item: DR [GL Expense Account], CR "Reimbursements Payable"
- **Fund mapping logic:** Each expense line explicitly codes to fund (no default; user must select)
- **Validation rules (D-024):** Funding source mandatory (no default for expense reports, unlike timesheets)
- **Dependencies:**
  - D-013: Fund accounting structure
  - D-024: GL validation (fund required for expense reports)
  - **Chunk 3 discovery:** Line-item GL entries, immediate posting on approval, financial-system pushes GL accounts to expense-reports
- **expense-reports-homegrown improvements needed (from Chunk 3 discovery):**
  - Rename "Projects" → "Funding Source" (schema: projectId/projectName → fundingSourceId/fundingSourceName)
  - Add "GL Account" field to expense entry (dropdown populated from financial-system)
  - Receive GL account list from financial-system API (chart of accounts with codes/names)
  - Receive fund list from financial-system API (dynamic, updates as new funds created)
  - Send GL account code + funding source in approved expense report API payload (per line item)
- **Scope note:** expense-reports-homegrown only covers employee reimbursable expenses (out-of-pocket). Does NOT cover Ramp credit card purchases (separate integration).
- **Integration mechanism (D-118, D-122):** Database-mediated. On approval, expense-reports-homegrown INSERTs one staging row per expense line item. Each row: employee ID, expense report reference, date, amount, merchant, memo, GL account code, fund ID, expense type, mileage details if applicable. No receipt URLs, thumbnails, AI confidence, or email metadata — all operational data stays in expense-reports DB. Financial-system creates one GL entry per staged row (DR expense account, CR Reimbursements Payable). Source app reads status back for payment/posting visibility.
- **QBO deprecation (D-122):** All QBO artifacts removed: qboBillId field, QBO API integration, QBO category/project mappings. Financial-system integration fully replaces QBO.
- **Open questions (resolved):**
  - ✅ One INSERT per line item (D-122)
  - ✅ Receipt references stay in expense-reports DB (D-122)
  - Error handling at INSERT time: deferred to spec (FK constraints on GL accounts/funds will catch invalid codes)

#### 3. app-portal → financial-system (D-006, D-017)
- **Status:** ✅ Integration confirmed
- **Two distinct use cases:**

  **3a. Authentication & Authorization (D-006)**
  - **Data consumed:** User identity, role (Admin/User), app-level access permissions
  - **Usage:** Every financial-system page load checks: is this user authorized to access financial-system?
  - **Access model:** All-or-nothing. If user has financial-system access, they see everything (no in-app permissions, no read-only mode).
  - **API status:** Shared auth system exists; financial-system consumes it (read-only)

  **3b. Employee Payroll Master Data (D-017) + Compensation Profile (D-119, D-120)**
  - **Status:** 🟡 **RESTORED TO V1** (D-068 reverses D-042/D-043) — Full in-house payroll build
  - **Data consumed by financial-system:**
    - Employee name (legal name for tax forms)
    - Tax IDs (SSN/EIN for federal, state tax ID for MA)
    - W-4 withholding elections (federal income tax, state income tax, social security, medicare, 401k, HSA)
    - Pay frequency (weekly, biweekly, monthly)
    - Worker type (W2_EMPLOYEE or CONTRACTOR_1099)
    - Employment status (via payroll_enabled flag)
  - **Data consumed by renewal-timesheets (D-119, D-120):**
    - Compensation type (PER_TASK or SALARIED)
    - Hourly rate (pre-calculated by People API for salaried employees: annual_salary ÷ expected_annual_hours)
    - Exempt status (EXEMPT or NON_EXEMPT) — determines overtime applicability
  - **New People API fields needed (D-119, D-120):**
    - `compensation_type`: PER_TASK | SALARIED
    - `annual_salary`: decimal (salaried employees only)
    - `expected_annual_hours`: integer, default 2080, editable (salaried employees only)
    - `exempt_status`: EXEMPT | NON_EXEMPT
    - `calculated_hourly_rate`: derived field (salary ÷ expected hours) passed to timesheets
  - **Usage:** Financial-system reads employee master data directly from auth portal DB to calculate withholdings. Timesheets reads compensation profile to determine rate source and overtime rules.
  - **Access mechanism (D-124):** Read-only database access. Financial-system and renewal-timesheets get restricted Postgres roles with SELECT on employee/payroll tables in the auth portal's Neon database. Same pattern as D-118.
  - **People Service API (D-132):** REST API also exists at `/api/v1/people/` with Zitadel JWT auth. Used by app-portal admin UI for people/payroll management. Internal app integration uses D-124 DB reads, not the API. Both access the same underlying tables.
  - ~~**REST API status (OLD):** REST API at `https://tools.renewalinitiatives.org` (employee-payroll-data-spec.md) is **DEPRECATED** per D-124. Direct DB reads replace API calls.~~
  - **PII security (D-132):** Tax IDs (SSN, state tax ID) encrypted with AES-256-GCM at the application layer in `employee_payrolls` table. Neon provides encryption at rest and TLS in transit. Restricted Postgres roles limit access to specific tables. Field-level audit trail in `people_audit_logs` with automatic PII masking.
  - **Dependencies:** Chunk 3 (payroll processing logic depends on this data)
  - **Implementation status (D-132):**
    - ✅ DB schema built: `people`, `employee_payrolls`, `people_audit_logs` tables
    - ✅ AES-256-GCM encryption for tax IDs (env var: `PEOPLE_ENCRYPTION_KEY`)
    - ✅ API routes: list, detail, create, update, payroll CRUD, audit trail
    - ✅ JWT auth middleware (validates Zitadel tokens via JWKS)
    - ⬜ D-119/D-120 fields not yet in schema: `compensation_type`, `annual_salary`, `expected_annual_hours`, `exempt_status`
    - ⬜ Drizzle migration not yet generated (`pnpm db:generate`)
    - ⬜ Admin UI for managing people/payroll data not yet built
    - ⬜ Neon cross-project DB access roles not yet provisioned (D-131 noted this as spec/build concern)

#### 4. Ramp credit card → financial-system (D-021)
- **Status:** ✅ Integration confirmed, API/export mechanism TBD
- **Data flow:** Ramp API/export → financial-system transaction queue (pending status) → user categorizes → GL posting (closed status)
- **Expected data fields:**
  - Transaction date
  - Merchant name
  - Amount
  - Card (last 4 digits, cardholder if multiple cards)
  - Ramp's suggested category (if available)
- **Workflow:** Transactions enter financial-system in "pending" queue. User must categorize (select GL account, fund, program). Only after categorization does transaction move to "closed" status and post to GL.
- **GL impact:** Debit expense account (user-categorized), Credit "Credit Card Payable — Ramp"
- **Validation rules (D-024):** MUST categorize before posting (strict enforcement via state machine)
- **Dependencies:**
  - D-021: GL structure (Credit Card Payable account)
  - D-024: Validation (pending → closed state transition requires categorization)
  - Chunk 3: Categorization rules (expense account mapping)
- **API/export questions:**
  - Does Ramp offer REST API? (webhook for new transactions, or polling?)
  - Fallback: CSV export? How frequent? (daily, weekly?)
  - How are refunds/reversals handled? (negative transactions, or separate API events?)
  - Latency: how long between Ramp transaction and availability in API/export?

#### 5. UMass Five bank accounts → financial-system via Plaid (D-093, D-094)
- **Status:** ✅ Integration confirmed — Plaid `/transactions/sync` API
- **Accounts:** Checking (...0180), Savings (...0172), future Escrow (D-069/D-100)
- **Bank platform:** UMass Five runs Fiserv Portico core; connected to Plaid and Finicity (Institution ID 4967)
- **Cost:** $0.30/account/month ($0.60/month for 2 accounts; $0.90/month when escrow added)
- **Confirmed by:** Jeff's direct call with Plaid (2026-02-13)

**API: Plaid `/transactions/sync`**
- **Developer docs:** https://plaid.com/docs/transactions/#overview (may require Plaid dashboard login)
- **Mechanism:** Cursor-based incremental sync. Client stores a cursor string; each call returns transactions added/modified/removed since that cursor, plus a new cursor.
- **Request:** `POST /transactions/sync` with `access_token` + `cursor` (empty string for initial sync)
- **Response structure:**
  ```
  {
    "added": [...],        // New transactions since last cursor
    "modified": [...],     // Previously-synced transactions that changed
    "removed": [...],      // Transaction IDs no longer valid (e.g., pending→posted)
    "next_cursor": "...",  // Store this for next sync call
    "has_more": true/false // Paginate if true
  }
  ```
- **Transaction fields available per item:**
  - `transaction_id` — Plaid's unique ID (stable for posted; changes for pending→posted)
  - `account_id` — Which Plaid account (maps to checking/savings/escrow)
  - `amount` — **Sign convention: positive = money OUT (debits), negative = money IN (credits)**
  - `date` — Posted date (YYYY-MM-DD)
  - `authorized_date` — Date transaction was authorized (may differ from posted date)
  - `name` — Raw transaction description from bank
  - `merchant_name` — Cleaned merchant name (when available)
  - `personal_finance_category` — Plaid's categorization:
    - `primary` (e.g., "TRANSPORTATION")
    - `detailed` (e.g., "TRANSPORTATION_GAS")
    - `confidence_level` ("VERY_HIGH", "HIGH", "MEDIUM", "LOW")
  - `pending` — Boolean; true = not yet posted
  - `payment_channel` — "online", "in store", "other"
  - `counterparties` — Array of entities involved (name, type, logo)
  - `location` — Address/city/state if available
  - `iso_currency_code` — "USD"
- **Pending-to-posted transition:** When a pending transaction posts, the pending version appears in `removed` array and the posted version appears in `added` array (with a new `transaction_id`)
- **History:** Default 90 days on initial sync; up to 24 months available via Plaid support
- **Webhook:** `SYNC_UPDATES_AVAILABLE` fires when new transactions are available. Not used in v1 (daily polling instead per D-094), but available for future optimization.

**Sync schedule (D-094):**
- Daily scheduled job (cron or equivalent) calls `/transactions/sync` for each connected account
- Manual "Sync Now" button in reconciliation UI for on-demand refresh
- Store cursor per account in database; resume from stored cursor on each sync

**Plaid Link (account connection setup):**
- Plaid Link is the client-side component for connecting bank accounts
- User goes through Plaid Link flow once to authenticate with UMass Five
- Produces an `access_token` stored server-side (encrypted at rest)
- One Link flow per institution; single access_token can cover multiple accounts at same bank
- **Question for spec:** Can one Plaid access_token cover all 3 accounts (checking, savings, future escrow) at UMass Five, or does escrow require a separate Link flow?

**Token management:**
- `access_token` is long-lived (does not expire) but can be invalidated if bank changes credentials
- Plaid sends `ITEM_ERROR` webhook if token becomes invalid (user must re-authenticate via Link)
- Store access_token encrypted; never log in plaintext
- Monitor for Plaid status page issues (UMass Five institution health)

**Error handling:**
- `ITEM_LOGIN_REQUIRED` — User must re-authenticate (bank password changed, MFA rotated)
- `TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION` — Retry sync from beginning (rare)
- Rate limits: 15 requests per minute per item (more than sufficient for daily sync)
- Retry logic: exponential backoff for 5xx errors

**Data flow to Chunk 4:**
- Plaid transactions land in a `bank_transactions` staging table
- Chunk 4 reconciliation engine reads from this table
- Matching, rule application, and reconciliation workflow are Chunk 4 concerns
- Chunk 8 owns: connection setup, sync scheduling, token management, error handling, raw data storage

**Dependencies:**
- D-093: Plaid API decision
- D-094: Daily sync schedule
- D-100: Third account (escrow) added when opened
- Chunk 4: Consumes bank transaction data for reconciliation (D-095 through D-099)

#### 6. proposal-rodeo → financial-system (D-009)
- **Status:** ❌ NO INTEGRATION (explicit decision)
- **Rationale:** At RI's scale, no need for CRM → proposal → project pipeline. Won-work is entered directly into financial-system if project tracking is built. Everyone knows what they're working on.

### Known Dependencies (from Chunk 1)

**D-024: GL Validation Rules**
- **Ramp:** MUST categorize before posting (enforce pending queue state machine)
- **Rental income:** MUST identify funding source (data validation in intake)
- **Timesheets:** Default to Unrestricted Fund, allow override via Task Code

### Key Questions for Chunk 8 Discovery
1. **renewal-timesheets API:** REST or shared DB? Real-time or batch? Does it send hourly rate or does financial-system fetch from employee master?
2. **expense-reports-homegrown API:** Per-expense or per-report posting? How are receipts transferred? Pre-categorized or categorize-on-intake?
3. ✅ ~~**app-portal enhancement:** What payroll data exists today? What needs to be added? API endpoint design for employee-payroll-data?~~ **RESOLVED (D-132):** People Service API built in app-portal with full CRUD for people + payroll data. REST API at `/api/v1/people/...` serves admin UI; inter-app integration uses D-124 direct DB reads. `employee-payroll-data-spec.md` is archived — see D-132 and the route files in `app-portal/src/app/api/v1/people/` for current specs.
4. **Ramp:** API availability? Webhook or polling? Refund handling? Export format fallback?
5. ✅ ~~**UMass Five:** Bank export formats (CSV, OFX, API)? Frequency? Manual or automated?~~ **ANSWERED:** Plaid `/transactions/sync` API. Daily scheduled sync. $0.30/account/month. See Integration #5 above for full technical details.
6. ✅ ~~**API architecture:** Should financial-system expose REST APIs for integrations, or use shared database access, or event-driven (message queue)?~~ **RESOLVED (D-118):** Database-mediated integration — internal apps share Postgres database, each getting restricted roles with access only to tables they need. No REST APIs between internal apps. See D-118, D-124.
7. ✅ ~~**⚠️ Employee Data Source of Truth (OQ-001, from D-068):** With payroll restored to v1, where does employee setup and PII live?~~ **RESOLVED (D-132):** app-portal owns employee data via People Service. All three dimensions addressed: (a) **PII security:** AES-256-GCM encryption at application layer for tax IDs, field-level audit logging with masked sensitive values; (b) **workflow origination:** Heather manages people via app-portal admin UI at `/api/v1/people/...` endpoints; (c) **API vs. direct:** Both — REST API for admin UI, D-124 direct DB reads (restricted Postgres roles) for inter-app integration. Schema: `people` table (profile, employment), `employee_payrolls` table (encrypted tax IDs, withholding elections as JSONB), `people_audit_logs` table.

---

## Deferred Cross-Chunk Features

Features that span multiple chunks and are deferred until prerequisite chunks are complete:

### ~~AI Transaction Entry Assistant~~ — **RESOLVED: Absorbed into Copilot Pattern (D-129, D-130)**
- **Status:** ✅ Resolved — no longer a standalone feature
- **Originated in:** D-028 (Chunk 1)
- **Resolution:** Per D-129 (System-Wide AI Copilot) and D-130 (D-028 absorbed), the standalone AI Transaction Entry Assistant is replaced by the copilot pattern. Transaction entry pages get copilot context packages with: transaction data, GL structure, historical patterns, amortization calculation tools, memo generation assistance. The copilot delivers the same value (context-appropriate questions, detailed memos, amortization setup) through the standard right-panel chat available on every page.
- **What remains valid:**
  - GL structure (Prepaid Expenses, Accrued Expenses Payable, Deferred Revenue) — unchanged
  - "Simple GL accounts + detailed memos" principle — unchanged
  - Ramp categorization UX (Chunk 3 Session 5: AI auto-suggestions, user-defined rules, batch categorization) — unchanged as system features; copilot can explain and help configure these
  - File attachments & AI extraction idea — still viable as copilot tool (copilot on transaction entry page could extract metadata from attached files)
- **Per-page copilot context packages:** Each page's spec should define what data, tools, and knowledge resources the copilot gets. This replaces the deferred "design questions" that were listed here.

### System-Wide AI Copilot (D-129)
- **Status:** ✅ Decided — architectural pattern, not a deferred feature
- **Originated in:** Chunk 8 discovery (depreciation assistant deep-dive → evolved into general pattern)
- **Scope:** Every screen in financial-system UI includes right-panel AI copilot with page-specific context and configurable toolkit. Supersedes both D-020 (AI Depreciation Assistant, via D-128) and D-028's AI Transaction Entry Assistant (via D-130).
- **v1:** Copilot operates within financial-system data only
- **v2 (future):** Cross-application access — copilot can query timesheets, expense reports, payroll/people, auth portal
- **Spec impact:** Every page/screen specification should include a "copilot context package" section defining what data, tools, and knowledge resources the copilot gets on that page

---

## Integration Sequence (Recommended Order)

Based on dependencies, suggested discovery/spec order:

1. **Chunk 1** (✅ discovery done) → Phase 2 formal spec
2. **Chunk 2** (🟡 AR/Rental Income done; Q3-Q8 pending) → Continue discovery or parallel with Chunk 1 spec
3. **Chunk 5** (✅ discovery complete) → Ready for spec phase
4. **Chunk 3** (🔴 not started) → After Chunk 1 spec is done (depends on GL structure)
5. **Chunk 8** (✅ discovery complete) → Parallel with Chunk 1-3 (integration contracts can be designed around GL structure)
6. **Chunk 4** (✅ discovery complete) → After Chunk 1 spec + some Chunk 3 work (needs GL structure + transaction flows)
7. **Chunk 6** (🔴 not started) → After Chunk 1 spec + Chunk 3 (needs GL structure + expense tracking)
8. **Chunk 7** (🔴 not started) → After Chunk 2 & 3 (revenue and expense tracking defined)

---

## How to Update This File

**As each chunk moves through discovery:**
- Copy the template for your chunk (below)
- Fill in decisions and impacts as you make them
- Reference other chunks and decisions where applicable
- Link to your chunk's decisions_log for full details

**Template (copy and customize):**

```
### [Decision ID]: [Decision Name]
- **Status:** ✅ Decided / 🟡 Exploring / ❓ TBD
- **Impacts:** [Chunk X, Chunk Y, Chunk Z]
- **What Chunk X needs:** [Brief description]
- **What Chunk Y needs:** [Brief description]
- **Dependencies on other chunks:** [If any]
- **Notes:** [Any caveats or open questions]
```
