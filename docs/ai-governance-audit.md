# AI Governance Audit: Renewal Initiatives Financial System

**Date:** 2026-03-19
**Scope:** All AI/LLM integration points in the financial system
**Framework:** Five-layer execution model (Orchestration → Action Gating → Schema Enforcement → Content Correctness → Post-Execution Audit)

---

## Executive Summary

The financial system uses **Claude AI (Anthropic)** across **4 integration points**, all classified as **AI-ADVISORY** — meaning a human reviews AI output before acting. This is a strong governance posture for a financial system. No AI-OPERATIONAL patterns exist (no AI output triggers automated action without human review).

The core financial engine (GL posting, payroll, depreciation, reconciliation, compliance rules, reporting) is **100% deterministic code** with robust validation at three layers (Zod schemas, GL engine invariants, PostgreSQL constraints). The architectural decision to route all mutations through a single GL engine with an append-only audit log is excellent.

**5 findings identified**, ordered by risk. None are critical. The system is well-designed.

---

## Classification Map

| Component | Classification | Layer(s) | Validated By | Risk |
|-----------|---------------|----------|-------------|------|
| **GL Engine** (`src/lib/gl/engine.ts`) | DETERMINISTIC | 1, 2 | Zod + 13 invariants + DB constraints | LOW |
| **Payroll Engine** (`src/lib/payroll/`) | DETERMINISTIC | 4 | Rate table lookups, formula-based | LOW |
| **Bank Reconciliation** (`src/lib/bank-rec/`) | DETERMINISTIC | 1, 5 | Trust-escalation rules, tolerance checks | LOW |
| **Depreciation/Amortization** (`src/lib/assets/`) | DETERMINISTIC | 4 | Idempotency checks, accumulated caps | LOW |
| **All Financial Reports** (`src/lib/reports/`) | DETERMINISTIC | 4 | Query-based aggregation | LOW |
| **Budget Variance** (`src/lib/budget/`) | DETERMINISTIC | 4 | Approved budget validation | LOW |
| **Compliance Rules** (`src/lib/compliance/`) | DETERMINISTIC | 4 | Formula-based (990 thresholds, 1099 $600) | LOW |
| **Cron Orchestration** (`src/app/api/cron/`) | DETERMINISTIC | 1 | Sequenced schedule, error isolation | LOW |
| **Security Deposit Interest** (`src/lib/assets/interest-accrual.ts`) | DETERMINISTIC | 4 | MA rate cap enforcement | LOW |
| **Copilot** (`src/lib/copilot/`, `src/app/api/copilot/`) | AI-ADVISORY | 2, 4 | Read-only tools, user interprets | LOW |
| **AI Categorization** (`src/lib/ramp/ai-categorization.ts`) | AI-ADVISORY | 3, 4 | Zod schema + DB ID validation + audit log | LOW |
| **Contract Extraction** (`src/lib/ai/contract-extraction.ts`) | AI-ADVISORY | 3, 4 | Manual type narrowing, user edits before save | LOW-MED |
| **Compliance Scan** (`src/app/api/compliance/scan/route.ts`) | AI-ADVISORY | 4 | Static citations, display-only | LOW |

---

## Findings (ordered by risk)

### FINDING-1: Contract Extraction — Revenue Classification Defaults Silently

- **Component:** `src/lib/ai/contract-extraction.ts` (lines 150-152)
- **Current classification:** AI-ADVISORY
- **Layer:** 3 (Output Schema Enforcement)
- **Issue:** When Claude fails to extract or returns an unrecognized `revenueClassification`, the code defaults to `GRANT_REVENUE`. This matters because GRANT_REVENUE (ASC 958-605) vs EARNED_INCOME (ASC 606) determines revenue recognition method, financial statement presentation, and public support test calculations. The default is silent — the user sees "GRANT_REVENUE" in the form with no indicator that the AI didn't confidently extract it. The same silent-default pattern applies to `fundingCategory` (defaults to `GRANT`).
- **What's at stake:** A misclassified earned-income contract treated as a grant could affect the public support test (Form 990 Part IX-A), potentially jeopardizing 501(c)(3) status if the ratio shifts.
- **Recommendation:** Add a `classificationConfidence` field (or flag `wasDefaulted: true`) to the extraction response. Surface a visual indicator in the UI when the classification was defaulted rather than confidently extracted. Consider replacing the manual type narrowing with a Zod schema (`z.enum(["GRANT_REVENUE", "EARNED_INCOME"])`) so validation is explicit and testable.
- **Effort:** Low

### FINDING-2: Copilot Tool Parameters — No Pre-Execution Schema Validation

- **Component:** `src/lib/copilot/tool-executor.ts` (lines 29-46)
- **Current classification:** AI-ADVISORY
- **Layer:** 2 (Action Gating)
- **Issue:** When Claude selects a tool and provides parameters, the `executeTool()` function passes `input: Record<string, unknown>` directly to the tool handler without validating against the tool's `input_schema`. Validation depends entirely on each handler's internal checks. If a handler lacks validation, malformed AI input could cause unexpected database queries or error states.
- **Mitigating factor:** All 9 copilot tools are **read-only** (search, lookup, get-balance). No tool can create, update, or delete data. The system prompt explicitly states "cannot modify data." The blast radius is limited to failed queries or incorrect search results.
- **Recommendation:** Add a lightweight Zod validation step in `executeTool()` that parses `input` against the tool's declared `input_schema` before calling the handler. This catches malformed parameters at the gate rather than letting them propagate into query functions.
- **Effort:** Low

### FINDING-3: Tax Rate Constants — No Provenance Field

- **Component:** `src/lib/db/schema/annual-rate-config.ts`, `src/lib/db/seed/annual-rates.ts`, `src/lib/payroll/federal-tax.ts` (lines 25-73)
- **Current classification:** DETERMINISTIC
- **Layer:** 4 (Content Correctness) — Anti-pattern: Coefficient Trust Without Provenance
- **Issue:** Payroll tax rates (FICA 6.2%, Medicare 1.45%, SS wage base, MA state tax 5%) are stored in `annualRateConfig` with only a free-text `notes` field for documentation. Federal withholding brackets are hardcoded in `federal-tax.ts` with a comment referencing "IRS Pub 15-T" but no structured provenance. The `annualRateConfig` table has no `verified_against` (source document), `verified_date`, or `effective_year` constraint preventing stale rates from persisting across fiscal years. The model is deterministic, but if the constants are wrong, it's deterministically wrong — the most dangerous kind of error because it looks trustworthy every time it runs.
- **What's at stake:** Incorrect payroll withholding rates create IRS/DOR penalty exposure. A stale SS wage base means over/under-withholding for high-earners. These errors compound across every pay period and affect W-2 accuracy.
- **Recommendation:** Add `sourceDocument` (varchar, e.g., "IRS Rev. Proc. 2025-11"), `sourceUrl` (text), and `verifiedDate` (date) columns to `annualRateConfig`. Add a compliance check (cron or startup) that flags any rate where `verifiedDate` is older than the current fiscal year. For the hardcoded federal brackets in `federal-tax.ts`, extract to the `annualRateConfig` table with the same provenance fields.
- **Effort:** Medium

### FINDING-4: Compliance Scan — No Structure on AI Output

- **Component:** `src/app/api/compliance/scan/route.ts` (lines 222-260)
- **Current classification:** AI-ADVISORY
- **Layer:** 3 (Output Schema Enforcement)
- **Issue:** The compliance scan returns free-text from Claude (max 1024 tokens) with no schema enforcement. While the citations are static (human-curated per workflow type, not AI-generated — good), the AI text body could contain specific numbers, dates, thresholds, or procedural claims that the user may treat as authoritative. There is no structured separation between "here are the facts from your data" vs "here is AI interpretation."
- **Mitigating factor:** Output is display-only, not stored in DB. User is a compliance officer reviewing the brief. Citations are deterministic. Risk is low but could be reduced further.
- **Recommendation:** Structure the AI response into sections: `dataFindings` (facts derived from the financial data provided in context), `guidance` (AI interpretation/recommendations), and `warnings` (items requiring manual verification). This helps the user distinguish data-backed statements from AI judgment. Alternatively, add a visible disclaimer in the UI: "AI-generated brief — verify all figures against source reports."
- **Effort:** Low

### FINDING-5: AI Categorization Confidence — Self-Reported Without Calibration

- **Component:** `src/lib/ramp/ai-categorization.ts`
- **Current classification:** AI-ADVISORY
- **Layer:** 4 (Content Correctness)
- **Issue:** The AI self-reports confidence as "high" / "medium" / "low" with no deterministic calibration. A "high confidence" categorization could still be wrong — LLMs are notoriously poorly calibrated on self-assessed confidence. The Zod schema validates the enum value exists but not whether the confidence claim is accurate.
- **Mitigating factor:** This is well-governed overall — Zod schema validation, DB ID existence checks, audit logging, user must accept before posting. The confidence label is informational, not a gate.
- **Recommendation:** Track acceptance/override rates by confidence level over time. If "high confidence" suggestions are overridden >15% of the time, the label is misleading. Consider adding a deterministic confidence signal: if a matching rule exists for the merchant but wasn't triggered (e.g., amount was unusual), that's a "medium" regardless of what the AI says.
- **Effort:** Low (tracking) / Medium (deterministic signal)

---

## What's Done Well

This audit found **no AI-OPERATIONAL patterns** — every AI output goes through human review before affecting financial state. This is the correct boundary for a financial system. Specific strengths:

1. **Single GL engine write path** — All mutations flow through `createTransaction()` with 13 invariants, Zod validation, and atomic audit logging. AI cannot bypass this.

2. **Read-only copilot by design** — The copilot's 9 tools are all queries. The system prompt and tool definitions enforce this. Even if the AI "wanted" to modify data, no tool exists to do so.

3. **AI categorization governance** — Zod schema on AI output, database validation of suggested IDs, audit logging of every AI call (model, tokens, elapsed time), graceful degradation to null. This is a model implementation of AI-ADVISORY.

4. **Deterministic orchestration** — All cron jobs, state machines, workflow progressions, and reconciliation logic are deterministic code. AI never decides "what to do next."

5. **Three-layer double-entry enforcement** — Debit/credit balance is validated by Zod (application), GL engine (business logic), and PostgreSQL CHECK constraint (database). Triple redundancy on the most critical invariant.

6. **Append-only audit log with transactional atomicity** (INV-012) — If audit logging fails, the entire business transaction rolls back. This prevents unaudited mutations.

---

## Summary

| Metric | Count |
|--------|-------|
| Total AI touchpoints | 4 |
| DETERMINISTIC components | 40+ (all business logic, calculations, orchestration) |
| AI-ADVISORY | 4 (copilot, categorization, contract extraction, compliance scan) |
| AI-OPERATIONAL | 0 |
| Properly gated AI-ADVISORY | 3 of 4 (categorization is exemplary) |
| Findings | 5 (0 critical, 0 high, 2 medium, 3 low) |

---

## Next Steps

1. [ ] **FINDING-1**: Add `wasDefaulted` flag to contract extraction response; surface in UI when classification was defaulted (Low effort)
2. [ ] **FINDING-2**: Add Zod pre-validation in `executeTool()` using each tool's declared `input_schema` (Low effort)
3. [ ] **FINDING-3**: Add `sourceDocument`, `sourceUrl`, `verifiedDate` columns to `annualRateConfig`; extract hardcoded federal brackets to DB; add stale-rate compliance check (Medium effort)
4. [ ] **FINDING-4**: Add UI disclaimer on compliance scan output, or structure response into data/guidance/warnings sections (Low effort)
5. [ ] **FINDING-5**: Instrument acceptance/override tracking by AI confidence level for Ramp categorization (Low effort)

Estimated total effort: **Medium** (items 1, 2, 4, 5 are each a few hours; item 3 is a small phase)

Recommended: `/plan-phase` for items 1-3 (highest value) → `/execute-phase` to build.
