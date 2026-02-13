# Financial System Project

Custom financial management system for Renewal Initiatives, Inc. — replacing QuickBooks Online with purpose-built software for a 501(c)(3) nonprofit focused on affordable housing and regenerative agriculture.

## Project Philosophy

**"Personal Software"** — Built only for Renewal Initiatives (2-5 users), no multi-tenant design, no generic features. Going 10x deeper on what's actually needed rather than broad COTS feature coverage.

## Workflow

1. **Discovery Phase** — Work through chunks 1-8 sequentially, exploring requirements and capturing decisions
2. **Cross-Chunk Review** — After each chunk discovery, review interdependencies and update `dependencies.md`
3. **Spec Phase** — Write formal specifications for chunks 1-8 sequentially
4. **Build Order Evaluation** — Determine optimal build sequence based on dependencies
5. **Build Phase** — Implement the system

## File Guide

### Core Documentation
- **`00-README.md`** (this file) — Project overview and file guide
- **`decisions.md`** — All decisions (D-001+) with rationale. Chronological record of choices made.
- **`../company_facts.md`** — Organization data, compliance calendar, revenue/expense profiles. Source of truth for all RI projects. Lives at workspace level for cross-project reuse. (A copy remains at `company_facts.md` in this directory for backward compatibility.)
- **`dependencies.md`** — Cross-chunk dependency tracker. How chunks impact each other. Update after each discovery.

### Chunk Files (Discovery → Spec → Build)
Each chunk follows the pattern: `N-name-discovery.md` → `N-name-spec.md` → `N-name-build.md`

**Discovery files** = Exploration, Q&A, requirements gathering, notes
**Spec files** = Formal specifications ready for implementation
**Build files** = Implementation notes, code references, deployment details (created during build phase)

### Supporting Materials
- **`discovery-docs/`** — Source materials (PDFs, extractions, reference documents)
- **`archive/`** — Deprecated files retained for reference

## The 8 Chunks

1. **Core Ledger / Chart of Accounts** — Foundation. Double-entry bookkeeping, fund accounting, accrual basis.
2. **Revenue Tracking / Donations & Grants** — AR, rental income, donation tracking, grant revenue recognition.
3. **Expense Tracking & Categorization** — AP, payroll obligations, functional splits (Program/Admin/Fundraising).
4. **Bank Reconciliation** — Matching GL to bank statements, variance analysis.
5. **Compliance Reporting** — IRS Form 990, MA AG Form PC, public charity support test.
6. **Board & Management Reporting** — Financial statements, dashboards, metrics.
7. **Budgeting** — Annual budgets, fund-level budgeting, variance tracking.
8. **Integration Layer** — APIs connecting to renewal-timesheets, expense-reports-homegrown, internal-app-registry-auth, Ramp, bank feeds.

## Current Status

**Chunk 1**: ✅ Discovery complete → Spec complete
**Chunk 2**: ✅ Discovery complete (spec-ready)
**Chunk 3**: ✅ Discovery complete (payroll restored to v1 per D-068)
**Chunk 5**: ✅ Discovery complete (25 decisions: D-061 through D-085, spec-ready)
**Chunk 6**: ✅ Discovery complete (17 decisions: D-054 through D-060, D-108 through D-117, spec-ready)
**Chunk 8**: ✅ Discovery complete (14 decisions: D-118 through D-131, spec-ready)
**Chunk 4**: 🔴 Not started
**Chunk 7**: ✅ Discovery complete (7 decisions: D-086 through D-092, spec-ready)

## Key Inter-App Integrations

- **renewal-timesheets** → financial-system (approved timesheets create payroll GL entries)
- **expense-reports-homegrown** → financial-system (approved expense reports create AP entries)
- **internal-app-registry-auth** → financial-system (auth + employee payroll master data)
- **Ramp credit card** → financial-system (transaction import and categorization)
- **UMass Five bank** → financial-system (statement data for reconciliation)

## Quick Start

**Starting discovery on a new chunk?**
1. Read `dependencies.md` to understand what upstream chunks decided
2. Open `N-name-discovery.md` and capture Q&A, explorations, notes
3. When you make decisions, record them in `decisions.md` with D-XXX IDs
4. Update `dependencies.md` with how your decisions impact other chunks

**Moving to spec phase?**
1. Review your chunk's discovery file
2. Check `dependencies.md` for any blockers or deferred items
3. Write the formal spec in `N-name-spec.md`

**Ready to build?**
1. Review all dependencies in `dependencies.md`
2. Check the build order plan
3. Create `N-name-build.md` to track implementation notes
