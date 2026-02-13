# Chunk 7: Budgeting — Discovery

**Status:** ✅ Discovery complete (7 decisions: D-086 through D-092, spec-ready)
**Started:** 2026-02-13

Annual budget creation, tracking actuals against budget, grant-specific budgets, 3-month cash projection.

---

## Context

RI has not yet established a formal budgeting process. This system will be the first. The budgeting module needs to be practical for a 2-person operation (Heather doing day-to-day, Jeff building/maintaining) while providing the structure the board expects as RI scales from pre-revenue into property operations.

No scenario/what-if budgeting in v1 — single budget only. Scenario planning happens outside the system.

---

## Upstream Dependencies (Comprehensive)

### From Chunk 1 (Core Ledger)

| Decision | What Chunk 7 Needs |
|----------|-------------------|
| D-013 | **Fund-level budgets.** Budget by fund (General Fund, AHP Fund, future restricted funds). Budget vs. actuals tracked per fund. |
| D-022 | **AHP available credit as planning input.** $3.4M available is a contingency resource. Budget does not assume draws unless planned. System should surface available credit context but not treat it as budgeted revenue. |
| D-031 | **Granular property expense budgets.** 13 property operating expense GL accounts (utilities by type, insurance, repairs, etc.). Pro forma line items must match GL accounts for direct variance analysis — not a single "Property Operating Expenses" budget line. |

### From Chunk 2 (Revenue)

| Decision | What Chunk 7 Needs |
|----------|-------------------|
| D-034 | **Grant revenue budgeting.** Revenue recognized at award letter. Budget should reflect awarded grants. |
| D-035 | **Grant expense attribution.** Restricted fund budgets track planned spending by expense category within grants. |

### From Chunk 3 (Expenses)

| Decision | What Chunk 7 Needs |
|----------|-------------------|
| D-018 | **Single payroll GL account.** Budget for "Salaries & Wages" is one line; functional split (Program/Admin/Fundraising) is year-end, not budgeted separately. |

### From Chunk 5 (Compliance)

| Decision | What Chunk 7 Needs |
|----------|-------------------|
| D-076 | **Grant spend-down monitoring.** Existing fund reports (D-059) provide spend-down data. No dedicated monitoring dashboard needed — budget vs. actuals by fund serves this purpose. |

### From Chunk 6 (Board Reporting)

| Decision | What Chunk 7 Needs to Provide |
|----------|-------------------------------|
| D-055 | **Budget vs. actuals uses same fund drill-down model.** Budget data must be filterable by fund, same as actuals. |
| D-058 | **Budget amounts by GL account by period.** Financial statements show Current Period / YTD / Budget columns. Chunk 7 must provide the "Budget" column data. |
| D-060 | **3-month cash projection — Chunk 7 owns entirely.** Projection logic, data model, automation level, and how it feeds into Chunk 6's display container. Board requested this at January 2026 meeting. |

---

## Exploration Area 1: Budget Process & Governance

### Current State
RI has no formal budget process yet. Form 1023 included 3-year revenue/expense projections ($100K→$150K→$195K revenue; $85K→$135K→$150K expenses), but these are IRS application estimates, not operational budgets.

### Proposed: Annual Budget, ED-Created, Board-Reviewed

**Budget cycle:**
1. **November–December:** Heather drafts next year's budget in the system, using current year actuals as a starting point
2. **January board meeting:** Board reviews and discusses the budget (not a formal approval vote — the 3-person board structure makes formal votes unnecessary for operational budgets)
3. **Quarterly:** Board sees budget vs. actuals in the standard financial statements (D-058 columns)
4. **Mid-year:** Optional budget revision if circumstances change materially (e.g., major grant awarded, property closes)

**Budget ownership:**
- Heather creates and maintains the budget
- Board has visibility through quarterly reports
- No approval workflow in the system (consistent with D-044 — no approval workflows)

### ✅ Resolved: Q7-01 — Standard Nonprofit Budget Cycle (D-086)

Jeff directed: "put in place a more formal and normal process." Research confirms standard nonprofit practice is to complete the budget **before** the fiscal year starts. Updated cycle:

1. **September:** Review current year actuals vs. budget, assess financial health, identify priorities for next year
2. **October:** ED drafts next year's budget using current year actuals as starting point, with input from relevant parties
3. **November:** Draft budget circulated to board for review ahead of December meeting
4. **December board meeting:** Board reviews and **approves** the annual budget before January 1
5. **Quarterly:** Board reviews budget vs. actuals in standard financial statements (D-058)
6. **Mid-year:** Optional budget revision if material changes occur (property closes, major grant awarded)

---

## Exploration Area 2: Budget Structure & Granularity

### The Core Question: What Does a Budget Line Item Look Like?

Based on upstream decisions, the budget must be structured as:

**Budget = GL Account × Fund × Period**

Each budget entry is: "For [GL Account], in [Fund], during [Month/Quarter], we expect [Amount]."

Example:
- Utilities — Electric, General Fund, March 2026: $400
- Salaries & Wages, General Fund, March 2026: $4,000
- Grant Revenue, SARE Fund, Q2 2026: $62,500

### Budget Entry Granularity

**Monthly vs. Quarterly:**

| Approach | Pros | Cons |
|----------|------|------|
| Monthly budget | Precise variance tracking. Aligns with monthly close rhythm. Catches issues faster. | More data entry for Heather. 12× the budget lines. |
| Quarterly budget | Less work. Matches board meeting cadence. | Less granular variance analysis. Hides monthly swings. |
| Annual with monthly spread | Enter annual amount, system spreads evenly (or custom spread). Best of both. | Spread assumptions may be wrong for seasonal expenses. |

**Proposed: Annual entry with monthly spread options.**

Heather enters an annual budget amount per GL account per fund. System spreads it across months using one of:
- **Even spread** (default) — $12,000/year = $1,000/month
- **Seasonal pattern** — user specifies which months get more/less (e.g., heating costs higher in winter)
- **One-time** — entire amount in a single month (e.g., annual insurance premium)
- **Custom** — user specifies amount per month manually

This keeps budget creation fast (enter ~30-50 annual line items, not 360-600 monthly ones) while enabling monthly variance tracking.

### ✅ Resolved: Q7-02 — Annual with Spread + Flexible Entry (D-087)

Confirmed: Annual entry with monthly spread options, **plus** the ability to do one-time or monthly custom entries for items like big grants, balloon payments, and seasonal surges. The system supports all four spread modes (even, seasonal, one-time, custom) per line item.

### Budget Template from Prior Year

For the first year (2026), there's no prior budget to copy. But for 2027+, the system should offer "copy last year's budget as starting point" with the ability to:
- Apply a percentage increase/decrease across all lines
- Adjust individual lines
- Review against prior year actuals

### What Gets Budgeted?

**Revenue lines:**
- Rental income (by unit/total — depends on occupancy assumptions)
- Grant/contract revenue (by fund — each restricted grant has its own budget)
- Donation revenue
- Earned income (farm, fees)
- Interest/investment income

**Expense lines:**
- All GL expense accounts (D-031's 13 property operating expense accounts, plus administrative categories)
- Salaries & Wages (single line per D-018)
- Professional fees
- Insurance
- Interest expense (AHP loan — calculable from drawn amount and rate)
- Depreciation (non-cash, but important for budget vs. actuals on P&L)

**Non-P&L items (balance sheet / cash flow):**
- AHP loan draws (financing, not revenue — but critical for cash projection)
- Capital expenditures / CIP additions (investing, not operating expense)
- Loan payments (interest is expense; principal is balance sheet)

### ✅ Resolved: Q7-03 — Full Budget Including Capital/Balance Sheet (D-088)

Confirmed: Full budget — operating (P&L) + capital (CIP additions, equipment) + financing (AHP draws, loan payments). Single budget covers everything, and cash projection derives from it. This is the single source of truth for planned financial activity.

---

## Exploration Area 3: Variance Tracking & Reforecasting

### Budget vs. Actuals

This is largely handled by Chunk 6's report structure (D-058 — Current / YTD / Budget columns). Chunk 7's job is to:

1. **Provide budget data** in the right format (by GL account, by fund, by period)
2. **Calculate variance** — both dollar amount and percentage
3. **Flag significant variances** — thresholds for highlighting

### Variance Display

For each budget line, the report shows:

| | Current Month | YTD | Annual Budget | Remaining |
|---|---|---|---|---|
| Utilities — Electric | $450 | $1,800 | $4,800 | $3,000 |
| Variance | ($50) over | $200 under | | |

### ✅ Resolved: Q7-04 — Color-Coded Variance Thresholds (D-089)

Confirmed: Color coding on budget vs. actuals reports. Green/yellow/red based on percentage over/under budget. Specific thresholds to be defined in spec phase (likely >10% = yellow, >25% = red). No active alerts — visual flags only.

### Reforecasting / Budget Revisions

**Proposed: Simple revision, no version history.**

When circumstances change materially (property closes, major grant awarded), Heather can revise the budget. The system:
- Keeps one active budget per fiscal year
- Allows mid-year revision (edits to remaining months; actuals-to-date are locked)
- Does **not** maintain version history of budget revisions (at RI's scale, this is unnecessary complexity)
- Original vs. revised budget comparison is not a v1 feature

### ✅ Resolved: Q7-05 — Simple Overwrite Revision (D-090)

Confirmed: One active budget per fiscal year. Mid-year revisions overwrite remaining months. No version history of prior budget states. Simple and appropriate for RI's scale.

---

## Exploration Area 4: 3-Month Cash Projection

### Ownership
Per D-060, Chunk 7 owns the cash projection entirely. Chunk 6 provides the report display container.

### Agreed Approach: Semi-Automated

The board requested this at the January 2026 meeting. The approach:

**System pre-fills from known data:**
- **Starting cash:** Current bank balances (checking + savings)
- **Known inflows:** Rent due per lease schedule (AR), expected grant receipts (Grants Receivable), recurring donation patterns
- **Known outflows:** Outstanding payables (Reimbursements Payable, Credit Card Payable, vendor invoices), AHP interest (annual Dec 31, amount calculable from drawn balance × rate), recurring monthly expenses (from GL history or budget)
- **Loan context:** AHP drawn vs. available (display only, not assumed as inflow)

**Heather manually adjusts:**
- Expected grant receipts not yet in AR (applications pending, verbal commitments)
- Planned AHP draws (capital needs)
- One-time expected expenses (contractor payments, equipment)
- Unusual items (property closing costs, insurance scaling)

### Data Model

```
cash_projection:
  fiscal_year: 2026
  as_of_date: 2026-03-15
  months: [
    {
      month: "2026-04",
      starting_cash: 95000,  // auto from bank balance (month 1) or prior month ending
      inflows: [
        { source: "Rental Income", amount: 8500, type: "auto", editable: true },
        { source: "SARE Grant Q2", amount: 62500, type: "manual" },
      ],
      outflows: [
        { source: "Payroll", amount: 6000, type: "auto", editable: true },
        { source: "Utilities", amount: 1200, type: "auto", editable: true },
        { source: "Contractor — Five Star", amount: 25000, type: "manual" },
      ],
      ending_cash: ...  // calculated
    },
    // months 2 and 3
  ]
```

### Key Design Questions

### ✅ Resolved: Q7-06 — Budget First, GL History Fallback (D-091)

Confirmed: Cash projection pre-fills recurring expenses from budget data first. If no budget exists for a line item, falls back to average of recent actuals. Budget represents the plan; GL history fills gaps.

### ✅ Resolved: Q7-07 — Quarterly Cash Projection Updates (D-091)

Confirmed: Heather updates the cash projection quarterly, before each board meeting. Four times a year — aligns with board reporting cadence.

---

## Exploration Area 5: Grant/Restricted Fund Budgets

### The Question

When RI receives a restricted grant (e.g., $250K SARE grant over 3 years), the grant likely comes with its own budget — categories and amounts the funder expects to see spent. How does this interact with the org-wide budget?

### Proposed: Grant Budgets Are Fund-Level Budgets

Since every fund maps to a set of GL accounts (D-013), a grant budget is just: "for SARE Fund, here are the expected revenues and expenses by GL account by period."

This means:
- The org-wide budget = sum of all fund-level budgets
- General Fund budget = RI's operating budget (unrestricted)
- SARE Fund budget = grant spending plan
- AHP Fund budget = capital project spending plan

**Grant budget entry:**
When a new restricted grant is awarded, Heather creates a fund-level budget with:
- Revenue: grant award amount, spread across expected receipt periods
- Expenses: planned spending by GL account category, per funder's budget categories
- Timeline: grant period (may span multiple fiscal years)

**Multi-year grants:** The budget system must support budgets that span fiscal years. A 3-year SARE grant needs budget entries in FY2026, FY2027, and FY2028.

### Funder Budget Categories vs. GL Accounts

Funders often use their own budget categories (e.g., "Personnel," "Travel," "Supplies," "Other Direct Costs," "Indirect Costs"). These may not map 1:1 to RI's GL accounts.

**Proposed: No funder category mapping in v1.** Per D-077 (funder-specific reporting deferred), RI budgets in its own GL account structure. If a funder needs a report in their format, it's a manual mapping exercise at reporting time. Building a category translation layer is premature when RI has zero active grants.

### ✅ Resolved: Q7-08 — Grant Budgets as Fund-Level Budgets, No Funder Mapping (D-092)

Confirmed: Grant budgets are fund-level budgets in RI's GL account structure. No funder-category-to-GL-account mapping in v1. Consistent with D-077 (funder-specific reporting deferred).

---

## Summary of Questions — All Resolved

| ID | Question | Decision | Decision ID |
|----|----------|----------|-------------|
| Q7-01 | Budget cycle & governance | Standard nonprofit cycle: Sept kickoff, Dec board approval | D-086 |
| Q7-02 | Budget entry granularity | Annual with spread + one-time + custom monthly | D-087 |
| Q7-03 | Budget scope (operating vs. full) | Full budget: operating + capital + financing | D-088 |
| Q7-04 | Variance threshold flags | Color coding (green/yellow/red) | D-089 |
| Q7-05 | Budget revision model | Simple overwrite, no version history | D-090 |
| Q7-06 | Cash projection pre-fill source | Budget first, GL history fallback | D-091 |
| Q7-07 | Cash projection update cadence | Quarterly, before board meetings | D-091 |
| Q7-08 | Grant budget approach | Fund-level budgets, no funder category mapping | D-092 |

---

## Decisions — Finalized

### D-086: Annual Budget Cycle — Standard Nonprofit Process with December Board Approval
- **Date:** 2026-02-13
- **Decision:** RI adopts a standard nonprofit annual budget cycle aligned with the calendar fiscal year. September: review current year actuals and assess priorities. October: ED drafts next year's budget. November: draft circulated to board. December board meeting: board reviews and approves budget before January 1. Quarterly: board reviews budget vs. actuals. Mid-year: optional revision if material changes occur. No approval workflow in the system (consistent with D-044) — board approval happens in the meeting, not in software.
- **Rationale:** Standard nonprofit best practice is to complete and approve the budget before the fiscal year starts. RI's original thought was January review, but research and Jeff's direction confirmed a more formal Q4 process. The compliance calendar (D-065) should include budget preparation reminders starting in September.
- **Affects:** Compliance calendar (D-065) gets budget cycle reminders. Chunk 6 (quarterly board reports include budget vs. actuals per D-058).

### D-087: Budget Entry — Annual Amounts with Monthly Spread Options
- **Date:** 2026-02-13
- **Decision:** Budget creation uses annual amounts per GL account per fund, with the system spreading across months. Four spread modes per line item: (1) **Even spread** (default) — annual ÷ 12. (2) **Seasonal pattern** — user specifies which months get more/less. (3) **One-time** — entire amount in a single month. (4) **Custom** — user specifies amount per month manually. This supports both predictable recurring items (utilities, rent, insurance) and irregular items (big grant receipt, balloon payment, contractor milestone payment).
- **Rationale:** Keeps budget creation fast (~30-50 annual line items to enter, not 360-600 monthly) while enabling monthly variance tracking. The spread options handle seasonal variation and one-time events without requiring manual monthly entry for every line. For 2027+, the system offers "copy last year's budget" with percentage adjustment capability.
- **Affects:** Budget data model must store both annual amount and monthly breakdown per line. Chunk 6 reports consume monthly budget amounts (D-058).

### D-088: Full Budget — Operating + Capital + Financing
- **Date:** 2026-02-13
- **Decision:** The annual budget includes operating items (P&L revenue and expenses), capital items (CIP additions, equipment purchases), and financing items (AHP loan draws, loan payments). Single budget is the source of truth for all planned financial activity. The 3-month cash projection (D-060) derives from this budget.
- **Rationale:** Cash projection needs to know about planned capital expenditures and loan draws to be useful. Splitting operating budget from capital/financing assumptions creates two disconnected data sources. A full budget provides the board with a complete picture: operating surplus/deficit + capital spending plan + financing plan = total cash impact.
- **Affects:** Budget data model must support non-P&L line items (balance sheet and cash flow items). Cash projection (D-091) pulls from the full budget. Chunk 6 reports may need a "capital budget" section alongside operating budget vs. actuals.

### D-089: Variance Reporting — Color-Coded Thresholds
- **Date:** 2026-02-13
- **Decision:** Budget vs. actuals reports use color coding to flag significant variances. Green = within budget or under. Yellow = moderately over budget. Red = significantly over budget. Specific percentage thresholds to be defined in spec phase (starting point: >10% over = yellow, >25% over = red). Visual flags only — no active alerts or notifications.
- **Rationale:** Color coding provides at-a-glance variance visibility without notification overhead. At RI's scale, Heather and the board can assess significance from the visual cues. Active alerts would create noise for a 2-person operation reviewing the same reports.
- **Affects:** Chunk 6 report rendering must support conditional color formatting. Threshold percentages are configurable (not hardcoded).

### D-090: Budget Revisions — Simple Overwrite, No Version History
- **Date:** 2026-02-13
- **Decision:** One active budget per fiscal year. Mid-year revisions edit remaining months directly (actuals-to-date months are locked from editing). No version history of prior budget states. No "original vs. revised" comparison columns.
- **Rationale:** At RI's scale, tracking budget versions adds complexity without proportional value. If the board wants to understand what changed, the discussion happens in the meeting, not in software. If RI grows to need version tracking, it can be added as a data-layer enhancement (timestamp budget changes, add version field) without architectural changes.
- **Affects:** Budget data model is simple: one record per GL account per fund per month per fiscal year. No version dimension.

### D-091: Cash Projection — Semi-Automated, Quarterly, Budget-First Pre-Fill
- **Date:** 2026-02-13
- **Decision:** The 3-month cash projection (D-060) is semi-automated and updated quarterly before board meetings. Pre-fill logic: (1) Starting cash from current bank balances. (2) Known inflows from AR schedules, Grants Receivable, and budget amounts. (3) Known outflows from outstanding payables, recurring expenses per budget (D-088), and AHP interest. (4) If no budget exists for a line item, fall back to average of last 3 months of actuals. Heather manually adjusts for expected grant receipts not yet in AR, planned AHP draws, one-time expenses, and unusual items. AHP available credit displayed as context but not assumed as inflow.
- **Rationale:** Semi-automated gives the board a data-grounded projection without requiring Heather to build it from scratch each quarter. Budget-first pre-fill means the projection reflects the plan; GL-history fallback handles gaps. Quarterly cadence matches board meeting rhythm and avoids unnecessary work.
- **Affects:** Cash projection data model must integrate with budget data (D-088), AR/AP data (Chunks 2/3), and bank balance data (Chunk 4). Chunk 6 provides the display container; Chunk 7 provides the data and logic.

### D-092: Grant Budgets — Fund-Level Budgets in RI's GL Structure
- **Date:** 2026-02-13
- **Decision:** Grant-specific budgets are implemented as fund-level budgets using RI's GL account structure. Org-wide budget = sum of all fund-level budgets. General Fund budget = operating budget. Restricted fund budgets = grant spending plans. Multi-year grants supported (budget entries span fiscal years). No funder-category-to-GL-account mapping layer in v1 — if a funder needs a report in their format, it's a manual exercise.
- **Rationale:** Consistent with D-077 (funder-specific reporting deferred) and D-013 (fund accounting). RI has zero active grants; building a category translation layer is premature. The fund-level budget structure provides the raw data; funder-format reporting is a customization when requirements are known.
- **Affects:** Budget data model supports multi-year budget entries (not just current fiscal year). Fund drill-down (D-055) applies to budget data the same way it applies to actuals.
