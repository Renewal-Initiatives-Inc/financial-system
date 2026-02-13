# Chunk 6: Board & Management Reporting — Discovery

**Status:** ✅ Discovery complete (Sessions 1-2, 2026-02-12 through 2026-02-13)

Financial statements, budget vs. actuals, dashboards. Whatever Heather, the board, and AHP need to see.

---

## Report Consumers & Their Needs

The system serves three distinct audiences with different report needs:

### 1. Board of Directors (Quarterly)
**Current practice (from company_facts.md):** Board receives P&L, Balance Sheet, Cash Flow at quarterly meetings. Requested 3-month forward cash projections at January 2026 meeting. Board meets quarterly (July, October, January so far).

**Known board members:** Heather Takle (President), Jeff Takle (Clerk), Damien Newman (Treasurer). All 3 people — direct communication, minimal ceremony needed.

### 2. Heather Takle (Day-to-Day Management)
ED handling day-to-day bookkeeping. Needs operational visibility: what's been paid, what's owed, where does cash stand, are tenants paying rent on time, how much is left on restricted grants.

### 3. AHP (Annual Covenant Requirement)
Per loan agreement: RI must provide annual financials or Form 990 to AHP. Damien Newman is both AHP officer and RI Treasurer, so there's informal ongoing visibility, but formal annual delivery is required.

---

## Exploration Area 1: Financial Statements

### What the system must produce

Based on upstream decisions and GAAP requirements, the system needs to generate these core statements:

**A. Statement of Financial Position (Balance Sheet)**
- Assets, Liabilities, Net Assets
- Net assets split: Without Donor Restrictions / With Donor Restrictions (D-014)
- Fund-level detail available (D-013): General Fund, AHP Fund, future restricted funds
- Shows: bank balances, AR (by-tenant per D-026), Grants Receivable (D-030), Pledges Receivable (D-050), Prepaid Expenses (D-028), CIP or Building (D-032/D-019), Credit Card Payable (D-021), Reimbursements Payable, AHP Loan Payable (D-022), Refundable Advance (D-046), Deferred Revenue (D-028)
- Loan note disclosure: "$3.5M facility, $100K drawn, $3.4M available" (D-022)
- Current vs. noncurrent classification

**B. Statement of Activities (P&L / Income Statement)**
- Revenue by type: rental income, grants, donations, earned income, investment income (D-048), event revenue (D-047 — exchange vs. contribution split), loan forgiveness (D-049)
- Expenses by nature (D-031 granular property operating accounts)
- Net asset releases from restricted → unrestricted (D-029 automatic on fund-coded expense)
- Changes in net assets by restriction class
- Rental income shows core rent vs. adjustments separately (D-027)

**C. Statement of Cash Flows**
- Indirect method: reconcile change in net assets to cash from operations
- Operating, investing (CIP/building), financing (AHP loan draws/payments)
- New for RI — not produced in QuickBooks currently

**D. Statement of Functional Expenses**
- Matrix: rows = expense by nature (salaries, utilities, insurance, etc. per D-031), columns = function (Program/Admin/Fundraising per D-018)
- Year-end allocation (D-018 — single Salaries & Wages account, split at year-end)
- Required for Form 990 reconciliation

**E. Notes / Supplementary Schedules**
- Accounting policies summary (Chunk 5 GAAP documentation)
- Restricted net assets detail by fund (D-013)
- AHP loan terms and available credit (D-022)
- Fixed asset schedule / depreciation (D-019)
- Grant commitments and conditions (D-046 conditional grants)
- AR aging summary

### ❓ Question Q6-01: GAAP Presentation — Now or Later?

The discovery doc flagged this question. Here's the trade-off:

**Option A: Full GAAP from day one**
- Pros: Audit-ready when the time comes. Board sees the "real" nonprofit financial picture. Builds habits around proper presentation. Not significantly harder to implement — the GL structure already supports it.
- Cons: More complex reports for a 3-person board that currently reads a simple P&L.

**Option B: Simplified presentation, add GAAP formatting later**
- Pros: Simpler, faster to build. Board gets what they're used to.
- Cons: Creates rework when audit required. Board doesn't build familiarity with GAAP format.

**Proposed: Option A (Full GAAP), with a "dashboard summary" layer on top.** Rationale: The GL structure (Chunks 1-3) already captures everything needed for GAAP statements. The reporting layer just formats it. Building simplified reports first and GAAP later means building two things. Build GAAP once, add a simplified dashboard/summary view for quick glances. The 3-person board can learn the GAAP format — it's not that different from what they already see.

→ **Needs Jeff's input**

---

## Exploration Area 2: Fund-Level Reporting

### The Question: Consolidated vs. By-Fund?

D-013 established full fund accounting. The board needs to see financial statements, but how?

**Options:**
1. **Consolidated only** — one set of statements, all funds combined. Fund-level detail in notes.
2. **By-fund only** — separate statements per fund. No consolidated view.
3. **Both** — consolidated view with ability to drill into fund-level. This is the obvious answer.

**Proposed: Consolidated primary view + fund-level drill-down.** Board quarterly pack shows consolidated statements. Any line item can be expanded by fund. Fund-level P&L and balance sheet available on demand.

This matches how the data is structured (every transaction coded to a fund per D-013/D-035) — consolidated is just "sum all funds," fund-level is "filter by fund."

### Fund-Specific Reports

Some funds will need dedicated reports beyond financial statements:

- **Restricted grant funds:** Draw-down tracking. "SARE Fund: $250K awarded, $50K spent, $200K remaining restricted" (D-029). Progress toward conditions for conditional grants (D-046).
- **AHP Fund:** Capital deployment tracking. CIP accumulation by fund (D-032). Loan draw vs. spending.
- **General Fund:** Operating cash position. Unrestricted liquidity.

→ **Needs Jeff's input:** Does the board want separate fund statements in the quarterly pack, or just consolidated with fund drill-down available?

---

## Exploration Area 3: Management / Operational Reports

Beyond formal financial statements, Heather needs operational reports for day-to-day management:

### A. Cash Position Dashboard
- Current bank balances (checking + savings)
- Outstanding payables (Reimbursements Payable, Credit Card Payable, Vendor invoices)
- Outstanding receivables (tenant AR, Grants Receivable, Pledges Receivable)
- Net available cash = bank - payables + near-term receivables
- AHP loan: drawn vs. available credit

### B. AR Aging Report
- By-tenant/unit aging (30/60/90+ days) per D-026
- Grants Receivable aging (D-030)
- Pledges Receivable aging (D-050)
- Alerts for slow-paying or partial-paying tenants (D-026)

### C. Rental Income Dashboard
- Core rent vs. adjustments (D-027) — trend over time
- Occupancy tracking (which units are occupied, vacant)
- Vacancy loss contra-revenue (D-031)
- Collection rate (rent billed vs. rent received)

### D. Grant/Contract Pipeline
- Active grants/contracts with balances, conditions, deadlines
- Fund draw-down status per restricted fund (D-029)
- Conditional grant progress (D-046 — matching requirements met? milestones achieved?)
- Budget vs. actuals by grant category (D-035 — expense attribution)

### E. Expense Tracking
- Property operating expenses by category (D-031 — 13 granular accounts)
- Budget vs. actual by expense category (Chunk 7 dependency — but report structure belongs here)
- Utility trends (electric, gas, water — solar ROI measurement, electrification tracking per D-031)
- Vendor spending summary

### F. Donor Reports
- Giving history by donor (D-038)
- Campaign/event performance
- Donation revenue: restricted vs. unrestricted (D-036)

→ **Needs Jeff's input:** Which of these are must-haves for launch vs. nice-to-haves?

---

## Exploration Area 4: Board Pack

### ❓ Question Q6-02: Should the system produce a board pack?

A "board pack" = pre-assembled set of reports for quarterly board meetings. Could be:

**Option A: System generates downloadable board pack (PDF or similar)**
- Financial statements (Balance Sheet, P&L, Cash Flow, Functional Expenses)
- Cash position summary
- AR aging
- Grant/fund status
- AHP loan summary
- 3-month forward cash projection (board requested this)

**Option B: Board members access the system directly and view reports on-screen**
- Treasurer (Damien) has direct system access (action item from Jan 2026 meeting)
- Board members navigate to reports section

**Option C: Both — system produces a PDF pack AND has interactive reports**

**Proposed: Option C, prioritizing the interactive views.** The system should have good on-screen reports that Heather uses daily and the board can access. For quarterly meetings, the system can export a PDF snapshot. The PDF is a "print view" of the same data, not a separate reporting system. This avoids maintaining two report formats.

→ **Needs Jeff's input**

---

## Exploration Area 5: Audit Log Viewer

D-041 established audit logging for all financial actions. Chunk 6 is responsible for the UI to view these logs.

**What the audit log viewer needs:**
- Filter by: user, date range, action type (create/edit/void/reverse), entity type (transaction, fund, vendor, etc.)
- Shows: timestamp, user, action, before/after state
- Voided transactions visible with "VOID" badge (D-053)
- Late entries identifiable: "transactions posted to [Month X] after [Date Y]" (D-045)
- Supports Treasurer/board review

**Implementation note:** This is straightforward — a filterable table reading from the audit log. Not complex, but important for the "no approval workflows" model (D-044) where audit logging is the compensating control.

---

## Exploration Area 6: Report Timing & Snapshots

### D-045 Implications (No Period Locking)

Since periods are never locked, reports reflect current state including any late entries. Key implications:

- **"As of" timestamp on every report** — "These financials are as of February 12, 2026 at 3:15 PM"
- **Board may want "preliminary" vs. "final" distinction** — D-045 noted board can request specific date ranges. Example: "February financials as of March 10" (before late entries) vs. "as of April 15" (after late entries).
- **Late entry visibility:** Audit log can show "transactions posted to February after March 10" to highlight what changed since the board last saw these numbers.

**Proposed approach:** Every report shows "as of [datetime]." No separate "preliminary/final" mechanism — if the board wants to compare, they regenerate the same report at a later date and the system shows what changed (via audit log).

---

## Exploration Area 7: 3-Month Forward Cash Projection

The board specifically requested this at the January 2026 meeting. This sits at the intersection of Chunk 6 (reporting) and Chunk 7 (budgeting).

### What it likely includes:
- Starting cash position
- Expected inflows: rent due (from lease schedule), expected grant receipts, anticipated donations
- Expected outflows: known payables, recurring expenses (insurance, utilities), AHP interest (annual Dec 31), loan draws planned
- Net cash position projected monthly for 3 months

### Key question: How automated?
- **Fully manual:** Heather enters projection assumptions each quarter. System just formats it.
- **Semi-automated:** System pre-fills from known data (AR schedule, recurring payables, loan terms) and Heather adjusts.
- **Mostly automated:** System uses GL history + AR/AP schedules + recurring patterns to project, with manual override for one-time items.

**Proposed: Semi-automated.** The system knows: rent due dates and amounts (AR schedule), recurring monthly expenses (from GL history), AHP loan interest timing and amount, and outstanding payables. It can pre-fill a 3-month projection template. Heather adds: expected grant receipts, planned loan draws, one-time expenses, unusual items. This gives the board a data-grounded projection without requiring a full budgeting engine (Chunk 7).

→ **Needs Jeff's input:** Is this the right scope, or should cash projections be purely a Chunk 7 concern?

---

## Full Dependency Inventory

### From Chunk 1 (Core Ledger)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-012 | Single "Property Operations" program class. Board sees consolidated program. |
| D-013 | Fund-level statements. All financials report by fund with consolidated view. |
| D-014 | Net asset split on balance sheet (With/Without Donor Restrictions). |
| D-016 | Fund-level capital reporting (CIP spending by fund). Details TBD from Chunk 5. |
| D-018 | Functional split (Program/Admin/Fundraising) derived from year-end allocation, not transaction-level. |
| D-019 | Depreciation on P&L, accumulated depreciation on balance sheet, fixed asset schedule. |
| D-022 | AHP Loan Payable on balance sheet. Note: facility size, drawn, available. |
| D-023/D-049 | Loan forgiveness as income event on P&L. Board visibility. |
| D-025 | P&L shows accrued rental income. Balance sheet shows AR. |
| D-026 | AR aging report by tenant/unit (30/60/90+ days). |
| D-027 | Rental income P&L: core rent vs. adjustments separately. Adjustment trends. |
| D-028 | Prepaid Expenses, Accrued Expenses, Deferred Revenue on balance sheet. |
| D-029 | Fund draw-down reports (awarded vs. spent vs. remaining restricted). Net asset releases visible. |
| D-030 | Grants Receivable separate from tenant AR on balance sheet. |
| D-031 | Property operating expense breakdown on P&L. Budget variance by category. Utility trends. |
| D-032 | CIP on balance sheet during development, Building after placed in service. Capital spending reports. |
| D-033 | FY25 transaction history available for year-over-year comparison if needed. |

### From Chunk 2 (Revenue)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-034/D-046 | Grant pipeline reporting. Conditional vs. unconditional visibility. Refundable Advance on balance sheet. |
| D-035 | Fund-level spending reports from mandatory expense attribution. |
| D-036 | Donation revenue by restricted/unrestricted. |
| D-037 | Earned income (farm lease, fees) reported separately from donations/grants. |
| D-038 | Donor giving history reports. |
| D-039 | No Schedule A / public support test reporting required initially. |
| D-047 | Event revenue: exchange vs. contribution split on P&L. |
| D-048 | Investment/interest income reported separately. |
| D-050 | Pledges Receivable on balance sheet (simple, no allowance). |

### From Chunk 3 (Expenses)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-040 | Payment status tracking (payable created → paid via bank portal). |
| D-041 | Audit log viewer UI. Filter by user, date, action type, entity. |
| D-044 | No "pending approval" category in reports. All posted = approved. |
| D-045 | "As of" timestamp on all reports. Late entry visibility via audit log. |
| D-051 | Multi-fund split transactions displayed in reports (one line with breakdown? separate lines?). |
| D-053 | Voided transactions excluded from reports. Visible in transaction history with VOID badge. |

### From Chunk 4 (Bank Reconciliation)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-093/D-094 | Bank feed data available for cash position reporting. Daily sync means balances are current within 24 hours. |
| D-097 | Two-way reconciliation status could surface in dashboard (unmatched items count). |
| D-104 | AR timing handled by AR aging report, not bank rec — confirms AR aging report design. |

### From Chunk 5 (Compliance)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-061 | Functional allocation percentages feed Statement of Functional Expenses. 990-style report auto-generates from allocation + D-062 mapping. |
| D-062 | GL account → 990 line item mapping enables 990-format view toggle on functional expense report. |
| D-065 | Compliance calendar displayed through Chunk 6 UI. Dashboard widget + full-page view. |
| D-069 | Security deposit liability on balance sheet. Per-tenant deposit register report for MA compliance. |
| D-070 | Per-tenant interest tracking, anniversary alerts in compliance calendar. |
| D-076 | Grant spend-down monitoring via existing fund reports (D-059). No separate dashboard. |
| D-077 | Funder-specific report templates deferred. System provides building blocks. |
| D-080 | Fixed asset schedule shows building components with individual useful lives and depreciation. |
| D-085 | Annual in-kind / Schedule M review reminder in compliance calendar. |

### From Chunk 7 (Budgeting)
| Decision | What Chunk 6 Needs |
|----------|-------------------|
| D-086 | Budget cycle milestones (Sept–Dec) shown in compliance calendar. |
| D-087 | Monthly budget amounts per GL account per fund feed D-058 comparison columns. |
| D-088 | Report layout needs capital/financing budget section alongside operating budget vs. actuals. |
| D-089 | Color-coded variance thresholds on all reports with budget columns. Configurable thresholds. |
| D-091 | Cash projection display container: auto-fill + manual override, quarterly update, line-item detail. |
| D-092 | Multi-year grant budgets use same fund drill-down (D-055). |

---

## Questions — Resolved

**Q6-01: GAAP Presentation — Now or Later?**
✅ **Full GAAP from day one.** GL already supports it. Dashboard summary layer on top for quick glances.

**Q6-02: Board Pack Format**
✅ **Both — interactive reports + PDF export.** PDF is a print view of the interactive report. No separate codebase.

**Q6-03: Fund-Level in Board Pack**
✅ **Consolidated primary + fund drill-down.** Same report, different filter.

**Q6-04: Management Reports Priority**
✅ **All reports are launch scope.** Jeff's direction: "build the whole thing right up front." Reports are standard, not fancy — effective and relevant. All operational reports (cash position, AR aging, rent collection, grant tracking, expense breakdown, donor history) ship at launch.

**Q6-05: Cash Projection Ownership**
✅ **Chunk 7 only.** 3-month forward cash projection is a budgeting/forecasting function, not a Chunk 6 reporting concern. Chunk 6 provides the report container/format; Chunk 7 provides the projection logic and data.

**Q6-06: Report Delivery**
✅ **On-screen + PDF export.** Covered by Q6-02 answer. Board pack is PDF snapshot of interactive reports.

**Q6-07: Multi-Fund Display**
🟡 **Deferred to spec phase.** Context-dependent — financial statements show consolidated with fund column, transaction detail shows line-per-fund-allocation. Will specify per-report during spec.

**Q6-08: Comparison Periods**
✅ **Current period + YTD + Budget.** Three-column layout: current period, year-to-date, and budget. Budget column depends on Chunk 7 providing budget data — column shows "—" or "N/A" until budgets exist.

**Q6-09: Security Deposit Reports**
✅ **Per-tenant Security Deposit Register (report #22).** Shows: tenant name, unit, deposit amount, date collected, escrow bank, interest rate, interest accrued, interest paid, tenancy anniversary, next interest due. Summary totals must match GL liability and escrow bank balance. Alert for anniversaries within 30 days. Compliance-critical (MA treble damages).

**Q6-10: Compliance Calendar Display**
✅ **Full-page view + dashboard widget.** Compliance calendar (D-065) displayed as both a dedicated page (filterable by deadline type: tax, tenant, grant, budget) and a "next 30 days" summary widget on the dashboard home screen. Report #23.

**Q6-11: Budget Variance Visual Treatment**
✅ **Universal color-coded variance highlighting.** Any report showing a budget column gets conditional color formatting per D-089. Applies to P&L, fund-level P&L, property expense breakdown, and any other budget vs. actuals view. Specific thresholds and colors deferred to spec.

**Q6-12: Capital & Financing Budget Reporting**
✅ **Dedicated Capital & Financing Budget Summary (report #24).** Shows planned vs. actual for loan draws, capital spending by fund, and debt service. Separate from operating P&L budget comparison. Addresses D-088 scope.

**Q6-13: Cash Projection Display Design**
✅ **Auto-fill + manual override pattern.** Starting cash (from bank), expected inflows (rent from AR, grants from GR, budget revenue), expected outflows (payables, budget expenses, AHP interest, capital spending). Each line auto-populated with editable override field. Adjustment notes visible ("system: $5,000; Heather adjusted to $4,200 — Unit 7 vacancy expected"). AHP available credit shown as context. Monthly columns for 3 months.

**Q6-14: 990-Format Functional Expense Report**
✅ **Toggle on report #4.** Statement of Functional Expenses has two view modes: GAAP format (RI chart of accounts as rows) and 990 format (IRS Part IX 23 line items as rows, mapped via D-062 `form_990_line` field). Same data, same functional allocation, different row groupings. No separate report.

**Q6-15: Payroll Reports**
✅ **Five payroll reports added (reports #25-29).** Payroll Register (by period, by employee, gross/withholding/net/fund), Payroll Tax Liability Summary (federal + MA withholding, FICA, deposit obligations), W-2 Data Verification (year-end per-employee box preview), Employer Payroll Cost Summary (total burden: wages + employer FICA + benefits), Quarterly 941/M-941 Prep (formatted to match federal 941 and MA M-941 line items). Added post-D-068 restoring payroll to v1.

**Q6-16: Dashboard Home Screen**
✅ **Five-section composite view.** (1) Cash snapshot: bank balances, net available cash, drill-to-detail. (2) Alerts/attention items: overdue rent, compliance deadlines within 30 days, payroll deposits due, unmatched bank transactions. (3) Rent collection this month: billed vs. collected by unit. (4) Fund balances: restricted vs. unrestricted net assets, per-fund breakdown. (5) Recent activity: last 5-10 transactions posted.

**Q6-17: Report Access & Permissions**
✅ **No role-based views. Everyone sees everything.** Consistent with D-006 (all users fully trusted). Same home screen, same reports for Heather, Damien, and any future user. Board pack PDF is a curated export, not a restricted view. Behavioral differences only: Heather uses daily, Damien uses quarterly/on-demand, board receives PDFs.

**Q6-18: Data Export & Delivery**
✅ **PDF + CSV export on all reports. Manual board pack delivery.** Any report exportable as PDF (formatted) or CSV (raw data for CPA/ad hoc analysis). Board pack generated manually by Heather on demand — no automated generation or email distribution. Compliance calendar email reminders (D-065) are the only automated delivery mechanism.

---

## Decisions — Finalized

### D-054: Full GAAP Financial Statement Presentation from Day One
- **Date:** 2026-02-12
- **Decision:** Board reports use GAAP-compliant nonprofit financial statement format from launch
- Four core statements: Financial Position (Balance Sheet), Activities (P&L), Cash Flows, Functional Expenses
- Supplementary: Notes/schedules, fund detail, AHP loan disclosure
- Dashboard/summary layer provides quick-glance operational view
- **Rationale:** GL structure (Chunks 1-3) already captures everything needed. Building simplified-first then GAAP-later means building two things. Build GAAP once, add dashboard layer. 3-person board can learn the format.
- **Affects:** All report consumers. Sets the standard for all financial output.

### D-055: Consolidated + Fund Drill-Down Reporting Model
- **Date:** 2026-02-12
- **Decision:** Primary view is consolidated across all funds. Every financial statement supports fund-level filtering/drill-down. No separate per-fund statement generation — same report, different filter.
- **Rationale:** Data is already fund-coded (D-013, D-035). Consolidated = sum all funds. Fund-level = filter by fund. One report engine, one template, configurable view.
- **Affects:** Chunk 7 (budget vs. actuals by fund uses same drill-down model)

### D-056: Interactive Reports + PDF Export
- **Date:** 2026-02-12
- **Decision:** All reports are interactive on-screen (filterable, expandable, drillable). Any report exportable to PDF for board distribution. Board pack = curated set of PDF exports. No separate board report codebase — PDF is a print/export view of the same interactive report.
- **Rationale:** Heather uses interactive reports daily. Board gets PDF snapshots quarterly. One codebase serves both. Avoids maintaining parallel report formats.
- **Affects:** Delivery mechanism only. No downstream architectural impact.

### D-057: "As Of" Timestamp on All Reports
- **Date:** 2026-02-12
- **Decision:** Every report header shows generation datetime ("These financials are as of [date/time]"). No "preliminary/final" mechanism. Audit log viewer enables "what changed since date X" queries for board members who want to understand late entries.
- **Rationale:** Direct consequence of D-045 (no period locking). Reports reflect current state at generation time. If board wants to compare, they regenerate and check the audit log.
- **Affects:** Extends D-045. All reports.

### D-058: Report Comparison Columns — Current + YTD + Budget
- **Date:** 2026-02-12
- **Decision:** Financial statements include three comparison columns: (1) Current period (month or quarter), (2) Year-to-date, (3) Budget. Budget column depends on Chunk 7 providing budget data — shows "—" until budgets are entered.
- **Rationale:** Gives the board context: what happened this period, cumulative picture, and how it compares to plan. Budget column is a placeholder until Chunk 7 is built, but the report layout accounts for it from day one.
- **Affects:** Chunk 7 must provide budget data in a format this report can consume. Report layout is designed for 3 columns from launch.

### D-059: All Operational Reports Ship at Launch (Updated)
- **Date:** 2026-02-12 (updated 2026-02-13)
- **Decision:** All 29 reports in the inventory are launch scope. No tiering or phasing. Reports are standard, not fancy — effective and relevant. Original 21 expanded to 29 after gap analysis incorporating Chunk 5 compliance dependencies (security deposit register, compliance calendar), Chunk 7 budget dependencies (capital/financing budget summary), and D-068 payroll restoration (5 payroll reports).
- **Rationale:** Jeff's direction: "build the whole thing right up front." The reports are straightforward reads of GL data that already exists. The reporting layer is the reason the system exists — skimping here defeats the purpose. Most reports are variations on the same data (filter by fund, filter by date, filter by account type).
- **Affects:** Scope commitment. All reports built as part of initial system delivery. Dashboard home screen (D-113) is the system landing page.

### D-060: 3-Month Cash Projection Deferred to Chunk 7
- **Date:** 2026-02-12
- **Decision:** The 3-month forward cash projection requested by the board is a budgeting/forecasting function, owned by Chunk 7. Chunk 6 provides the report container and display format; Chunk 7 provides the projection logic, assumptions, and data model.
- **Rationale:** Cash projection requires assumptions about future inflows/outflows — that's budgeting, not reporting. Keeping it in Chunk 7 avoids building forecasting logic in two places.
- **Affects:** Chunk 7 must specify: projection data model, automation level (manual vs. semi-auto vs. auto), and how projection data feeds into the Chunk 6 report display.

### D-108: Security Deposit Register Report
- **Date:** 2026-02-13
- **Decision:** Per-tenant Security Deposit Register is report #22 in the inventory. Shows deposit amount, date, escrow bank, interest rate, interest accrued/paid, tenancy anniversary, next interest due. Summary totals must reconcile to GL liability (Security Deposits Held) and escrow bank balance. 30-day anniversary alert.
- **Rationale:** MA G.L. c. 186 § 15B imposes treble damages for any non-compliance. Compliance-grade per-tenant tracking with proactive anniversary alerts is essential.
- **Affects:** Extends D-069, D-070. Compliance calendar (D-065) also tracks anniversaries; this report provides the detail view.

### D-109: Compliance Calendar — Full Page + Dashboard Widget
- **Date:** 2026-02-13
- **Decision:** Compliance calendar (D-065 data) displayed as both a dedicated full-page view (filterable by type: tax, tenant, grant, budget) and a "next 30 days" summary widget on the dashboard home screen. Report #23.
- **Rationale:** Multiple deadline types (990 filing, Form PC, budget cycle, per-tenant interest, grant reviews, Schedule M) warrant a dedicated page for comprehensive view. Dashboard widget ensures nothing is missed during daily use.
- **Affects:** Extends D-065. Dashboard design (D-113).

### D-110: Universal Color-Coded Budget Variance
- **Date:** 2026-02-13
- **Decision:** Any report displaying a budget comparison column gets conditional color-coded variance highlighting. Applies universally — P&L, fund-level P&L, property expense breakdown, capital budget summary, etc. Specific thresholds and color scheme deferred to spec.
- **Rationale:** Consistent visual treatment across all budget reports. No partial implementation — if a report has a budget column, it gets variance colors. Extends D-089.
- **Affects:** All reports with budget columns. Spec must define threshold values and color scheme.

### D-111: Capital & Financing Budget Summary Report
- **Date:** 2026-02-13
- **Decision:** Dedicated Capital & Financing Budget Summary (report #24) showing planned vs. actual for: loan draws, capital spending by fund, and debt service. Separate from operating P&L budget comparison.
- **Rationale:** Capital and financing activities are balance sheet movements, not P&L items. Operating budget vs. actuals on the P&L covers 90% of board needs, but capital/financing needs its own view — especially post-closing when AHP draws and Easthampton development are the biggest financial events.
- **Affects:** Extends D-088. Chunk 7 must provide capital and financing budget data.

### D-112: Cash Projection Display — Auto-Fill + Manual Override
- **Date:** 2026-02-13
- **Decision:** Report #15 (cash projection display container) uses auto-fill + manual override pattern. Sections: starting cash (bank balances), expected inflows (rent from AR, grants from GR, budget revenue, manual "other"), expected outflows (payables, budget expenses, AHP interest, capital spending, manual "other"). Each line auto-populated with editable override field. Adjustment notes visible. Monthly columns for 3 months. AHP available credit shown as informational context.
- **Rationale:** Gives the board a data-grounded projection. Heather adjusts for items the system can't predict (pending grants, planned draws, vacancies). Adjustment notes provide audit trail for board questions ("why did you change the rent number?").
- **Affects:** Extends D-060, D-091. Chunk 7 provides projection logic and pre-fill data; Chunk 6 provides the display container and override mechanism.

### D-113: Dashboard Home Screen — Five-Section Composite View
- **Date:** 2026-02-13
- **Decision:** System landing page is a dashboard with five sections: (1) Cash snapshot (bank balances, net available cash), (2) Alerts/attention items (overdue rent, compliance deadlines, payroll deposits, unmatched bank transactions), (3) Rent collection this month (billed vs. collected by unit), (4) Fund balances (restricted vs. unrestricted, per-fund), (5) Recent activity (last 5-10 transactions). Each section links to the full report for drill-down.
- **Rationale:** This is Heather's daily driver — the most-used screen in the system. Must answer "what do I need to know right now?" at a glance. Each section is a summary widget pulling from a specific operational report.
- **Affects:** References reports #5 (cash position), #6 (AR aging), #8 (rent collection), #9 (fund draw-down), #18 (transaction history), #23 (compliance calendar).

### D-114: No Role-Based Report Views
- **Date:** 2026-02-13
- **Decision:** All users see the same home screen, same reports, same data. No role-based filtering or restricted views. Consistent with D-006 (all users fully trusted, all-or-nothing access). Behavioral differences only: Heather uses daily, Damien uses quarterly/on-demand, board receives PDF exports.
- **Rationale:** 3-person board with full trust. Building role-based views adds complexity for no benefit. If Damien wants to see payroll data, he can — he's the Treasurer.
- **Affects:** Simplifies UI — one view, one codebase. No permission logic in the reporting layer.

### D-115: PDF + CSV Export, Manual Board Pack Delivery
- **Date:** 2026-02-13
- **Decision:** All reports exportable as PDF (formatted for print/distribution) and CSV (raw data for CPA, ad hoc analysis). Board pack generated manually by Heather on demand — no automated generation or email distribution schedule. Compliance calendar email reminders (D-065) are the only automated delivery.
- **Rationale:** CSV export covers the "give me the data" use case (CPA needs raw numbers). Manual board pack delivery keeps scope simple — Heather already communicates directly with the 3-person board. Automated scheduling adds engineering for a quarterly task that takes 2 minutes manually.
- **Affects:** Extends D-056 (adds CSV alongside PDF). No automated delivery infrastructure to build.

### D-116: 990-Format Toggle on Functional Expense Report
- **Date:** 2026-02-13
- **Decision:** Statement of Functional Expenses (report #4) has two view modes: GAAP format (RI chart of accounts as rows) and 990 format (IRS Part IX 23 line items as rows). Toggle between views. Same data, same D-061 functional allocation percentages, different row groupings. 990 format uses D-062 `form_990_line` field to map GL accounts to IRS lines.
- **Rationale:** One report, two views avoids maintaining separate report templates. CPA gets the 990-format view for filing prep; board gets the GAAP view for financial statement context. Underlying data is identical.
- **Affects:** Depends on D-061 (functional allocation) and D-062 (990 line item mapping).

### D-117: Payroll Reports — Five Reports Added to Inventory
- **Date:** 2026-02-13
- **Decision:** Five payroll reports added to the report inventory as reports #25-29, reflecting D-068 restoring payroll to v1:
  - #25 Payroll Register: by pay period, per employee — gross pay, federal/state withholding, FICA, net pay, fund allocation
  - #26 Payroll Tax Liability Summary: running view of federal income tax, MA income tax, employer + employee FICA, deposit due dates, deposited vs. outstanding
  - #27 W-2 Data Verification: year-end per-employee preview of W-2 box values (1-6, 16-17) for review before generation
  - #28 Employer Payroll Cost Summary: total employer burden by period (wages + employer FICA + benefits), budget comparison
  - #29 Quarterly 941/M-941 Prep: quarterly snapshot formatted to match federal Form 941 and MA Form M-941 line items (total wages, withholding, FICA, deposit reconciliation)
- **Rationale:** In-house payroll (D-068) requires operational reports for verification (payroll register), compliance (tax liability, 941 prep, W-2 verification), and cost management (employer cost summary). These are standard payroll reports — not fancy, but essential.
- **Affects:** Chunk 3 (payroll processing) must produce the data these reports consume. Updates D-059 scope from 21 to 29 reports.

---

## Report Inventory (Final — 29 Reports)

### Core Financial Statements (Quarterly Board Pack)
1. Statement of Financial Position (Balance Sheet)
2. Statement of Activities (P&L)
3. Statement of Cash Flows
4. Statement of Functional Expenses — with GAAP/990 format toggle (D-116)

### Operational Dashboards (Heather — Daily/Weekly)
5. Cash position summary
6. AR aging (tenants + grants + pledges)
7. Outstanding payables
8. Rent collection status

### Fund & Grant Reports (As Needed)
9. Fund draw-down / restricted grant status
10. Grant compliance tracking (conditional grants — D-046)
11. Fund-level P&L and balance sheet (drill-down from consolidated)

### Specialized Reports
12. Property operating expense breakdown (D-031 — 13 categories)
13. Utility trend analysis (solar ROI, electrification measurement)
14. Donor giving history (D-038)
15. 3-month forward cash projection — auto-fill + manual override display (D-112, data from Chunk 7 per D-060)
16. AHP loan summary (drawn, available, interest accrued, annual payment)

### Audit & Compliance
17. Audit log viewer (D-041 — filter by user, date, action, entity)
18. Transaction history (includes voided transactions with VOID badge — D-053)
19. Late entry report ("transactions posted to [period] after [date]" — D-045)

### Annual / Covenant
20. Annual financial package for AHP (covenant requirement)
21. Data supporting Form 990 / Form PC preparation (Chunk 5 primary, Chunk 6 delivery)

### Compliance (added Session 2 — from Chunk 5 dependencies)
22. Security Deposit Register — per-tenant with interest tracking and anniversary alerts (D-108)
23. Compliance Calendar — full-page view with type filtering + dashboard widget (D-109)

### Budget (added Session 2 — from Chunk 7 dependencies)
24. Capital & Financing Budget Summary — planned vs. actual for loans, capital, debt service (D-111)

### Payroll (added Session 2 — from D-068 restoring payroll to v1)
25. Payroll Register — by period, per employee, gross/withholding/net/fund (D-117)
26. Payroll Tax Liability Summary — federal + MA withholding, FICA, deposit obligations (D-117)
27. W-2 Data Verification — year-end per-employee box preview (D-117)
28. Employer Payroll Cost Summary — total burden by period with budget comparison (D-117)
29. Quarterly 941/M-941 Prep — formatted to match federal 941 and MA M-941 line items (D-117)

### Dashboard Home Screen (not a report — composite view per D-113)
- Cash snapshot | Alerts/attention items | Rent collection | Fund balances | Recent activity
- Each section links to its full report for drill-down

### Cross-Cutting Features (apply to all reports)
- "As of" timestamp on every report (D-057)
- PDF + CSV export on all reports (D-115)
- Color-coded budget variance on any report with budget column (D-110)
- Fund drill-down on any report with fund-level data (D-055)
- Current period + YTD + Budget comparison columns on financial statements (D-058)
