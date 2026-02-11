# Company Facts — Renewal Initiatives, Inc.

*Living document. Updated each session. Source of truth for all downstream project decisions.*
*Last updated: 2026-02-08 (Session 2 — integrated Nonprofit Admin, Easthampton project, consultant, and compliance documents)*

---

## Organization Basics

- **Legal name:** Renewal Initiatives, Inc.
- **Principal office:** 1666 Main Street, Ste 138, Springfield, MA 01103
- **State of incorporation:** Massachusetts
- **Tax status:** 501(c)(3) public charity (IRS) + registered nonprofit (Commonwealth of Massachusetts)
- **Public charity classification:** 170(b)(1)(A)(vi) — organizations receiving substantial support from public
- **501(c)(3) approved:** October 7, 2025 (effective retroactive to date of organization, 6/27/2025)
- **EIN:** 39-3072501 (verified on IRS TEOS 2026-02-07)
- **IRS city on file:** Bolton, MA (differs from mailing address — may be registered agent location)
- **Deductibility code:** PC (public charity)
- **IRS determination letter date:** July 16, 2025
- **Pub 78 listed:** Yes (eligible to receive tax-deductible contributions)
- **Fiscal year end:** 12/31 (calendar year, confirmed via MA SOS and Bylaws)
- **MA SOS ID Number:** 001898078
- **Date of organization in MA:** 06/27/2025
- **Accounting method:** Cash-basis (FY25); moving to accrual-basis in 2026 (see D-005)
- **Organization stage:** Pre-revenue, pre-operational. Property acquisition anticipated March 2026.
- **Automatic revocation risk:** Failure to file Form 990/990-N for 3 consecutive years triggers automatic revocation of tax-exempt status.

### State Tax & Exemption Registration

- **MA Taxpayer ID (DOR):** 22312021
- **MassTax Connect Master Administrator:** Heather Takle (htakle@renewalinitiatives.org, (617) 938-7409), setup 10/29/2025
- **ST-2 Sales Tax Exemption Certificate:** #560305152
  - Effective: October 29, 2025
  - Expires: October 28, 2035 (10-year renewal cycle)
  - Exemption type: Chapter 64H, Section 6(d) or (e) of MA General Laws
  - Coverage: All purchases of tangible personal property exempt from sales tax when used in conduct of business
  - Note: Misuse subject to criminal penalties (up to 1 year, $10K fine). Must report name/address changes to MA DOR.
- **W-9 on file:** Dated November 2025. Exemption code 1 (nonprofit organization). FATCA exemption code 1.

## People

### Staff / System Users

| Name | Role | Email | Phone | Notes |
|------|------|-------|-------|-------|
| Heather Takle | Executive Director (President) | htakle@renewalinitiatives.org | (617) 938-7409 | Day-to-day bookkeeping, expense management, MassTax master admin |
| Jeff Takle | Consultant (Clerk) | jeff@takle.me | (978) 226-1882 x543 | System builder, also board member, also AHP Project Director for Mecky contract |

- **Current active users:** ~2
- **Expected growth:** Up to ~5 total, likely no more

### Board of Directors (per MA SOS filing)

| Name | Title(s) | Term Expires | Notes |
|------|----------|-------------|-------|
| Heather Takle | President, Director | 6/30/2026 (President), 6/30/2028 (Director) | Also Executive Director |
| Jeff Takle | Clerk, Director | 6/30/2026 | Also consultant; recused from AHP loan vote (AHP officer) |
| Damien Newman | Treasurer, Director | 6/30/2026 | AHP officer; recused from AHP loan vote |

- **Board size:** 3 members (Bylaws allow 3-7, in three rotating classes with staggered 1/2/3-year terms)
- **Board meets:** Quarterly (July 2025, October 2025, January 2026 so far)
- **Board receives:** P&L, Balance Sheet, Cash Flow statements; requested 3-month forward cash projections
- **Treasurer access to financial systems:** Action item noted at January 2026 meeting — not yet established. When ready, just assign Damien Newman as a User in internal-app-registry-auth with financial-system access.
- **Auth model:** Shared via `internal-app-registry-auth`. Admin role = all apps; User role = assigned apps. Full access once in — no in-app permissions. (see D-006)

## Mission & Programs

**Mission:** Transform historic spaces into affordable, welcoming homes using eco-friendly methods; build lasting stability and belonging; engage veterans in hands-on regenerative work.

**Five program areas (per Articles of Organization and Form 1023):**

| Program | Effort % | Expense % | Description |
|---------|----------|-----------|-------------|
| Affordable Housing Development | 40% | 45% | Acquire, rehabilitate, preserve affordable housing for veterans and underserved populations |
| Regenerative Agriculture & Land Use | 25% | 20% | Training farms, CSAs, therapeutic/vocational spaces for veterans |
| Workforce Development & Behavioral Health | 15% | 15% | Job training, career support, behavioral health referrals |
| Public Education & Community Engagement | 15% | 15% | Workshops, outreach, planning forums |
| Energy Affordability & Independence | 5% | 5% | Energy solutions for low-income/affordable housing residents |

**Primary active project:** 75 Oliver Street, Easthampton, MA — lodging house, garage, 56-acre farm. Revised redevelopment cost estimate ~$6.8M. Closing anticipated March 2026.

**Service area:** Western Massachusetts (Springfield, Easthampton)

## Chart of Accounts (Existing QBO Structure)

*Extracted from CoA Guide and CoA Mapping Guide. The custom financial system should either adopt or improve on this structure.*

### Account Types

| Type | Examples | Maps To |
|------|----------|---------|
| Assets | Checking, Savings, Accounts Receivable, Prepaid Expenses, Buildings/Real Estate | Balance Sheet |
| Liabilities | Accounts Payable, Credit Cards, Payroll Liabilities, Deferred Revenue | Balance Sheet |
| Net Assets | Without Donor Restrictions, With Donor Restrictions | Balance Sheet (Equity) |
| Income/Revenue | Donations, Grants, Program Service Revenue, Events/Fundraising, In-kind Contributions | P&L |
| Expenses — Program | Farm Inputs, Housing Operations, Salaries — Program | P&L (Program Services) |
| Expenses — Admin | Office Supplies, Insurance, Professional Fees | P&L (Management & General) |
| Expenses — Fundraising | Fundraising Events, Marketing, Salaries — Fundraising | P&L (Fundraising) |
| Other Expenses | Depreciation, Miscellaneous | P&L |

### Three Functional Categories (for IRS Form 990)

1. **Program Services** — Direct program delivery (program-specific salaries, supplies, direct costs)
2. **Management & General** — Administrative overhead (insurance, professional fees, office supplies)
3. **Fundraising** — Revenue generation activities (events, marketing, fundraising salaries)

### Dual Classification System (Classes in QBO)

Each transaction gets TWO class assignments:

**Class 1 — Program Classes:**
- Farm Training
- Housing Support
- Community Workshops

**Class 2 — Fund/Grant Classes:**
- General Fund (unrestricted)
- Restricted Grants (donor-restricted)

**System design implication:** The financial system must support multi-dimensional reporting: by functional category, by program, by fund source, and any combination thereof — without duplicating accounts. This is the core accounting architecture challenge for a nonprofit. See Q12 and Q15.

## Legal & Compliance Profile

- **IRS filing:** Likely 990-N for FY25 (revenue well under $50K threshold; currently zero revenue). Will scale to 990-EZ or full 990 as revenue grows per Form 1023 projections.
- **MA Attorney General reporting:** Must register as charity with MA Non-Profit Organizations/Public Charities Division (authorized in signing authority document). Form PC required.
- **MA Annual Report:** Due by November 1 each year to MA SOS.
- **Audit requirement:** No external CPA/auditor relationship yet. Bylaws provide for Treasurer to receive auditor statements. No funder currently requires audit.
- **Public charity status:** In initial 5-year test period (organized 2025). Classification 170(b)(1)(A)(vi). Revenue mix matters for public support test but not yet binding.
- **Conflict of interest policy:** Adopted July 2025. Annual attestation required from all directors/officers. Properly applied at October 2025 AHP loan vote.

### Financial Authority Thresholds (per Signing Authority document)

| Action | Threshold | Approval Required |
|--------|-----------|------------------|
| Check writing & withdrawals | Any amount | Officer authority |
| Contracts & agreements | Up to $20,000 | Officer authority |
| Contracts & agreements | Over $20,000 | Board approval |
| Real estate transactions | Over $20,000 | Board approval |
| Bank account establishment | Any | Officer authority |

### Compliance Calendar

| Obligation | Frequency | Due Date | Filed By | Notes |
|------------|-----------|----------|----------|-------|
| IRS Form 990-N (or 990/990-EZ) | Annual | 5/15 (15th day of 5th month after FY end) | RI | 990-N for FY25; scales up with revenue. 3 consecutive missed filings = automatic revocation. |
| MA SOS Annual Report | Annual | November 1 | RI | Filed online; confirms officers/directors, address |
| MA AG Form PC | Annual | 4½ months after FY end (~5/15) | RI | Charity registration renewal. Address on file may need updating (see Q16). |
| Conflict of Interest Attestations | Annual | At/around annual meeting | All directors/officers | Per COI policy adopted July 2025 |
| AHP Loan — Annual financials or 990 | Annual | Per loan agreement | RI → AHP | Covenant requirement |
| AHP Loan — Interest payment | Annual | December 31 | RI → AHP | Interest-only, simple interest Actual/365 |
| Insurance renewal (Hiscox BOP) | Annual | October 29 | RI | Current policy expires 10/29/2026 |
| ST-2 Exemption renewal | Every 10 years | October 28, 2035 | RI → MA DOR | Certificate #560305152 |
| Compensation reasonableness review | Periodic | Per Bylaws | Board | Required for 501(c)(3) compliance |

### Compliance Obligations

- No private inurement
- No substantial lobbying (limited to Section 501(h))
- No political campaign activity
- Annual conflict of interest attestations from all directors/officers
- Periodic compensation review for reasonableness
- Maintain 501(c)(3) exempt status (loan covenant requirement)
- Annual financial statements or Form 990 to AHP (loan covenant)
- Formation expenses (legal, filing, etc.) are reimbursable per Written Consent

## Insurance

**Carrier:** Hiscox Insurance Company Inc.
**Policy Number:** P105.651.229.1
**Coverage Period:** 10/29/2025 – 10/29/2026
**Annual Premium:** $501.00

| Coverage | Limit |
|----------|-------|
| General Liability — per occurrence | $2,000,000 |
| General Liability — aggregate | $2,000,000 |
| Property damage to rented premises | $100,000 |
| Medical payments (per person) | $10,000 |
| Personal property | $25,000 |
| Deductible (building & contents) | $1,000 |

- **Additional insured:** Advocates for Human Potential, Inc. (required by AHP loan agreement)
- **Type:** Business Owners Policy (BOP) — Property & Rehab
- **Note:** Must maintain property insurance as AHP loan covenant. Policy will need to scale significantly upon property acquisition.

## Revenue Profile

*Currently pre-revenue. All funding to date via AHP loan.*

**Form 1023 Revenue Projections:**

| Revenue Type | Year 1 (partial 2025) | Year 2 | Year 3 |
|---|---|---|---|
| Gifts, grants, contributions | $100,000 | $140,000 | $180,000 |
| Gross receipts (fees, etc.) | — | $10,000 | $15,000 |
| **Total** | **$100,000** | **$150,000** | **$195,000** |

**Expected future revenue sources:**
- Foundation grants
- Government grants (CDBG, ARPA, housing authorities, veteran grants, agricultural grants, workforce grants, energy program funds)
- Individual donations
- Corporate contributions
- Program fees/services (fee for service in workforce dev)
- Development fees (post-property-closing)
- Management fees (post-property-closing)
- Farm operations revenue (when active) — 10-year projection: ~$34.7K/yr Years 1-2, ~$41.7K/yr Years 3-10, gross ~$401K total
- USDA/SARE grants (HIVE program — $250K SARE grant application identified in discovery docs)

**Fundraising methods authorized:** Website, mail, email, personal/phone solicitations, foundation grants, government grants

**Restricted funding:** No donor-advised funds. No restricted grants currently. Funder restrictions anticipated with future grants. Real estate subject to funding/deed restrictions (historic restriction, affordable housing restriction, agricultural preservation restriction all on 75 Oliver St).

**Donor acknowledgment:** [TBD — not yet operational]

## Expense Profile

**FY25 Actual Expenses (Jan-Dec 2025): $17,879.56**

| Category | Amount | Notes |
|----------|--------|-------|
| Professional Fees | $14,091.00 | Property development consulting, architecture/design |
| Technology/Software | $1,765.74 | QuickBooks, Webflow, ChatGPT, CRM, Adobe, website dev |
| Taxes & Licenses | $674.50 | MA SOS fees, corporate filing, good standing cert |
| Interest Paid | $572.60 | AHP loan interest (Nov-Dec 2025) |
| Business Insurance | $501.00 | Property & rehab business owners policy |
| Meals & Entertainment | $108.58 | HIVE Montana project meals |
| Training | $75.00 | Montana Hive Project training |
| Office Supplies | $71.14 | Digital mailbox, notary, mailbox services |
| Bank Charges | $20.00 | Wire fees, account fees |

**Form 1023 Expense Projections:**

| Category | Year 1 (partial 2025) | Year 2 | Year 3 |
|---|---|---|---|
| Officer/director compensation | $30,000 | $50,000 | $70,000 |
| Other salaries/wages | $40,000 | $50,000 | $70,000 |
| Occupancy | $5,000 | $6,000 | $7,000 |
| Professional fees | $10,000 | $12,000 | $14,000 |
| Other program expenses | $40,000 | $67,000 | $59,000 |
| **Total** | **$85,000** | **$135,000** | **$150,000** |

**Payroll:** Not yet operational. Form 1023 projects officer compensation + salaries.
**Reimbursements:** Yes — $4,471.96 in employee reimbursements payable at 12/31/2025 (Heather Takle, for professional services, meals, office supplies, tech, taxes, training expenses paid personally)

### Active Consultants

**Mecky Adnani — Property Development Consultant**

| Element | Detail |
|---------|--------|
| Contract ID | 9600.19-AHP with ADNANI-01 |
| Contracting party | AHP (not RI directly) — RI is the "Client" |
| Rate | $150/hour (includes all direct and indirect costs) |
| Retainer | $3,000 (upon execution; credited against final invoice) |
| Period of performance | Execution through 12/31/2025 |
| Billing | Monthly max; submit to AP2@AHPNET.COM with AHP billing number |
| Payment terms | 14 days from approved invoice |
| Invoice deadline | 60 days after completion of deliverables |
| Travel | FTR rates, booked through AHP's travel services |
| Approver | Jeff Takle (AHP Project Director) |
| Scope | Initial assessment and planning/development for 75 Oliver Street redevelopment |

**Invoicing history:**

| Invoice | Period | Hours | Amount |
|---------|--------|-------|--------|
| Invoice 1 | Jul-Aug 2025 | 68.5 | $10,275.00 |
| Invoice 2 | Aug-Sep 2025 | 17.0 | $2,550.00 |
| **Total** | | **85.5** | **$12,825.00** |

**Note:** The Mecky contract is between AHP and Mecky, with RI as client. The $3K retainer and consulting costs flow through AHP's books, not RI's directly. However, the board action item to "record $3K Mecky retainer with equity adjustment" suggests some portion may need to be reflected in RI's books. This needs clarification (see Q14/Q17).

**Other consultant costs (project-specific, paid by AHP or RI — TBD):**
- AEL Architects — feasibility/design proposal: $33,180
- Five Star Building Corp — pre-construction services: $8,700
- Saloomey Construction — high-level estimate provided (not a contract amount)

## Banking & Accounts

**Bank:** UMass Five College Federal Credit Union (P.O. Box 1060, Hadley, MA 01035)
- Member Number: 770030632

| Account | Last 4 | Balance (12/31/2025) |
|---------|--------|---------------------|
| Business Base Checking | 0180 | $99,422.40 |
| Business Interest Savings | 0172 | $5.00 |
| **Total** | | **$99,427.40** |

**Credit Card:** Ramp (one card)

**Banking activity:** Minimal. December 2025 showed single wire payment ($572.60 interest to AHP). No overdrafts, no returned items.

**Interest payment method:** ACH from UMass Five checking (...0180) to AHP at TD Bank, NA (...4520). Processing fee $0.50 + tax (waived on first 5 ACH payments).

## Loan & Financing

**AHP Secured Revolving Line of Credit:**

| Element | Detail |
|---------|--------|
| Lender | Advocates for Human Potential, Inc. (AHP), 490-B Boston Post Road, Sudbury, MA 01776 |
| Effective date | November 1, 2025 |
| Maximum credit | $3,500,000 |
| Amount drawn (12/31/2025) | $100,000 |
| Pre-closing limit | $250,000 (until property acquisition closes) |
| Pre-development spending cap | $100,000 |
| Minimum advance | $100,000 |
| Interest rate | Variable, tied to AHP savings rate (2% floor, 5% cap) |
| 2025 rate applied | 4.75% (proactively applied by RI; verbally confirmed by AHP CEO) |
| Interest calculation method | Simple interest, Actual/365 day count |
| Payment schedule | Interest-only, due annually December 31 |
| Maturity | November 1, 2032 (7-year term; balloon payment) |
| Prepayment | Allowed without penalty |
| Forgiveness option | Lender may forgive portions as charitable donation |
| Collateral | 75 Oliver Street, Easthampton, MA (real property + personal property) |
| Key covenants | Maintain 501(c)(3) status, annual financials/990 to lender, maintain property insurance, no additional liens without consent |

**2025 Interest Calculation (verified against statement):**
- Principal: $100,000; Rate: 4.75%; Period: Nov 18 – Dec 31, 2025 (44 days)
- Calculation: $100,000 × 0.0475 × (44 ÷ 365) = $572.60
- Rate communicated by Noah Shifman (AHP) via email, December 19, 2025

**Interest accrual policy:** Accrue monthly at last known rate (4.75% for 2026), true up when actual rate is confirmed. See D-011.

**Conflict of interest note:** Jeff Takle and Damien Newman are AHP officers. Both were recused from the board vote approving this loan (October 2025). Only Heather Takle voted.

## Easthampton Project — Financial Profile

*75 Oliver Street, Easthampton, MA. The primary active project and sole current focus of the organization.*

### Property Details
- **Address:** 75 Oliver Street, Easthampton, MA
- **Parcels:** 56 acres total (lodging house, garage, farm land)
- **Building:** ~5,600 sq ft main building + ~1,200 sq ft garage
- **Historic status:** Built ~1890, listed on National Register of Historic Places
- **Deed restrictions:** Historic restriction, affordable housing restriction, agricultural preservation restriction (1983 APR)
- **Planned units:** Up to 20 residential units (studios, 1-bed, 2-bed mix); max 23 allowed per deed restrictions
- **ADA requirement:** 5% of units must be ADA-compliant

### Cost Estimates

| Component | Estimate | Source |
|-----------|----------|--------|
| Main building renovation | ~$4,749,058 | Five Star Building Corp (12/30/2025) |
| Workshop/Garage renovation | $130,000–$210,000 | Five Star |
| New Pole Barn | $120,000–$190,000 | Five Star |
| Site utilities | $40,000–$80,000+ | Five Star |
| Contingency (10%) | ~$431,733 | Five Star |
| **Total revised estimate** | **~$6.8M** | Board presentation Jan 2026 |
| Saloomey Construction estimate | ~$4,500,000 | Alternative estimate, main building only |
| AEL architectural/feasibility | $33,180 | Fee proposal |
| Five Star pre-construction | $8,700 | Signed proposal |
| Cost per unit | ~$237,453 | Derived |

### Anticipated Capital Stack

| Source | Amount/Role | Notes |
|--------|-------------|-------|
| AHP Revolving Credit Line | Up to $3,500,000 | Backup equity / bridge financing |
| CPA (Community Preservation Act) | TBD | Easthampton-specific funding |
| CDBG / ARPA | TBD | Federal/state housing funds |
| Historic Tax Credits | TBD | Property is National Register listed |
| AHPR (Affordable Housing Program Resources) | TBD | State housing program |
| Philanthropic grants | TBD | Foundation and individual donors |
| USDA programs | TBD | Agriculture-related funding |
| SARE grant (HIVE program) | $250,000 applied for | Sustainable Agriculture Research & Education |

### Farm Revenue Projections (10-year)

| Period | Annual Gross Revenue | Annual Costs (30%) | Annual Net |
|--------|---------------------|--------------------|------------|
| Years 1-2 | $34,700 | $10,410 | $24,290 |
| Years 3-10 | $41,700 | $12,510 | $29,190 |
| **10-Year Total** | **~$401,300** | **~$120,390** | **~$280,910** |

### 2020 Capital Needs Assessment
- Prior assessment identified $1,500,000+ in deferred repairs
- Basement ceiling height limits (excavation costly — tens of thousands per zone)
- Historic preservation requirements add complexity and cost to renovation

## Balance Sheet Summary (12/31/2025)

| Line Item | Amount |
|-----------|--------|
| **Assets** | |
| Bank accounts | $99,427.40 |
| **Total Assets** | **$99,427.40** |
| **Liabilities** | |
| Employee reimbursements payable | $4,471.96 |
| AHP Loan (long-term) | $100,000.00 |
| **Total Liabilities** | **$104,471.96** |
| **Equity** | |
| Opening balance equity | $12,835.00 |
| Net income (loss) | ($17,879.56) |
| **Total Equity** | **($5,044.56)** |

## Operational Realities

- **Current accounting tool:** QuickBooks Online (Nonprofit edition, purchased via TechSoup)
- **Existing QBO CoA:** Uses dual-class system (Program Classes: Farm Training / Housing Support / Community Workshops; Fund Classes: General Fund / Restricted Grants) and functional expense categories (Program / Admin / Fundraising) per 990 mapping guides
- **Bank reconciliation:** [TBD — how often? Minimal activity so far]
- **Day-to-day bookkeeping:** Heather Takle (via QuickBooks + personal expense reimbursement pattern)
- **External accountant / CPA:** None yet. Bylaws provision for auditor statements exists but no relationship established.
- **Existing homegrown apps:**
  - `internal-app-registry-auth` — user management & auth for all apps (financial-system will use this; see D-006)
  - `expense-reports-homegrown` — expense reports; will API approved reports into financial-system (see D-007)
  - `renewal-timesheets` — timesheets; will API approved timesheets into financial-system for payroll (see D-008)
  - `proposal-rodeo` — proposal writing; NO integration with financial-system (see D-009)
- **Other technology:** Wix.com (website), Freshworks CRM, Google Workspace for Nonprofits (transitioning as of Jan 2026)
- **Outstanding action items from board:** Establish Treasurer access to financial systems; record $3K Mecky retainer with equity adjustment
- **Records retention:** Consultant contracts (via AHP) require 7-year retention of all books, records, and documentation

## Known Constraints

- System must be buildable and maintainable by Jeff using Claude Code
- Target user count is tiny (~2-5) — auth handled by `internal-app-registry-auth`; no in-app permissions (see D-006)
- Must support fund accounting (restricted vs. unrestricted) at minimum — not currently needed but will be as grants arrive
- Must support dual classification: by program (Farm Training / Housing Support / Community Workshops) AND by fund source (General Fund / Restricted Grants), matching existing QBO class structure
- Must support three functional expense categories (Program / Admin / Fundraising) for 990 reporting
- Must produce whatever reports are needed for 990 filing and MA AG Form PC compliance
- Must support loan covenant reporting (annual financials to AHP)
- Must track expenses by program area (5 programs per Form 1023, currently collapsed to 3 program classes in QBO — see Q15)
- Board expects quarterly financial reporting + 3-month forward cash projections
- $20,000 transaction approval threshold (officer vs. board) should be reflected in workflow if applicable
- Personal software philosophy: build only what's needed, go deep on those features
- Interest calculation must support simple interest with Actual/365 day count convention (confirmed via AHP interest statement)
- ~~Currently cash-basis accounting; may need to migrate to accrual basis~~ **DECIDED: Moving to accrual basis in 2026 (D-005)**

## Open Questions

*Capturing these early. Each one has downstream consequences for system design.*

1. ~~What is the annual revenue range?~~ **PARTIALLY ANSWERED: Currently $0 revenue. Form 1023 projects $100K-$195K over first 3 years. Farm revenue projected $34.7K-$41.7K/yr. Still TBD what actual revenue will be and when it starts.**
2. ~~What is the fiscal year?~~ **ANSWERED: Calendar year (12/31)**
3. ~~What is the current accounting setup?~~ **ANSWERED: QuickBooks Online Nonprofit with dual-class structure and functional expense categories. Considering replacement with custom-built system.**
4. Are there restricted grants or funds? **RESOLVED (D-013, D-014): None currently. No donor-advised funds. System will support full fund accounting from day one with 2 initial funds (General [Unrestricted] and AHP [Restricted]), plus dynamic fund creation for future restricted sources (CDBG, Historic Tax Credits, CPA, SARE, etc.). Restrictions anticipated with future grants post-property-closing. Property has historic, affordable housing, and agricultural preservation restrictions.**
5. Do funders require financial reports? **PARTIALLY ANSWERED: AHP loan requires annual financials or Form 990. No other funders yet. SARE grant (if awarded) would likely require reporting.**
6. ~~Does the board need financial visibility in the system?~~ **PARTIALLY ANSWERED: Board receives P&L, Balance Sheet, Cash Flow at quarterly meetings. Treasurer access to financial systems is an open action item. Direct system access TBD.**
7. ~~Is there an external CPA?~~ **ANSWERED: No. None yet. Bylaws provide for auditor but no relationship established.**
8. ~~How do the existing homegrown apps (timesheets, expense reports) need to integrate with the financial system?~~ **ANSWERED: expense-reports-homegrown pivots from QBO to financial-system API (D-007). renewal-timesheets APIs into financial-system for payroll (D-008). proposal-rodeo does NOT integrate (D-009). Bill pay mechanism TBD (D-010).**
9. What's the public support test situation? **PARTIALLY ANSWERED: In initial 5-year period (org'd 2025). Classification 170(b)(1)(A)(vi). Currently zero revenue so test not yet applicable. Revenue mix will matter as grants/donations arrive.**
10. ~~Does the org have any earned income?~~ **PARTIALLY ANSWERED: Not currently. Form 1023 projects $10-15K in gross receipts by Year 2-3. Development and management fees anticipated post-property-closing. Farm operations projected $34.7K-$41.7K/yr.**
11. ~~What is the Ramp credit card used for? Does it need to sync with the financial system?~~ **ANSWERED: Yes, Ramp needs to sync with financial-system. Usage details TBD.**
12. ~~What are the chart of accounts implications of having 5 program areas?~~ **RESOLVED (D-012): RI uses 1 program class ("Property Operations"). The Form 1023's 5 areas are descriptive aspects of the same property, not separate business lines. FVC manages training/farming; RI manages property. For 990 reporting, functional categories (Program/Admin/Fundraising) are sufficient.**
13. ~~Should the system track the AHP loan interest accrual monthly?~~ **ANSWERED: Yes. Accrue monthly at last known rate (4.75% for 2026), true up when actual rate is confirmed. Simple interest, Actual/365 day count. See D-011.**
14. **RESOLVED (D-015):** The $12,835 opening balance equity is AHP's in-kind contribution for consultant costs (Mecky contract + other professional development) that AHP covered before RI had operational infrastructure. Recorded as AHP in-kind contribution (equity) offset by professional services expense, documenting the cost for capital stack/tax credit purposes with zero net cash impact.
15. **RESOLVED (D-012):** RI uses 1 program class ("Property Operations") because RI is a landlord/property manager. The 5 Form 1023 program areas (Affordable Housing, Regenerative Agriculture, Workforce Development, Public Education, Energy Affordability) are all integrated into the same property and managed through partnerships (FVC for training/farming) or property operations. For 990 reporting, functional categories (Program/Admin/Fundraising) are sufficient. The 5 Form 1023 areas are mapped at the reporting level (Chunk 5), not the transaction level.
16. **NEW:** Address discrepancy — the Form PC and some AHP documents reference a Sudbury, MA address (490-B Boston Post Road — this is AHP's address, not RI's). The principal office is Springfield, MA. Is the AG filing address correct, or does it need updating?
17. **NEW:** Consultant costs (Mecky, AEL, Five Star) — which are paid by AHP vs. RI? The Mecky contract is between AHP and Mecky with RI as client. Are AHP-paid consultant costs reflected in RI's books at all? If AHP forgives loan portions, does that convert expense treatment?
18. **RESOLVED (D-013, D-016):** Fund accounting will track funding sources at the fund level (Historic Tax Credits Fund, CPA Fund, CDBG Fund, etc.). Individual transactions are coded to funds. Detailed cost-code tracking (which capital item was paid by which grant) is deferred to Chunk 5 based on actual funder requirements. Fund-level tracking is sufficient for now; cost-code retrofit is straightforward if needed.
19. **NEW:** 1099 preparation — the chunks.md defers this. But with consultant relationships (even if currently through AHP), will RI need to issue 1099s? When does this become relevant?
20. **NEW:** The insurance policy is a minimal BOP ($501/yr). Upon property acquisition, insurance needs will scale dramatically. Does the financial system need to track insurance as a compliance item (renewal dates, coverage adequacy) or just as an expense?
