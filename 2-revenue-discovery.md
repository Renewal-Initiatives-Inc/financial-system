# Chunk 2: Revenue Tracking / Donations & Grants — Discovery

**Status:** ✅ Discovery Complete

Recording incoming money — donations, grants, earned income. Tracking donor info, grant restrictions, acknowledgment letters. Supports public charity test calculations. Primary focus: Accounts Receivable & Rental Income Recognition.

---

## Discovery Status

**Completed:**
- Rental income recognition (D-025, D-026, D-027)
- AR tracking structure and granularity
- Rent adjustment mechanisms

**Completed:**
- Q3: Donations & grants revenue recognition (D-034, D-035, D-036, D-037)
- Q4: Public support test (D-039 — deferred to future CPA/990 filing)
- Q5: Historic tax credit equity revenue recording (deferred to 2027+)
- Q8: Program fees and earned income (D-037 — farm lease revenue)
- Q9: Donor management needs (D-038 — donor tracking + IRS acknowledgment automation)

**Deferred:**
- Q6: Bad debt policy (deferred to Chunk 5)
- Q7: In-kind contributions and volunteer tracking (deferred to Chunk 5)

---

## Key Decisions

**AR/Rental Income:**
- **D-025:** Rental Income Recognition — Accrual Basis When Due
- **D-026:** AR Tracking Granularity — By-Tenant/Unit
- **D-027:** Rent Adjustments & Forgiveness — Separate GL Accounts + Annotation

**Grants/Contracts (2026-02-11):**
- **D-034:** Grant Revenue Recognition — Revenue at Award Letter (both upfront and reimbursement models)
- **D-035:** Grant/Contract Expense Attribution — Mandatory fund/grant coding for all expenses (timesheets, expense reports, Ramp)

**Donations (2026-02-11):**
- **D-036:** Donation Revenue Recognition — Immediate recognition for unrestricted and restricted donations

**Earned Income (2026-02-11):**
- **D-037:** Earned Income Recognition — Revenue when earned (farm lease, fee-for-service)

---

## Open Questions

**Q3: Donations & Grants Revenue**
- When is grant revenue recognized? (award, spending, receipt?)
- Donor management needed, or just transaction recording?
- How to handle restricted vs. unrestricted classification?
- **GAAP/FASB Requirement:** Formalize grant revenue recognition policy per FASB ASC 958-605 (Nonprofit Revenue Recognition). Must choose and document consistent approach: exchange transactions (revenue when earned) vs. contributions (revenue when conditions met or unconditional promise received). Policy determines when to use Grants Receivable (D-030) vs. Deferred Revenue (D-028) vs. immediate recognition. Required for future GAAP-compliant audited financials.

**Q4: Public Support Test**
- System-generated calculations or manual?
- What data is needed for 170(b)(1)(A)(vi) test?

**Q5: Historic Tax Credit Equity**
- **Status (2026-02-11):** Very early stage. HTC consultant identified but not hired until property possession (Spring 2026). No investors/syndicators lined up. Not yet approved for credits. Money unlikely to arrive until 2027+.
- **Target:** ~32% of total deal from HTC equity (federal + state combined)
- **Accounting treatment:** DEFERRED until deal structure is clearer. Not an immediate system requirement for 2026 launch.
- **Future questions (when deal materializes):** Revenue recognition timing (award vs. construction completion vs. placed-in-service), restricted net asset classification, investor structure (syndication vs. direct equity)

---

## Dependencies

**From Chunk 1:**
- D-013: Fund accounting structure (all revenue codes to funds)
- D-014: Net assets split (restricted grants → "With Donor Restrictions")
- D-024: GL validation (rental income MUST identify funding source)
- D-025, D-026, D-027: AR and rental income GL structure

**Impacts on Other Chunks:**
- **Chunk 4**: AR reconciliation, timing gaps between accrual and receipt
- **Chunk 5**: Grant revenue recognition rules (funder-specific)
- **Chunk 6**: AR aging reports, donation/grant tracking dashboards

---

## Discovery Session Notes (2026-02-11)

### Revenue Source Exploration Framework

**Exploration approach:** Map actual revenue streams first (what money comes in, from where, with what restrictions) before determining accounting treatment. Focus on depth over breadth — one topic at a time.

**Revenue Categories to Explore:**

1. **Rental Income** (✅ COMPLETE — D-025, D-026, D-027)
   - Tenant rent, VASH vouchers, MVRAP, FVC farmer leases

2. **Grants & Restricted Funding** (🔍 IN PROGRESS)

   a. **Historic Tax Credits** (2026-02-11) — DEFERRED TO 2027+
      - Status: Pre-consultant engagement. No investors/syndicators. Not yet approved.
      - Target: ~32% of deal (federal + state HTC combined)
      - Timeline: Money unlikely before 2027+

   b. **Community Preservation Act (CPA)** (2026-02-11) — DEFERRED TO 2027+
      - Status: Informal proposal submitted to town ($1.2M requested). Pre-formal submission. Town response: interested but concerned about amount.
      - Timeline: Obligation no earlier than end of 2026, more likely 2027 (multiple approval gates). If approved, cash potentially ~$400K/year for 3 years.
      - Restrictions: Definitely restricted (specific bucket TBD)
      - Reimbursement structure: Unknown

   c. **2026 Grant Revenue Reality** (2026-02-11) — SYSTEM REQUIREMENT
      - **SARE/USDA grants:** Actively submitting proposals. Funding could arrive in 2026 if awarded.
      - **Other grants/contracts:** Post-acquisition (Spring 2026), will pursue aggressively. Expecting revenues in calendar year 2026.
      - **CDBG:** No (town process delays to 2027+)
      - **Rental income:** NOT until 2028 (training starts = FVC rents; tenants = property rents)
      - **CRITICAL INSIGHT:** Grant revenue IS a 2026 concern. System must handle grant tracking from launch.

   d. **Grant & Contract Structures** (2026-02-11) — SYSTEM DESIGN CRITICAL

      **Model 1: Upfront Payment Grants (SARE example)**
      - Cash received upfront (not reimbursement)
      - Restricted: All expenditures must be tracked against specific grant
      - Revenue recognition: At award letter (preferred)
      - Grant document specifies spending limits by budget category
      - Every expense needs attribution (timesheets, expense reports, Ramp transactions → coded to grant)
      - Compliance reporting required: What spent, where, why, attribution to funder program
      - **Clawback risk:** Low. Government won't claw back unless negligence/incompetence/lawsuit. Post-project audit might disallow some expenditures, but would negotiate additional work rather than actual clawback.
      - **GAAP treatment:** Restricted but unconditional contribution. Once awarded, it's RI's money (with use restrictions).

      **Model 2: Reimbursement Contracts (USDA/VA example)**
      - Pay expenses out of pocket first, submit for reimbursement after
      - Restricted: All expenditures must be tracked against specific contract
      - Revenue recognition: At award letter (preferred - creates Grants Receivable until reimbursed)
      - Every expense needs attribution (timesheets, expense reports, Ramp transactions → coded to contract)
      - Compliance reporting required at contract level
      - **Payment mechanism:** Must submit invoices through government procurement processes. Legal right to payment exists, but practical requirement to follow invoicing procedures.
      - **GAAP consideration:** May be conditional contribution or exchange transaction. "Revenue at award" treatment may need CPA review for GAAP compliance when audited. System will support preferred treatment; can adjust later if needed.

      **Critical System Requirements:**
      1. Fund/grant-level expense tracking (all expense sources must code to grant/contract)
      2. Budget tracking by category within each grant/contract (track spending against limits)
      3. Compliance reporting at grant/contract level (attribution, spending by category)
      4. Support both upfront and reimbursement models
      5. Integration with timesheets (D-008), expense reports (D-007), and Ramp (D-021) for expense attribution

3. **Donations** (2026-02-11) — SYSTEM REQUIREMENT (Secondary Priority)
   - **Fundraising event:** May 2026 to build community excitement
   - **Campaign-based giving:** Tied to specific site improvements (e.g., "Barn restoration $250K" = restricted donation)
   - **General giving:** "Wherever needed most" = unrestricted donation
   - **Scale:** Expected <5% of total project costs over life of project (donations are tertiary to grants/contracts)
   - **System needs:** Track restricted vs. unrestricted; minimal donor management (not a CRM-heavy operation)

   **Donor Management Requirements (2026-02-11):**
   - **Donor tracking:** YES - track donations by donor (donor entity: name, contact info, email). Link donations to donors. View giving history per donor.
   - **IRS acknowledgment letters (>$250):** YES - auto-generate and email. Requires letterhead template + Heather's signature image. Need to determine trigger (on donation entry? manual send? batch?)
   - **Thank-you notes:** NO - not needed in system
   - **Campaign tracking:** Coding to restricted funds is sufficient. No granular campaign tracking (mailings, events, appeal IDs) needed.

4. **Earned Income - Farm Operations** (2026-02-11) — SYSTEM REQUIREMENT (Tertiary Priority)
   - **FVC lease arrangements:** FVC leases land to local farmers; revenue flows back to RI via leasing agreement
   - **Timeline:** 2026 (even if FVC not working land themselves)
   - **Classification:** Likely unrestricted earned income
   - **No other earned income expected in 2026:** No training fees, workshop fees, management fees, or other fee-for-service revenue

5. **Tax Credit Equity** (Q5)
   - Historic Tax Credits equity flow
   - Timing and restrictions
   - GL treatment (restricted net assets? When?)

**Key Decision Dependencies:**
- Revenue recognition timing determines use of: Grants Receivable (D-030), Deferred Revenue (D-028), or immediate recognition
- Must formalize policy per FASB ASC 958-605 for future GAAP compliance
- Fund accounting (D-013) requires all revenue coded to funds
- Net assets split (D-014) requires restricted vs. unrestricted classification
