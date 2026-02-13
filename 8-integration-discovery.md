# Chunk 8: Integration Layer — Discovery

**Status:** ✅ Discovery Complete (14 decisions: D-118 through D-131)

API contracts and data flows between financial-system and existing app ecosystem. Three internal app integrations (all inbound), one external service (Ramp), one bank data feed (UMass Five).

---

## Inter-App Dependencies

**1. renewal-timesheets → financial-system** (D-008)
- Approved timesheets create GL payroll entries
- Integration: Database-mediated staging (D-118)
- Compensation model: Dual — PER_TASK (youth) vs SALARIED (adults) (D-119)
- Exempt status determines overtime applicability (D-120)
- Staging: One row per fund per approved timesheet, hours + dollars (D-121)
- Fund selection per time entry, defaults to Unrestricted (D-024)

**2. expense-reports-homegrown → financial-system** (D-007)
- Approved expense reports create GL expense/AP entries
- Integration: Database-mediated staging (D-118)
- Staging: One row per expense line item, no receipts (D-122)
- GL account + fund per line item; all QBO artifacts deprecated
- Pivoting from QBO API to financial-system staging table

**3. app-portal → financial-system** (D-006, D-017)
- Authentication/authorization (existing, working)
- Employee payroll master data: read-only DB access (D-124)
- New People API fields needed: compensation_type, annual_salary, expected_annual_hours, exempt_status (D-119, D-120)

**4. Ramp credit card → financial-system** (D-021)
- REST API with daily polling (D-123), same cadence as Plaid (D-094)
- Transactions land in pending queue → categorization → GL posting
- Implementation details (auth, pagination, refunds) deferred to spec/build

**5. UMass Five bank → financial-system** (D-093, D-094)
- Plaid `/transactions/sync` API, daily polling
- $0.30/account/month ($0.60 for 2 accounts, $0.90 when escrow added)
- Full details in dependencies.md Integration #5

**6. proposal-rodeo → financial-system** (D-009)
- NO INTEGRATION (explicit decision)

## Integration Architecture (D-118)

**Pattern: Database-mediated integration for internal apps; external APIs for Ramp and Plaid.**

Financial-system owns its Postgres database. Internal source apps (renewal-timesheets, expense-reports-homegrown) get a **restricted Postgres role** with:
- **SELECT** on reference tables (GL accounts, funds, vendors) — for populating dropdowns and autocomplete in source app UIs
- **INSERT + SELECT** on a staging table — for submitting approved financial data and reading back processing status
- **No UPDATE, no DELETE** on anything

**Data flow:**
1. Source app user approves a timesheet or expense report in the source app
2. Source app INSERTs a summary record into the staging table (just the financial data — not receipts, metadata, drafts, etc.)
3. Financial-system queries the staging table, sees what's waiting for processing
4. Financial-system validates, creates GL entries, and updates status on the staging record (received → posted → matched to payment → paid)
5. Source app reads status back from the staging table to show users where their submission stands (e.g., "Expense report #103 matched to payment on 2/12")

**Why not REST APIs?** The only existing inter-app API (payroll data on auth portal) isn't in production. REST between internal apps adds endpoints to build and maintain on both sides with no benefit at this scale. Database access is simpler, gives live reference data, and the staging table provides a natural audit trail.

**External integrations (Ramp, Plaid):** These are accessed via their vendor-provided APIs directly by financial-system. They do not use the staging table pattern.

**Staging table schema design:** Deferred to spec phase. Whether one table or multiple is an implementation decision.

## Error Handling (D-125)

Two patterns:
- **Internal staging INSERTs:** Postgres does the work — FK constraints catch invalid GL accounts/funds, unique constraints prevent duplicates, database transactions ensure atomicity. Source apps get immediate database errors on failed INSERTs.
- **External API sync failures (Ramp, Plaid):** Dashboard notification + email alert (D-126 Postmark). Failed syncs retry next daily poll. No data loss since transactions persist in external system.

Detailed error handling mechanics (retry strategies, dead letter patterns) deferred to spec/build.

## Email Delivery (D-126)

Postmark for all outbound email: donor acknowledgment letters (D-038) and sync failure alerts (D-125). Already used by renewal-timesheets.

## AI Strategy Decisions (from Chunk 8 Discovery)

### Depreciation Policy & AI Assistant (D-127, D-128)

**Context:** D-020 originally scoped a standalone AI Depreciation Assistant. During Chunk 8 discovery, deeper analysis revealed that RI as a 501(c)(3) nonprofit has no tax benefit from accelerated depreciation. This insight eliminated most of the complexity that justified a dedicated AI feature.

**Decisions:**
- **D-127:** RI uses straight-line depreciation at IRS-standard useful lives for all assets. No accelerated methods, no Section 179, no bonus depreciation. Organizational policy position.
- **D-128:** Standalone AI Depreciation Assistant (D-020) superseded. Depreciation form gets copilot support via system-wide pattern (D-129) instead.

**Cross-reference:** See Chunk 1 spec GL-P1-001 (updated) and decisions.md D-127, D-128.

### System-Wide AI Copilot Pattern (D-129, D-130)

**Context:** The depreciation assistant discussion evolved into a broader architectural insight: building bespoke AI features per domain (depreciation helper, transaction entry helper) is less effective than a single context-aware copilot available on every page.

**Decisions:**
- **D-129:** Every screen gets a right-panel AI copilot with page-specific context and configurable toolkit. Each page's spec defines a "copilot context package" (data, tools, knowledge resources). v1: financial-system data only. v2: cross-application access (timesheets, expense reports, payroll/people).
- **D-130:** AI Transaction Entry Assistant (D-028) absorbed into copilot pattern. Ramp categorization UX (Chunk 3 Session 5) remains valid as system features; the "AI" piece becomes copilot context on those pages.

**Spec impact:** Every page/screen specification should include a "copilot context package" section. This is a system-wide design guideline, not a per-chunk feature.

**Cross-reference:** See decisions.md D-129, D-130. See dependencies.md "Deferred Cross-Chunk Features" section (updated). See Chunk 1 spec GL-P1-001, GL-P1-002 (both updated). See Chunk 3 discovery (AI note added after Session 5 summary).

## Deployment Topology (D-131)

**Same stack as existing apps: Vercel + Neon.** No special infrastructure required.

- **Scheduled jobs** (daily Plaid/Ramp sync, monthly depreciation, compliance reminders): Vercel cron or equivalent. Mechanism determined at build time.
- **AI copilot** (D-129): Anthropic API via server-side proxy. Standard pattern.
- **Secrets:** API keys (Anthropic, Plaid, Ramp, Postmark) + DB connection strings managed via environment variables.
- **Cross-Neon-project DB access** (D-118, D-124): The integration pattern is decided. The Neon-specific connectivity mechanics (how cross-project access works in practice) are a spec/build concern, not a discovery decision.

---

## Key Questions — All Resolved

- ✅ ~~API architecture: REST, shared DB, or event-driven?~~ **ANSWERED (D-118):** Database-mediated. Restricted Postgres role for source apps. Staging table for writes. External APIs for Ramp/Plaid.
- ✅ ~~internal-app-registry-auth: What payroll data exists? Enhancement needed?~~ **ANSWERED (D-124):** Auth portal is single source of truth for all employee data. REST API deprecated — financial-system and timesheets read employee data via direct read-only DB access, same pattern as D-118. New hires set up in app-portal. Neon encryption sufficient for PII.
- ✅ ~~renewal-timesheets: What data goes into the staging table? Batch or per-approval? Fund mapping?~~ **ANSWERED (D-119, D-120, D-121):** Approval triggers INSERT. Per-fund aggregation (hours + dollars). Dual compensation model (per-task vs salaried) with exempt status. People API provides pre-calculated hourly rate. Fund selection per time entry, defaults to Unrestricted.
- ✅ ~~expense-reports-homegrown: What data goes into the staging table? Per-report or per-line-item? Receipt references?~~ **ANSWERED (D-122):** Per-line-item INSERT on approval. No receipts/attachments in staging — stay in expense-reports DB. All QBO artifacts deprecated. GL account + fund per line item.
- ✅ ~~Ramp: API availability? Webhook or polling? Export fallback?~~ **ANSWERED (D-123):** Ramp REST API with daily polling. Same cadence as Plaid. Implementation details deferred to spec/build.
- ✅ ~~How does financial-system push reference data updates to source apps? (Or do they just query live?)~~ **ANSWERED (D-118):** Source apps have SELECT access on reference tables (GL accounts, funds, vendors) — they query live. No push mechanism needed. Reference data updates are immediately visible to source apps via their next SELECT.
- ✅ ~~Error handling for integration failures?~~ **ANSWERED (D-125):** DB constraints for internal; dashboard notification + email for external sync failures.
- ✅ ~~Email delivery service?~~ **ANSWERED (D-126):** Postmark (already in ecosystem).
- ✅ ~~Depreciation policy and AI approach?~~ **ANSWERED (D-127, D-128, D-129, D-130):** Straight-line only. Standalone AI features superseded by system-wide copilot pattern.
- ✅ ~~Deployment topology?~~ **ANSWERED (D-131):** Same stack (Vercel + Neon). Scheduled jobs, secrets, and cross-DB access mechanics are spec/build concerns.

## Dependencies

**From Chunk 1:**
- D-007, D-008: Integration requirements
- D-017: Employee master data
- D-021: Ramp GL structure
- D-024: GL validation rules

**Depends On:**
- Chunk 1: GL must accept entries
- Chunk 3: Expense/payroll recording logic

---

## Discovery Summary

Chunk 8 discovery ran across two sessions on 2026-02-13, producing 14 decisions (D-118 through D-131).

**Session 1 (Topics 1–9):** Established database-mediated integration as the architecture for internal apps (D-118), defined compensation model and staging contracts for timesheets and expense reports (D-119 through D-122), confirmed Ramp API with daily polling (D-123), resolved employee data source of truth via read-only DB access (D-124), defined error handling and email delivery (D-125, D-126), set depreciation policy (D-127), and evolved standalone AI features into a system-wide copilot pattern (D-128 through D-130).

**Session 2 (Topic 10):** Confirmed deployment on the same Vercel + Neon stack as existing apps (D-131). Cross-Neon-project connectivity mechanics deferred to spec/build.

**Key architectural decisions:**
1. **Database-mediated integration** (D-118) — internal apps write to staging tables and read reference tables via restricted Postgres roles. No REST APIs between internal apps.
2. **System-wide AI copilot** (D-129) — every page gets a right-panel chatbot with page-specific context, replacing bespoke AI features. Each page spec defines a "copilot context package."
3. **Same stack** (D-131) — Vercel + Neon, consistent with all other RI apps.

**Explicitly deferred to spec/build:**
- Staging table schema design (one table vs. multiple)
- Ramp API implementation details (auth, pagination, refund handling)
- Cross-Neon-project database connectivity mechanics
- Copilot context package definitions (per-page, defined in each page's spec)
- Scheduled job implementation (Vercel cron specifics)
- Detailed error handling mechanics (retry strategies, dead letter patterns)
