# Naming Conventions

Claude: Read this before generating UI components, API routes, or tests.

## UI Foundations

- **Accessibility:** WCAG AA / Section 508 baseline
- **Reference site:** renewal-timesheets (forest green theme, spacing, typography)
- **Component library:** shadcn/ui (New York style) + TanStack Table for data tables
- **Color scheme:** Light/dark/system (via next-themes)
- **Icons:** Lucide React only

---

## REQUIRED: Test IDs

Every interactive element MUST have a `data-testid` attribute. Playwright E2E tests depend on these.

```
Pattern: data-testid="[page]-[element]-[qualifier]"

Examples:
  data-testid="journal-entry-form"
  data-testid="journal-entry-submit-btn"
  data-testid="journal-entry-date-input"
  data-testid="accounts-table"
  data-testid="accounts-table-row-1001"
  data-testid="bank-rec-match-btn"
  data-testid="bank-rec-split-btn"
  data-testid="ramp-categorize-btn"
  data-testid="dashboard-cash-widget"
  data-testid="report-export-pdf-btn"
  data-testid="report-export-csv-btn"
  data-testid="copilot-panel"
  data-testid="copilot-input"
  data-testid="fund-select"
  data-testid="account-select"

NOT: data-testid="btn1"
NOT: data-testid="submit"
NOT: data-testid="table"
NOT: testId="..." (wrong attribute name)
```

---

## REQUIRED: Modal Props

All modals/dialogs follow this interface:

```typescript
interface ModalProps {
  open: boolean;
  onClose: () => void;           // NOT: onDismiss, onCancel, handleClose
  onSubmit?: (data: T) => void;  // NOT: onSave, onConfirm, handleSubmit
  title: string;
}

// NOT: isOpen (use "open")
// NOT: visible (use "open")
// NOT: show/hide (use "open/onClose")
```

---

## REQUIRED: Error State

```typescript
// Page/form-level error
const [error, setError] = useState<string | null>(null);
// NOT: errorMessage, errMsg, errorText

// Field-level errors
const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
// NOT: errors, formErrors, validationErrors

// API response errors
type ApiResponse<T> = { data: T } | { error: string };
// NOT: { message: string }, { err: string }
```

---

## REQUIRED: Date/Timestamp Fields

```
Database columns (Drizzle schema):
  created_at    — record creation timestamp
  updated_at    — last modification timestamp
  deleted_at    — soft delete timestamp (nullable)
  *_date        — business dates (transaction_date, due_date, start_date, end_date)

  NOT: createdAt (DB columns are snake_case)
  NOT: *_at for business dates (use *_date)
  NOT: *_date for system timestamps (use *_at)

TypeScript properties:
  createdAt     — camelCase in application code
  transactionDate
  dueDate

  NOT: created_at in TypeScript (snake_case is DB only)
```

---

## Naming Patterns

| Context | Convention | Example | NOT |
|---------|-----------|---------|-----|
| **React components** | PascalCase | `JournalEntryForm` | `journalEntryForm`, `journal-entry-form` |
| **Component files** | kebab-case | `journal-entry-form.tsx` | `JournalEntryForm.tsx`, `journalEntryForm.tsx` |
| **React hooks** | camelCase, `use` prefix | `useAccounts()`, `useTransactions()` | `getAccounts()`, `fetchAccounts()` |
| **Hook files** | kebab-case, `use-` prefix | `use-accounts.ts` | `useAccounts.ts` |
| **API routes** | kebab-case directories | `app/api/bank-rec/route.ts` | `app/api/bankRec/route.ts` |
| **API handler exports** | uppercase HTTP method | `export async function GET()` | `export async function get()` |
| **Server actions** | camelCase, verb-first | `createTransaction()`, `voidTransaction()` | `transactionCreate()`, `handleCreate()` |
| **DB table names** | snake_case, plural | `transactions`, `transaction_lines` | `Transaction`, `transactionLines` |
| **DB column names** | snake_case | `account_id`, `fund_id`, `is_voided` | `accountId`, `fundId`, `isVoided` |
| **TypeScript interfaces** | PascalCase | `Transaction`, `TransactionLine` | `ITransaction`, `TransactionInterface` |
| **TypeScript enums/unions** | SCREAMING_SNAKE for values | `'MANUAL' \| 'RAMP' \| 'SYSTEM'` | `'manual'`, `'Manual'` |
| **Zod schemas** | camelCase + `Schema` suffix | `transactionSchema`, `accountSchema` | `TransactionSchema`, `transactionValidator` |
| **Test files** | `*.test.ts(x)` co-located | `gl-engine.test.ts` | `gl-engine.spec.ts`, `__tests__/gl-engine.ts` |
| **E2E test files** | `*.spec.ts` in `/e2e` | `e2e/journal-entry.spec.ts` | `e2e/journal-entry.test.ts` |
| **Environment variables** | SCREAMING_SNAKE | `DATABASE_URL`, `PLAID_CLIENT_ID` | `databaseUrl`, `plaid-client-id` |
| **CSS/Tailwind classes** | Tailwind utilities | `className="flex gap-2"` | inline styles, CSS modules |
| **Boolean props** | `is`/`has`/`can` prefix | `isVoided`, `hasBalance`, `canDeactivate` | `voided`, `balance`, `deactivatable` |
| **Boolean DB columns** | `is_`/`has_` prefix | `is_voided`, `is_system_generated` | `voided`, `system_generated` |
| **Event handlers** | `on` prefix (props), `handle` prefix (internal) | `onClose` (prop), `handleClose = () => {}` | `close()`, `closeHandler()` |

---

## Toolset-Enforced (No Action Needed)

These conventions are enforced by the toolchain — just be aware:

| Tool | Enforces | Detail |
|------|----------|--------|
| **Drizzle ORM** | DB snake_case → TS camelCase | Column `account_id` becomes `accountId` in queries |
| **Zod** | camelCase for parsed objects | API request/response bodies use camelCase |
| **shadcn/ui** | Component file structure | Components in `src/components/ui/`, variants via CVA |
| **TanStack Table** | Column accessor keys | Match your TypeScript property names (camelCase) |
| **Next.js App Router** | Route file naming | `page.tsx`, `layout.tsx`, `route.ts`, `loading.tsx`, `error.tsx` |
| **Tailwind CSS 4** | Class-based styling | No CSS modules, no styled-components |
| **ESLint** | Import ordering, unused vars | Configured in project eslint config |

---

## Financial Domain Conventions

| Pattern | Convention | Example |
|---------|-----------|---------|
| **GL account references** | `accountId` (FK) | `transactionLine.accountId` |
| **Fund references** | `fundId` (FK) | `transactionLine.fundId` |
| **Money amounts** | `debit`/`credit` separate columns, never signed | `{ debit: 500, credit: null }` |
| **Source provenance** | `sourceType` + `sourceReferenceId` | `{ sourceType: 'RAMP', sourceReferenceId: 'ramp_123' }` |
| **System-generated flag** | `isSystemGenerated` | Depreciation, interest accrual, net asset releases |
| **Voided transactions** | `isVoided` | Excluded from GL totals, visible with VOID badge |
| **Reversal chain** | `reversalOfId` / `reversedById` | Bidirectional link between original and reversing entry |
| **Staging records** | `sourceApp` + `sourceRecordId` | `{ sourceApp: 'timesheets', sourceRecordId: 'ts_456' }` |
| **Audit log actions** | Past tense verb | `'created'`, `'updated'`, `'voided'`, `'reversed'`, `'signed_off'` |
| **Report IDs** | `Report #N` in comments/docs | Reference requirements.md numbering |

---

## File Organization

```
src/
├── app/                          # Next.js App Router (kebab-case directories)
│   ├── (dashboard)/              # Route groups use parentheses
│   ├── transactions/
│   │   ├── page.tsx              # Route page
│   │   ├── layout.tsx            # Route layout
│   │   └── [id]/                 # Dynamic segments use brackets
│   └── api/
│       ├── cron/                 # Scheduled jobs
│       └── copilot/              # AI proxy
├── lib/                          # Business logic (kebab-case files)
│   ├── db/
│   │   ├── schema.ts             # Drizzle schema (single file or schema/ directory)
│   │   └── migrations/           # Drizzle migrations
│   ├── gl/
│   │   ├── engine.ts             # Core GL write path
│   │   └── engine.test.ts        # Co-located unit test
│   └── ...
└── components/                   # React components
    ├── ui/                       # shadcn/ui components (auto-generated)
    ├── copilot/                  # Copilot panel
    ├── reports/                  # Report-specific components
    ├── forms/                    # Transaction/entity forms
    └── shared/                   # Breadcrumbs, UserMenu, HelpTooltip
```
