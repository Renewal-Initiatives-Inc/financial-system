# Chunk 1: Core Ledger / Chart of Accounts — Discovery

**Status:** ✅ Discovery Complete (21 decisions finalized, all critical gaps addressed)

Foundation for everything else. Double-entry bookkeeping, chart of accounts designed for 501(c)(3), fund accounting (restricted vs. unrestricted), accrual-basis accounting.

---

## Discovery Summary

Chunk 1 discovery is complete with 21 major decisions finalized (D-012 through D-033). All critical gaps have been addressed. Ready for formal specification phase.

**Key Architectural Decisions:**
- Single program class "Property Operations" (D-012)
- Full fund accounting from day one with dynamic fund creation (D-013)
- Net assets split "Without Donor Restrictions" / "With Donor Restrictions" (D-014)
- Accrual-basis accounting (D-005)
- AHP loan structure and interest accrual (D-011, D-022, D-023)
- Payroll GL structure with year-end functional allocation (D-018)
- Depreciation with AI assistant for setup (D-019, D-020)
- Ramp credit card integration (D-021)
- AR tracking by tenant/unit (D-026)
- Rent adjustments with mandatory annotation (D-027)

**Deferred to Chunk 5 (pending MA law / funder requirements research):**
- Security deposits and escrow accounts
- Bad debt / write-off policy
- Historic tax credit equity accounting
- In-kind contributions and volunteer tracking
- Proration methods for partial-month moves

**Next Step:** Phase 2 formal specification using product-management:feature-spec skill

---

## Full Decision Details

See `decisions.md` for complete decision text and rationale:
- D-005: Move to accrual-basis accounting in 2026
- D-011: AHP loan interest — accrue monthly at last known rate, true up at year-end
- D-012: Program Classes — Single "Property Operations" Class
- D-013: Fund Accounting — Full Structure from Day One with Dynamic Fund Creation
- D-014: Net Assets — Split "Without Donor Restrictions" and "With Donor Restrictions" from Day One
- D-015: Opening Balance Equity — AHP In-Kind Contribution ($12,835)
- D-016: Capital Cost Coding — Fund-Level Tagging, Details Deferred
- D-017: Employee Master Data in app-portal
- D-018: Payroll GL — Single "Salaries & Wages" Account, Year-End Allocation
- D-019: Depreciation GL Structure — Assets, Accumulated Depreciation, Monthly Automation
- D-020: AI Depreciation Assistant — **SUPERSEDED by D-128/D-129** (system-wide copilot pattern)
- D-127: Depreciation Policy — Straight-Line, IRS Standard Lives, No Accelerated Methods
- D-128: AI Depreciation Assistant Superseded by System-Wide AI Copilot
- D-129: System-Wide AI Copilot — Architectural Pattern
- D-130: AI Transaction Entry Assistant Absorbed into Copilot Pattern
- D-021: Ramp Credit Card Integration — GL Structure in Chunk 1, Workflow in Chunk 8
- D-022: AHP Loan Structure — Only Drawn Amount is Liability
- D-023: Loan Forgiveness — Treated as Donation Income
- D-024: GL Entry Validation — Selective Enforcement
- D-025: Rental Income Recognition — Accrual Basis When Due
- D-026: AR Tracking Granularity — By-Tenant/Unit
- D-027: Rent Adjustments and Forgiveness — Separate GL Accounts + Annotation
- D-028: Prepaid Expenses & Accrued Liabilities — Simple GL Structure with AI-Enhanced Entry
- D-029: Restricted Net Assets Release — Automatic on Fund-Coded Expense
- D-030: Grants Receivable — Separate Asset Account for Grant Award Timing
- D-031: Property Operating Expenses — Granular GL Structure for Operational Tracking
- D-032: Construction in Progress — Asset Account for Property Development Costs
- D-033: FY25 Cash-to-Accrual Conversion — Import All Transactions and System-Generated Adjustments

---

## Cross-Chunk Dependencies

See `dependencies.md` for full impact analysis. Chunk 1 decisions impact:
- **Chunk 2** (Revenue): AR structure, rental income recognition, fund attribution required
- **Chunk 3** (Expense): Payroll GL, fund coding, functional split deferred to year-end
- **Chunk 4** (Bank Recon): GL-only entries (depreciation, loan forgiveness), AR timing gaps
- **Chunk 5** (Compliance): Net assets mechanics, loan forgiveness documentation, functional allocation policy
- **Chunk 6** (Reporting): Fund-level statements, AR aging, adjustment trend analysis
- **Chunk 7** (Budgeting): Fund-level budgets, available credit planning
- **Chunk 8** (Integration): GL validation rules, fund mapping from task codes
