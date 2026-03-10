# Compliance Workflow Engine — Plan

**Status:** Design Complete — Ready for Planning
**Last Updated:** 2026-03-06
**Author:** Jeff + Claude
**Traces to:** Phase 22 (Deployment & Go-Live), Compliance Calendar (Phase 16)

> **Protocol**: This section is auto-updated before session end. Start new sessions with: `@docs/compliance-workflow-engine-PLAN.md Continue.`

---

## 1. Problem Statement

The compliance calendar lists deadlines but provides no guided workflow for completing them. Each compliance item needs a reusable 4-step pipeline (Checklist → AI Scan → Draft → Delivery) integrated into the copilot panel, with Google Calendar bidirectional sync and artifact storage for audit trail.

---

## 2. Discovery

### Prior Context (from this session)

**UX Decision:** Option B — copilot panel becomes contextual. When user clicks a compliance item, the copilot panel gains a "Detail/Workflow" tab showing the 4-step pipeline. AI chat tab remains available with pre-seeded context for that item.

**4-Step Pipeline Model:**

| Step | Name | Description | Logging |
|------|------|-------------|---------|
| 1 | **Checklist** | Pre-qualifying inputs. Auto-checked items are invisible. Manual items require check-off or written explanation (≤50 words). | All acceptances + alt-reasons logged on advance |
| 2 | **AI Scan** | Completeness scan + regulatory analysis + "things to consider" with citations. User acknowledges recommendations as a whole (no per-item ack). | Acknowledgement logged on advance |
| 3 | **Draft** | Artifact production (resolution, form, report). User reviews and "Accepts Final Version." Serious items (990, etc.) get a confirmation warning dialog. | Acceptance logged |
| 4 | **Delivery** | Final artifact saved to Vercel Blob. Downloadable immediately or from admin later. | Blob URL + metadata logged |

**Reusable Primitives (4 cover 95% of workflows):**

| Primitive | Maps to Step | Implementation |
|-----------|-------------|----------------|
| Readiness Check | Step 1 (Checklist) | DB queries returning pass/fail per condition |
| AI Brief | Step 2 (AI Scan) | Pre-baked copilot prompt + data context → structured summary |
| Doc Draft | Step 3 (Draft) | Template + merge fields + AI polish → editable draft |
| Blob Delivery | Step 4 (Delivery) | PDF/DOCX generation → Vercel Blob → download link |

**Google Calendar Sync (separate but related feature):**
- Financial-system owns `renewal-initiatives-compliance` Google Calendar
- Bidirectional sync (financial-system is authoritative)
- Two events per deadline: actual due date + REMINDER 14 days prior
- Reminder events also appear in financial-system compliance calendar
- Embedded Google Calendar iframe as alternate view
- Each event includes link: `https://finance.renewalinitiatives.org`

**Slide-over Detail Cards:**
- Rich metadata per deadline: `legalCitation`, `referenceUrl`, `recommendedActions`, `authoritySource`
- Populated at generation time for the 28 hardcoded deadlines
- Grant/tenant deadlines pull context from source records

---

## 3. Design Decisions

| ID | Decision | Rationale |
|----|----------|-----------|
| D1 | Copilot panel = contextual workflow host (Option B) | Left nav already uses left slide-over; right panel already exists; no layout conflicts |
| D2 | 4-step state machine per compliance item | Covers all workflow types with one reusable component; state persisted so users can resume |
| D3 | Financial-system is authoritative for Google Calendar sync | Avoids merge conflicts; Google Calendar is a publish channel |
| D4 | Reminder events are real rows in `compliance_deadlines` | They appear in list view, get status tracking, simplify Google sync (1 row = 1 event) |
| D5 | Artifacts stored in Vercel Blob under `compliance-artifacts/` | Durable, downloadable, auditable; admin retrieval via blob listing |
| D6 | Checklist auto-items invisible to user | Reduces noise; user only sees items requiring their input |
| D7 | Serious acceptance items get warning dialog | 990, W-2 filing — irreversible-ish actions deserve friction |
| D8 | All workflow state transitions logged to audit log | Full trail: who accepted what, when, with what explanation |
| D9 | No CPA — system is the payroll provider and self-files | All filing done in-house; system must close the loop on W-2, 1099-NEC, 941 |
| D10 | TaxBandits API for W-2, 1099-NEC, 941 e-filing | Best developer experience, free sandbox, pay-per-form (~$85/yr), covers all three forms; no nonprofit discount but trivial cost |
| D11 | Form 990 — data report only, no API filing | IRS MeF API too complex; Tax990.com adds cost/dependency; user manually transcribes into IRS fillable PDF (~10 min) |
| D12 | Form 990 data report fields match IRS PDF exactly | Same section/line order (Part I, Part VIII Line 1a, etc.), identical labels — transcription is mechanical, no interpretation needed |
| D13 | Form PC (MA) — simplified 2-step workflow | Form is simple; full 4-step pipeline overkill; checklist + data summary → manual MA portal entry |
| D14 | MA M-941 — data report + manual MassTaxConnect entry | No MA DOR API available; system generates filing-ready data report; user enters into portal |

---

## 4. Workflow Definitions by Cluster

### Cluster A: Federal/State Tax Form Filing

**Items:** Form 990, Form PC, W-2 filing, 1099-NEC filing, Federal 941 (×4), MA M-941 (×4)

These all follow an identical pattern: verify data → AI reviews for issues → produce the filing artifact → deliver.

| Step | Implementation |
|------|---------------|
| **1. Checklist** | Auto: relevant transactions exist for period, accounts reconciled, prior period closed. Manual (varies by form): "All officer compensation reviewed?" (990), "All W-9s collected?" (1099), "Payroll reconciled to GL?" (W-2/941) |
| **2. AI Scan** | Pull the relevant report data. AI checks: completeness, mathematical accuracy, year-over-year variance flags, regulatory red flags (e.g., "Officer comp increased 40% — Schedule O explanation recommended"), citations to instructions |
| **3. Draft** | Generate the form-specific data package: 990 → Form 990 Data report (PDF); W-2 → W-2 Verification + PDFs; 1099 → 1099-NEC PDFs; 941/M-941 → Quarterly Tax Prep report |
| **4. Delivery** | PDF to blob. For 990: CPA receives the data package. For W-2/1099: employer copies + employee/vendor copies. For 941: filing-ready data export. |

**Resolved decisions (Cluster A):**

| ID | Decision |
|----|----------|
| WF-A1 | 990 Step 3: Data report formatted to match IRS PDF field names and order (Part/Line/Label). User manually transcribes into IRS fillable PDF — ~10 min of work. No API filing. |
| WF-A2 | W-2 + 1099-NEC Step 4: TaxBandits API e-files federal + state. System also generates Copy B/C PDFs; TaxBandits optionally mails postal copies to employees/vendors. |
| WF-A3 | 941 Step 4: TaxBandits API e-files quarterly. M-941 (MA): data report → manual MassTaxConnect portal entry. |
| WF-A4 | Form PC (MA): Simplified 2-step — checklist + data summary. User files manually on MA Secretary of State portal. |

**Estimated annual TaxBandits cost (2026):** ~$85 (3 W-2s + 8 1099s + 4×941 filings + postal copies). No nonprofit discount; no API/developer surcharge.

---

### Cluster B: Annual Reviews & Attestations

**Items:** Officer compensation review, Conflict of interest attestation, Annual in-kind review, UBIT annual review, Public support trajectory review, Year-end functional allocation review, Annual tax rate review (SS wage base)

These are analysis-heavy workflows where the "draft" is a summary/resolution rather than a tax form.

| Step | Implementation |
|------|---------------|
| **1. Checklist** | Auto: relevant data populated (salaries entered, donations recorded, allocations set). Manual: attestation-type items ("I confirm no conflicts exist," "Board has reviewed compensation") |
| **2. AI Scan** | Deep analysis: comparability study (compensation), allocation benchmark comparison (functional), trajectory projection (public support), rate change research (tax rates), UBIT exposure scan |
| **3. Draft** | Board resolution (compensation, COI), summary report (in-kind, UBIT, public support), updated rate table (tax rates), allocation adjustment recommendations (functional) |
| **4. Delivery** | Board resolution → Word doc. Summary reports → PDF. Rate changes → applied to system config + change log PDF. |

**Sub-decisions needed:**

| ID | Question | Options |
|----|----------|---------|
| WF-B1 | Officer compensation — comparability data source? | **DECIDED:** Link to Open990.org for manual comp lookup. No API integration now; build ProPublica/IRS XML pipeline later if needed. |
| WF-B2 | Conflict of interest — tracking granularity? | **DECIDED:** Org-wide. One annual attestation check-off, logged. No per-person roster needed. |
| WF-B3 | Public support — how far to project? | **DECIDED:** Through end of grace period (FY2029) only. Reassess after. |
| WF-B4 | Tax rate review — auto-apply or propose-then-apply? | **DECIDED:** Always propose → user reviews → user approves → system updates. Full audit trail. |
| WF-B5 | UBIT review — depth? | **DECIDED:** Shallow only. AI flags potential UBIT exposure, cites IRC §512-514. No Schedule M draft unless UBIT actually found. |

---

### Cluster C: Budget Cycle

**Items:** Budget draft (ED), Budget board circulation, Budget board approval, Quarterly board prep (×4)

These are document-production workflows centered on the board pack.

| Step | Implementation |
|------|---------------|
| **1. Checklist** | Auto: prior period data complete, current actuals through latest month. Manual: "Department heads consulted?" (budget draft), "ED has reviewed?" (circulation) |
| **2. AI Scan** | Budget: trend analysis, inflation adjustments, known upcoming changes. Board prep: variance highlights, cash position, notable items, risk flags |
| **3. Draft** | Budget: next-FY budget template pre-filled from actuals + AI suggestions. Board prep: board pack with executive summary. Approval: board resolution for budget adoption. |
| **4. Delivery** | Board pack PDF (already exists). Budget resolution → Word doc. Budget template → Excel/CSV. |

**Sub-decisions needed:**

| ID | Question | Options |
|----|----------|---------|
| WF-C1 | Budget draft starting point? | **DECIDED:** Current year actuals, annualized. Most grounded in reality. |
| WF-C2 | Quarterly board prep — auto-generate or manual trigger? | **DECIDED:** Manual trigger only. User opens workflow and kicks it off. |
| WF-C3 | Board resolution format? | **DECIDED:** Formatted Word doc. User can provide a template; system merges data. Word allows edits before signing. No PDF — too rigid for a document that needs textual adjustment. |

---

### Cluster D: Grant & Funding Source

**Items:** Annual grant compliance review, Report submission — [Fund], Milestone — [Fund], Close-out preparation — [Fund]

These are fund-specific and vary by funder requirements.

| Step | Implementation |
|------|---------------|
| **1. Checklist** | Auto: fund transactions recorded, allocations current, drawdown calculated. Manual: "All receipts/invoices collected?" "Matching funds documented?" |
| **2. AI Scan** | Expenditure analysis vs budget, burn rate, compliance with restrictions, milestone progress, matching requirement status |
| **3. Draft** | Fund-level P&L for reporting period. For AHP: annual report from template. For close-out: final expenditure summary. For milestones: progress narrative. |
| **4. Delivery** | Report PDF. Template-based reports (AHP) → formatted document. Close-out package → bundled PDF. |

**Sub-decisions needed:**

| ID | Question | Options |
|----|----------|---------|
| WF-D1 | Grant report templates — how managed? | **DECIDED:** Standard expenditure report only — fund-level P&L for the reporting period. User reformats for funder's portal manually. No template management needed. |
| WF-D2 | Close-out workflow — scope? | **DECIDED:** Financial summary only — final expenditure vs budget, remaining balance, unspent funds to return. Simple and accurate. |

---

### Cluster E: Tenant

**Items:** Security deposit interest — [Tenant]

Single-purpose workflow, simplest of all.

| Step | Implementation |
|------|---------------|
| **1. Checklist** | Auto: deposit amount on file, interest rate set, anniversary date confirmed. Manual: "Tenant still in occupancy?" |
| **2. AI Scan** | Calculate exact interest owed, verify against MA 3% statutory rate, compare to escrow bank balance |
| **3. Draft** | Interest payment record with calculation breakdown |
| **4. Delivery** | Payment record PDF. If integrated with AP: create payable to tenant. |

**Sub-decisions needed:**

| ID | Question | Options |
|----|----------|---------|
| WF-E1 | Interest payment — auto-create AP entry? | **DECIDED:** Yes — auto-create payable to tenant in AP when user accepts the calculation in Step 3. Closes the loop without manual re-entry. |

---

## 5. Data Model

### New Schema Changes

```
-- Workflow state tracking on compliance_deadlines
ALTER TABLE compliance_deadlines ADD COLUMN workflow_state enum('not_started','checklist','scan','draft','delivered') DEFAULT 'not_started';
ALTER TABLE compliance_deadlines ADD COLUMN workflow_type varchar(50); -- e.g., 'tax_form_filing', 'annual_review', 'budget_cycle', 'grant_report', 'tenant_deposit'
ALTER TABLE compliance_deadlines ADD COLUMN is_reminder boolean DEFAULT false;
ALTER TABLE compliance_deadlines ADD COLUMN parent_deadline_id integer REFERENCES compliance_deadlines(id);
ALTER TABLE compliance_deadlines ADD COLUMN google_event_id varchar(255);
ALTER TABLE compliance_deadlines ADD COLUMN google_reminder_event_id varchar(255);

-- Rich metadata for detail cards
ALTER TABLE compliance_deadlines ADD COLUMN legal_citation text;
ALTER TABLE compliance_deadlines ADD COLUMN reference_url text;
ALTER TABLE compliance_deadlines ADD COLUMN recommended_actions text; -- JSON array
ALTER TABLE compliance_deadlines ADD COLUMN authority_source varchar(100); -- e.g., 'IRS', 'SSA', 'MA DOR'

-- Workflow artifacts & logging
CREATE TABLE compliance_workflow_logs (
  id serial PRIMARY KEY,
  deadline_id integer REFERENCES compliance_deadlines(id) NOT NULL,
  step enum('checklist','scan','draft','delivery') NOT NULL,
  action varchar(50) NOT NULL, -- 'checklist_accepted', 'scan_acknowledged', 'draft_accepted', 'artifact_delivered'
  user_id varchar(255) NOT NULL,
  data jsonb, -- checklist responses, explanations, scan results, etc.
  created_at timestamp DEFAULT now()
);

CREATE TABLE compliance_artifacts (
  id serial PRIMARY KEY,
  deadline_id integer REFERENCES compliance_deadlines(id) NOT NULL,
  artifact_type varchar(50) NOT NULL, -- 'form_990_data', 'board_resolution', 'w2_package', etc.
  blob_url text NOT NULL,
  file_name varchar(255) NOT NULL,
  file_size integer,
  created_by varchar(255) NOT NULL,
  created_at timestamp DEFAULT now()
);
```

### Workflow Configuration (per deadline type)

```typescript
// src/lib/compliance/workflow-config.ts
interface WorkflowConfig {
  workflowType: string
  steps: {
    checklist: {
      autoChecks: AutoCheck[]      // DB queries, pass/fail
      manualChecks: ManualCheck[]   // User must check or explain
    }
    scan: {
      reportSlugs: string[]        // Reports to pull data from
      aiPromptTemplate: string     // Pre-baked prompt
      citations: Citation[]        // Regulatory references
    }
    draft: {
      artifactType: 'pdf' | 'docx' | 'csv'
      templateId?: string          // For template-based drafts
      generatorFn: string          // Function name to call
      requiresWarningDialog: boolean
    }
    delivery: {
      blobPrefix: string           // e.g., 'compliance-artifacts/990/'
      notifyRoles?: string[]       // Optional: email CPA, board, etc.
    }
  }
}
```

---

## 6. Implementation Plan

### Phase 1: Core Pipeline Infrastructure

| Task | Status | Notes |
|------|--------|-------|
| Schema migration: workflow columns on `compliance_deadlines` | 🔲 | |
| Schema migration: `compliance_workflow_logs` table | 🔲 | |
| Schema migration: `compliance_artifacts` table | 🔲 | |
| Schema migration: rich metadata columns (citation, etc.) | 🔲 | |
| `WorkflowPipeline` React component (4-step state machine) | 🔲 | Single component, step props |
| `ChecklistStep` component (auto + manual checks) | 🔲 | |
| `AIScanStep` component (brief display + acknowledge) | 🔲 | |
| `DraftStep` component (artifact preview + accept) | 🔲 | Warning dialog variant |
| `DeliveryStep` component (download + blob storage) | 🔲 | |
| Copilot panel: add "Workflow" tab (Option B) | 🔲 | Context-aware per deadline |
| Workflow state persistence (DB read/write) | 🔲 | |
| Audit logging for all state transitions | 🔲 | |
| Populate rich metadata for 28 hardcoded deadlines | 🔲 | `legal_citation`, `authority_source`, etc. |

### Phase 2: Workflow Configurations (per cluster)

| Task | Status | Notes |
|------|--------|-------|
| Cluster A: Tax Form Filing workflows | 🔲 | 990, W-2, 1099, 941, M-941, Form PC |
| Cluster B: Annual Reviews & Attestations | 🔲 | 7 workflows |
| Cluster C: Budget Cycle | 🔲 | 4 workflows |
| Cluster D: Grant & Funding Source | 🔲 | 4 workflow types |
| Cluster E: Tenant | 🔲 | 1 workflow |

### Phase 3: Google Calendar Sync

| Task | Status | Notes |
|------|--------|-------|
| Google Cloud project + Calendar API setup | 🔲 | Service account + domain delegation |
| Create `renewal-initiatives-compliance` calendar | 🔲 | |
| Sync engine: financial-system → Google Calendar | 🔲 | Create/update/delete events |
| Reminder event generation (14-day prior) | 🔲 | `is_reminder` + `parent_deadline_id` |
| Webhook endpoint: Google → financial-system | 🔲 | `/api/webhooks/google-calendar` |
| Webhook subscription renewal cron | 🔲 | Re-subscribe every ~7 days |
| Embedded Google Calendar iframe view | 🔲 | Toggle: List View | Calendar View |

### Phase 4: Admin & Retrieval

| Task | Status | Notes |
|------|--------|-------|
| Admin page: browse compliance artifacts by year/type | 🔲 | |
| Admin page: view workflow logs per deadline | 🔲 | |
| Admin page: re-download any artifact from blob | 🔲 | |

---

## 7. Verification

- [ ] Each 4-step workflow can be started, paused, resumed, and completed
- [ ] Checklist: auto-checks evaluate correctly; manual checks require input or explanation
- [ ] AI Scan: generates relevant analysis with citations; acknowledgement logged
- [ ] Draft: produces correct artifact type; warning dialog appears for serious items
- [ ] Delivery: artifact saved to blob; downloadable immediately and from admin
- [ ] Google Calendar: events appear within 60s of deadline creation; reminder events 14 days prior
- [ ] Google Calendar: edits in financial-system reflect in Google Calendar
- [ ] Copilot panel: Workflow tab appears when compliance item selected; chat tab retains context
- [ ] Audit log: all state transitions, acceptances, and explanations recorded
- [ ] Responsive: works on primary viewport (≥1280px); copilot minimizes gracefully on narrow

---

## 8. Session Progress

### Session 1: 2026-03-09 (Discovery + Design + All Workflow Decisions)

**Completed:**
- [x] Created plan document
- [x] Assessed 4 feature areas (detail cards, Google sync, embedded calendar, tax rate discovery)
- [x] Mapped all 28+ compliance items to buildable workflows with pattern analysis
- [x] Identified 4 reusable primitives covering 95% of workflows
- [x] Defined 4-step pipeline model (Checklist → AI Scan → Draft → Delivery)
- [x] Defined 5 workflow clusters (A–E)
- [x] UX decision: Option B (copilot panel = contextual workflow host)
- [x] Drafted schema changes and data model
- [x] All 14 workflow decisions made (WF-A1–A4, WF-B1–B5, WF-C1–C3, WF-D1–D2, WF-E1)
- [x] Filing API: TaxBandits for W-2, 1099-NEC, 941 (~$85/yr). No CPA. Self-filing.
- [x] 990: data report matched to IRS PDF field order, manual transcription
- [x] Officer comp: Open990 link, manual lookup, no API now
- [x] Security deposit interest: auto-create AP payable on acceptance

**Next Steps:**
- [ ] Define P0/P1/P2 requirements
- [ ] Phase the implementation (suggest: Phase 1 = pipeline infrastructure, Phase 2 = Cluster A workflows + TaxBandits, Phase 3 = Clusters B–E, Phase 4 = Google Calendar sync)
- [ ] Run `/plan-phase` on Phase 1 when ready to build
