# Chunk 3: Expense Tracking & Categorization — Discovery

**Status:** ✅ Complete (as of 2026-02-11)

Recording outgoing money. Categorization by program vs. admin vs. fundraising (required for 990). Receives approved expense reports from expense-reports-homegrown (D-007) and approved timesheets from renewal-timesheets as payroll obligations (D-008).

---

## Discovery Sessions

### Session 1: Approved Expense Reports → GL Entry Flow (2026-02-11)

**Context:** expense-reports-homegrown has 4-state workflow (open → submitted → approved → rejected). Each approved report contains individual expenses with: amount, date, merchant, memo, category (categoryId/categoryName), project (projectId/projectName), type (out_of_pocket or mileage), receipt URLs.

**Questions resolved:**

1. **GL Entry Timing** — ✅ **ANSWERED:** Immediate upon approval via API from expense-reports-homegrown. No separate "post to GL" action needed.

2. **Entry Granularity** — ✅ **ANSWERED:** **Option B: One GL entry per expense line item.** Each line item has GL account assignment and fund categorization. Industry best practice supports line-item entries rather than rollups.
   - Rationale: Each expense line needs independent GL account and fund attribution. Funds are designated restricted or unrestricted, enabling compliance checks per line item. Adjustments (if needed) happen at line-item level without affecting payment.

3. **Accounts Payable Treatment** — ✅ **ANSWERED:** **Yes, create liability.** Approved expense reports create company obligation to pay.
   - GL Entry: Debit [GL Expense Account], Credit Reimbursements Payable
   - Compliance adjustments (e.g., wrong fund attribution during submission) can be flagged and corrected in financial-system without affecting employee payment.
   - Payment execution is separate from GL posting.

4. **Category → GL Account Mapping** — ✅ **ANSWERED:** **financial-system pushes GL accounts to expense-reports-homegrown.** No crosswalk table or complex upkeep.
   - expense-reports app stores GL account codes in advance (received from financial-system)
   - When user creates expense, they select from available GL accounts
   - financial-system is source of truth for chart of accounts

5. **Fund/Project Attribution** — ✅ **ANSWERED:** **Rename "Projects" → "Funding Source" in expense-reports-homegrown.**
   - Current "projectId/projectName" fields were a workaround to leverage QBO's project functionality
   - These should be renamed to "Funding Source" to match actual purpose (fund accounting per D-013)
   - Each expense line item codes to a fund (General Fund, AHP Fund, future restricted funds)
   - **ACTION ITEM:** Update expense-reports-homegrown schema/UI to rename Projects → Funding Source during Chunk 8 integration work

**Integration implications identified:**

*All cross-system integration requirements are documented in Chunk 8 (Integration Layer) for implementation during integration build phase.*

**expense-reports-homegrown improvements needed:**
- Rename "Projects" → "Funding Source" (schema + UI)
- Add API endpoint to receive GL account list from financial-system (for expense category dropdown)
- Add API endpoint to receive fund list from financial-system (for funding source dropdown)
- Dynamic updates when chart of accounts or fund list changes in financial-system

**renewal-timesheets improvements needed:**
- Add "Funding Source" dropdown to time entry UI (separate from Task Code)
- Add API endpoint to receive fund list from financial-system
- Implement auto-suggestion logic (pre-populate fund based on task code + historical patterns)
- Default to "Unrestricted Fund" when no historical pattern exists (per D-024)
- Send fund attribution in API payload to financial-system when timesheet is approved

**financial-system API requirements:**
- Push chart of accounts to expense-reports-homegrown (list of GL accounts with codes/names)
- Push fund list to both expense-reports-homegrown and renewal-timesheets (list of funds with restricted/unrestricted designation)
- Receive fund attribution from both systems when transactions are posted

*See Chunk 8 dependencies.md section for detailed integration contracts and API specifications.*

---

### Session 2: Approved Timesheets → Payroll GL Entry Flow (2026-02-11)

**Context:** renewal-timesheets app sends approved timesheets to financial-system for payroll processing. D-017 established that employee master data (tax IDs, withholding elections, pay frequency) lives in app-portal. D-018 established simple payroll GL structure: single "Salaries & Wages" expense account, with liability accounts for withholdings. D-024 established that timesheets default to Unrestricted Fund, with override via Task Code.

**Additional context (from user):**
- Timesheets will be submitted intermittently in 2026, not on a disciplined weekly schedule
- Expectation: timesheets arrive in batches and should accumulate immediately as liability
- Time entries tied to "Task Codes" which determine pay rates (not strict salaried employees)
- Work is sporadic, not consistent 40 hrs/week against single task
- Task codes currently lack tie-in to financial-system "fund" concept
- Need to track restricted grant fund usage through task codes

**Questions resolved:**

1. **GL Entry Timing & Batching** — ✅ **ANSWERED:** **Option B: Batch per payroll run at end of pay period.**
   - Rationale: Withholding calculations are inherently per-pay-period (federal/state tax depends on total period earnings). Batching matches how payroll is actually paid (one check per period, not per timesheet). GL entries are cleaner (one entry per employee per period vs. multiple per-timesheet entries). Timing lag is immaterial (days, not weeks) and does not violate GAAP accrual principles.
   - Workflow: Approved timesheets accumulate in "pending payroll" state → At pay period close, system calculates gross pay + withholdings per employee → Single GL entry per employee: DR Salaries & Wages, CR Payroll Payable (net), CR [Withholding liability accounts]
   - **Pay period definition:** ✅ **ANSWERED:** **Option A: Organization-wide monthly payroll.**
     - Initial setup: Monthly payroll (everyone paid on same schedule, e.g., last day of month or first Friday of following month)
     - Future flexibility: System design allows changing to biweekly if needed as org scales
     - Rationale: At 2-5 employees with sporadic 2026 work, monthly is simpler administratively (one payroll run per month). As org scales and work becomes more regular, can switch to biweekly without redesign.

**Questions resolved (continued):**

2. **Task Code → Fund Mapping** — ✅ **ANSWERED:** **Option B: Task code + separate fund selection dropdown, with auto-suggestion.**
   - Rationale: Cleaner task code list (10 types of work = 10 task codes, regardless of funding sources). Flexible: same task can charge to different grants without creating new codes. Easier maintenance: add funding source once, works with all existing tasks.
   - Implementation: renewal-timesheets shows two selections per time entry:
     - Task Code dropdown (e.g., "C4: Farming sheep," "PM: Project management," etc.)
     - Funding Source dropdown (e.g., "SARE Grant," "Historic Tax Credit Fund," "AHP Fund," "Unrestricted")
   - Default behavior (per D-024): Funding Source defaults to "Unrestricted Fund" (user only changes when needed)
   - **Auto-suggestion enhancement:** renewal-timesheets can pre-populate fund based on historical patterns (e.g., if 90% of "Farming sheep" entries go to SARE Grant, suggest that as default instead of Unrestricted)
   - **ACTION ITEMS for renewal-timesheets (documented in Chunk 8):**
     - Add "Funding Source" dropdown to time entry UI
     - Receive fund list from financial-system API (dynamic, updates as new funds are created per D-013)
     - Implement auto-suggestion logic based on task code + historical usage patterns
     - Default to "Unrestricted Fund" if no historical pattern exists (per D-024)

---

### Session 3: Functional Split Allocation — Year-End Process (2026-02-11)

**Context:** D-018 established that functional split (Program/Admin/Fundraising) happens at year-end via manual allocation, not transaction-level coding. IRS Form 990 requires this split for all expenses. At RI's scale (2-5 employees with mixed roles), a simple year-end process with great UI is the goal.

**Questions resolved:**

1. **Allocation Granularity** — ✅ **ANSWERED:** **Per GL account** (not per-transaction drill-down).
   - User allocates each GL account with expenses to Program/Admin/Fundraising percentages
   - Example: "Salaries & Wages: 60% Program, 30% Admin, 10% Fundraising"
   - No need to drill into individual transactions
   - At RI's scale (~10-15 expense accounts), this is a 10-minute year-end exercise

2. **Smart Defaults** — ✅ **ANSWERED:** **Yes, implement smart defaults.**
   - System suggests allocations based on:
     - Last year's percentages (if available)
     - Account type patterns (e.g., "Property Taxes" likely 100% Program)
     - User-defined rules (e.g., "Insurance is always 80/20/0")
   - Reduces year-end effort, ensures consistency across years

3. **Journal Entry Treatment** — ✅ **ANSWERED:** **Option 2: Store allocations without touching GL.**
   - GL remains simple all year (e.g., "Salaries & Wages: $85,000" — no split)
   - Allocation percentages stored as metadata (e.g., "60/30/10")
   - Form 990 prep applies stored percentages to calculate functional split on-the-fly
   - **Rationale:** Both approaches are GAAP-compliant. Option 2 (stored allocations) is simpler for small nonprofits. Board doesn't need mid-year functional split visibility (they see fund-level reporting instead). Easier to revise allocations before filing 990. Cleaner GL with fewer accounts.
   - **Trade-off:** Board can't see "Admin costs this quarter" directly from GL — requires applying allocations via report
   - **User confirmed:** Board won't care about mid-year functional split visibility

**Implementation notes:**
- Year-end allocation UI: wizard-style workflow, one GL account at a time
- Show total amount for each account, ask for % split (must sum to 100%)
- Pre-populate with smart defaults (last year's allocation or account type suggestion)
- Allow user to set permanent rules (e.g., "Property Insurance is always 85/15/0")
- Store allocations in database linked to fiscal year
- Form 990 generation applies stored allocations to calculate functional expense breakdown
- Board reporting can optionally show functional split by applying allocations (but not required)

---

### Session 4: Consultant Costs & Vendor Invoice Processing (2026-02-11)

**Context:** RI will engage consultants and vendors for property development (architecture, construction, engineering) and ongoing operations (legal, accounting, property management). These are not employees and not reimbursable expenses — they're vendor invoices for services or fixed-price contracts.

**Questions to resolve:**

1. **Vendor Invoice Workflow** — ✅ **ANSWERED:** **Full Purchase Order (PO) system for all vendor invoices.**
   - **Anticipated vendor types:**
     - Large fixed-price contracts (construction, architecture, engineering)
     - Hourly consultants (legal, accounting, property management)
     - Materials and services purchase orders
   - **Workflow:**
     1. **Create Purchase Order**: User uploads signed contract PDF
     2. **AI Contract Extraction**: System extracts milestones, dates, deliverables, payment terms, covenants (e.g., expense detail requirements, receipt requirements)
     3. **User Review & Confirmation**: User reviews AI-extracted data, edits if needed, saves PO
     4. **Invoice Matching**: When invoices arrive, user connects invoice to PO
     5. **Compliance Warnings**: System warns if violations occur or are approaching:
        - Time deadlines approaching/passed
        - Budget capacity reached/exceeded
        - Covenant breaches (insufficient expense detail, missing receipts, etc.)
   - **GL Integration:**
     - PO creation records commitment (optional budget encumbrance)
     - Invoice processing: 3-way match (PO → Invoice → Payment)
     - GL entry on invoice approval: DR [CIP or Expense Account], CR Accounts Payable (coded to fund per D-013)
     - Payment execution clears AP liability
   - **Rationale:** Even though RI is small scale, full PO system provides:
     - Contract compliance tracking (milestones, deadlines, deliverables)
     - Budget control (warns before overspending)
     - Covenant enforcement (receipt requirements, expense detail requirements)
     - Audit trail (signed contract → PO → invoice → payment linkage)
     - AI extraction reduces data entry burden despite added process steps

2. **AHP-Paid Consultants** — ✅ **ANSWERED:** Not relevant for future. Mecky contract was one-time through AHP. All future consulting will be direct to RI. No future AHP-paid consultants.

3. **Development Consultants → CIP vs. Expense** — ✅ **ANSWERED:** **Option A: Development costs debit CIP (Construction in Progress).**
   - Rationale: Development costs (architecture, pre-construction, legal fees for acquisition, permits, renovation, any costs to prepare building for intended use) are **capital costs**, not operating expenses. These are part of acquiring the asset (the Easthampton property), not operational spending. GAAP requires capitalization of development costs. Tax credits (Historic Tax Credits, LIHTC) require accurate capitalization — development costs must be part of the building's "basis."
   - **GL Treatment:**
     - During development: DR Construction in Progress, CR Cash/Accounts Payable (coded to appropriate fund)
     - When building is placed in service: DR Building (fixed asset), CR Construction in Progress (transfer accumulated costs)
     - After placed in service: Ongoing costs (repairs, utilities, insurance) debit operating expense accounts (D-031)
   - **Vendor invoice workflow implication:** When processing vendor invoices for development work (architecture, construction, engineering, legal for acquisition, permits), the financial-system must allow user to select "CIP" as the destination account (not just expense accounts). User needs ability to distinguish capital vs. operating invoices at entry time.
   - **Fund coding:** Development invoices are coded to funds (Historic Tax Credit Fund, AHP Fund, CPA Fund, etc.) per D-013, D-032. Each invoice debits CIP and codes to the funding source.

4. **1099-NEC Preparation** — ✅ **ANSWERED:** **Build Tiers 1-4 (payment tracking, W-9 collection, data export, PDF form generation). Skip IRS FIRE integration.**
   - **Requirement:** Vendors/contractors paid $600+ for services in a calendar year must receive 1099-NEC by Jan 31 of following year. RI must also file with IRS.
   - **System capabilities:**
     - **Tier 1 (Payment Tracking):** Auto-track vendor payments by calendar year, flag $600+ threshold crossings, distinguish reportable vs. non-reportable entities
     - **Tier 2 (W-9 Collection):** Workflow to collect W-9 forms before first payment (legal name, TIN/EIN, address, entity type). Secure storage of TINs. Validate completeness before year-end.
     - **Tier 3 (Data Export):** Generate CSV/report with vendor name, TIN, address, total payments (for accountant or third-party service)
     - **Tier 4 (Form Generation):** Generate fillable PDF 1099-NEC forms using IRS templates (straightforward data placement on standard form)
   - **Not building:** IRS FIRE system integration (free electronic filing system, but overkill for 2-10 vendors/year — accountant can e-file PDFs through FIRE or third-party service)
   - **Compliance context:** Penalties $60-$310 per form for late/incorrect filing (escalates with delay)
   - **Rationale:** Keep everything in one system. W-9 collection during vendor setup ensures data completeness. PDF generation is simple and provides immediate value without external dependencies.
   - **Clarification:** No future AHP-paid consultants to track (Mecky was one-time)

---

### Session 5: Ramp Corporate Card Integration (2026-02-11)

**Context:** RI uses Ramp corporate cards for operational purchases. Currently managed via Ramp website, not connected to QBO. Low volume: 2-5 transactions/month normally, 10-30/month during peak construction phase. Only authorized persons have cards, so spending is pre-approved (no expense report approval workflow needed).

**Questions resolved:**

1. **Integration Architecture** — ✅ **ANSWERED:** **Ramp API → financial-system direct integration. No intermediary through expense-reports-homegrown.**
   - Rationale: No reason to route through expense-reports app. Different workflows (card transactions vs. employee reimbursements). Keep them separate. All Ramp work happens in financial-system.
   - **Current state:** Ramp managed on Ramp website today. User chose not to connect to QBO, preferring to build connection in financial-system.

2. **Categorization Location** — ✅ **ANSWERED:** **Categorization happens in financial-system.**
   - Not in Ramp website (too disconnected from GL)
   - Not in expense-reports-homegrown (wrong system)
   - In financial-system: user assigns GL account + funding source per transaction

3. **Approval Workflow** — ✅ **ANSWERED:** **No approval workflow needed.**
   - Rationale: Only authorized cardholders have Ramp cards. Spending is pre-approved by virtue of card issuance. No manager approval step required.
   - GL posting happens immediately upon categorization (no pending approval state)

4. **Categorization Workflow & UX** — ✅ **ANSWERED:** **Batch categorization with AI auto-suggestions and user-defined rules.**
   - **Transaction sync:** Daily sync from Ramp API to financial-system
   - **Landing state:** Transactions land in "Uncategorized" queue
   - **User workflow:**
     - User reviews uncategorized queue periodically (weekly or before month close)
     - System shows AI-suggested categorization for each transaction:
       - Based on merchant patterns (historical data: "Five Star Construction → CIP, Historic Tax Credit Fund")
       - Based on description keywords (e.g., "lumber" → Building Materials, "legal fee" → Professional Services)
       - Based on user-defined rules (see below)
     - User confirms AI suggestion or selects different GL account + fund
     - Bulk actions available (select multiple, apply same categorization)
   - **Auto-categorization rules:** User can create permanent rules:
     - "Merchant = Five Star Construction → always CIP, Historic Tax Credit Fund"
     - "Description contains 'insurance' → always Property Insurance, Unrestricted Fund"
     - Rules auto-categorize future transactions without user review (but user can review/modify anytime)
   - **GL posting:** Once categorized, immediate GL entry: DR [GL Account], CR Ramp Card Liability (paid when Ramp bill is paid)
   - **Volume consideration:** At 2-30 transactions/month, batch review is efficient. Don't over-engineer real-time categorization prompts.

**Integration implications:**
- Ramp API integration (Chunk 8): Daily sync of transactions (date, merchant, amount, description, cardholder)
- No connection to expense-reports-homegrown needed
- Separate categorization workflow from expense report flow (different UX, different pain points, some overlapping functionality is acceptable)

---

## Key Questions (High-Level)

- How are approved expense reports converted to GL entries?
- How are timesheets converted to payroll GL entries?
- How is the functional split (Program/Admin/Fundraising) allocated?
- What's the Ramp categorization workflow?
- How are consultant costs handled?

## Dependencies

**From Chunk 1:**
- D-007: Expense report integration
- D-008: Timesheet integration
- D-013: Fund accounting (expenses code to funds)
- D-017: Employee master data for payroll
- D-018: Single payroll GL account
- D-024: GL validation (timesheets default to Unrestricted Fund)
- D-028: Prepaid/accrued expense structure
- D-031: Granular property operating expense accounts
- D-032: Construction in Progress (CIP) for development costs

**Depends On:**
- Chunk 8: API contracts with expense-reports-homegrown, renewal-timesheets, and Ramp

---

## Discovery Complete — Summary

**All expense inflow workflows defined:**

1. **Employee Reimbursements** → expense-reports-homegrown API → per-line-item GL entries with immediate AP liability (Session 1)
2. **Payroll** → renewal-timesheets API → monthly batched GL entries with payroll liability + withholdings (Session 2)
3. **Corporate Cards** → Ramp API → batch categorization in financial-system with AI suggestions + rules (Session 5)
4. **Vendor Invoices** → Full PO system with AI contract extraction, 3-way match, compliance warnings (Session 4)

**Additional workflows defined:**

5. **Functional Split Allocation** → Year-end per-GL-account allocation with smart defaults, stored percentages (Session 3)
6. **1099-NEC Preparation** → Auto-tracking, W-9 collection, data export, PDF form generation (Session 4)
7. **CIP Treatment** → Development costs debit Construction in Progress (Session 4)

**Key architectural decisions:**
- Per-line-item GL granularity for expense reports (not rolled up)
- Monthly payroll batching with task code + separate fund selection
- Stored functional allocations (no GL journal entries)
- Full PO system for all vendor invoices (not hybrid approach)
- Direct Ramp API integration (not through expense-reports)
- No approval workflow for Ramp transactions (pre-authorized cards)

**Chunk 8 integration requirements documented:**
- expense-reports-homegrown: GL account dropdown, funding source rename, API endpoints
- renewal-timesheets: funding source dropdown with auto-suggestion, monthly batching context
- Ramp: Daily transaction sync, merchant + description data for AI categorization

**Next steps:**
- Begin discovery on next chunk (Chunk 4: Cash Management, Chunk 5: Reporting & Analytics, or Chunk 6: Fixed Assets)
- Or: Review any Chunk 3 edge cases before moving forward
