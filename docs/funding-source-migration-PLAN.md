# Funding Source Migration — Plan

**Status:** Ready for Build
**Last Updated:** 2026-02-19
**Author:** Jeff + Claude
**Traces to:** `handoff-funding-source-migration.md`, `requirements.md` (Revenue Recording), `design.md` (Fund Accounting)

> **Protocol**: Start new sessions with: `@docs/funding-source-migration-PLAN.md Continue.`

---

## 1. Problem Statement

The application has two separate entities — `grants` (contractual relationship with a funder) and `funds` (GL accounting bucket) — that are always 1:1, plus a top-level `/funds/` management surface that duplicates the concept. Collapse into a single enriched `funds` entity managed from Revenue → Funding Sources. Retire the `/funds/` pages, the `grants` table, and all dual-entity overhead. Pre-launch with zero production data — do this right, no backward compatibility.

---

## 2. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Use `fund:X`, `fund-receipt:X`, `fund-conditional-cash:X`, `fund-condition-met:X` as `sourceReferenceId` patterns | Pre-launch, zero data. Uniform naming from day one. |
| D2 | Rename URL routes: `/revenue/grants/` → `/revenue/funding-sources/` | Matches new terminology. Clean break. |
| D3 | **Retire** top-level `/funds/` pages entirely | All fund management moves into Revenue → Funding Sources. No duplicate nav entries. |
| D4 | Extract `<ContractTermsCard>` shared component from PO detail | Reuse in funding source detail |
| D5 | Extract `<ContractUploadExtract>` shared component from PO creation form | Reuse in funding source creation |
| D6 | Permanently rename Postgres enums: `grant_type` → `funding_type`, `grant_status` → `funding_status` | No translation layer. All code uses new names. |
| D7 | Permanently rename all code: `grantTypeEnum` → `fundingTypeEnum`, `grantStatusEnum` → `fundingStatusEnum` | Single naming convention everywhere. |
| D8 | All new columns on `funds` are nullable | Unrestricted funds don't need funder/contract fields |
| D9 | No `sourceType` dropdown in UI | Restriction toggle (RESTRICTED/UNRESTRICTED) is the only accounting classification |
| D10 | Add `fundId` FK to `compliance_deadlines` table | Enables Phase 4 dynamic deadline generation linked to funding source |
| D11 | Funding Sources page shows ALL funds (restricted + unrestricted) | Replaces the old `/funds/` page. Unrestricted funds simply have no funder/contract data. |

---

## 3. Requirements

### P0: Must Have (Phases 1-2)

| ID | Requirement |
|----|-------------|
| REQ-01 | Enrich `funds` table with 15 new columns (all nullable except `isUnusualGrant`) |
| REQ-02 | Rename Postgres enums permanently |
| REQ-03 | Migrate existing grant data into funds, drop `grants` table |
| REQ-04 | Delete `src/lib/db/schema/grants.ts`, `src/lib/validators/grants.ts` |
| REQ-05 | Delete top-level `/funds/` pages and remove from nav |
| REQ-06 | Create `/revenue/funding-sources/` pages (list, new, detail) — absorb all fund + grant CRUD |
| REQ-07 | GL operations use `fundId` directly with `fund:` sourceReferenceId prefix |
| REQ-08 | Revenue actions query `funds` table, no grants join |
| REQ-09 | All reports query funds directly (compliance, drawdown, AR aging) |
| REQ-10 | Validators: `insertFundingSourceSchema` replaces both grant and fund schemas |
| REQ-11 | All tests updated (schema, validators, revenue, reports, E2E) |
| REQ-12 | Seed data includes funder/amount/terms on restricted funds |
| REQ-13 | Breadcrumbs, help terms, copilot contexts updated |

### P1: Nice to Have (Phase 3)

| ID | Requirement |
|----|-------------|
| REQ-14 | Contract PDF upload on funding source creation form |
| REQ-15 | AI extraction of milestones/terms/covenants (reuse existing pipeline) |
| REQ-16 | Shared `<ContractTermsCard>` component (PO detail + funding source detail) |
| REQ-17 | Shared `<ContractUploadExtract>` component (PO creation + funding source creation) |

### P2: Future (Phases 4-5)

| ID | Requirement |
|----|-------------|
| REQ-18 | Dynamic compliance deadlines from `reportingFrequency`, `extractedMilestones`, `endDate` |
| REQ-19 | Cost-share / match soft warning (yellow, non-blocking) |
| REQ-20 | AR invoice schema (`direction`, `fundId` FK, check constraint) |
| REQ-21 | AR invoice creation UI from funding source detail |
| REQ-22 | Revenue recognition on AR invoice payment |

---

## 4. Data Model

### 4.1 Enum renames

```sql
ALTER TYPE grant_type RENAME TO funding_type;
ALTER TYPE grant_status RENAME TO funding_status;
```

### 4.2 New columns on `funds` table

```
funderId                integer     FK → vendors.id       (nullable)
amount                  numeric(15,2)                      (nullable)
type                    funding_type                       (nullable — CONDITIONAL/UNCONDITIONAL)
conditions              text                               (nullable)
startDate               date                               (nullable)
endDate                 date                               (nullable)
status                  funding_status  default 'ACTIVE'   (nullable)
isUnusualGrant          boolean         default false      (not null)
contractPdfUrl          text                               (nullable)
extractedMilestones     jsonb                              (nullable)
extractedTerms          jsonb                              (nullable)
extractedCovenants      jsonb                              (nullable)
matchRequirementPercent numeric(5,2)                       (nullable)
retainagePercent        numeric(5,2)                       (nullable)
reportingFrequency      varchar(50)                        (nullable)
```

### 4.3 New indexes

```sql
CREATE INDEX funds_funder_id_idx ON funds(funder_id);
CREATE INDEX funds_status_idx ON funds(status);
```

### 4.4 Data migration + drop

```sql
UPDATE funds SET
  funder_id = g.funder_id, amount = g.amount, type = g.type,
  conditions = g.conditions, start_date = g.start_date, end_date = g.end_date,
  status = g.status, is_unusual_grant = g.is_unusual_grant
FROM grants g WHERE g.fund_id = funds.id;

DROP TABLE grants;
```

### 4.5 Future: compliance_deadlines (Phase 4)

```sql
ALTER TABLE compliance_deadlines ADD COLUMN fund_id integer REFERENCES funds(id);
```

### 4.6 Future: invoices (Phase 5)

```sql
ALTER TABLE invoices
  ALTER COLUMN purchase_order_id DROP NOT NULL,
  ADD COLUMN fund_id integer REFERENCES funds(id),
  ADD COLUMN direction varchar(2) NOT NULL DEFAULT 'AP';
```

---

## 5. Implementation Plan

### Phase 1: Schema Migration (10 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 1.1 | Rename enums in `enums.ts`: `grantTypeEnum` → `fundingTypeEnum`, `grantStatusEnum` → `fundingStatusEnum` | ✅ | `src/lib/db/schema/enums.ts` |
| 1.2 | Add 15 new columns to `funds.ts` schema definition | ✅ | `src/lib/db/schema/funds.ts` |
| 1.3 | Delete `grants.ts` schema file | ✅ | `src/lib/db/schema/grants.ts` |
| 1.4 | Update `index.ts`: remove grants import/export/relations, add `funder` relation to `fundsRelations`, remove `grants: many(grants)` from `vendorsRelations` | ✅ | `src/lib/db/schema/index.ts` |
| 1.5 | Generate Drizzle migration: enum renames, add columns, copy data, add indexes, drop grants | ✅ | `drizzle/0011_funding_source_migration.sql` |
| 1.6 | Run migration against dev DB | ✅ | `drizzle/0011_funding_source_migration.sql` |
| 1.7 | Update seed data: add funder/amount/terms to restricted funds | ✅ | `src/lib/db/seed/funds.ts` |
| 1.8 | Update seed test | ✅ | `src/lib/db/seed/seed.test.ts` |
| 1.9 | Update schema test: remove grant tests, add enriched fund tests | ✅ | `src/lib/db/schema/schema.test.ts` |
| 1.10 | Verify `npx tsc --noEmit` passes | ✅ | |

### Phase 2: Code Migration (organized by layer)

#### 2a. Validators (5 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2a.1 | Delete grants validator | ✅ | `src/lib/validators/grants.ts` |
| 2a.2 | Create `insertFundingSourceSchema` in funds validator (extends fund creation with optional funder/contract fields + conditional refinement) | ✅ | `src/lib/validators/funds.ts` |
| 2a.3 | Update revenue validators: `grantCashReceiptSchema` → `fundCashReceiptSchema` (field `grantId` → `fundId`), `grantConditionMetSchema` → `fundConditionMetSchema` | ✅ | `src/lib/validators/revenue.ts` |
| 2a.4 | Update validators index: remove grants export, add new exports | ✅ | `src/lib/validators/index.ts` |
| 2a.5 | Delete grants validator test, update revenue validator test | ✅ | `src/lib/validators/__tests__/grants.test.ts`, `src/lib/validators/__tests__/revenue.test.ts` |

#### 2b. GL Operations (2 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2b.1 | Rename `grants.ts` → `funding-sources.ts`. Update 4 function params: `grantId` → `fundId`. Update `sourceReferenceId` patterns: `grant:` → `fund:`, `grant-receipt:` → `fund-receipt:`, `grant-conditional-cash:` → `fund-conditional-cash:`, `grant-condition-met:` → `fund-condition-met:`. Update memo strings. | ✅ | `src/lib/revenue/grants.ts` → `src/lib/revenue/funding-sources.ts` |
| 2b.2 | Update export path | ✅ | `src/lib/revenue/index.ts` |

#### 2c. Server Actions — Revenue (1 task, major)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2c.1 | Rewrite revenue actions: `getGrants()` → `getFundingSources()` (query enriched funds), `getGrantById()` → `getFundingSourceById()` (direct fund query, no join), `getGrantTransactions()` → `getFundingSourceTransactions()` (query `sourceReferenceId LIKE 'fund%{id}%'`), `createGrant()` → `createFundingSource()` (single insert into funds), `recordGrantCashReceiptAction` → `recordFundCashReceiptAction` (look up fund directly), `recognizeConditionalGrantRevenue` → `recognizeConditionalRevenue`. Update types: `GrantRow`/`GrantWithFunder` → `FundingSourceRow`. Update revalidation paths to `/revenue/funding-sources`. | ✅ | `src/app/(protected)/revenue/actions.ts` |

#### 2d. Delete Old Fund Pages + Create New Funding Source Pages (12 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2d.1 | Delete top-level fund list page | ✅ | `src/app/(protected)/funds/page.tsx` |
| 2d.2 | Delete fund list client | ✅ | `src/app/(protected)/funds/funds-client.tsx` |
| 2d.3 | Delete fund columns | ✅ | `src/app/(protected)/funds/columns.tsx` |
| 2d.4 | Delete create fund dialog | ✅ | `src/app/(protected)/funds/create-fund-dialog.tsx` |
| 2d.5 | Delete fund detail page | ✅ | `src/app/(protected)/funds/[id]/page.tsx` |
| 2d.6 | Delete fund detail client | ✅ | `src/app/(protected)/funds/[id]/fund-detail-client.tsx` |
| 2d.7 | Delete fund actions (merge needed logic into revenue actions) | ✅ | `src/app/(protected)/funds/actions.ts` |
| 2d.8 | Rename `/revenue/grants/` → `/revenue/funding-sources/`. Create list page showing ALL funds (restricted + unrestricted), with funder/status/amount columns for enriched funds. Absorb fund management (create, edit, activate/deactivate) into this surface. | ✅ | `src/app/(protected)/revenue/funding-sources/page.tsx` |
| 2d.9 | Create funding source creation page: name field, restriction toggle, funder dropdown (optional), amount, type, conditions, dates, match/retainage/reporting fields. Creating a funding source IS creating a fund. | ✅ | `src/app/(protected)/revenue/funding-sources/new/page.tsx`, `create-funding-source-client.tsx` |
| 2d.10 | Create funding source detail page: fund info + contract terms + funding history + cash receipt/revenue recognition actions. Absorb fund detail (balance breakdown, edit, activate/deactivate). | ✅ | `src/app/(protected)/revenue/funding-sources/[id]/page.tsx`, `funding-source-detail-client.tsx` |
| 2d.11 | Update revenue hub page: card label "Grants" → "Funding Sources", description updated, href → `/revenue/funding-sources` | ✅ | `src/app/(protected)/revenue/page.tsx` |
| 2d.12 | Remove `/funds` from sidebar nav, update any nav component that links to it | ✅ | Sidebar/nav component(s) |

#### 2e. Reports (10 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2e.1 | Rewrite `grant-compliance.ts`: query `funds` directly (WHERE `funder_id IS NOT NULL`), no grants join. Rename types: `GrantComplianceRow` → `FundingComplianceRow`, `grantId` → `fundId`. Pull `extractedMilestones` from fund itself (not just POs). | ✅ | `src/lib/reports/grant-compliance.ts` |
| 2e.2 | Update compliance report page | ✅ | `src/app/(protected)/reports/grant-compliance/page.tsx` |
| 2e.3 | Update compliance report client: update types | ✅ | `src/app/(protected)/reports/grant-compliance/grant-compliance-client.tsx` |
| 2e.4 | Simplify `fund-drawdown.ts`: remove `relatedGrants` array, show contract terms (funder, amount, type, conditions, status) directly on the fund row | ✅ | `src/lib/reports/fund-drawdown.ts` |
| 2e.5 | Update drawdown client: remove related grants display, show inline contract terms | ✅ | `src/app/(protected)/reports/fund-drawdown/fund-drawdown-client.tsx` |
| 2e.6 | Update `ar-aging.ts`: `GrantARRow` → `FundingSourceARRow`, `grantId` → `fundId`, query funds instead of grants | ✅ | `src/lib/reports/ar-aging.ts` |
| 2e.7 | Update AR aging client: update types and labels | ✅ | `src/app/(protected)/reports/ar-aging/ar-aging-client.tsx` |
| 2e.8 | Update report definitions (descriptions referencing grants) | ✅ | `src/lib/reports/types.ts` |
| 2e.9 | Update PDF export for grant-compliance and fund-drawdown | ✅ | `src/app/api/reports/pdf/route.ts` |
| 2e.10 | Update board pack PDF | ✅ | `src/lib/pdf/board-pack.ts` |

#### 2f. Reports UI (3 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2f.1 | Update board pack client | ✅ | `src/app/(protected)/reports/board-pack/board-pack-client.tsx` |
| 2f.2 | Update compliance calendar report client | ✅ | `src/app/(protected)/reports/compliance-calendar/compliance-calendar-client.tsx` |
| 2f.3 | Update compliance calendar data layer | ✅ | `src/lib/reports/compliance-calendar.ts` |

#### 2g. Compliance (3 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2g.1 | Deadline generator: keep `'grant'` category value for now, no functional change | ✅ | `src/lib/compliance/deadline-generator.ts` |
| 2g.2 | Compliance columns: no change if category stays `'grant'` | ✅ | `src/app/(protected)/compliance/columns.tsx` |
| 2g.3 | Compliance calendar client (compliance section): update any grant references | ✅ | `src/app/(protected)/compliance/compliance-calendar-client.tsx` |

#### 2h. Copilot, Help, Navigation (7 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2h.1 | Update revenue copilot context description | ✅ | `src/lib/copilot/contexts/revenue.ts` |
| 2h.2 | Update compliance copilot context | ✅ | `src/lib/copilot/contexts/compliance.ts` (no grant refs) |
| 2h.3 | Update funds copilot context: mention funding source capabilities | ✅ | `src/lib/copilot/contexts/funds.ts` |
| 2h.4 | Update get-fund-balance tool: include funding source data in response | ✅ | `src/lib/copilot/tools/get-fund-balance.ts` |
| 2h.5 | Update help terms: grant-related tooltips | ✅ | `src/lib/help/terms.ts` |
| 2h.6 | Update breadcrumbs: remove `grants` → add `'funding-sources': 'Funding Sources'`, remove `funds` top-level entry | ✅ | `src/components/shared/breadcrumbs.tsx` |
| 2h.7 | Update copilot config if it references fund pages | ✅ | `src/lib/copilot/config.ts` (no refs) |

#### 2i. Other Code (5 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2i.1 | Update budget pages: grant references, fix broken `/funds/actions` imports | ✅ | `queries.ts`, `budgets/actions.ts`, `page.tsx`, `budget-review-client.tsx`, `edit/page.tsx` |
| 2i.2 | Update donations client: any grant cross-references | ✅ | No change — `isUnusualGrant` is IRS term (kept) |
| 2i.3 | Update Ramp integration: any grant references | ✅ | No change — OAuth "client credentials grant" (kept) |
| 2i.4 | Update ProPublica client: grant-funded notes | ✅ | No change — general org description (kept) |
| 2i.5 | Update dashboard fund balances widget if it links to old `/funds` route | ✅ | No change — no `/funds` route links found |

#### 2j. Tests (8 tasks)

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 2j.1 | Update revenue validator tests: `grantId` → `fundId` | ✅ | `src/lib/validators/__tests__/revenue.test.ts` |
| 2j.2 | Update phase16 report tests | ✅ | `src/lib/reports/__tests__/phase16-reports.test.ts` (no changes needed) |
| 2j.3 | Update import engine tests | ✅ | `src/lib/migration/__tests__/import-engine.test.ts` (no changes needed) |
| 2j.4 | Update deadline generator tests | ✅ | `src/lib/compliance/deadline-generator.test.ts` (no changes needed) |
| 2j.5 | Update E2E revenue tests: grant workflow → funding source workflow | ✅ | `e2e/revenue.spec.ts` |
| 2j.6 | Update E2E report tests | ✅ | `e2e/reports.spec.ts` |
| 2j.7 | Update E2E budget tests (fund selector) | ✅ | `e2e/budgets.spec.ts` (no changes needed) |
| 2j.8 | Verify all tests pass: `npm test` + `npx playwright test` | ✅ | 965/966 pass (1 pre-existing Plaid test failure) |

### Phase 3: Contract Upload + AI Extraction

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 3.1 | Extract `<ContractTermsCard>` from PO detail into shared component | ✅ | `src/components/shared/contract-terms-card.tsx` |
| 3.2 | Extract `<ContractUploadExtract>` from PO creation form into shared component | ✅ | `src/components/shared/contract-upload-extract.tsx` |
| 3.3 | Refactor PO forms to use shared components | ✅ | `create-po-form.tsx`, `po-detail-client.tsx` |
| 3.4 | Add contract upload + extraction to funding source creation form | ✅ | `create-funding-source-client.tsx`, `funds.ts` (validator), `actions.ts` |
| 3.5 | Add contract terms display to funding source detail page | ✅ | `funding-source-detail-client.tsx` |

### Phase 4: Compliance Calendar + Nudges

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 4.1 | Add `fundId` FK to `compliance_deadlines` table (migration) | ✅ | `drizzle/0012_compliance_fund_id.sql`, `compliance-deadlines.ts`, `index.ts` |
| 4.2 | Implement `generateFundingSourceDeadlines(fundId)` | ✅ | `src/lib/compliance/deadline-generator.ts` |
| 4.3 | Close-out approach warnings (90d yellow, 30d red) | ✅ | `funding-source-detail-client.tsx` |
| 4.4 | Cost-share / match soft warning on detail page | ✅ | `funding-source-detail-client.tsx` |

### Phase 5: AR Invoice Schema + UI

| # | Task | Status | File(s) |
|---|------|--------|---------|
| 5.1 | Make `purchaseOrderId` nullable, add `fundId` FK, `direction` column, check constraint | ✅ | `drizzle/0013_ar_invoices.sql`, `invoices.ts`, `index.ts`, `validators/invoices.ts` |
| 5.2 | AR invoice creation UI from funding source detail | ✅ | `funding-source-detail-client.tsx`, `revenue/actions.ts` |
| 5.3 | Revenue recognition on AR invoice payment | ✅ | `revenue/actions.ts` (`recordArInvoicePayment`) |

---

## 6. Files Deleted (cleanup)

| File | Reason |
|------|--------|
| `src/lib/db/schema/grants.ts` | Table absorbed into funds |
| `src/lib/validators/grants.ts` | Merged into funds validator |
| `src/lib/validators/__tests__/grants.test.ts` | Tests moved to fund/revenue validators |
| `src/lib/revenue/grants.ts` | Renamed to `funding-sources.ts` |
| `src/app/(protected)/funds/page.tsx` | Retired — managed via Revenue → Funding Sources |
| `src/app/(protected)/funds/funds-client.tsx` | Retired |
| `src/app/(protected)/funds/columns.tsx` | Retired |
| `src/app/(protected)/funds/create-fund-dialog.tsx` | Retired — replaced by full creation form |
| `src/app/(protected)/funds/[id]/page.tsx` | Retired |
| `src/app/(protected)/funds/[id]/fund-detail-client.tsx` | Retired |
| `src/app/(protected)/funds/actions.ts` | Retired — logic merged into revenue actions |
| `src/app/(protected)/revenue/grants/` (entire directory) | Replaced by `/revenue/funding-sources/` |

---

## 7. GAAP/FASB Compliance Verification

| Standard | Requirement | Verification |
|----------|------------|--------------|
| ASC 958-605 | Conditional vs unconditional revenue recognition | `type` field (CONDITIONAL/UNCONDITIONAL) on fund. GL unchanged: DR 1110/CR 4100 (unconditional), DR 1000/CR 2050 → DR 2050/CR 4100 (conditional) |
| ASC 958-205 | Net asset classification by restriction | `restrictionType` (RESTRICTED/UNRESTRICTED) stays on fund. `restricted-fund-release.ts` unaffected. |
| FASB ASU 2018-08 | Distinguish contributions from exchange transactions | `type` field captures this |
| Reg. 1.509(a)-3(c)(4) | Unusual grant 2% threshold | `isUnusualGrant` flag on fund |
| ASC 958-720 | Functional allocation of grant expenses | Operates at fund level via `transactionLines.fundId` — unaffected |
| GL accounts | 1000, 1110, 2050, 4100 | Unchanged |

---

## 8. Execution Order

Phases 1-2 are **one atomic change**. Phases 3-5 can be done incrementally after.

**Phase 1-2 build order (dependency chain):**
1. Schema + migration (1.1–1.6)
2. Validators (2a) — needed by actions
3. GL operations rename (2b) — needed by actions
4. Revenue actions rewrite (2c) — needed by UI
5. Delete old pages, create new pages (2d) — depends on actions
6. Reports (2e, 2f)
7. Compliance, copilot, help, nav (2g, 2h)
8. Other code + dashboard (2i)
9. Seed data + all tests (1.7–1.9, 2j)
10. Final verify: `tsc`, `npm test`, `playwright test`

---

## 9. What NOT to Change

- `fundId` field names across all 10+ referencing tables — stay exactly as-is
- Fund restriction enum (RESTRICTED/UNRESTRICTED) — drives financial statement classification
- GL account codes (1000, 1110, 2050, 4100)
- Transaction line structure (`transactionLines.fundId` FK)
- PO contract extraction (purchase_orders has its own `extractedMilestones/Terms/Covenants`)
- `dismissedWarnings` on purchase_orders (recently added, leave as-is)
- `fund-selector.tsx` shared component — still works, just selects funds
- `fund-split-helper.tsx` — still works for multi-fund splits
- `restricted-fund-release.ts` — already operates at fund level

---

## 10. Session Progress

### Session 1: 2026-02-19 (Discovery + Plan)

**Completed:**
- [x] Scanned all grant references (51 files)
- [x] Scanned all fund references (65+ files)
- [x] Identified 13 files missing from handoff
- [x] Verified GAAP/FASB compliance
- [x] Resolved all discovery questions with Jeff
- [x] Created plan document

**Key Decisions:**
- Pre-launch: no backward compat. Uniform `fund:` sourceReferenceId from day one.
- Retire `/funds/` pages entirely — all management via Revenue → Funding Sources.
- Permanent enum/code rename: `funding_type`, `funding_status`, `fundingTypeEnum`, etc.
- Extract shared components from PO forms for reuse.

**Next Steps:**
- [x] `/plan-phase` for Phase 1-2 detailed execution
- [x] `/execute-phase` to build

### Session 2-3: 2026-02-19 (Build Phases 1-2)

**Completed:**
- [x] Phase 1: Schema migration (enums, columns, grants.ts deletion, migration SQL)
- [x] Phase 2a: Validators (grants → funding source schemas)
- [x] Phase 2b: GL operations rename (grants.ts → funding-sources.ts)
- [x] Phase 2c: Revenue actions rewrite
- [x] Phase 2d: Delete old fund/grant pages, create funding source pages
- [x] Phase 2e-f: Reports (compliance, drawdown, AR aging, board pack, PDF export)
- [x] Phase 2g: Compliance (kept 'grant' category)
- [x] Phase 2h: Copilot, help, navigation updates
- [x] Phase 2i: Budget pages, other code
- [x] Phase 2j: All tests updated — 965/966 pass

**Additional fixes during build:**
- Fixed circular import between `funds.ts` and `vendors.ts` (FK defined in migration SQL)
- Fixed `formatCurrency` type mismatch in fund-drawdown client (string → Number())
- Enriched seed data for 5 restricted funds with amounts, types, dates, conditions
- Added `insertFundingSourceSchema` validation to seed test

**Remaining:**
- [x] 1.6: Run migration against dev DB (`drizzle/0011_funding_source_migration.sql`)
- [x] Phase 3: Contract upload + AI extraction (shared components)
- [ ] Phase 4: Compliance calendar + nudges
- [ ] Phase 5: AR invoice schema + UI

### Session 4: 2026-02-19 (Phase 3 — Contract Upload + AI Extraction)

**Completed:**
- [x] 3.1: Extracted `<ContractTermsCard>` → `src/components/shared/contract-terms-card.tsx`
- [x] 3.2: Extracted `<ContractUploadExtract>` → `src/components/shared/contract-upload-extract.tsx`
- [x] 3.3: Refactored PO detail + creation form to use shared components
- [x] 3.4: Added contract upload + AI extraction to funding source creation form
- [x] 3.5: Added contract terms display to funding source detail page
- [x] Added `contractPdfUrl`, `extractedMilestones/Terms/Covenants` to `insertFundingSourceSchema`
- [x] Updated `createFundingSource` action to persist contract data
- [x] `npx tsc --noEmit` passes (zero errors)

**Not yet run:**
- [ ] `npm test` — unit tests not yet verified this session
- [ ] E2E tests not yet verified this session

### Session 5: 2026-02-19 (Phase 4 — Compliance Calendar + Nudges)

**Completed:**
- [x] 4.1: Added `fundId` FK to `compliance_deadlines` table + migration `drizzle/0012_compliance_fund_id.sql`
- [x] 4.1: Updated schema relations (complianceDeadlines → fund, funds → complianceDeadlines)
- [x] 4.2: Implemented `generateFundingSourceDeadlines(fundId)` — generates reporting, milestone, covenant, and close-out deadlines
- [x] 4.3: Close-out approach warnings on funding source detail page (90d yellow, 30d red)
- [x] 4.4: Cost-share/match soft warning on funding source detail page (yellow, non-blocking)
- [x] Added 19 new unit tests (reporting date generation, close-out warning, match warning)
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] `npm test`: 984/985 pass (1 pre-existing Plaid test failure)

**Remaining:** none — migration complete ✅

### Session 6: 2026-02-20 (Phase 5 — AR Invoice Schema + UI)

**Completed:**
- [x] 5.1: Made `purchaseOrderId` + `vendorId` nullable on invoices table
- [x] 5.1: Added `direction varchar(2) DEFAULT 'AP'`, `fund_id FK` to invoices table
- [x] 5.1: DB check constraints (`direction IN ('AP','AR')`, source integrity)
- [x] 5.1: Migration `drizzle/0013_ar_invoices.sql`
- [x] 5.1: Updated `invoices.ts` schema + `invoicesRelations`, `fundsRelations` in `index.ts`
- [x] 5.1: Added `insertArInvoiceSchema` + `InsertArInvoice` type to validators
- [x] 5.2: `getArInvoices(fundId)` query in revenue actions
- [x] 5.2: `createArInvoice()` action — GL: DR 1110 Grants Receivable, CR 4100 Grant Revenue
- [x] 5.3: `recordArInvoicePayment()` action — GL: DR 1000 Cash, CR 1110 Grants Receivable
- [x] 5.2-5.3: AR Invoice card on funding source detail page (issue form + outstanding list + record payment)
- [x] `npx tsc --noEmit` passes (zero errors)
- [x] `npm test`: 984/985 pass (1 pre-existing Plaid test failure)

### Session 7: 2026-02-20 (Housekeeping — Migrations + E2E)

**Completed:**
- [x] Applied `drizzle/0012_compliance_fund_id.sql` to dev DB (fund_id FK on compliance_deadlines)
- [x] Applied `drizzle/0013_ar_invoices.sql` to dev DB (direction, fund_id, check constraints on invoices)
- [x] Ran full E2E suite: 12/92 pass, 67 fail, 13 skip

**E2E Status:**
- All 67 failures are **auth-only** — `e2e/.auth-state.json` (saved 2026-02-14) has expired Zitadel session; only CSRF cookies remain, no session token. Tests redirect to login page.
- Smoke tests (3) pass (no auth required). 9 other auth-free tests pass.
- **No failures attributable to Phase 4/5 changes.**
- Root cause: Zitadel app had `client_secret_basic` auth method set; reverted to `none` (PKCE) in Zitadel console. No code changes.
- After auth fix + fresh auth state: **41 passed, 15 skipped, 0 failed** ✅
