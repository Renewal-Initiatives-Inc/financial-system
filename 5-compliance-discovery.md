# Chunk 5: Compliance Reporting — Discovery

**Status:** ✅ Discovery complete (Sessions 1-5 complete, 2026-02-13)

990/990-EZ preparation support, MA AG Form PC, public support test tracking, GAAP policy documentation, funder compliance. The "must have" outputs that justify building the system.

---

## Discovery Sessions

### Session 1: IRS Filing & 990 Mechanics (2026-02-13) ✅

**Filing Progression for RI:**

| Fiscal Year | Likely Filing | Trigger | Due Date |
|-------------|--------------|---------|----------|
| FY25 | 990-N (e-Postcard) | Revenue well under $50K | May 15, 2026 |
| FY26 | 990-N or 990-EZ | Depends on actual revenue; Form 1023 projects $100-150K | May 15, 2027 |
| FY27-28 | 990-EZ or Full 990 | Property acquisition → assets > $500K triggers full 990 | May 15, 2028+ |

**Thresholds (current IRS rules):**
- **990-N:** Gross receipts ≤ $50K (3-year average for orgs ≥ 3 years old)
- **990-EZ:** Gross receipts < $200K AND total assets < $500K
- **Full 990:** Required if either threshold exceeded
- **Key trigger for RI:** Once Easthampton property is on the books, total assets will exceed $500K → full Form 990 required regardless of revenue level

**MA Form PC:**
- Due 4.5 months after FY end (~May 15 for calendar year)
- Under $25K: minimal filing, no 990 attachment required
- $25K-$500K: attach Form 990
- $500K-$1M: attach 990 + reviewed financial statements
- Over $1M: attach 990 + audited financial statements
- All filings electronic via MA Online Charity Portal

**Schedule A / Public Support Test:**
- RI is in 5-year grace period (organized June 2025) through ~FY2029
- During grace period: just check a box, no calculation needed
- Starting FY2030: must demonstrate ≥ 33.33% of total support from public sources (5-year rolling window)
- Or: 10% + facts-and-circumstances test (fallback)
- 2% excess contribution rule: individual contributions exceeding 2% of 5-year total counted at only 2% (government contributions exempt from cap)

**990 Part IX — Statement of Functional Expenses:**
- 23 primary expense line items + "Other" (Line 24)
- Four columns: Total / Program Services / Management & General / Fundraising
- Every expense must be allocated across functional categories
- System needs: GL account → 990 line item mapping + functional allocation percentages

**Decisions Made:**
- D-061: Annual worksheet for functional allocation (Program/Admin/Fundraising percentages per person)
- D-062: System-level 990 line item mapping on GL accounts
- D-063: Public support test data capture from day one (source type tagging on contributions)
- D-064: Form PC — compliance calendar reminder only, no data generation
- D-065: Built-in compliance calendar with automated email reminders (30-day, 7-day)
- D-066: Manual narrative for 990 program descriptions, no sub-program tagging
- D-067: Officer compensation reporting derives from payroll, no pre-payroll data entry

### Session 2: MA Landlord-Tenant Law & Security Deposits (2026-02-13) ✅

**MA G.L. c. 186 § 15B — Security Deposit Requirements:**
- Max deposit = first month's rent
- Must be in separate interest-bearing escrow account in MA
- Interest: lesser of actual bank rate or 5%, paid annually on tenancy anniversary
- Two receipts required: (1) at collection, (2) within 30 days showing bank details
- Statement of condition within 10 days of tenancy start
- 30-day return deadline after move-out, with itemized deductions + receipts
- Allowed deductions: unpaid rent, water bills, real estate taxes, damage beyond normal wear
- **Treble damages** for ANY non-compliance (automatic, no bad faith required) + attorney's fees
- Last month's rent: can collect, interest required, but does NOT need separate escrow

**Rent Proration:**
- Statutory requirement under MA G.L. c. 186 § 4
- Daily rate = monthly rent ÷ actual calendar days in month × days occupied
- Applies to both move-in and move-out; cannot be waived by lease

**VASH/Section 8:**
- Standard Housing Choice Voucher program (HUD-VA collaboration)
- Tenant pays ~30% adjusted income; PHA pays HAP directly to landlord
- Annual HQS inspections required; PHA recertifies tenant income annually
- Security deposit follows MA state law (first month's rent max)

**MVRAP:**
- Exact program name not found in current MA resources
- Likely MRVP, VHVP, or AHVP — all state-funded voucher programs with same mechanics as Section 8
- To be confirmed when RI enters HAP contracts

**Decisions Made:**
- D-069: Pooled escrow account with per-tenant system tracking (3 new GL accounts)
- D-070: Fully automated annual interest calculation + compliance calendar per-tenant reminders
- D-071: Statutory daily rate proration, automated calculation, flows through D-027 adjustment accounts
- D-072: Move-out deposit return workflow deferred (compliance calendar provides interim safety net)
- D-073: VASH/subsidy operational data (HAP contracts, recertification) lives outside financial system; GL tracking via existing D-026 AR-by-source
- D-074: MVRAP name clarification; all voucher programs treated identically in GL

### Session 3: Funder Substantiation & Grant Compliance (2026-02-13) ✅

All three topics deferred with clear rationale — RI doesn't have funder awards yet, and building speculative compliance infrastructure risks designing for the wrong requirements. The system's existing fund-level tracking (D-013), fund spending reports (D-059), and compliance calendar (D-065) provide the foundation. Concrete requirements will be specified via mini-discoveries when award letters arrive.

**Decisions Made:**
- D-075: Capital vs. operating cost categories deferred until funder awards (extends D-016/D-032)
- D-076: Grant spend-down monitoring via existing fund reports, no dedicated dashboard
- D-077: Funder-specific reporting deferred; flexible framework + compliance calendar for deadlines

### Session 4: GAAP Policy Documentation (2026-02-13) ✅

Three core accounting policies formalized. These serve as RI's written GAAP policy documentation — required for future audit readiness and referenced by Notes to Financials (Chunk 6). Functional allocation methodology was already decided in Session 1 (D-061).

**Capitalization Policy:**
- $2,500 threshold per item/invoice (IRS de minimis safe harbor, Reg. §1.263(a)-1(f))
- Maximum safe harbor for orgs without audited financials
- Increases to $5,000 when RI obtains audited financials (Form PC $1M+ threshold)
- Consistent application + written policy (this decision) is the IRS requirement

**Bad Debt Policy:**
- Direct write-off method (expense when determined uncollectible)
- No allowance-for-doubtful-accounts contra-asset
- Write-offs require mandatory annotation (reason, collection efforts, authorization)
- Switch to allowance method when audit threshold reached

**Depreciation Policy:**
- Component depreciation for Easthampton building (roof 20yr, HVAC 15yr, electrical 15-20yr, plumbing 15-20yr, windows 15-20yr, flooring 5-10yr, structure 27.5yr)
- Single-item depreciation for all other assets (equipment 5-7yr, vehicles 5yr, furniture 7yr, computers 3-5yr)
- Straight-line method for all assets (IRS standard for residential rental)
- Component useful lives finalized at property closing when renovation scope known

**Decisions Made:**
- D-078: $2,500 capitalization threshold (IRS de minimis safe harbor)
- D-079: Direct write-off for bad debts, annotation required
- D-080: Component depreciation for building, single-item for everything else, straight-line

### Session 5: Tax Credit Mechanics & In-Kind Contributions (2026-02-13) ✅

**Historic Tax Credit Equity:**
- RI can't use HTCs directly (no tax liability). Standard approach: syndicate via partnership/LLC with tax credit investor.
- Federal HTC = 20% of QRE; MA State HTC = up to 20% of QRE
- Investor equity is contribution revenue under ASC 958-605 (nonreciprocal transfer)
- Partnership structure may require consolidated financials (ASC 810)
- 5-year investor holding period to avoid recapture
- **Decision: Fully deferred.** Deal is very early stage (no consultant, no investors, no credits approved, money unlikely until 2027+). Mini-discovery when deal is structured. D-013 fund structure and D-080 component depreciation provide the foundation.

**QRE (Qualified Rehabilitation Expenditure) Tracking:**
- Critical for HTC — every rehab cost must be classified as qualifying or non-qualifying
- Substantial rehabilitation test: QREs must exceed adjusted basis of building or $5,000
- NPS certification required via Form 10-168
- **Decision: Deferred with HTC.** CIP (D-032) and component depreciation (D-080) capture costs by component. QRE tagging retrofitted when HTC consultant specifies requirements.

**In-Kind Contributions:**
- ASC 958-605 requires recording: donated physical assets (at FMV), donated specialized services (3-part test), use of donated facilities
- Cannot record general volunteer time as revenue
- 990 Part VIII Line 1g reports noncash contributions; Schedule M required if > $25,000/year
- ASU 2020-07 requires disaggregated disclosure when audited financials are prepared
- **Decision: Three separate GL revenue accounts** — In-Kind Goods, In-Kind Services (specialized only), In-Kind Facility Use. Enables clean 990 reporting and future audit readiness.

**Volunteer Hour Tracking:**
- Volunteer hours tracked outside financial system (spreadsheet or separate tool)
- Financial system records dollar value as in-kind JE only when qualifying for ASC 958-605 or grant matching
- Independent Sector 2024 rate: $34.79/hr national, ~$38-40/hr MA; specialized skills higher
- SARE grants typically require 25-50% cost-sharing (volunteer hours eligible)
- **Decision: Outside system.** Financial impact recorded via in-kind accounts when it occurs.

**Decisions Made:**
- D-081: HTC equity accounting fully deferred to mini-discovery when deal is structured
- D-082: QRE tracking deferred with HTC; CIP and component depreciation provide foundation
- D-083: Three in-kind contribution GL revenue accounts (Goods, Services, Facility Use)
- D-084: Volunteer hours tracked outside system; dollar value enters via in-kind JEs
- D-085: Annual compliance calendar reminder for in-kind review and Schedule M threshold check

---

## Research Required (Will Inform Chunk 1 GL Structure)

~~**MA Landlord-Tenant Law:** (Session 2)~~ ✅ Resolved — D-069 through D-072

~~**VASH/MVRAP Program Rules:** (Session 2)~~ ✅ Resolved — D-073, D-074

~~**Tax Credit Mechanics:** (Session 5)~~ ✅ Resolved — D-081, D-082 (deferred to mini-discovery when HTC deal is structured)

~~**Funder Requirements:** (Session 3)~~ ✅ Resolved — D-075 through D-077 (deferred until awards arrive)

~~**GAAP Policy Documentation:** (Session 4)~~ ✅ Resolved — D-078 through D-080
- Capitalization: $2,500 threshold (D-078)
- Bad debt: Direct write-off (D-079)
- Depreciation: Component for building, single-item for others (D-080)
- Functional allocation: Annual worksheet (D-061, Session 1)

---

## Dependencies

**From Chunk 1:**
- D-014: Net assets mechanics (restricted → unrestricted movement)
- D-018: Functional allocation policy (Program/Admin/Fundraising) — now specified by D-061
- D-023: Loan forgiveness documentation

**From Chunk 2:**
- D-034: Grant revenue recognition timing
- D-035: Grant expense attribution
- D-036: Donation recognition (source type tagging needed per D-063)
- D-038: Donor tracking (extended by D-063 for public support test data)

**From Chunk 6:**
- D-059: All reports ship at launch (includes compliance views)
- Chunk 6 depends on Chunk 5 for: GAAP policies → Notes to Financials; functional allocation methodology → Statement of Functional Expenses

**Impacts on Chunk 1:**
- D-062: GL account schema needs `form_990_line` field
- D-069: 3 new GL accounts for security deposits (escrow asset, deposit liability, interest expense)
- D-079: 1 new GL account (Bad Debt Expense)
- D-083: 3 new GL revenue accounts for in-kind contributions (Goods, Services, Facility Use)
- D-081/D-082: HTC GL accounts deferred to mini-discovery

**Impacts on Chunk 2:**
- D-063: Contribution entry must include source type (government/public/related party)
- D-083: Contribution entry workflow should prompt for in-kind type when recording noncash donations

**Impacts on Chunk 6:**
- D-065: Compliance calendar shows on dashboard
- D-062: Enables auto-generated 990-style functional expense report
- D-085: Annual in-kind review / Schedule M threshold check added to compliance calendar
