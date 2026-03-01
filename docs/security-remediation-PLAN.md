# Security Policy Compliance Remediation — Plan

**Status:** Implementation Complete
**Last Updated:** 2026-03-01
**Author:** Jeff + Claude
**Traces to:** `docs/information-security-policy.md` (Section 6.4, 7.2)

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/security-remediation-PLAN.md Continue.`

---

## 1. Problem Statement

A codebase audit against the Information Security Policy identified three gaps where the system does not implement what the policy claims: (1) no Content Security Policy headers despite the policy citing CSP as an XSS control, (2) Plaid access tokens are not revoked via the Plaid API when bank accounts are deactivated, and (3) no tooling or automation exists for data retention review and deletion procedures described in Section 6.3–6.4.

---

## 2. Discovery

### Questions

1. **CSP + Next.js inline scripts:** Next.js injects inline `<script>` tags for hydration and chunk loading. A strict CSP (`script-src 'self'`) will break the app unless we use nonce-based CSP. Does Next.js 15 support the `nonce` prop on `<Script>` and inline scripts?
2. **CSP + Vercel:** Vercel injects its own analytics/speed-insights scripts on some plans. Are any Vercel injected scripts present?
3. **Plaid revocation error handling:** If `itemRemove()` fails (network error, expired token), should we still proceed with soft-delete, or block the deactivation?
4. **Shared Plaid items:** Multiple bank accounts can share the same `plaidItemId` (one Plaid Link session → multiple accounts). If we revoke the item, ALL accounts on that item lose access. Should we only revoke when the LAST account on an item is deactivated?
5. **Data retention scope:** The policy describes retention periods but the system uses soft-delete-only design (no hard deletes). Is the goal to build an admin-facing retention review dashboard, or automated purge jobs, or just a documented manual procedure?

### Responses

*(To be filled during discovery)*

### Synthesis

*(To be written after discovery)*

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | CSP via `next.config.ts` `headers()` with nonce for inline scripts | Next.js 15 supports nonce-based CSP; `headers()` is simpler than middleware for static policy |
| D2 | Plaid revocation: best-effort, log failure, proceed with deactivation | Token is encrypted at rest; revocation is defense-in-depth, not a blocking gate |
| D3 | Only revoke Plaid item when last account on that item is deactivated | Prevents breaking sibling accounts that share the same access token |
| D4 | Data retention: admin review page + documented runbook (no auto-purge) | Matches org size (2-5 staff); automated purge on a 7-year horizon is premature |

---

## 4. Requirements

### P0: Must Have

| ID | Requirement | Traces to |
|----|-------------|-----------|
| SEC-01 | Add Content-Security-Policy response header to all pages | Policy §7.2 |
| SEC-02 | CSP must allow Next.js hydration scripts (nonce-based or hash-based) | Functional requirement |
| SEC-03 | Call Plaid `itemRemove()` when last bank account on an item is deactivated | Policy §6.4 |
| SEC-04 | Audit-log the Plaid revocation (success or failure) | Policy §7.3 |

### P1: Nice to Have

| ID | Requirement | Traces to |
|----|-------------|-----------|
| SEC-05 | Admin page showing data age by entity type (oldest financial record, oldest bank txn, etc.) | Policy §6.3 |
| SEC-06 | Exportable retention compliance report | Policy §14 (annual review) |

### P2: Future

| ID | Requirement | Traces to |
|----|-------------|-----------|
| SEC-07 | Automated retention purge jobs (7-year financial records, employee PII) | Policy §6.4 |
| SEC-08 | CSP violation reporting endpoint (`report-uri` / `report-to`) | Policy §10.1 (detection) |

---

## 5. Data Model

No schema changes required. All changes are application-level (headers, API calls, queries).

---

## 6. Implementation Plan

### Phase 1: Content Security Policy Headers

| Task | Status | Notes |
|------|--------|-------|
| CSP header with nonce generation in middleware | ✅ | Report-only mode; includes Plaid CDN, Zitadel in connect-src |
| Security response headers (X-Content-Type-Options, Referrer-Policy, X-Frame-Options) | ✅ | Added alongside CSP in middleware |
| Verify app type-checks with CSP changes | ✅ | `tsc --noEmit` clean |
| Test in browser and switch from Report-Only to enforcing | 🔲 | Post-deploy verification |

### Phase 2: Plaid Token Revocation

| Task | Status | Notes |
|------|--------|-------|
| Add `removeItem()` function to `src/lib/integrations/plaid.ts` | ✅ | Wraps `client.itemRemove()` |
| Update `deactivateBankAccount()` with sibling account check | ✅ | Queries for active siblings on same `plaidItemId` |
| Best-effort revocation with audit logging | ✅ | Logs `plaidRevoked` and `siblingAccountsRemaining` in afterState |
| Test with Plaid sandbox item | 🔲 | Post-deploy verification |

### Phase 3: Data Retention Review Tooling

| Task | Status | Notes |
|------|--------|-------|
| Add retention review query functions | ✅ | `settings/data-retention/actions.ts` — 10 entity categories |
| Build admin retention dashboard page | ✅ | `/settings/data-retention` with age badges and summary cards |
| Document retention review procedure in operations runbook | ✅ | Annual review procedure + Plaid revocation docs |

---

## 7. Verification

| Check | Method |
|-------|--------|
| CSP header present on responses | `curl -I` against deployed app; check `Content-Security-Policy` header |
| App functions with CSP enabled | Full manual walkthrough: login, navigation, Plaid Link, reports |
| Plaid revocation fires on last-account deactivation | Deactivate test account in sandbox; verify `itemRemove` called |
| Plaid revocation skipped for sibling accounts | Deactivate one of two accounts on same item; verify other still syncs |
| Revocation failure doesn't block deactivation | Simulate network error; verify account still deactivated + audit logged |
| Retention dashboard shows accurate data | Compare counts against direct DB queries |

---

## 8. Impact Assessment

### Phase 1: CSP Headers — Risk Analysis

**What could break:**

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Next.js inline scripts blocked** | HIGH if nonce not implemented correctly | App won't hydrate (blank page) | Use `Content-Security-Policy-Report-Only` header first; test in staging before enforcing |
| **Plaid Link modal blocked** | MEDIUM — Plaid Link loads via iframe + script from `cdn.plaid.com` | Bank connection flow breaks | Must add `frame-src https://cdn.plaid.com; script-src https://cdn.plaid.com` to CSP |
| **Zitadel auth redirect blocked** | LOW — OAuth is redirect-based, not script-based | None expected | `connect-src` needs `https://*.zitadel.cloud` for token endpoint calls |
| **PDF report generation blocked** | LOW — `@react-pdf/renderer` uses blob URLs | PDF downloads may fail | Add `blob:` to `worker-src` and `child-src` |
| **Tailwind/shadcn inline styles** | MEDIUM — Tailwind 4 may inject `<style>` tags | Styling breaks | `style-src 'self' 'unsafe-inline'` (inline styles are lower risk than inline scripts) |

**Recommendation:** Deploy CSP in **report-only mode first** (`Content-Security-Policy-Report-Only`) for 1-2 weeks to catch violations without breaking anything. Then switch to enforcing.

### Phase 2: Plaid Token Revocation — Risk Analysis

**What could break:**

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Revoking shared item kills sibling accounts** | HIGH if not handled | Active bank accounts stop syncing | Query for sibling active accounts before calling `itemRemove()`; only revoke on last |
| **`itemRemove()` fails, blocks deactivation** | MEDIUM — network/API errors | User can't deactivate account | Best-effort pattern: try/catch, log failure, proceed with soft-delete |
| **Cron sync fails after revocation** | Expected behavior | Plaid sync errors for removed items | Cron already skips inactive accounts; no impact |
| **Encrypted token still in DB after revocation** | By design | Token is useless after Plaid-side revocation | Token stays encrypted; Plaid rejects it. Defense-in-depth. |

**Key constraint:** The `bankAccounts` table stores `plaidItemId` per row. Multiple rows can share the same `plaidItemId`. The revocation logic MUST check: `SELECT count(*) FROM bank_accounts WHERE plaid_item_id = ? AND is_active = true AND id != ?`. If count > 0, skip revocation.

### Phase 3: Data Retention — Risk Analysis

**What could break:**

| Risk | Likelihood | Severity | Mitigation |
|------|-----------|----------|------------|
| **Queries on large tables slow** | LOW — <1,000 txns/month scale | Page load delay | Use `COUNT` + `MIN(created_at)` aggregates, not full scans |
| **Misleading data if timestamps missing** | LOW | Incorrect retention age | Verify all tables have `created_at`; handle nulls |

**No breaking risk** — this phase is read-only queries and a new page. No mutations.

---

## 9. Session Progress

### Session 1: 2026-03-01 (Audit + Plan)

**Completed:**
- [x] Full codebase audit against information security policy
- [x] Identified 3 actionable gaps (CSP, Plaid revocation, retention tooling)
- [x] Dismissed non-gaps per Jeff's input (RBAC single-role, MFA, key rotation)
- [x] Created plan document with impact assessment

**Next Steps:**
- [x] ~~Jeff answers discovery questions~~ — resolved during plan approval

### Session 2: 2026-03-01 (Implementation)

**Completed:**
- [x] Phase 1: CSP + security headers in middleware (report-only mode)
  - Nonce-based CSP with `strict-dynamic` + `unsafe-inline` fallback
  - Plaid CDN in `script-src` and `frame-src`, Zitadel in `connect-src`
  - `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` headers
- [x] Phase 2: Plaid token revocation on bank account deactivation
  - `removeItem()` added to `plaid.ts`
  - Sibling account check prevents revoking shared items
  - Best-effort: logs failure, proceeds with soft-delete
  - Audit trail includes `plaidRevoked` and `siblingAccountsRemaining`
- [x] Phase 3: Data retention review tooling
  - Server action queries 10 entity categories for age + record count
  - Dashboard page at `/settings/data-retention` with status badges
  - Nav link and settings card added
  - Operations runbook updated with annual review procedure

**Post-deploy verification needed:**
- [ ] Confirm CSP report-only header present in browser (DevTools > Network > Response Headers)
- [ ] Check browser console for CSP violation reports — adjust policy if false positives
- [ ] When stable: switch `Content-Security-Policy-Report-Only` → `Content-Security-Policy`
- [ ] Test bank account deactivation in Plaid sandbox to confirm `itemRemove()` call
