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

### D-017: Employee Master Data in internal-app-registry-auth
- **Status:** ✅ Decided
- **Impacts:** Chunk 3, Chunk 8
- **What Chunk 3 needs:** Payroll entry generation depends on fetching employee data (name, tax IDs, withholding elections, pay frequency) from auth system via API.
- **What Chunk 8 needs:** Must design/enhance internal-app-registry-auth API to provide employee data. Separate spec: employee-payroll-data-spec.md (TBD).

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

### D-020: AI Depreciation Assistant
- **Status:** ✅ Decided (setup feature, not production automation)
- **Impacts:** None immediately; scoped to Chunk 1 setup
- **Notes:** Full discovery of AI assistant scope deferred. May impact Chunk 5 (tax compliance on depreciation method choices).

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

### D-028: Prepaid Expenses & Accrued Liabilities — Simple GL Structure with AI-Enhanced Entry
- **Status:** ✅ Decided (GL structure finalized; AI assistant deferred)
- **Impacts:** Chunk 2, Chunk 3, Chunk 8 (AI assistant design)
- **What Chunk 2 needs:** Deferred Revenue account handles prepaid rent from tenants/FVC and grant revenue received but not yet earned. Revenue recognition timing must respect deferral mechanics.
- **What Chunk 3 needs:** Prepaid Expenses and Accrued Expenses Payable accounts handle timing mismatches (insurance paid early, reimbursements owed). Expense entry workflow must support prepaid/accrual questions and amortization setup.
- **What Chunk 8 needs:** AI Transaction Entry Assistant (scope deferred to Chunk 8 or separate mini-chunk after Chunks 2, 3, 8 complete). The assistant asks context-appropriate questions during entry ("What is this payment for?", "What period does it cover?"), writes detailed transaction memos automatically, sets up amortization/deferral schedules, and handles edge cases through conversation (MA property tax abatements, PILOT payments, mid-month rent prorations). Full design requires understanding all transaction sources: rental income, donations, grants, expense reports, timesheets, Ramp credit card, bank feeds.
- **GL Accounts:** Prepaid Expenses (asset), Accrued Expenses Payable (liability), Deferred Revenue (liability).
- **Key principle:** Keep chart of accounts simple (3 accounts instead of 10+), capture detail in transaction memos, use AI to ensure memo consistency. Drill-down transaction reports provide detail when needed.

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

### Deferred to Chunk 5

**Q6: Bad Debt Policy**
- Impacts: Chunk 1 (GL structure), Chunk 2, Chunk 5, Chunk 6
- **What Chunk 5 needs to research:** MA landlord-tenant law on bad debt write-offs, CPA guidance, allowance vs. direct write-off method.

**Q7: In-Kind Contributions & Volunteer Tracking**
- Impacts: Chunk 1 (GL structure), Chunk 2, Chunk 5, Chunk 6
- **What Chunk 5 needs to research:** Funder volunteer hour matching requirements, valuation rules for in-kind contributions.

---

## Chunk 3: Expense Tracking & Categorization

### Status: 🔴 Not started

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

### Key Questions for Chunk 3 Discovery
1. How do approved expense reports create GL entries? (AP entry + liability vs. direct posting?)
2. How do timesheets create payroll entries? (Single entry per pay period or per timesheet?)
3. How is functional split allocated? (Manual worksheet, rule engine, or manual journal entry?)
4. What's the Ramp workflow? (Ramp categorization happens in Chunk 8; Chunk 3 consumes categorized transactions)

---

## Chunk 4: Bank Reconciliation

### Status: 🔴 Not started

### Known Dependencies (from Chunk 1)

**D-015: Opening Balance**
- $12,835 opening equity is GL-only (no bank counterpart)
- Reconciliation must account for GL entries with no bank match

**D-019: Depreciation**
- Monthly depreciation is GL-only (no bank transaction)
- Reconciliation must accommodate GL-only entries

**D-021: Ramp Credit Card**
- Ramp transactions create GL entries (Debit Expense, Credit Credit Card Payable)
- Bank feeds show Ramp card purchases; reconciliation must match GL to Ramp statement

**D-022: AHP Loan**
- Loan draws appear as bank deposits and GL entries
- Available credit is tracked separately (contingent, not GL)

**D-023: Loan Forgiveness**
- Forgiveness is GL-only (no bank transaction)
- Must be documented with AHP's written notice

**D-025: Rental Income Recognition — Accrual Basis**
- AR is generated on due date (month N), cash received month N+1
- Bank reconciliation shows gap: expected AR > received cash (explained by AR aging)

**D-026: AR Tracking**
- AR reconciliation may show variance (units paying slowly or partially)
- System should alert when tenant rents come in lower than expected

**D-027: Rent Adjustments**
- Adjustments may reduce AR or cash
- Reconciliation must account for adjustment types

### Key Questions for Chunk 4 Discovery
1. What bank export formats does UMass Five support? (CSV, OFX, QFX, API?)
2. How does RI currently reconcile? (Manual per bank statement? Monthly? As-needed?)
3. Should AR reconciliation be automated or manual variance reporting?
4. What about interest accrual on AHP loan? (D-011 specifies monthly accrual; reconciliation must account for it)

---

## Chunk 5: Compliance Reporting

### Status: 🟡 Discovery (compliance calendar documented; detailed funder requirements pending)

### Known Dependencies (from Chunk 1 — Things Chunk 5 Must Research & Specify)

**Security Deposits & Escrow Accounts** (GL structure pending)
- MA landlord-tenant law requirement
- Escrow account structure, interest accrual, annual tenant payments
- Once researched: Chunk 1 will add GL structure (Security Deposit Liability, Escrow Payable, Interest Expense)

**Bad Debt Policy** (GL structure pending)
- MA law on bad debt write-offs
- Allowance-for-doubtful-accounts vs. direct write-off method
- Once decided: Chunk 1 will add GL structure if needed

**Rent Proration & Partial-Month Moves** (GL structure pending)
- VASH/MVRAP partial-month rules
- MA landlord-tenant law on proration and vacate refunds
- Once researched: Chunk 1 will add detail to D-027 (Rent Adjustments GL structure)

**In-Kind Contributions & Volunteer Tracking** (GL structure pending)
- Funder volunteer hour matching requirements
- Valuation rules for in-kind donations
- Once researched: Chunk 1 will add GL structure

**Historic Tax Credit / Historic Tax Credit Equity** (GL structure pending)
- Deal structure and capital stack mechanics
- Tax credit equity treatment (restricted vs. unrestricted)
- Once deal closes: Chunk 1 will add GL structure for tax credit equity accounts

**Tenant Law Compliance in GL** (GL structure pending)
- Security deposit deductions (damages, unpaid rent)
- Escrow account interest accrual mechanics
- Once researched: Chunk 1 will add GL structure

### Known Chunk 1 Dependencies (that impact Chunk 5 spec)

**D-014: Net Assets Split — With/Without Donor Restrictions**
- Chunk 5 must specify GL mechanics for restricted net asset movement
- When restricted grants are expended, net assets move from restricted to unrestricted
- 990 reporting depends on this mechanics

**D-023: Loan Forgiveness — Income Treatment**
- Chunk 5 must verify IRS compliance
- Forgiveness counts as contribution for public support test (170(b)(1)(A)(vi))
- RI must maintain documentation of AHP's charitable intent

**D-018: Payroll GL — Year-End Allocation**
- Chunk 5 must specify functional split allocation policy (Program/Admin/Fundraising)
- 990 Line 24 depends on this split

### Key Questions for Chunk 5 Discovery
1. **MA Landlord-Tenant Law:** Security deposits, interest, escrow, tenant remedies, deductions
2. **VASH/MVRAP Program Rules:** Partial months, proration, subsidy mechanics, compliance tracking
3. **Tax Credit Mechanics:** Historic Tax Credit and historic tax credit equity, basis, IRS rules, restricted/unrestricted classification
4. **Funder Requirements:** Specific requirements from grants (once SARE, CDBG, CPA awards arrive or applications clarify)
5. **990 Reporting:** Form 1023 program area mapping, functional split allocation, public support test calculations
6. **In-Kind & Volunteer Tracking:** Funder requirements, valuation, substantiation

---

## Chunk 6: Board & Management Reporting

### Status: 🔴 Not started

### Known Dependencies (from Chunk 1)

**D-012: Program Classes — Single Class**
- Board reporting shows single "Property Operations" program
- Functional split (Program/Admin/Fundraising) derived at year-end (not transaction-level)

**D-013: Fund Accounting**
- Board sees financial statements by fund (General Fund, AHP Fund, future restricted funds)
- Separate P&L and Balance Sheet by fund, or consolidated with note disclosure? (TBD)

**D-014: Net Assets Split**
- Balance sheet shows "Net Assets Without Donor Restrictions" and "Net Assets With Donor Restrictions" separately
- Board understands restricted vs. unrestricted equity

**D-018: Payroll GL — Year-End Allocation**
- Functional split allocation for board reporting (Program/Admin/Fundraising salaries)
- Separate reporting or combined with note? (TBD)

**D-019: Depreciation**
- Board sees depreciation expense on P&L, accumulated depreciation on Balance Sheet
- Fixed asset schedule or note disclosure? (TBD)

**D-021: Ramp Integration**
- Board visibility into credit card liability and expenses
- Monthly reconciliation and approval? (TBD)

**D-022: AHP Loan**
- Balance sheet shows Loan Payable ($100K drawn)
- Note disclosure: credit facility size ($3.5M), available credit ($3.4M)

**D-023: Loan Forgiveness**
- Income event on P&L (if forgiveness occurs)
- Board notification and tracking? (TBD)

**D-025, D-026, D-027: Rental Income**
- AR disclosed on balance sheet
- AR aging report (total AR by age bucket)
- Rental income trend analysis (core rent vs. adjustments)

### Key Questions for Chunk 6 Discovery
1. **Financial Statement Format:** What statements does the board currently review? (P&L, Balance Sheet, Cash Flow?) Frequency?
2. **Fund-Level Reporting:** Does board want consolidated or by-fund statements?
3. **Functional Split Display:** How should Program/Admin/Fundraising split be shown? (Separate columns? Notes?)
4. **Dashboard / KPIs:** What metrics does board track? (Cash position? AR aging? Grant compliance?)
5. **Board Pack:** Should system generate board pack or just financial statements?

---

## Chunk 7: Budgeting

### Status: 🔴 Not started

### Known Dependencies (from Chunk 1)

**D-013: Fund Accounting**
- Budgets are fund-level (General Fund budget, AHP Fund budget, future restricted fund budgets)
- Budget vs. actuals tracked by fund

**D-022: AHP Loan — Available Credit**
- Available credit ($3.4M) is a planning/contingency resource
- Budgeting may use it for "if-then" scenarios but not assume spending

### Key Questions for Chunk 7 Discovery
1. **Budget Process:** Annual? Board-approved? Rolling forecasts?
2. **Budget Granularity:** Line-item (by expense account)? By program? By fund? Combination?
3. **Variance Reporting:** Monthly budget vs. actuals? Reforecasting triggers?
4. **Multi-Fund Budgets:** How does RI handle budgets for restricted grants (once they arrive)?

---

## Chunk 8: Integration Layer

### Status: 🟡 Discovery (integration architecture partially defined)

### Inter-App Dependencies Summary

Chunk 8 is the integration hub connecting financial-system to the existing app ecosystem. Three internal app integrations (all inbound to financial-system), one external service integration (Ramp), and one bank data integration (UMass Five).

#### 1. renewal-timesheets → financial-system (D-008)
- **Status:** 🟡 Integration confirmed, API contract defined in Chunk 3 discovery
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
  - D-017: Employee master data (tax withholding, pay frequency) from internal-app-registry-auth
  - D-018: Single payroll GL account (no functional split at entry)
  - D-024: GL validation (default fund, task code override)
  - **Chunk 3 discovery:** Batching per pay period (not real-time per timesheet), task code + separate fund selection
- **renewal-timesheets improvements needed (from Chunk 3 discovery):**
  - Add "Funding Source" dropdown to time entry UI (separate from Task Code)
  - Receive fund list from financial-system API (dynamic, updates as new funds created)
  - Implement auto-suggestion logic (pre-populate fund based on task code + historical patterns)
  - Default to "Unrestricted Fund" when no pattern exists
  - Send fund attribution in approved timesheet API payload
- **API contract questions (still TBD):**
  - REST API or shared database access?
  - Real-time (per-timesheet approval) or batch (end of day/week)?
  - Does renewal-timesheets send hourly rate, or does financial-system fetch from employee master?
  - How are task codes structured? (dropdown, predefined codes?)

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
- **API contract questions (still TBD):**
  - REST API or shared database?
  - Does it send one API call per expense report (with line items array), or one call per line item?
  - How are attachments/receipts transferred? (file paths, Base64, URLs?)
  - Error handling: what if GL account or fund code is invalid?

#### 3. internal-app-registry-auth → financial-system (D-006, D-017)
- **Status:** ✅ Integration confirmed
- **Two distinct use cases:**

  **3a. Authentication & Authorization (D-006)**
  - **Data consumed:** User identity, role (Admin/User), app-level access permissions
  - **Usage:** Every financial-system page load checks: is this user authorized to access financial-system?
  - **Access model:** All-or-nothing. If user has financial-system access, they see everything (no in-app permissions, no read-only mode).
  - **API status:** Shared auth system exists; financial-system consumes it (read-only)

  **3b. Employee Payroll Master Data (D-017)**
  - **Data consumed:**
    - Employee name (legal name for tax forms)
    - Tax IDs (SSN/EIN for federal, state tax ID for MA)
    - W-4 withholding elections (federal income tax, state income tax, social security, medicare, 401k, HSA)
    - Pay frequency (weekly, biweekly, monthly)
    - Worker type (W2_EMPLOYEE or CONTRACTOR_1099)
    - Employment status (via payroll_enabled flag)
  - **Usage:** When processing payroll from timesheets (Chunk 3 + Chunk 8), financial-system fetches employee master data to calculate withholdings and generate payroll entries
  - **API status:** ✅ **COMPLETE** — REST API exists at `https://tools.renewalinitiatives.org`. Full spec: `employee-payroll-data-spec.md`
  - **Base URL:** `https://tools.renewalinitiatives.org`
  - **Endpoints:**
    - `GET /api/v1/users/payroll` — List all payroll-enabled employees (paginated)
    - `GET /api/v1/users/{user_id}/payroll` — Get individual employee payroll data (includes decrypted tax IDs, full withholding elections)
    - `GET /api/v1/users/{user_id}/payroll/audit` — Audit trail of payroll data changes
  - **Authentication:** `X-API-Key` header with `PAYROLL_API_KEY` environment variable
  - **Webhook support:** Optional inbound webhook for real-time employee data change notifications
  - **Dependencies:** Chunk 3 (payroll processing logic depends on this data)
  - **Implementation notes:**
    - Cache employee data (refresh daily or on webhook notification)
    - Handle 401 (invalid key), 404 (employee not found), 503 (retry logic)
    - Tax IDs are PII — encrypt at rest, never log in plaintext
    - Audit all API calls (who fetched whose data, when)

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

#### 5. UMass Five bank accounts → financial-system (Chunk 4 dependency)
- **Status:** ❓ TBD
- **Accounts:** Checking (...0180), Savings (...0172)
- **Data needed:** Transaction date, description, debit/credit amount, running balance
- **Usage:** Bank reconciliation (Chunk 4)
- **Format questions:**
  - CSV export from online banking?
  - OFX/QFX download?
  - Bank API (if UMass Five offers one)?
  - Manual entry from paper statements?
- **Dependencies:** Chunk 4 (bank reconciliation workflow)

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
3. ✅ ~~**internal-app-registry-auth enhancement:** What payroll data exists today? What needs to be added? API endpoint design for employee-payroll-data?~~ **ANSWERED:** REST API exists at tools.renewalinitiatives.org with full payroll endpoints. See `employee-payroll-data-spec.md`
4. **Ramp:** API availability? Webhook or polling? Refund handling? Export format fallback?
5. **UMass Five:** Bank export formats (CSV, OFX, API)? Frequency? Manual or automated?
6. **API architecture:** Should financial-system expose REST APIs for integrations, or use shared database access, or event-driven (message queue)?

---

## Deferred Cross-Chunk Features

Features that span multiple chunks and are deferred until prerequisite chunks are complete:

### AI Transaction Entry Assistant
- **Deferred to:** Chunk 8 or separate mini-chunk after Chunks 2, 3, 8 complete
- **Originated in:** D-028 (Chunk 1)
- **Purpose:** Intelligent conversational transaction entry that asks context-appropriate questions, writes detailed memos automatically, sets up amortization/deferral schedules, and handles edge cases through dialogue rather than rigid account structures.
- **Prerequisites:** Must understand all transaction sources before designing:
  - Chunk 2: Rental income, donations, grants, deferred revenue mechanics
  - Chunk 3: Expenses, reimbursements, prepaids, accruals
  - Chunk 8: Ramp credit card, bank feeds, expense reports integration, timesheets integration
- **Design questions to answer:**
  - What questions should the AI ask for each transaction type?
  - How to ensure memo consistency across different entry points (manual entry, Ramp import, bank feed)?
  - How to handle novel situations (MA property tax abatements, PILOT payments, mid-month rent prorations)?
  - Should the AI assistant be part of each transaction entry flow, or a separate "review and enhance" step?
  - How to balance automation (set up amortization automatically) with user control (ability to override)?
  - **File attachments & AI extraction (discovery idea):** Enable attaching files to transactions (receipts, insurance policies, invoices, contracts). AI can extract metadata from attachments: coverage dates from insurance policies, compliance requirements, vendor information, line-item detail from invoices. This enhances the conversational entry experience: "I see you attached an insurance policy — it covers 12 months starting November 2025. Should I set up monthly amortization?" Use cases: receipts for expense reports, insurance policies for prepaid tracking, invoices for AP, contracts for compliance monitoring.
- **Impact:** Enables simple GL structure (D-028) by ensuring detailed memos without relying on human discipline. Differentiates the financial-system from COTS products by using conversational AI rather than rigid dropdowns.

---

## Integration Sequence (Recommended Order)

Based on dependencies, suggested discovery/spec order:

1. **Chunk 1** (✅ discovery done) → Phase 2 formal spec
2. **Chunk 2** (🟡 AR/Rental Income done; Q3-Q8 pending) → Continue discovery or parallel with Chunk 1 spec
3. **Chunk 5** (🟡 compliance calendar done; detailed research pending) → Parallel with Chunk 1 spec (MA law research can proceed independently)
4. **Chunk 3** (🔴 not started) → After Chunk 1 spec is done (depends on GL structure)
5. **Chunk 8** (🟡 architecture sketched) → Parallel with Chunk 1-3 (integration contracts can be designed around GL structure)
6. **Chunk 4** (🔴 not started) → After Chunk 1 spec + some Chunk 3 work (needs GL structure + transaction flows)
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
