# Phase 23: AI Governance Hardening

## Summary

| # | Task | Requirements |
|---|------|-------------|
| 1 | Contract extraction — add Zod schema + defaulted flags | TXN-P0-020 |
| 2 | Copilot tool executor — add pre-execution schema validation | SYS-P0-001, SYS-P0-002 |
| 3 | Annual rate config — add provenance fields + stale-rate check | TXN-P0-035 |
| 4 | Federal tax brackets — extract to DB from hardcoded constants | TXN-P0-035 |
| 5 | Compliance scan — add AI disclaimer to UI | INV-012 |
| 6 | AI categorization — instrument acceptance/override tracking | TXN-P0-025, INV-012 |

## Dependencies

- None — all tasks modify existing code with no new infrastructure required.

---

## Tasks

### Task 1: Contract Extraction — Zod Schema + Defaulted Flags

**What:** Replace manual type narrowing with a Zod schema and surface `wasDefaulted` flags when `revenueClassification` or `fundingCategory` fell back to defaults.

**Files:**
- Modify: `src/lib/ai/contract-extraction.ts` — replace lines 142-160 (manual type narrowing) with Zod `.safeParse()`. Add `classificationWasDefaulted` and `categoryWasDefaulted` booleans to `ExtractedTerms` type. Set flags when enum values don't match valid options.
- Modify: `src/app/(protected)/revenue/funding-sources/` (the UI that displays extracted terms) — show a warning badge next to defaulted fields: "AI could not confidently determine this — please verify."

**AC:**
- [ ] `ExtractedTerms` type includes `classificationWasDefaulted: boolean` and `categoryWasDefaulted: boolean`
- [ ] A Zod schema (`extractedTermsSchema`) validates the AI response; `safeParse` replaces raw `JSON.parse` + manual checks
- [ ] When AI returns an unrecognized `revenueClassification`, the field defaults to `GRANT_REVENUE` AND `classificationWasDefaulted` is set to `true`
- [ ] When AI returns an unrecognized `fundingCategory`, the field defaults to `GRANT` AND `categoryWasDefaulted` is set to `true`
- [ ] UI shows a visible indicator (e.g., amber badge) next to any defaulted field
- [ ] Existing behavior preserved: valid AI responses produce no warning badges
- [ ] Unit test: unrecognized enum → defaults + `wasDefaulted: true`
- [ ] Unit test: valid enum → no default + `wasDefaulted: false`

---

### Task 2: Copilot Tool Executor — Pre-Execution Schema Validation

**What:** Add a Zod validation step in `executeTool()` that parses AI-provided tool input against the tool's declared `input_schema` before invoking the handler.

**Files:**
- Create: `src/lib/copilot/tool-schemas.ts` — Zod schemas derived from each tool's `input_schema` in `tool-definitions.ts` (9 schemas total)
- Modify: `src/lib/copilot/tool-executor.ts` — import schemas, validate `input` before calling `handler(input)`. On validation failure, return error object (same pattern as unknown tool): `{ error: "Invalid parameters for tool ${name}: ..." }`

**AC:**
- [ ] Each of the 9 copilot tools has a corresponding Zod schema in `tool-schemas.ts`
- [ ] `executeTool()` validates input against the schema before calling the handler
- [ ] Validation failure returns `{ error: "..." }` (does not throw — consistent with existing error pattern)
- [ ] Valid inputs pass through to the handler unchanged
- [ ] Unit test: invalid input (wrong type for required field) → returns error object
- [ ] Unit test: valid input → handler executes normally
- [ ] Unit test: extra/unknown fields are stripped (not passed to handler)

---

### Task 3: Annual Rate Config — Add Provenance Fields

**What:** Add `sourceDocument`, `sourceUrl`, and `verifiedDate` columns to the `annualRateConfig` table. Backfill seed data with proper source citations.

**Files:**
- Create: new Drizzle migration — add three nullable columns to `annual_rate_config`
- Modify: `src/lib/db/schema/annual-rate-config.ts` — add `sourceDocument` (varchar 255), `sourceUrl` (text), `verifiedDate` (date)
- Modify: `src/lib/db/seed/annual-rates.ts` — add provenance data to each seed entry (e.g., `sourceDocument: 'IRS Pub 15-T (2026)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15t.pdf'`)
- Modify: `src/app/(protected)/settings/` (annual rates management UI, if exists) — display provenance fields; show amber warning if `verifiedDate` is older than current fiscal year

**AC:**
- [ ] Migration adds `source_document`, `source_url`, `verified_date` columns (all nullable — existing rows unaffected)
- [ ] Seed data includes source citations for all rate entries (IRS Pub 15, SSA announcement URL, MA DOR Circular M URL, IRS notices for mileage)
- [ ] Schema exports the new columns
- [ ] Annual rates UI (if exists) displays `sourceDocument` and flags stale `verifiedDate`
- [ ] Existing queries and payroll calculations unaffected (new columns are nullable)

---

### Task 4: Federal Tax Brackets — Extract to Database

**What:** Move hardcoded 2026 federal tax brackets and standard deductions from `federal-tax.ts` into the `annualRateConfig` table (or a new `federalTaxBrackets` table), so rate updates don't require code changes.

**Files:**
- Create: new Drizzle migration — add `federal_tax_brackets` table (fiscalYear, filingStatus, bracketIndex, over, notOver, rate, plus, sourceDocument, verifiedDate) OR store as JSON in `annualRateConfig` with configKey `federal_brackets_2026`
- Modify: `src/lib/payroll/federal-tax.ts` — replace hardcoded `BRACKETS_2026` and `STANDARD_DEDUCTIONS_2026` with a DB lookup function. Cache in memory per request (rates don't change mid-request). Fall back to hardcoded values if DB lookup fails (safety net).
- Modify: `src/lib/db/seed/annual-rates.ts` — add bracket data for 2026

**AC:**
- [ ] Federal tax brackets for 2026 are stored in the database with `sourceDocument` and `verifiedDate`
- [ ] `calculateFederalWithholding()` reads brackets from DB instead of hardcoded constants
- [ ] Fallback: if DB lookup fails, uses hardcoded constants (defensive — payroll cannot break)
- [ ] Adding 2027 brackets requires only a DB insert, not a code change
- [ ] Unit test: withholding calculation produces identical results before and after (regression)
- [ ] Unit test: fallback to hardcoded values when DB is unavailable

---

### Task 5: Compliance Scan — Add AI Disclaimer to UI

**What:** Add a visible disclaimer to the compliance scan output in the UI indicating the content is AI-generated and should be verified against source reports.

**Files:**
- Modify: the compliance scan results component (likely in `src/app/(protected)/compliance/` or the component that renders the `ScanResponse`) — add a banner/callout above the AI-generated text: "AI-generated brief — verify all figures against source reports before acting."

**AC:**
- [ ] Compliance scan results display a visible disclaimer banner above the AI-generated content
- [ ] Disclaimer text: "AI-generated brief — verify all figures against source reports before acting."
- [ ] Disclaimer uses a distinct visual style (e.g., info callout or muted banner) that doesn't interfere with readability
- [ ] Static citations section (already deterministic) does NOT get the disclaimer
- [ ] E2E or visual test confirms disclaimer renders

---

### Task 6: AI Categorization — Acceptance/Override Tracking

**What:** Track whether users accept or override AI categorization suggestions, keyed by confidence level, to enable calibration analysis over time.

**Files:**
- Modify: `src/app/(protected)/expenses/ramp/actions.ts` — in the categorize action, check if the applied account/fund matches the AI suggestion. Log the outcome (accepted/overridden) and the AI's confidence level to the audit log.
- Modify: `src/lib/ramp/ai-categorization.ts` — export the `AiCategorizationSuggestion` type (already exported) and ensure the suggestion is available at categorization time

**AC:**
- [ ] When a user categorizes a Ramp transaction that had an AI suggestion, the audit log entry includes: `aiConfidence`, `aiAccepted` (boolean), and if overridden, `aiSuggestedAccountId` + `aiSuggestedFundId`
- [ ] Acceptance = user's chosen account+fund matches AI's suggested account+fund
- [ ] Override = user chose different account or fund than AI suggested
- [ ] Transactions with no AI suggestion are logged normally (no AI metadata)
- [ ] Unit test: accept scenario logs `aiAccepted: true` with confidence
- [ ] Unit test: override scenario logs `aiAccepted: false` with both AI suggestion and user choice

---

## Tests

| Test | File | Verifies |
|------|------|---------|
| Contract extraction — valid response | `src/__tests__/ai/contract-extraction.test.ts` | Zod schema parses valid AI response, wasDefaulted: false |
| Contract extraction — defaulted enums | `src/__tests__/ai/contract-extraction.test.ts` | Unrecognized enums default + wasDefaulted: true |
| Contract extraction — malformed JSON | `src/__tests__/ai/contract-extraction.test.ts` | Parse failure throws user-friendly error |
| Tool executor — valid input | `src/__tests__/copilot/tool-executor.test.ts` | Valid params pass through to handler |
| Tool executor — invalid input | `src/__tests__/copilot/tool-executor.test.ts` | Invalid params return error object |
| Tool executor — extra fields stripped | `src/__tests__/copilot/tool-executor.test.ts` | Unknown fields not passed to handler |
| Federal tax — regression | `src/__tests__/payroll/federal-tax.test.ts` | DB-backed calculation matches hardcoded values |
| Federal tax — fallback | `src/__tests__/payroll/federal-tax.test.ts` | Hardcoded fallback works when DB unavailable |
| AI categorization — accept tracking | `src/__tests__/ramp/ai-categorization-tracking.test.ts` | Audit log includes aiAccepted: true + confidence |
| AI categorization — override tracking | `src/__tests__/ramp/ai-categorization-tracking.test.ts` | Audit log includes aiAccepted: false + both choices |
