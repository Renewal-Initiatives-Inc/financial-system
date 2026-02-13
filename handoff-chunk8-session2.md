# Handoff Prompt: Chunk 8 Integration Layer — Session 2 Continuation

**Date:** 2026-02-13
**Project:** financial-system (Renewal Initiatives — 501(c)(3) nonprofit, affordable housing in Easthampton MA)
**Context:** Continuing Chunk 8 (Integration Layer) discovery. Previous session covered Topics 1-9 and resolved the AI strategy. One topic remains.

---

## Instructions for New Session

You are continuing discovery on Chunk 8 of the financial-system project. Read the following files to orient yourself:

1. **`CONVENTIONS.md`** — Project conventions and workflow
2. **`decisions.md`** — All 130 decisions (D-001 through D-130). Skim the last ~15 (D-118 through D-130) closely — these are from this Chunk 8 session.
3. **`8-integration-discovery.md`** — The Chunk 8 discovery document (current working file)
4. **`dependencies.md`** — Cross-chunk dependency tracker (Chunk 8 section near the bottom)
5. **`1-core-ledger-spec.md`** — Chunk 1 spec (recently updated GL-P1-001 and GL-P1-002 for copilot pattern)

Optionally skim for broader context:
- `company_facts.md` area files for organizational context
- `3-expense-discovery.md` for expense/Ramp workflow context
- Technology decisions files in `renewal-timesheets/`, `expense-reports-homegrown/`, `internal-app-registry-auth/`

---

## What Was Completed (Topics 1-9)

All key questions in `8-integration-discovery.md` are now ✅ answered. Decisions recorded:

| Decision | Summary |
|----------|---------|
| D-118 | Database-mediated integration (not REST APIs). Restricted Postgres roles for source apps. Staging tables for writes. |
| D-119 | Dual compensation model: PER_TASK (youth, per-task rates) vs SALARIED (adults, salary ÷ expected hours = hourly rate). People API in auth portal owns compensation profile. |
| D-120 | Exempt status (EXEMPT/NON_EXEMPT) stored in People API, passed to timesheets for overtime calc. |
| D-121 | Timesheet staging: one row per fund per approved timesheet. Hours + dollars. Approval triggers INSERT. |
| D-122 | Expense report staging: one row per expense line item. No receipts in staging. All QBO artifacts deprecated. |
| D-123 | Ramp API with daily polling (same cadence as Plaid D-094). |
| D-124 | Employee data via read-only DB access to auth portal. REST API (employee-payroll-data-spec.md) deprecated. |
| D-125 | Error handling: DB constraints for internal; dashboard notification + email for external sync failures. |
| D-126 | Postmark for outbound email (donor acknowledgments, sync failure alerts). |
| D-127 | Depreciation policy: straight-line, IRS standard useful lives, no accelerated methods (nonprofit — no tax benefit). |
| D-128 | AI Depreciation Assistant (D-020) superseded by system-wide copilot pattern. |
| D-129 | System-wide AI copilot: right-panel chatbot on every page with page-specific context package and configurable toolkit. |
| D-130 | AI Transaction Entry Assistant (D-028) absorbed into copilot pattern. |

---

## What Remains

### Topic 10: Deployment Topology and Infrastructure

This is the last discovery topic for Chunk 8. Key questions to explore:

1. **Where does financial-system deploy?** The existing apps all use Vercel + Neon (Vercel Postgres). Does financial-system follow the same pattern? Or does the expanded scope (copilot, multiple DB connections to other apps' Neon instances, Plaid/Ramp API polling, cron jobs for daily syncs) warrant a different hosting approach?

2. **Cron/scheduled jobs:** Daily Plaid sync (D-094), daily Ramp sync (D-123), monthly depreciation automation (D-019), compliance calendar reminders (D-065). Where do these run? Vercel cron? Separate worker? External scheduler?

3. **Database topology:** Financial-system has its own Neon DB. But per D-118/D-124, it also needs to READ from:
   - internal-app-registry-auth's Neon DB (employee data)
   - And source apps need to READ/INSERT into financial-system's Neon DB (staging tables)
   - How do cross-database Postgres roles work in Neon? Is this straightforward or does it require special configuration?

4. **AI copilot infrastructure (D-129):** The copilot needs an Anthropic API connection. Where does the API key live? How are copilot requests routed (client-side streaming vs. server-side proxy)? Cost considerations for Claude API usage?

5. **Environment and secrets management:** Multiple API keys (Anthropic, Plaid, Ramp, Postmark), multiple DB connection strings (own DB + auth portal DB). How are these managed across environments (dev/staging/prod)?

6. **Is this even discovery-scope?** Jeff has consistently pushed back on implementation-level detail during this session. Some of these questions may be spec/build concerns rather than discovery. Calibrate accordingly — deployment topology at discovery level might just be "same stack as existing apps (Vercel + Neon) with noted considerations for cron jobs and cross-DB access."

### After Topic 10

Once Topic 10 is resolved:
1. Update `8-integration-discovery.md` status to ✅ Discovery Complete
2. Add a Discovery Summary section (similar to other completed chunks)
3. Verify all cross-references in `dependencies.md` are current
4. Chunk 8 is ready for spec phase

---

## User Communication Style

Jeff (the user) prefers:
- Discovery-level thinking, NOT implementation details ("this is very much the 'how to build it' that is beyond scope for a discovery phase")
- Directness and simplicity
- Pushes back when Claude anchors on wrong assumptions (e.g., REST APIs when they weren't established, QBO references when "QBO is dead")
- Wants focused, one-topic-at-a-time discussion
- Records decisions in `decisions.md` as they're made
- Asked for handoff prompts when tokens run low

---

## File Locations

All project files are in `/mnt/Claude/financial-system/`. Key files:
- `decisions.md` — Central decisions log
- `8-integration-discovery.md` — Current working document
- `dependencies.md` — Cross-chunk dependencies
- `1-core-ledger-discovery.md` and `1-core-ledger-spec.md` — Chunk 1 (recently updated)
- `3-expense-discovery.md` — Chunk 3 expense tracking
- Related app codebases: `/mnt/Claude/renewal-timesheets/`, `/mnt/Claude/expense-reports-homegrown/`, `/mnt/Claude/internal-app-registry-auth/`
