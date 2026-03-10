# Compliance Workflow Engine — Phase Execution Plans

**Traces to:** compliance-workflow-engine-PLAN.md
**Last Updated:** 2026-03-09
**Purpose:** Detailed sub-phase execution plans consumed by `/execute-phase`

---

## Phase Assessment & Splitting

**Phase 1** (Core Pipeline Infrastructure) is split into three sub-phases:
- **1a: Schema & Data Layer** — migrations first; everything else blocks on schema existing in DB
- **1b: Pipeline React Components** — the 4-step WorkflowPipeline + all step sub-components; no DB writes yet, uses static mock config
- **1c: Copilot Panel Integration & Metadata** — wire the panel's Workflow tab to real DB state, add server actions for state persistence and audit logging, populate rich metadata for 28 hardcoded deadlines

**Phase 2** (Workflow Configurations) is split into two sub-phases:
- **2a: TaxBandits Integration + Cluster A (Tax Filing)** — the TaxBandits API client is a dependency for W-2/1099/941 workflows; build it alongside Cluster A configs
- **2b: Clusters B–E Workflow Configs** — no external API dependency; pure workflow config objects and generator functions

**Phase 3** (Google Calendar Sync) stays as one phase but is ordered carefully: infra setup → sync engine → reminder rows → webhook → cron → iframe. No split needed but the infra step has a manual prerequisite (Google Cloud console setup).

**Phase 4** (Admin & Artifact Retrieval) stays as one phase. Three closely related server components on a single admin route; natural unit.

---

## Phase 1a: Schema & Data Layer

### Overview
Add 10 new columns to `compliance_deadlines`, create two new tables (`compliance_workflow_logs`, `compliance_artifacts`), add three new pg enums, update the Drizzle schema files, update `index.ts` relations, and apply the migration.

---

### Task 1a-1: Add new pg enums to `enums.ts`

**What:** Define three new pg enums — `workflowStateEnum`, `workflowStepEnum`, and `workflowTypeEnum` — following the existing pattern in `enums.ts`.

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/db/schema/enums.ts`

**Implementation:**
```typescript
export const workflowStateEnum = pgEnum('workflow_state', [
  'not_started',
  'checklist',
  'scan',
  'draft',
  'delivered',
])

export const workflowStepEnum = pgEnum('workflow_step', [
  'checklist',
  'scan',
  'draft',
  'delivery',
])

export const workflowTypeEnum = pgEnum('workflow_type', [
  'tax_form_990',
  'tax_form_pc',
  'tax_w2',
  'tax_1099_nec',
  'tax_941',
  'tax_m941',
  'annual_review',
  'annual_attestation',
  'budget_cycle',
  'grant_report',
  'grant_closeout',
  'grant_milestone',
  'tenant_deposit',
])
```

**AC:**
- All three enums exported from `enums.ts` using `pgEnum` from `drizzle-orm/pg-core`
- `workflowStateEnum` values match the 5 states in the plan exactly: `not_started`, `checklist`, `scan`, `draft`, `delivered`
- `workflowStepEnum` values match the 4 step names: `checklist`, `scan`, `draft`, `delivery`
- `workflowTypeEnum` covers all 13 workflow types across clusters A–E
- No existing enum is modified

---

### Task 1a-2: Extend `compliance-deadlines.ts` schema with 10 new columns

**What:** Add 10 columns to the `complianceDeadlines` pgTable definition — workflow state tracking (6 columns) and rich metadata (4 columns).

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/db/schema/compliance-deadlines.ts`

**Implementation — add these columns to the existing table definition:**
```typescript
// Workflow state tracking
workflowState: workflowStateEnum('workflow_state').notNull().default('not_started'),
workflowType: workflowTypeEnum('workflow_type'),
isReminder: boolean('is_reminder').notNull().default(false),
parentDeadlineId: integer('parent_deadline_id'),  // self-referential FK added in relations
googleEventId: varchar('google_event_id', { length: 255 }),
googleReminderEventId: varchar('google_reminder_event_id', { length: 255 }),

// Rich metadata for detail cards
legalCitation: text('legal_citation'),
referenceUrl: text('reference_url'),
recommendedActions: text('recommended_actions'),  // stored as JSON array string
authoritySource: varchar('authority_source', { length: 100 }),
```

**New imports needed:** `workflowStateEnum`, `workflowTypeEnum` from `./enums`

**AC:**
- Table definition compiles with no TypeScript errors
- `workflowState` has `.notNull().default('not_started')`
- `isReminder` has `.notNull().default(false)`
- `parentDeadlineId` is nullable integer (no default, no notNull) — FK constraint added in migration SQL, not schema file (avoids Drizzle circular self-ref issues)
- All 4 metadata columns are nullable text/varchar
- `workflowType` uses `workflowTypeEnum` (nullable — not all deadlines have workflows yet)

---

### Task 1a-3: Create `compliance-workflow-logs.ts` schema file

**What:** Define the `complianceWorkflowLogs` table following the naming and import conventions of existing schema files like `audit-log.ts`.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/db/schema/compliance-workflow-logs.ts`

**Implementation:**
```typescript
import {
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core'
import { workflowStepEnum } from './enums'

export const complianceWorkflowLogs = pgTable(
  'compliance_workflow_logs',
  {
    id: serial('id').primaryKey(),
    deadlineId: integer('deadline_id').notNull(),
    step: workflowStepEnum('step').notNull(),
    action: varchar('action', { length: 50 }).notNull(),
    userId: varchar('user_id', { length: 255 }).notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('compliance_workflow_logs_deadline_idx').on(table.deadlineId),
    index('compliance_workflow_logs_created_at_idx').on(table.createdAt),
  ]
)
```

**AC:**
- File structure matches `audit-log.ts` pattern: named exports, index hints in table callback array
- `action` values to be stored: `'checklist_accepted'`, `'scan_acknowledged'`, `'draft_accepted'`, `'artifact_delivered'`
- `data` is `jsonb` (nullable) — stores checklist responses, explanations, scan results
- Two indexes: on `deadline_id` (frequent lookup) and `created_at` (temporal audit queries)

---

### Task 1a-4: Create `compliance-artifacts.ts` schema file

**What:** Define the `complianceArtifacts` table for tracking Vercel Blob artifact metadata.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/db/schema/compliance-artifacts.ts`

**Implementation:**
```typescript
import {
  index,
  integer,
  pgTable,
  serial,
  timestamp,
  varchar,
  text,
} from 'drizzle-orm/pg-core'

export const complianceArtifacts = pgTable(
  'compliance_artifacts',
  {
    id: serial('id').primaryKey(),
    deadlineId: integer('deadline_id').notNull(),
    artifactType: varchar('artifact_type', { length: 50 }).notNull(),
    blobUrl: text('blob_url').notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileSize: integer('file_size'),
    createdBy: varchar('created_by', { length: 255 }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (table) => [
    index('compliance_artifacts_deadline_idx').on(table.deadlineId),
    index('compliance_artifacts_created_at_idx').on(table.createdAt),
  ]
)
```

**AC:**
- `artifactType` values (not enforced as enum — flexible): `'form_990_data'`, `'board_resolution'`, `'w2_package'`, `'1099_nec_package'`, `'941_filing'`, `'m941_report'`, `'form_pc_summary'`, `'budget_resolution'`, `'board_pack'`, `'grant_report'`, `'deposit_interest_record'`
- `blobUrl` is `text` (not varchar) — Vercel Blob URLs can be long
- `fileSize` is nullable integer (bytes)
- Index on `deadline_id` for admin retrieval queries

---

### Task 1a-5: Export new tables from `index.ts` and add relations

**What:** Add exports and Drizzle relations for the two new tables and update `complianceDeadlinesRelations` to include self-referential parent/children and the new child collections.

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/db/schema/index.ts`

**Changes:**
1. Add to export barrel at top:
   ```typescript
   export * from './compliance-workflow-logs'
   export * from './compliance-artifacts'
   ```
2. Add import statements in the "Re-import for relations" section:
   ```typescript
   import { complianceWorkflowLogs } from './compliance-workflow-logs'
   import { complianceArtifacts } from './compliance-artifacts'
   ```
3. Update `complianceDeadlinesRelations` to add:
   ```typescript
   parent: one(complianceDeadlines, {
     fields: [complianceDeadlines.parentDeadlineId],
     references: [complianceDeadlines.id],
     relationName: 'reminderChain',
   }),
   reminders: many(complianceDeadlines, { relationName: 'reminderChain' }),
   workflowLogs: many(complianceWorkflowLogs),
   artifacts: many(complianceArtifacts),
   ```
4. Add new relation definitions:
   ```typescript
   export const complianceWorkflowLogsRelations = relations(
     complianceWorkflowLogs,
     ({ one }) => ({
       deadline: one(complianceDeadlines, {
         fields: [complianceWorkflowLogs.deadlineId],
         references: [complianceDeadlines.id],
       }),
     })
   )

   export const complianceArtifactsRelations = relations(
     complianceArtifacts,
     ({ one }) => ({
       deadline: one(complianceDeadlines, {
         fields: [complianceArtifacts.deadlineId],
         references: [complianceDeadlines.id],
       }),
     })
   )
   ```

**AC:**
- `index.ts` compiles with no TypeScript errors
- `typeof complianceDeadlines.$inferSelect` now includes all 10 new columns
- Drizzle `with` queries on `complianceDeadlines` can include `workflowLogs` and `artifacts`

---

### Task 1a-6: Write and apply migration SQL

**What:** Generate Drizzle migration file `0024_compliance_workflow_engine.sql` with all DDL changes.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/drizzle/0024_compliance_workflow_engine.sql`

**Implementation — full SQL:**
```sql
-- Create enums
CREATE TYPE "public"."workflow_state" AS ENUM('not_started', 'checklist', 'scan', 'draft', 'delivered');
CREATE TYPE "public"."workflow_step" AS ENUM('checklist', 'scan', 'draft', 'delivery');
CREATE TYPE "public"."workflow_type" AS ENUM(
  'tax_form_990', 'tax_form_pc', 'tax_w2', 'tax_1099_nec', 'tax_941', 'tax_m941',
  'annual_review', 'annual_attestation', 'budget_cycle',
  'grant_report', 'grant_closeout', 'grant_milestone', 'tenant_deposit'
);

-- Extend compliance_deadlines
ALTER TABLE "compliance_deadlines"
  ADD COLUMN "workflow_state" "workflow_state" NOT NULL DEFAULT 'not_started',
  ADD COLUMN "workflow_type" "workflow_type",
  ADD COLUMN "is_reminder" boolean NOT NULL DEFAULT false,
  ADD COLUMN "parent_deadline_id" integer REFERENCES "compliance_deadlines"("id"),
  ADD COLUMN "google_event_id" varchar(255),
  ADD COLUMN "google_reminder_event_id" varchar(255),
  ADD COLUMN "legal_citation" text,
  ADD COLUMN "reference_url" text,
  ADD COLUMN "recommended_actions" text,
  ADD COLUMN "authority_source" varchar(100);

-- Create compliance_workflow_logs
CREATE TABLE "compliance_workflow_logs" (
  "id" serial PRIMARY KEY,
  "deadline_id" integer NOT NULL REFERENCES "compliance_deadlines"("id"),
  "step" "workflow_step" NOT NULL,
  "action" varchar(50) NOT NULL,
  "user_id" varchar(255) NOT NULL,
  "data" jsonb,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "compliance_workflow_logs_deadline_idx" ON "compliance_workflow_logs" ("deadline_id");
CREATE INDEX "compliance_workflow_logs_created_at_idx" ON "compliance_workflow_logs" ("created_at");

-- Create compliance_artifacts
CREATE TABLE "compliance_artifacts" (
  "id" serial PRIMARY KEY,
  "deadline_id" integer NOT NULL REFERENCES "compliance_deadlines"("id"),
  "artifact_type" varchar(50) NOT NULL,
  "blob_url" text NOT NULL,
  "file_name" varchar(255) NOT NULL,
  "file_size" integer,
  "created_by" varchar(255) NOT NULL,
  "created_at" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX "compliance_artifacts_deadline_idx" ON "compliance_artifacts" ("deadline_id");
CREATE INDEX "compliance_artifacts_created_at_idx" ON "compliance_artifacts" ("created_at");
```

**Steps after writing the file:**
1. Run `npx drizzle-kit generate` to verify Drizzle picks it up (or confirm numbering is correct)
2. Apply to dev DB: `psql $DATABASE_URL -f drizzle/0024_compliance_workflow_engine.sql`
3. Apply to production DB via the same psql command with `$PROD_DATABASE_URL`

**AC:**
- Migration applies without errors on dev DB
- `\d compliance_deadlines` shows all 10 new columns
- `\dt compliance_workflow_logs` and `\dt compliance_artifacts` both exist
- `\dT workflow_state` shows the enum with 5 values
- `$inferSelect` on `complianceDeadlines` includes `workflowState` typed as the enum union

---

## Phase 1b: Pipeline React Components

### Overview
Build the `WorkflowPipeline` container component and its four step sub-components. At this stage, components render against a static `WorkflowConfig` object passed as props — no live DB calls. This allows the components to be developed and tested in isolation before wiring to real state in Phase 1c.

---

### Task 1b-1: Define shared workflow types

**What:** Create a types file for the workflow configuration interfaces and step-level state shapes used across all pipeline components.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflow-types.ts`

**Implementation:**
```typescript
export type WorkflowState = 'not_started' | 'checklist' | 'scan' | 'draft' | 'delivered'
export type WorkflowStep = 'checklist' | 'scan' | 'draft' | 'delivery'

export interface AutoCheck {
  id: string
  label: string           // Shown in logs only (invisible in UI per D6)
  check: () => Promise<boolean>
}

export interface ManualCheck {
  id: string
  label: string           // Shown to user
  requiresExplanation: boolean  // If true, unchecked requires ≤50 word explanation
}

export interface Citation {
  label: string           // e.g., "IRC §512-514"
  url?: string
}

export interface WorkflowConfig {
  workflowType: string
  displayName: string
  cluster: 'A' | 'B' | 'C' | 'D' | 'E'
  requiresWarningDialog: boolean   // D7: serious items (990, W-2 filing)
  steps: {
    checklist: {
      autoChecks: AutoCheck[]
      manualChecks: ManualCheck[]
    }
    scan: {
      reportSlugs: string[]
      aiPromptTemplate: string
      citations: Citation[]
    }
    draft: {
      artifactType: 'pdf' | 'docx' | 'csv'
      templateId?: string
      generatorFn: string
    }
    delivery: {
      blobPrefix: string
      notifyRoles?: string[]
    }
  }
}

// State persisted in DB and passed to pipeline as props
export interface WorkflowStateData {
  deadlineId: number
  currentState: WorkflowState
  checklistResponses?: Record<string, { checked: boolean; explanation?: string }>
  scanAcknowledged?: boolean
  draftAccepted?: boolean
  artifactUrl?: string
  artifactFileName?: string
}

// What the pipeline passes up to its host when state changes
export interface WorkflowStateChange {
  newState: WorkflowState
  logEntry: {
    step: WorkflowStep
    action: string
    data: Record<string, unknown>
  }
}
```

**AC:**
- No runtime code — types only, compiles cleanly
- `WorkflowConfig` matches the shape in the plan's Section 5 exactly
- `WorkflowStateChange` captures everything needed by the audit log server action in Phase 1c

---

### Task 1b-2: Create `ChecklistStep` component

**What:** Render manual checklist items as checkboxes; auto-checks run server-side and are never shown in UI; unchecked manual items reveal a 50-word explanation textarea; "Continue" button enabled only when all manual items are either checked or have an explanation.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/checklist-step.tsx`

**Implementation notes:**
- `'use client'`
- Props: `{ checks: ManualCheck[], initialResponses?: Record<string, { checked: boolean; explanation?: string }>, onComplete: (responses: Record<string, { checked: boolean; explanation?: string }>) => void, isSubmitting: boolean }`
- Each `ManualCheck` renders as a `<Checkbox>` from `@/components/ui/checkbox` with its label
- When a checkbox is unchecked and `requiresExplanation` is true, reveal a `<Textarea>` beneath it with placeholder "Explain why this doesn't apply (50 words max)" and `maxLength={300}` (approx 50 words)
- Word count validation: trim + split on whitespace, reject if > 50 words
- "Continue" button is disabled if any `requiresExplanation` item is unchecked AND has no explanation
- "Continue" calls `onComplete(responses)` — parent handles DB write and log

**AC:**
- All visible checks must be checked OR have a non-empty explanation before "Continue" enables
- Explanation textarea appears only when its checkbox is unchecked (hidden when checked)
- Word count enforcement: textarea bordered red + helper text "X / 50 words" when over limit
- `isSubmitting` prop disables the Continue button and shows a spinner
- Component has `data-testid="workflow-checklist-step"` on root, `data-testid="workflow-checklist-item-{id}"` per check

---

### Task 1b-3: Create `AIScanStep` component

**What:** Display the AI-generated compliance brief (markdown) with citations, plus a single "I've reviewed these recommendations" acknowledge button; no per-item acknowledgement.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/ai-scan-step.tsx`

**Implementation notes:**
- `'use client'`
- Props: `{ scanContent: string | null, citations: Citation[], isLoading: boolean, isAcknowledged: boolean, onAcknowledge: () => void, isSubmitting: boolean }`
- When `isLoading` is true, show a skeleton loader (use `Skeleton` from `@/components/ui/skeleton`) with 3–4 lines
- When `scanContent` is present, render it as formatted text (plain `<p>` + `<ul>` — no markdown parser dependency needed; AI prompt will output plain text)
- Citations rendered as a `<ul>` below the scan content; if `url` present, render as `<a>` with `target="_blank" rel="noopener noreferrer"`
- Acknowledge button text: "I've reviewed these recommendations — Continue"
- Button disabled when `isLoading || isSubmitting || isAcknowledged`
- When `isAcknowledged`, show a green checkmark badge "Reviewed" in place of button

**AC:**
- Skeleton shows during `isLoading` state
- Citations section renders with external links that open in new tab
- Acknowledge button is the only interactive element beyond scrolling
- `data-testid="workflow-scan-step"` on root, `data-testid="workflow-scan-acknowledge-btn"` on button

---

### Task 1b-4: Create `DraftStep` component

**What:** Show a preview of the generated artifact (filename, type, size), an "Accept Final Version" button, and (for serious items) a confirmation `AlertDialog` before acceptance.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/draft-step.tsx`

**Implementation notes:**
- `'use client'`
- Props: `{ artifactType: 'pdf' | 'docx' | 'csv', fileName: string | null, previewUrl: string | null, isGenerating: boolean, isDraftAccepted: boolean, requiresWarningDialog: boolean, onAccept: () => void, isSubmitting: boolean }`
- When `isGenerating`, show skeleton + "Generating document..." text
- When `fileName` is present, show a file card: icon (FileText from lucide), filename, type badge
- If `previewUrl` is set, show a "Preview" link (opens blob URL in new tab)
- "Accept Final Version" button:
  - If `requiresWarningDialog` is true: clicking opens `AlertDialog` with title "Confirm Filing Acceptance" and body "This action initiates the official filing process. Verify all data before proceeding." Two buttons: "Cancel" and "Confirm Acceptance"
  - If `requiresWarningDialog` is false: calls `onAccept()` directly
- When `isDraftAccepted`, show "Accepted" badge and disable button

**AC:**
- Warning dialog appears for `requiresWarningDialog: true` items before `onAccept()` fires
- File card shows correct icon and type badge ('PDF', 'DOCX', 'CSV')
- `isGenerating` shows skeleton, not empty state
- `data-testid="workflow-draft-step"` on root, `data-testid="workflow-draft-accept-btn"` on accept button, `data-testid="workflow-draft-confirm-btn"` on dialog confirm

---

### Task 1b-5: Create `DeliveryStep` component

**What:** Display the delivered artifact's download link and a summary of completion.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/delivery-step.tsx`

**Implementation notes:**
- `'use client'`
- Props: `{ artifactUrl: string | null, fileName: string | null, deliveredAt: string | null, onStartOver?: () => void }`
- Primary content: green checkmark icon + "Workflow Complete" heading + "Your artifact has been saved." subtext
- File download button: `<a href={artifactUrl} download={fileName}>` — renders as `<Button>` variant `outline` with `Download` lucide icon
- Show delivered timestamp formatted as `toLocaleDateString('en-US', { ... })` matching `columns.tsx` date format
- Optional "Start Over" button (for rerunning if needed) only if `onStartOver` prop is provided

**AC:**
- Download button uses native `<a download>` — no server action needed for download
- Delivered timestamp formatted consistently with rest of compliance UI
- Component shows "Saved to compliance archive" subtext beneath filename
- `data-testid="workflow-delivery-step"` on root, `data-testid="workflow-delivery-download-btn"` on download

---

### Task 1b-6: Create `WorkflowPipeline` container component

**What:** The 4-step state machine container that renders the correct step component based on current state, shows a step progress indicator, and routes callbacks to the parent host.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/workflow-pipeline.tsx`

**Implementation notes:**
- `'use client'`
- Props:
  ```typescript
  interface WorkflowPipelineProps {
    config: WorkflowConfig
    stateData: WorkflowStateData
    scanContent: string | null
    isScanLoading: boolean
    isSubmitting: boolean
    onStateChange: (change: WorkflowStateChange) => Promise<void>
    onRequestScan: () => void   // triggers AI scan fetch in parent
  }
  ```
- Step indicator: horizontal bar showing 4 steps (Checklist, AI Scan, Draft, Delivery) with filled/empty circles. Use `cn()` from `@/lib/utils` for active/complete styling.
- State machine mapping:
  - `not_started` → show "Start Workflow" button that advances to `checklist`
  - `checklist` → render `<ChecklistStep>`
  - `scan` → render `<AIScanStep>`, call `onRequestScan()` on mount if `scanContent` is null
  - `draft` → render `<DraftStep>`
  - `delivered` → render `<DeliveryStep>`
- When `ChecklistStep.onComplete` fires: call `onStateChange({ newState: 'scan', logEntry: { step: 'checklist', action: 'checklist_accepted', data: { responses } } })`
- When `AIScanStep.onAcknowledge` fires: call `onStateChange({ newState: 'draft', logEntry: { step: 'scan', action: 'scan_acknowledged', data: {} } })`
- When `DraftStep.onAccept` fires: call `onStateChange({ newState: 'delivered', logEntry: { step: 'draft', action: 'draft_accepted', data: {} } })`

**AC:**
- Step indicator correctly highlights current step and marks completed steps
- `not_started` state shows only "Start Workflow" button, no step content
- Transitions only advance forward — no backward navigation
- `data-testid="workflow-pipeline"` on root container
- `data-testid="workflow-step-indicator"` on step indicator bar
- TypeScript compiles without errors

---

### Task 1b-7: Create component barrel index

**What:** Export all workflow components from a single index file for clean imports.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/components/compliance/workflow/index.ts`

**Implementation:**
```typescript
export { WorkflowPipeline } from './workflow-pipeline'
export { ChecklistStep } from './checklist-step'
export { AIScanStep } from './ai-scan-step'
export { DraftStep } from './draft-step'
export { DeliveryStep } from './delivery-step'
```

**AC:**
- All 5 components importable from `@/components/compliance/workflow`

---

## Phase 1c: Copilot Panel Integration & Metadata

### Overview
Wire the copilot panel to show a "Workflow" tab when a compliance item is selected, add server actions for workflow state persistence and audit logging, build the compliance detail slide-over, and populate rich metadata for all 28 hardcoded deadlines.

---

### Task 1c-1: Create workflow state server actions

**What:** Server actions for reading workflow state, persisting state transitions, and writing workflow audit logs — called from the copilot panel host component.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/workflow-actions.ts`

**Implementation:**
```typescript
'use server'

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { complianceDeadlines, complianceWorkflowLogs, complianceArtifacts } from '@/lib/db/schema'
import { revalidatePath } from 'next/cache'
import type { WorkflowState, WorkflowStep, WorkflowStateChange } from '@/lib/compliance/workflow-types'

export async function getWorkflowState(deadlineId: number) {
  const [row] = await db
    .select({
      workflowState: complianceDeadlines.workflowState,
      workflowType: complianceDeadlines.workflowType,
    })
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.id, deadlineId))
  return row ?? null
}

export async function advanceWorkflowState(
  deadlineId: number,
  userId: string,
  change: WorkflowStateChange
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(complianceDeadlines)
      .set({ workflowState: change.newState })
      .where(eq(complianceDeadlines.id, deadlineId))

    await tx.insert(complianceWorkflowLogs).values({
      deadlineId,
      step: change.logEntry.step as WorkflowStep,
      action: change.logEntry.action,
      userId,
      data: change.logEntry.data,
    })
  })
  revalidatePath('/compliance')
}

export async function recordArtifactDelivery(
  deadlineId: number,
  userId: string,
  artifact: {
    artifactType: string
    blobUrl: string
    fileName: string
    fileSize?: number
  }
): Promise<void> {
  await db.transaction(async (tx) => {
    await tx
      .update(complianceDeadlines)
      .set({ workflowState: 'delivered', status: 'completed' })
      .where(eq(complianceDeadlines.id, deadlineId))

    await tx.insert(complianceArtifacts).values({
      deadlineId,
      ...artifact,
      createdBy: userId,
    })

    await tx.insert(complianceWorkflowLogs).values({
      deadlineId,
      step: 'delivery',
      action: 'artifact_delivered',
      userId,
      data: { blobUrl: artifact.blobUrl, fileName: artifact.fileName },
    })
  })
  revalidatePath('/compliance')
}

export async function getWorkflowLogs(deadlineId: number) {
  return db
    .select()
    .from(complianceWorkflowLogs)
    .where(eq(complianceWorkflowLogs.deadlineId, deadlineId))
    .orderBy(complianceWorkflowLogs.createdAt)
}

export async function getDeadlineWithWorkflow(deadlineId: number) {
  const [row] = await db
    .select()
    .from(complianceDeadlines)
    .where(eq(complianceDeadlines.id, deadlineId))
  return row ?? null
}
```

**AC:**
- `advanceWorkflowState` writes both the state update and the log entry in a single transaction
- `recordArtifactDelivery` sets `status: 'completed'` on the deadline (mirrors `completeDeadline()`) and inserts into both `complianceArtifacts` and `complianceWorkflowLogs` in one transaction
- All actions call `revalidatePath('/compliance')` so the table refreshes
- TypeScript `WorkflowStep` type enforces valid step values

---

### Task 1c-2: Build compliance detail slide-over

**What:** A slide-over drawer panel (Sheet component) that appears when a user clicks a compliance row, showing the deadline's rich metadata and housing the WorkflowPipeline.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/compliance-detail-sheet.tsx`

**Implementation notes:**
- `'use client'`
- Imports: `Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription` from `@/components/ui/sheet`; `Tabs, TabsList, TabsTrigger, TabsContent` from `@/components/ui/tabs`
- Props:
  ```typescript
  interface ComplianceDetailSheetProps {
    deadline: ComplianceDeadlineRow | null
    open: boolean
    onClose: () => void
  }
  ```
- Sheet opens from the right (`side="right"`) with `className="w-[500px] sm:max-w-[500px]"`
- Two tabs: "Details" and "Workflow"
- **Details tab:** Shows `legalCitation`, `referenceUrl` (as external link), `authoritySource`, `recommendedActions` (parsed JSON array rendered as `<ul>`), `notes`. Labels styled as `text-muted-foreground text-xs` with value below. If a field is null, don't render its section.
- **Workflow tab:** Renders `<WorkflowPipelineHost deadlineId={deadline.id} workflowType={deadline.workflowType} />` (built in 1c-3)
- Default to "Workflow" tab when sheet opens if `deadline.workflowType` is non-null, else "Details"

**AC:**
- Sheet animates in from right using shadcn Sheet
- Details tab gracefully hides null metadata fields — no blank labels
- `recommendedActions` parsed from JSON string before rendering; if parse fails, render as plain text
- `data-testid="compliance-detail-sheet"` on sheet root
- `data-testid="compliance-detail-tab-details"` and `data-testid="compliance-detail-tab-workflow"` on tabs

---

### Task 1c-3: Create `WorkflowPipelineHost` client component

**What:** The client component that owns async data fetching, AI scan triggering, and state change callbacks, passing everything down to `WorkflowPipeline` as props.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/workflow-pipeline-host.tsx`

**Implementation notes:**
- `'use client'`
- Props: `{ deadlineId: number, workflowType: string | null }`
- Uses `useState` for `stateData`, `scanContent`, `isScanLoading`, `isSubmitting`
- On mount: fetches current workflow state via `getDeadlineWithWorkflow(deadlineId)` (server action call via `import`)
- `handleStateChange(change: WorkflowStateChange)`:
  - Sets `isSubmitting(true)`
  - Calls `advanceWorkflowState(deadlineId, userId, change)`
  - If `change.newState === 'scan'` and `scanContent` is null: triggers `handleRequestScan()`
  - Updates local `stateData` optimistically
  - Sets `isSubmitting(false)`
- `handleRequestScan()`:
  - Sets `isScanLoading(true)`
  - POSTs to `/api/compliance/scan` with `{ deadlineId, workflowType }` (stubbed in Phase 2; returns mock data for now)
  - Sets `scanContent` from response
  - Sets `isScanLoading(false)`
- If `workflowType` is null: render `<p className="text-muted-foreground text-sm">No workflow configured for this item.</p>`
- User ID: use `useSession()` from `next-auth/react` → `session.user.id` (or `session.user.email` as fallback)

**AC:**
- Workflow state loads from DB on mount (no stale data from parent)
- AI scan only fetched once — `scanContent` persists across tab switches within the sheet session
- `isSubmitting` gates all user interaction during DB writes
- If `workflowType` is null, renders a graceful "no workflow" message instead of crashing

---

### Task 1c-4: Modify `CopilotPanel` to support Workflow tab mode

**What:** Extend `CopilotPanel` to optionally show a "Workflow" tab alongside the existing chat, when a compliance item with a workflow is selected — decision D1 (Option B).

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/components/copilot/copilot-panel.tsx`

**Changes:**
- Add optional props:
  ```typescript
  workflowContent?: React.ReactNode   // Passed from compliance page
  defaultTab?: 'chat' | 'workflow'
  ```
- When `workflowContent` is provided, wrap the panel body in `<Tabs>` with two tabs: "Chat" and "Workflow"
- "Chat" tab contains the existing messages + input UI (unchanged)
- "Workflow" tab contains `{workflowContent}` with `overflow-y-auto h-full` container
- When `workflowContent` is undefined, render exactly as before (single-tab mode — no visible tab bar)
- Header title: when in workflow mode, show "Compliance Assistant" instead of "AI Assistant"

**AC:**
- Existing `CopilotPanel` usage on non-compliance pages is completely unaffected (no `workflowContent` prop = same behavior)
- Tab bar appears only when `workflowContent` is provided
- `defaultTab` prop controls which tab is selected on open
- `data-testid="copilot-tab-chat"` and `data-testid="copilot-tab-workflow"` on tab triggers

---

### Task 1c-5: Wire compliance page to open copilot panel on row click

**What:** Update `ComplianceCalendarClient` to open the `CopilotPanel` (and pass the selected deadline's workflow content) when a row is clicked, replacing the current "Mark Complete" button pattern.

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/compliance-calendar-client.tsx`

**Changes:**
- Add state: `selectedDeadline: ComplianceDeadlineRow | null`
- Add state: `copilotOpen: boolean`
- `onRowClick`: sets `selectedDeadline` and `copilotOpen = true` (replaces current `setSelected` logic)
- Render `<CopilotPanel>` with:
  - `open={copilotOpen}`
  - `onClose={() => setCopilotOpen(false)}`
  - `workflowContent={selectedDeadline ? <WorkflowPipelineHost deadlineId={selectedDeadline.id} workflowType={selectedDeadline.workflowType} /> : undefined}`
  - `defaultTab={selectedDeadline?.workflowType ? 'workflow' : 'chat'}`
  - Existing chat props passed through (messages, etc.) — wire up copilot hook same as other pages
- Keep the `<ComplianceDetailSheet>` as secondary slide-over triggered by a "Details" button in the row actions (or keep Sheet for Details tab content, remove now-redundant mark-complete button)
- The old `selected` / `handleComplete` pattern: keep `markDeadlineComplete` accessible via the copilot workflow delivery step — don't expose a standalone "Mark Complete" button on the table

**AC:**
- Clicking any row opens the copilot panel to the right
- Panel shows "Workflow" tab by default if row has a `workflowType`
- Panel shows "Chat" tab by default if row has no `workflowType`
- Copilot chat is pre-seeded with deadline context (taskName, dueDate, category) in system message
- Panel close button closes panel and deselects row

---

### Task 1c-6: Populate rich metadata for all 28 hardcoded deadlines

**What:** Write a one-time data migration script that UPDATEs the `legalCitation`, `referenceUrl`, `authoritySource`, `recommendedActions`, and `workflowType` columns for every deadline generated by `ANNUAL_DEADLINES` in `deadline-generator.ts`.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/scripts/populate-compliance-metadata.ts`

**Metadata to populate (all 28 deadlines):**

| taskName | workflowType | authoritySource | legalCitation | referenceUrl |
|----------|-------------|-----------------|---------------|--------------|
| Form 990 filing | tax_form_990 | IRS | IRC §6033; Reg §1.6033-2 | https://www.irs.gov/form990 |
| Form PC filing | tax_form_pc | MA AG | M.G.L. c. 12 §8F | https://www.mass.gov/how-to/file-your-annual-report-form-pc |
| Federal 941 (Q1–Q4) | tax_941 | IRS | IRC §3102, §3111, §3402 | https://www.irs.gov/form941 |
| MA M-941 (Q1–Q4) | tax_m941 | MA DOR | M.G.L. c. 62B | https://www.mass.gov/masstaxconnect |
| W-2 filing | tax_w2 | SSA/IRS | IRC §6051; 26 CFR §31.6051-1 | https://www.ssa.gov/employer/businessServices.htm |
| 1099-NEC filing | tax_1099_nec | IRS | IRC §6041A; 26 CFR §1.6041A-1 | https://www.irs.gov/form1099nec |
| Annual in-kind review | annual_review | IRS | IRC §170(f)(8); ASC 958-605 | https://www.irs.gov/charities-non-profits/charitable-organizations/substantiation-and-disclosure-requirements |
| Officer compensation review | annual_review | IRS | IRC §4958; Reg §53.4958-6 | https://www.irs.gov/charities-non-profits/charitable-organizations/intermediate-sanctions-irc-4958 |
| Conflict of interest attestation | annual_attestation | IRS | IRS Form 990 Part VI Line 12 | https://www.irs.gov/pub/irs-pdf/f990.pdf |
| Annual tax rate review (SS wage base) | annual_review | SSA | 42 U.S.C. §430 | https://www.ssa.gov/oact/cola/cbb.html |
| Year-end functional allocation review | annual_review | IRS | ASC 958-720-45; FASB ASU 2016-14 | https://fasb.org/page/PageContent?pageId=/standards/fasb-accounting-standards-codification.html |
| Public support trajectory review | annual_review | IRS | IRC §509(a)(1); Reg §1.509(a)-3 | https://www.irs.gov/charities-non-profits/public-charities/public-support-test |
| UBIT annual review | annual_review | IRS | IRC §511-515; Reg §1.512(a)-1 | https://www.irs.gov/charities-non-profits/unrelated-business-income-tax |
| MA Secretary of State Annual Report | annual_attestation | MA SOC | M.G.L. c. 180 §26A | https://www.sec.state.ma.us/cor/corpweb/corannrpt/annrptidx.htm |
| Insurance renewal (Hiscox BOP) | null | — | — | — |
| Budget draft (ED) | budget_cycle | — | Internal policy | — |
| Budget board circulation | budget_cycle | — | Internal policy | — |
| Budget board approval | budget_cycle | — | Robert's Rules; IRS Form 990 Part VI | — |
| Quarterly board prep (Q1–Q4) | budget_cycle | — | Internal policy | — |
| Annual grant compliance review | grant_report | — | 2 CFR §200 (Uniform Guidance) | https://www.ecfr.gov/current/title-2/part-200 |

**recommendedActions** (JSON array): 3–5 short action strings per deadline, e.g. for 990: `["Pull trial balance for FY", "Verify officer compensation figures", "Confirm public support calculation", "Review Part VII compensation table", "Run workflow 2 weeks before due date"]`

**Script implementation:**
```typescript
#!/usr/bin/env npx tsx
import { db } from '../src/lib/db'
import { complianceDeadlines } from '../src/lib/db/schema'
import { eq, and } from 'drizzle-orm'

// ... updateDeadlineMetadata helper that matches by taskName + updates columns
// Loop through all deadline metadata definitions
// Log updated count
```

**AC:**
- Script is idempotent — running twice produces the same result
- Script logs "Updated X deadlines, skipped Y" to stdout
- After running: `SELECT task_name, workflow_type, authority_source FROM compliance_deadlines WHERE workflow_type IS NOT NULL` returns all 27 non-insurance deadlines with non-null values
- `recommended_actions` column contains valid JSON array strings for all deadlines with workflows
- Insurance renewal has `workflowType = null` (no workflow — external vendor action)

---

## Phase 2a: TaxBandits Integration + Cluster A (Tax Filing)

### Overview
Build the TaxBandits API client (W-2, 1099-NEC, 941 e-filing), then implement all 6 Cluster A workflow configurations. Each configuration is a `WorkflowConfig` object exported from a per-workflow file and the checklist auto-checks are implemented as real DB queries.

---

### Task 2a-1: Create TaxBandits API client

**What:** A typed API client for TaxBandits REST API covering business creation, W-2 filing, 1099-NEC filing, and 941 filing endpoints.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/taxbandits/client.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/taxbandits/types.ts`

**Implementation notes:**
- Base URL from env: `TAXBANDITS_API_URL` (sandbox: `https://testapi.taxbandits.com/v1.7.1`, production: `https://api.taxbandits.com/v1.7.1`)
- Auth: OAuth2 client credentials flow using `TAXBANDITS_CLIENT_ID` and `TAXBANDITS_CLIENT_SECRET` env vars
- Token caching: store access token in module-level variable with expiry check
- Core methods:
  - `createBusiness(data: TaxBanditsBusinessPayload): Promise<TaxBanditsBusinessResponse>`
  - `submitW2(data: TaxBanditsW2Payload): Promise<TaxBanditsSubmissionResponse>`
  - `submitForm1099NEC(data: TaxBandits1099NECPayload): Promise<TaxBanditsSubmissionResponse>`
  - `submitForm941(data: TaxBandits941Payload): Promise<TaxBanditsSubmissionResponse>`
  - `getSubmissionStatus(submissionId: string): Promise<TaxBanditsStatusResponse>`
- Error handling: throw typed `TaxBanditsApiError` with `statusCode`, `message`, `errors[]`

**Environment variables to add (documented in script, not set here):**
- `TAXBANDITS_CLIENT_ID`
- `TAXBANDITS_CLIENT_SECRET`
- `TAXBANDITS_API_URL`

**AC:**
- Client compiles with no TypeScript errors
- Token refresh logic: new token fetched automatically when expired (check `expires_in`)
- All methods accept typed payloads matching TaxBandits API v1.7.1 documentation
- Sandbox URL used when `NODE_ENV !== 'production'`
- No credentials hardcoded

---

### Task 2a-2: Create AI scan server action endpoint

**What:** API route that takes a `deadlineId` and `workflowType`, fetches relevant financial data, and streams an AI compliance brief back to the client.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/api/compliance/scan/route.ts`

**Implementation notes:**
- `POST` handler; request body: `{ deadlineId: number, workflowType: string }`
- Data fetching: based on `workflowType`, run the appropriate data queries (payroll for tax forms, funds for grant reports, etc.)
- Use Anthropic client (already in codebase — follow existing copilot pattern at `src/lib/copilot/`)
- Return a non-streamed JSON response for Phase 2a: `{ content: string, citations: Citation[] }`
- Streamed response can be added in a later iteration
- Prompt template: pre-baked per workflow type, imported from the workflow config

**AC:**
- Route returns 200 with `{ content: string, citations: Citation[] }` on success
- Route returns 400 if `workflowType` is unknown
- Content is plain text (no markdown) suitable for rendering in `AIScanStep`
- Response includes populated `citations` array matching `Citation` type

---

### Task 2a-3: Create Form 990 workflow configuration

**What:** Export a `WorkflowConfig` for `tax_form_990` with all checklist items, scan prompt, draft generator reference, and delivery config. Draft generator produces a data report matching IRS PDF field order (decision D11, D12).

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-form-990.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/generators/generate-990-report.ts`

**Workflow config — checklist items:**
- Auto: Trial balance for fiscal year exists in DB (`transactions` with date in FY)
- Auto: All accounts reconciled for FY (no unreconciled bank sessions)
- Manual: "All officer compensation amounts reviewed and confirmed?" (`requiresExplanation: true`)
- Manual: "Part VII compensation table prepared and verified?" (`requiresExplanation: false`)
- Manual: "Schedule O narratives drafted for any required explanations?" (`requiresExplanation: true`)

**Draft generator (`generate-990-report.ts`):**
- Queries: trial balance, payroll totals by employee, fund revenue/expense breakdown, functional allocation percentages
- Output: PDF with sections exactly matching IRS Form 990:
  - Part I: Summary (Revenue, Expenses, Net Assets)
  - Part VII: Compensation (officer names, title, hours, reportable comp, other comp)
  - Part VIII: Statement of Revenue (Lines 1a–1h, Lines 2–8, Lines 9–12)
  - Part IX: Statement of Functional Expenses (columns: Program, Management, Fundraising)
  - Notes section: data-to-IRS-line mapping guide for manual transcription
- PDF generated using a library already in the project or `@react-pdf/renderer` (check existing usage first)

**AC:**
- Config exports `WorkflowConfig` with all required fields populated
- `requiresWarningDialog: true` (990 is a serious item per D7)
- Auto-checks return boolean results from real DB queries
- 990 data report includes a "How to transfer to IRS form" guide page at the end
- `blobPrefix: 'compliance-artifacts/990/'`

---

### Task 2a-4: Create W-2 filing workflow configuration

**What:** Export a `WorkflowConfig` for `tax_w2` that drives checklist → AI review → W-2 package generation → TaxBandits e-filing.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-w2.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/generators/generate-w2-package.ts`

**Checklist items:**
- Auto: Payroll runs exist for all 12 months of calendar year
- Auto: All payroll entries have GL transactions posted
- Manual: "All employee SSNs verified?" (`requiresExplanation: false`)
- Manual: "Payroll reconciled to GL for full calendar year?" (`requiresExplanation: true`)
- Manual: "W-9s on file for all employees?" (`requiresExplanation: false`)

**Draft generator:**
- Pull all `payrollEntries` for calendar year joined to `payrollRuns`
- Produce per-employee W-2 data: Box 1 (wages), Box 2 (federal withholding), Box 3/4 (SS wages/tax), Box 5/6 (Medicare wages/tax), Box 16/17 (state wages/withholding)
- Generate employer verification summary PDF (Copy D retained by employer)

**Delivery:**
- Call `taxBanditsClient.submitW2(payload)` for each employee
- Store submission ID in artifact `data` field
- `blobPrefix: 'compliance-artifacts/w2/'`

**AC:**
- `requiresWarningDialog: true`
- Delivery step calls TaxBandits API in sandbox mode during dev
- W-2 data pulls from `payrollEntries` joined to `payrollRuns` via Drizzle query
- Federal + MA state boxes populated

---

### Task 2a-5: Create 1099-NEC filing workflow configuration

**What:** Export a `WorkflowConfig` for `tax_1099_nec` with TaxBandits delivery.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-1099-nec.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/generators/generate-1099-package.ts`

**Checklist items:**
- Auto: At least one vendor with `w9Status = 'COLLECTED'` and payments ≥ $600 in calendar year
- Auto: All qualifying vendor transactions posted
- Manual: "All vendor tax IDs (W-9s) collected for vendors paid ≥ $600?" (`requiresExplanation: true`)
- Manual: "Non-employee compensation amounts verified against vendor payments?" (`requiresExplanation: false`)

**Draft generator:**
- Call `getVendorById()` to decrypt tax IDs (uses `decryptVendorTaxId()`)
- Query `transactionLines` joined to `vendors` for payments ≥ $600 in year
- Generate 1099-NEC data package with Box 1 (nonemployee comp) per vendor
- Produce Copy B/C PDFs for vendor records

**Delivery:**
- Call `taxBanditsClient.submitForm1099NEC(payload)` per vendor
- `blobPrefix: 'compliance-artifacts/1099-nec/'`

**AC:**
- Auto-check uses real query: `SELECT SUM(amount) FROM transaction_lines JOIN transactions ... WHERE vendor_id = X AND fiscal_year = Y`
- Tax ID decryption via existing `decryptVendorTaxId()` — no plaintext tax IDs in logs
- `requiresWarningDialog: true`

---

### Task 2a-6: Create Federal 941 and MA M-941 workflow configurations

**What:** One config each for `tax_941` (TaxBandits e-filing) and `tax_m941` (data report + manual portal). Both parameterized by quarter.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-941.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-m941.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/generators/generate-941-report.ts`

**941 checklist items:**
- Auto: Payroll runs for all 3 months of quarter exist
- Auto: All payroll entries have GL transactions posted
- Manual: "Payroll deposits made on schedule (semi-weekly/monthly)?" (`requiresExplanation: true`)
- Manual: "Reconciled to prior quarter's Form 941 if applicable?" (`requiresExplanation: true`)

**941 draft:**
- Line 1: Number of employees
- Line 2: Wages, tips, other compensation
- Line 3: Federal income tax withheld
- Lines 5a–5e: Taxable SS/Medicare wages and tax
- Line 6: Total taxes before adjustments
- TaxBandits delivery for 941; data report PDF for M-941 (manual MassTaxConnect)

**M-941 delivery:**
- Generate PDF data report formatted for MassTaxConnect entry (decision D14)
- Include "Filing Instructions" page with step-by-step MassTaxConnect navigation
- `blobPrefix: 'compliance-artifacts/m941/'`

**AC:**
- Quarter is inferred from the deadline `taskName` (Q1/Q2/Q3/Q4)
- `requiresWarningDialog: false` for 941/M-941
- M-941 delivery does NOT call TaxBandits (data report only)
- 941 delivery calls `taxBanditsClient.submitForm941()`

---

### Task 2a-7: Create Form PC workflow configuration

**What:** Simplified 2-step workflow (decision D13) — checklist + data summary only. No AI scan step, no TaxBandits.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tax-form-pc.ts`

**Implementation:** Form PC is a simplified variant — the `WorkflowPipeline` must support a 2-step variant. Add `simplified: true` flag to `WorkflowConfig`. When `simplified: true`, skip the scan step (Checklist → Draft → Delivery directly).

**Checklist items:**
- Manual: "Annual report filed with IRS (990 delivered)?" (`requiresExplanation: false`)
- Manual: "MA charitable registration current?" (`requiresExplanation: false`)
- Manual: "Gross support and revenue amounts calculated?" (`requiresExplanation: false`)

**Draft:** PDF summary matching AG Form PC data fields (organization info, financial summary, program description lines). Include "Filing Instructions" page for MA Secretary of State portal.

**AC:**
- `simplified: true` in config causes pipeline to show only 3 steps (Checklist, Draft, Delivery) — step indicator updates accordingly
- `requiresWarningDialog: false`
- `blobPrefix: 'compliance-artifacts/form-pc/'`

---

## Phase 2b: Clusters B–E Workflow Configs

### Overview
Implement workflow configurations for all remaining clusters: B (annual reviews and attestations), C (budget cycle), D (grant reporting), E (tenant deposit). No new external API integrations — these workflows use internal data and generate PDFs/DOCX artifacts.

---

### Task 2b-1: Create Cluster B workflow configurations (7 workflows)

**What:** Seven `WorkflowConfig` objects for the annual reviews and attestations cluster.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-officer-comp.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-coi.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-in-kind.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-ubit.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-public-support.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-functional-allocation.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/annual-review-tax-rates.ts`

**Key decisions per workflow:**
- **Officer comp (WF-B1):** AI scan section includes direct link to Open990.org for manual comparability lookup; no API call. Draft: board resolution in DOCX format. Delivery: DOCX to blob. `requiresWarningDialog: false`.
- **COI attestation (WF-B2):** Manual check: "I confirm that all board members and officers have disclosed any potential conflicts of interest." Org-wide, single attestation. Draft: signed attestation record PDF. `requiresWarningDialog: false`.
- **In-kind review:** Auto-check: in-kind donation transactions exist in FY. AI scan: verify ASC 958-605 compliance. Draft: in-kind summary report PDF. `requiresWarningDialog: false`.
- **UBIT review (WF-B5):** AI scan performs shallow scan only — flags potential exposure against IRC §512-514. If no exposure found, draft is a "No UBIT Exposure" memo PDF. No Schedule M unless exposure found. `requiresWarningDialog: false`.
- **Public support (WF-B3):** AI scan projects through FY2029 only. Draft: trajectory report PDF with public support percentage per year and 33% threshold line. `requiresWarningDialog: false`.
- **Functional allocation:** Auto-check: functional allocations set for current FY. Draft: allocation summary PDF with percentage breakdown by program/management/fundraising per account. `requiresWarningDialog: false`.
- **Tax rate review (WF-B4):** AI scan pulls current SSA wage base announcement. Draft: proposed rate table. Delivery: rate table PDF AND system update applied to `annualRateConfig` table after user approval. `requiresWarningDialog: false`.

**AC:**
- All 7 configs export valid `WorkflowConfig` objects
- Tax rate review `generatorFn` is `'generate-tax-rate-review'` which also updates `annual_rate_config` table on delivery
- Officer comp draft produces DOCX (`artifactType: 'docx'`); all others produce PDF
- COI attestation `cluster: 'B'`; logged per D8

---

### Task 2b-2: Create Cluster C workflow configurations (4 workflows)

**What:** Four `WorkflowConfig` objects for the budget cycle.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/budget-draft.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/budget-circulation.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/budget-approval.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/budget-quarterly-board-prep.ts`

**Key decisions:**
- **Budget draft (WF-C1):** Auto-check: current year actuals available through at least 6 months. Draft generator: pulls `budgetLines` for current FY and `transactionLines` for actuals, annualizes actuals, outputs next-FY budget CSV. `artifactType: 'csv'`.
- **Board circulation:** Manual: "ED has reviewed and approved budget draft?" Draft: board pack PDF (summary + budget). `requiresWarningDialog: false`.
- **Budget approval:** Draft: board resolution DOCX per WF-C3. Manual: "Board quorum present at meeting?" `requiresWarningDialog: false`.
- **Quarterly board prep (WF-C2):** Manual trigger only — no auto-advance. Draft: board pack PDF with variance highlights and cash position. Quarter inferred from deadline `taskName`. `requiresWarningDialog: false`.

**AC:**
- Budget draft `artifactType: 'csv'`; board approval `artifactType: 'docx'`; others `artifactType: 'pdf'`
- Quarterly board prep `simplified: false` (full 4-step)
- `blobPrefix` per workflow: `'compliance-artifacts/budget-draft/'`, `'compliance-artifacts/budget-resolution/'`, etc.

---

### Task 2b-3: Create Cluster D workflow configurations (4 workflow types)

**What:** Four `WorkflowConfig` objects covering grant report, close-out, milestone, and annual grant compliance review. Fund-specific context injected at runtime.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/grant-report.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/grant-closeout.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/grant-milestone.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/grant-annual-review.ts`

**Key decisions:**
- **Grant report (WF-D1):** Auto-check: fund transactions for reporting period exist, drawdown calculated. Draft: fund-level P&L for period (revenue, expenses by account, beginning/ending balance). Standard format — user reformats for funder portal. `requiresWarningDialog: false`.
- **Grant close-out (WF-D2):** Draft: final expenditure vs budget, remaining balance, unspent funds to return. Financial summary only — no narrative template. `requiresWarningDialog: false`.
- **Grant milestone:** Manual: "Milestone deliverable completed and documented?" Draft: progress report PDF. `requiresWarningDialog: false`.
- **Annual grant compliance review:** Auto-check: all active funds have complete transaction records for FY. AI scan: expenditure compliance against restrictions for each fund. `requiresWarningDialog: false`.

**Fund context injection:** The `WorkflowPipelineHost` passes `fundId` (from `deadline.fundId`) to the generator function at runtime so fund-specific data is pulled.

**AC:**
- All 4 configs handle null `fundId` gracefully (render "No fund linked" message in checklist)
- Grant report P&L matches the fund-level P&L format used elsewhere in the system
- `blobPrefix` includes fund name slug: `'compliance-artifacts/grant-reports/{fundId}/'`

---

### Task 2b-4: Create Cluster E workflow configuration (1 workflow)

**What:** Single `WorkflowConfig` for `tenant_deposit` — security deposit interest calculation with auto AP creation.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflows/tenant-deposit.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/generators/generate-deposit-interest.ts`

**Checklist items:**
- Auto: Tenant record exists with `depositAmount` > 0
- Auto: `tenancyAnniversary` date falls within 30 days
- Auto: MA interest rate (3%) available in `annualRateConfig`
- Manual: "Tenant still in occupancy?" (`requiresExplanation: true`)

**Draft generator:**
- Query: `SELECT deposit_amount, tenancy_anniversary FROM tenants WHERE id = X`
- Calculate: `interestOwed = depositAmount * 0.03` (flat MA statutory rate)
- Verify against `securityDepositInterestPayments` for prior year (no double-pay)
- Draft: interest payment record PDF with calculation breakdown showing deposit amount × 3% = interest owed

**Delivery — auto-create AP payable (decision WF-E1):**
- On `recordArtifactDelivery`, also insert into `invoices` table: payable to tenant (vendor), amount = `interestOwed`, status `PENDING`, fundId from deposit fund
- Log the invoice creation in workflow log `data` field: `{ invoiceId: X }`

**AC:**
- Auto-check for occupancy uses `isReminder` field if available; else auto-check passes (manual check handles it)
- Interest calculation uses 3% flat rate (statutory MA rate — no configurable lookup in Phase 2)
- AP payable created in `invoices` table on delivery with correct amount
- `requiresWarningDialog: false`
- `blobPrefix: 'compliance-artifacts/tenant-deposit/{tenantId}/'`

---

### Task 2b-5: Create workflow config registry

**What:** A registry module that maps `workflowType` strings to their `WorkflowConfig` objects — used by `WorkflowPipelineHost` and the scan API route.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/compliance/workflow-registry.ts`

**Implementation:**
```typescript
import type { WorkflowConfig } from './workflow-types'
import { form990Config } from './workflows/tax-form-990'
import { formPCConfig } from './workflows/tax-form-pc'
// ... all 20 configs

const registry: Record<string, WorkflowConfig> = {
  tax_form_990: form990Config,
  tax_form_pc: formPCConfig,
  tax_w2: w2Config,
  // ...
}

export function getWorkflowConfig(workflowType: string): WorkflowConfig | null {
  return registry[workflowType] ?? null
}
```

**AC:**
- All 13 `workflowType` enum values are represented in the registry
- `getWorkflowConfig('unknown')` returns `null` without throwing
- Registry is a pure data module — no DB calls

---

## Phase 3: Google Calendar Sync

### Overview
Wire financial-system as the authoritative publisher to a dedicated Google Calendar. Manual prerequisite: Google Cloud project setup. Then build the sync engine, reminder row generation, webhook endpoint, renewal cron, and embedded iframe view.

---

### Task 3-1: Google Cloud setup (manual prerequisite)

**What:** Document the manual Google Cloud steps required before any code can run.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/docs/google-calendar-setup.md`

**Steps to document:**
1. Create Google Cloud project `renewal-initiatives-financial-system`
2. Enable Google Calendar API
3. Create service account `compliance-calendar-sync@renewal-initiatives-financial-system.iam.gserviceaccount.com`
4. Download JSON key → store as `GOOGLE_SERVICE_ACCOUNT_KEY` env var (base64-encoded)
5. Create calendar `renewal-initiatives-compliance` in a Google Workspace admin account
6. Share calendar with service account (Make Changes to Events permission)
7. Copy Calendar ID → store as `GOOGLE_CALENDAR_ID` env var
8. Add both env vars to Vercel (production, preview, development)

**AC:**
- Doc lists all steps in order with exact field values to use
- Includes `printf '%s' "$(cat service-account-key.json | base64)" | vercel env add GOOGLE_SERVICE_ACCOUNT_KEY production` (using `printf` per global CLAUDE.md rule)

---

### Task 3-2: Create Google Calendar API client

**What:** Typed wrapper around the Google Calendar REST API using the service account credentials.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/google-calendar/client.ts`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/google-calendar/types.ts`

**Implementation notes:**
- Use `googleapis` npm package (or `google-auth-library` + raw fetch — check if `googleapis` is already installed)
- Auth: `google.auth.GoogleAuth` with `keyFile` = parsed `GOOGLE_SERVICE_ACCOUNT_KEY` env var (base64 decode → JSON parse)
- Scopes: `['https://www.googleapis.com/auth/calendar']`
- Core methods:
  - `createEvent(calendarId: string, event: GoogleCalendarEvent): Promise<string>` — returns `eventId`
  - `updateEvent(calendarId: string, eventId: string, event: GoogleCalendarEvent): Promise<void>`
  - `deleteEvent(calendarId: string, eventId: string): Promise<void>`
  - `createWebhookSubscription(calendarId: string, webhookUrl: string): Promise<{ channelId: string; resourceId: string; expiration: number }>`
  - `stopWebhookSubscription(channelId: string, resourceId: string): Promise<void>`

**AC:**
- No credentials stored in code — all from env vars
- `GOOGLE_CALENDAR_ID` env var drives the target calendar
- If `GOOGLE_SERVICE_ACCOUNT_KEY` is undefined, client throws a descriptive error at initialization time
- Types file exports `GoogleCalendarEvent` with `summary`, `description`, `start`, `end`, `source` (url + title)

---

### Task 3-3: Create sync engine

**What:** Server-side sync function that reads compliance deadlines and creates/updates/deletes Google Calendar events, storing the resulting `googleEventId` back on each row.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/google-calendar/sync-engine.ts`

**Implementation:**
```typescript
export async function syncComplianceCalendar(): Promise<{ created: number; updated: number; deleted: number }>
```

Logic:
1. Fetch all non-reminder compliance deadlines where `status != 'completed'` from DB
2. For each deadline:
   - Build event: `summary = deadline.taskName`, `description = [legalCitation, referenceUrl, recommendedActions].filter(Boolean).join('\n')`, `start/end = dueDate` (all-day), `source.url = 'https://finance.renewalinitiatives.org'`
   - If `googleEventId` is null: `createEvent()`, store returned ID
   - If `googleEventId` is set: `updateEvent()` with current data
3. Fetch all Google Calendar events; delete any whose ID is not in our DB (orphan cleanup)

**AC:**
- `syncComplianceCalendar()` is idempotent — calling twice doesn't duplicate events
- Stores `googleEventId` back to DB via `UPDATE compliance_deadlines SET google_event_id = ?`
- Skips deadlines with `isReminder = true` (handled by reminder generation, Task 3-4)
- Returns counts for observability

---

### Task 3-4: Reminder event generation

**What:** For each non-reminder deadline, generate a companion "reminder" row in `compliance_deadlines` dated 14 days prior, with `isReminder = true` and `parentDeadlineId` set. Sync the reminder row to Google Calendar as a separate event.

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/lib/google-calendar/sync-engine.ts`

**Implementation:**
- New function: `generateReminderRows(): Promise<{ created: number; skipped: number }>`
- For each parent deadline:
  - Compute `reminderDate = dueDate - 14 days`
  - Check for existing reminder row with `parentDeadlineId = parent.id AND isReminder = true`
  - If not exists: insert reminder row with `taskName = "REMINDER: {parent.taskName}"`, `isReminder = true`, `parentDeadlineId = parent.id`
- `syncComplianceCalendar()` includes reminder rows in its sync pass
- Store reminder's Google Event ID in parent's `googleReminderEventId` column

**AC:**
- Reminder rows appear in the compliance calendar list view with a "Reminder" badge (based on `isReminder = true`)
- Reminder rows are filtered out from workflow tab (no workflow for reminder rows)
- Running `generateReminderRows()` twice doesn't create duplicate reminder rows

---

### Task 3-5: Webhook endpoint for reverse sync

**What:** POST endpoint that receives Google Calendar push notifications and syncs changes back to financial-system DB.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/api/webhooks/google-calendar/route.ts`

**Implementation:**
- POST handler (GET handler returns 200 for Google health check)
- Validate `X-Goog-Channel-Token` header against `GOOGLE_WEBHOOK_SECRET` env var
- Validate `X-Goog-Resource-State` header: `'sync'` → return 200, `'exists'` → process
- On `exists`: pull changed event from Calendar API, update the matching deadline by `google_event_id` lookup
- Fields that financial-system accepts from Google: none (financial-system is authoritative per D3) — log the notification and ignore content; only used to detect manual deletions
- If event was deleted in Google: mark deadline `status = 'reminded'` (not completed)

**AC:**
- Endpoint returns 200 immediately (Google requires fast response)
- `GOOGLE_WEBHOOK_SECRET` mismatch → returns 401 without processing
- No writes to DB if financial-system is already authoritative (event updates from Google are ignored)
- Deletion events are logged to console with deadline ID for observability

---

### Task 3-6: Webhook renewal cron

**What:** A scheduled job that renews the Google Calendar webhook subscription before it expires (Google webhooks expire after 7 days max).

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/api/cron/renew-google-calendar-webhook/route.ts`

**Implementation:**
- GET handler with `Authorization: Bearer {CRON_SECRET}` header validation
- Calls `googleCalendarClient.stopWebhookSubscription()` for current channel (stored in env/DB)
- Calls `googleCalendarClient.createWebhookSubscription(calendarId, webhookUrl)` for new subscription
- Stores new `channelId` and `resourceId` (simple approach: env vars updated via Vercel API, or store in a config table)
- Vercel cron: `schedule: "0 0 * * 1"` (Monday midnight — 7-day cycle)

**Vercel cron config to add to `vercel.json`:**
```json
{
  "crons": [
    {
      "path": "/api/cron/renew-google-calendar-webhook",
      "schedule": "0 0 * * 1"
    }
  ]
}
```

**AC:**
- Cron protected by `CRON_SECRET` header check
- New subscription registered before old one expires
- Returns `{ success: true, channelId, expiration }` on success

---

### Task 3-7: Embedded calendar view toggle

**What:** Add a "Calendar View" toggle button to `ComplianceCalendarClient` that shows an embedded Google Calendar iframe as an alternate to the data table.

**Files:**
- MODIFY `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/compliance-calendar-client.tsx`

**Implementation:**
- Add `view: 'list' | 'calendar'` state, default `'list'`
- Add toggle buttons (use `<Button variant="outline">` with icons) in the header bar: "List View" | "Calendar View"
- When `view === 'calendar'`: render `<iframe src={googleCalendarEmbedUrl} className="w-full h-[600px] rounded-md border" />`
- `googleCalendarEmbedUrl`: `https://calendar.google.com/calendar/embed?src={GOOGLE_CALENDAR_ID}&ctz=America%2FNew_York&mode=MONTH&showTitle=0&showNav=1&showPrint=0&showTabs=0&showCalendars=0`
- Calendar ID passed from server component as a prop (read from `GOOGLE_CALENDAR_ID` env var in `page.tsx`)
- When `view === 'list'`: existing table renders as before

**AC:**
- Toggle buttons show correct active state
- iframe renders at full width with `h-[600px]`
- Calendar ID not hardcoded — sourced from env var via server component prop
- `data-testid="compliance-view-toggle-list"` and `data-testid="compliance-view-toggle-calendar"` on buttons

---

## Phase 4: Admin & Artifact Retrieval

### Overview
A protected admin route at `/compliance/admin` with three panels: artifact browser (by year/type), workflow log viewer (per deadline), and re-download links. All data served via server actions; page is a React Server Component.

---

### Task 4-1: Create compliance admin page (RSC)

**What:** Server component page at `/compliance/admin` that fetches artifact and log data and passes to client component.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/admin/page.tsx`
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/admin/admin-actions.ts`

**Admin actions:**
```typescript
// admin-actions.ts
'use server'

export async function getArtifactsByYear(year: number) {
  // JOIN compliance_artifacts + compliance_deadlines
  // Filter by EXTRACT(year FROM created_at) = year
  // Return: id, deadlineId, taskName, artifactType, blobUrl, fileName, fileSize, createdBy, createdAt
}

export async function getWorkflowLogsByDeadline(deadlineId: number) {
  // SELECT * FROM compliance_workflow_logs WHERE deadline_id = X ORDER BY created_at
}

export async function getAllArtifactYears(): Promise<number[]> {
  // SELECT DISTINCT EXTRACT(year FROM created_at) FROM compliance_artifacts ORDER BY 1 DESC
}
```

**Page:**
```typescript
// page.tsx
export default async function ComplianceAdminPage() {
  const currentYear = new Date().getFullYear()
  const years = await getAllArtifactYears()
  const artifacts = await getArtifactsByYear(currentYear)
  return <ComplianceAdminClient initialArtifacts={artifacts} years={years} initialYear={currentYear} />
}
```

**AC:**
- Page renders as RSC — no `'use client'` on page.tsx
- `getArtifactsByYear` query uses Drizzle join (not raw SQL)
- Admin page accessible at `/compliance/admin`

---

### Task 4-2: Create `ComplianceAdminClient` component

**What:** Client component with three sections: year selector + artifact table, deadline selector + log viewer, re-download buttons.

**Files:**
- CREATE `/Users/jefftakle/Desktop/Claude/financial-system/src/app/(protected)/compliance/admin/compliance-admin-client.tsx`

**Section 1 — Artifact Browser:**
- Year `<Select>` that refetches via server action on change
- Table columns: Task Name, Artifact Type, File Name, File Size (formatted KB/MB), Created By, Created At, Download button
- Download button: `<a href={blobUrl} download={fileName}>` styled as `<Button size="sm" variant="outline">`

**Section 2 — Workflow Log Viewer:**
- Deadline selector: `<Select>` populated with unique `taskName` values from artifacts
- On selection: fetch logs via `getWorkflowLogsByDeadline(deadlineId)`
- Log table: Step, Action, User ID, Timestamp, Data (JSON pretty-printed in `<pre>`)

**Section 3 — Summary Stats:**
- Total artifacts this year
- Total workflows completed this year
- Most recent delivery timestamp

**AC:**
- Year change triggers server action call and updates artifact table without full page reload
- Log JSON data rendered in `<pre className="text-xs bg-muted rounded p-2 max-h-32 overflow-auto">`
- File size formatted: < 1024 bytes → "X B"; < 1MB → "X KB"; else → "X.X MB"
- `data-testid="admin-artifact-table"`, `data-testid="admin-log-viewer"` on respective sections
- Re-download links use blob URLs directly — no server proxy needed (Vercel Blob URLs are public by default, or use signed URLs if private)

---

### Task 4-3: Add admin nav link

**What:** Add "Compliance Admin" link to the compliance section of the navigation.

**Files:**
- MODIFY the navigation component (locate via `Glob src/**/nav*.tsx` or `sidebar*.tsx`)

**Implementation:**
- Add link `href="/compliance/admin"` with label "Compliance Admin" beneath the existing Compliance Calendar link
- Use same nav item styling pattern as adjacent links

**AC:**
- Link appears in nav under Compliance section
- Active state highlights when on `/compliance/admin`
- `data-testid="nav-compliance-admin"` on the link element

---

## Cross-Cutting Concerns

### File Organization Summary

```
src/
  lib/
    compliance/
      workflow-types.ts              (1b-1)
      workflow-registry.ts           (2b-5)
      workflows/
        tax-form-990.ts              (2a-3)
        tax-form-pc.ts               (2a-7)
        tax-w2.ts                    (2a-4)
        tax-1099-nec.ts              (2a-5)
        tax-941.ts                   (2a-6)
        tax-m941.ts                  (2a-6)
        annual-review-officer-comp.ts  (2b-1)
        annual-review-coi.ts           (2b-1)
        annual-review-in-kind.ts       (2b-1)
        annual-review-ubit.ts          (2b-1)
        annual-review-public-support.ts (2b-1)
        annual-review-functional-allocation.ts (2b-1)
        annual-review-tax-rates.ts     (2b-1)
        budget-draft.ts                (2b-2)
        budget-circulation.ts          (2b-2)
        budget-approval.ts             (2b-2)
        budget-quarterly-board-prep.ts (2b-2)
        grant-report.ts                (2b-3)
        grant-closeout.ts              (2b-3)
        grant-milestone.ts             (2b-3)
        grant-annual-review.ts         (2b-3)
        tenant-deposit.ts              (2b-4)
      generators/
        generate-990-report.ts         (2a-3)
        generate-w2-package.ts         (2a-4)
        generate-1099-package.ts       (2a-5)
        generate-941-report.ts         (2a-6)
        generate-deposit-interest.ts   (2b-4)
    taxbandits/
      client.ts                      (2a-1)
      types.ts                       (2a-1)
    google-calendar/
      client.ts                      (3-2)
      types.ts                       (3-2)
      sync-engine.ts                 (3-3, 3-4)
    db/
      schema/
        compliance-workflow-logs.ts  (1a-3)
        compliance-artifacts.ts      (1a-4)
  components/
    compliance/
      workflow/
        workflow-pipeline.tsx        (1b-6)
        checklist-step.tsx           (1b-2)
        ai-scan-step.tsx             (1b-3)
        draft-step.tsx               (1b-4)
        delivery-step.tsx            (1b-5)
        index.ts                     (1b-7)
  app/
    (protected)/
      compliance/
        workflow-actions.ts          (1c-1)
        compliance-detail-sheet.tsx  (1c-2)
        workflow-pipeline-host.tsx   (1c-3)
        admin/
          page.tsx                   (4-1)
          admin-actions.ts           (4-1)
          compliance-admin-client.tsx (4-2)
    api/
      compliance/
        scan/
          route.ts                   (2a-2)
      webhooks/
        google-calendar/
          route.ts                   (3-5)
      cron/
        renew-google-calendar-webhook/
          route.ts                   (3-6)
drizzle/
  0024_compliance_workflow_engine.sql (1a-6)
scripts/
  populate-compliance-metadata.ts    (1c-6)
docs/
  google-calendar-setup.md           (3-1)
```

### Environment Variables Added by Phase

| Phase | Variable | Where Set |
|-------|----------|-----------|
| 2a | `TAXBANDITS_CLIENT_ID` | Vercel (all 3 envs) |
| 2a | `TAXBANDITS_CLIENT_SECRET` | Vercel (all 3 envs) |
| 2a | `TAXBANDITS_API_URL` | Vercel (production uses prod URL; preview/dev use sandbox) |
| 3 | `GOOGLE_SERVICE_ACCOUNT_KEY` | Vercel (all 3 envs) |
| 3 | `GOOGLE_CALENDAR_ID` | Vercel (all 3 envs) |
| 3 | `GOOGLE_WEBHOOK_SECRET` | Vercel (all 3 envs) |
| 3 | `CRON_SECRET` | Vercel (already set if other crons exist) |

### Phase Sequencing

```
Phase 1a (Schema) → must be applied to DB before any other phase
Phase 1b (Components) → can start in parallel with 1a (no DB calls in components)
Phase 1c (Integration) → requires 1a (DB) and 1b (components) complete
Phase 2a (TaxBandits + Cluster A) → requires 1c complete; TaxBandits API registration needed
Phase 2b (Clusters B–E) → can parallelize with 2a after 1c complete
Phase 3 (Google Calendar) → requires 1a complete; Google Cloud setup manual prerequisite
Phase 4 (Admin) → requires 1a and Phase 2 (artifacts need to exist for meaningful testing)
```
