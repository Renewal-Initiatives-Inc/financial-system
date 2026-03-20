# Plan: Left Nav Restructure & Landing Page Cards

**Date:** 2026-03-20
**Status:** Ready to build
**Branch:** (create `feature/nav-restructure`)

---

## Goal

Reduce the left nav from 21 links (14 top-level + 7 indented) to **13 clean top-level links** organized under 4 sections. Sub-navigation moves to card-based landing pages. User clicks a nav item, sees summary cards, then drills in.

---

## Final Left Nav Structure

```
Dashboard
Revenue
Expenses
Assets
Liabilities
Vendors
Donors

WORKFLOWS
Match Transactions
Run Payroll
Run Bank Reconcile
Compliance

PLANS
Reports
Budgets

SETTINGS
Chart of Accounts
Timesheets & ERs
Annual Rates
Data Retention
```

**Removed from nav:** Transactions, Ramp Credit Card, New Run, Bank Settings, CIP Balances, Developer Fee, Prepaid Expenses, Cash Forecast (moved to gear icon in report), Compliance Admin (orphaned — dropped entirely).

---

## Files to Change

### 1. Nav Items — `src/components/layout/nav-items.ts`

Replace flat `navItems` array with a `navSections: NavSection[]` structure:

```ts
export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavSection {
  label?: string          // omit for the top unlabeled group
  items: NavItem[]
}
```

Sections:
- **(unlabeled):** Dashboard `/`, Revenue `/revenue`, Expenses `/expenses`, Assets `/assets`, Liabilities `/liabilities`, Vendors `/vendors`, Donors `/donors`
- **Workflows:** Match Transactions `/match-transactions`, Run Payroll `/payroll`, Run Bank Reconcile `/bank-rec`, Compliance `/compliance`
- **Plans:** Reports `/reports`, Budgets `/budgets`
- **Settings:** Chart of Accounts `/accounts`, Timesheets & ERs `/settings/staging`, Annual Rates `/settings/rates`, Data Retention `/settings/data-retention`

Keep a derived flat `navItems` export for backward compat: `navSections.flatMap(s => s.items)`.

### 2. Sidebar Component — `src/components/layout/app-sidebar.tsx`

- Import `SidebarGroupLabel` from `@/components/ui/sidebar`
- Import `navSections` instead of `navItems`
- Render each section as its own `<SidebarGroup>`:
  - If `section.label` exists, render `<SidebarGroupLabel>{section.label}</SidebarGroupLabel>`
  - Then `<SidebarMenu>` with items (no `indent` class — all items are top-level now)
- Remove all `indent`-related logic

### 3. Revenue Landing Page — `src/app/(protected)/revenue/page.tsx`

**Already has cards** — just needs two changes:
- Reorder so **Funding Sources** is the first card (currently second)
- Remove **Investment Income** card (will surface through checking account / asset accounts, not its own entry point)
- Below the card grid, add a **revenue transactions table** matching the pattern used in `/bank-rec`:
  - Fetch recent revenue transactions via server action
  - Render with `<DataTable>` using standard columns (date, description, account, fund, amount)
  - Click-to-edit row behavior (same as bank-rec)

### 4. Expenses Landing Page — `src/app/(protected)/expenses/page.tsx`

**Already has 3 cards** (Purchase Orders, Outstanding Payables, Ramp Credit Card) — needs:
- Add a **Bank Transactions** card linking to `/bank-rec`. Description: "Reconcile bank statement transactions." Bank settings remains accessible via the gear icon already on the bank-rec page.
- Below the card grid, add an **expense transactions table** (same pattern as revenue above, filtered to expense-type transactions)

### 5. Assets Landing Page — `src/app/(protected)/assets/page.tsx` + `asset-list-client.tsx`

**Already has summary cards + table with filters** — retain as-is. The sub-pages (Prepaid, CIP, Developer Fee) are already linked from the assets page cards. Just confirm they remain accessible and remove their nav entries. No structural change needed here.

### 6. NEW: Liabilities Landing Page — `src/app/(protected)/liabilities/page.tsx`

Create new page. Card-based layout matching Revenue/Expenses pattern:

| Card | Description | Route |
|------|-------------|-------|
| Notes Payable / Loans | Outstanding loan balances and payment schedules | `/liabilities/loans` |
| Accrued Liabilities | Accrued expenses not yet paid (payroll, interest, etc.) | `/liabilities/accrued` |
| Deferred Revenue | Funds received but not yet earned | `/liabilities/deferred-revenue` |
| Security Deposits | Tenant security deposit obligations | `/liabilities/security-deposits` |

Below cards: liabilities transactions table (same DataTable pattern, filtered to LIABILITY account type).

**Sub-pages:** Create stub pages for each card route. Each should follow the standard pattern: server component fetching data → client component with DataTable. Query transactions where the GL account type = LIABILITY and filter by the relevant sub-category.

### 7. NEW: Match Transactions Landing Page — `src/app/(protected)/match-transactions/page.tsx`

Card-based layout:

| Card | Description | Route |
|------|-------------|-------|
| Match Credit Card Transactions | Categorize and post Ramp transactions to the GL | `/expenses/ramp` |
| Match Bank Transactions | Reconcile bank statement transactions | `/bank-rec` |

These cards link to existing pages — no new sub-pages needed. Bank settings remains accessible via the gear icon already present on the bank-rec page header.

### 8. Settings Landing Page — `src/app/(protected)/settings/page.tsx`

**Already exists with card layout** — update to show all 4 settings cards:

| Card | Description | Route |
|------|-------------|-------|
| Chart of Accounts | Manage GL accounts, codes, and hierarchy | `/accounts` |
| Timesheets & ERs | View and manage records from renewal-timesheets and expense-reports | `/settings/staging` |
| Annual Rates | Configure annual interest and tax rates | `/settings/rates` |
| Data Retention | Review record age by category for annual retention compliance | `/settings/data-retention` |

Remove any existing "Cash Forecast Thresholds" card if present.

### 9. "Make Journal Entry" Button — `src/app/(protected)/accounts/accounts-client.tsx`

Add a button to the left of the existing "Create Account" button:

```tsx
<div className="flex items-center justify-between">
  <h1 ...>Chart of Accounts</h1>
  <div className="flex items-center gap-2">
    <Button
      variant="outline"
      onClick={() => router.push('/transactions/new')}
      data-testid="journal-entry-btn"
    >
      <BookOpen className="mr-2 h-4 w-4" />
      Make Journal Entry
    </Button>
    <Button onClick={() => setCreateOpen(true)} data-testid="create-account-btn">
      <Plus className="mr-2 h-4 w-4" />
      Create Account
    </Button>
  </div>
</div>
```

Uses `variant="outline"` to differentiate from the dark-green primary "Create Account" button. Routes to existing `/transactions/new` page which already has the `JournalEntryForm`.

### 10. Cash Forecast Thresholds → Gear Icon in Report

Move the cash forecast thresholds config out of settings nav and into the cash projection report page.

**File:** `src/app/(protected)/reports/cash-projection/cash-projection-client.tsx`

Add a gear icon button in the `<ReportShell>` header area (same pattern as bank-rec settings icon):

```tsx
<Button variant="ghost" size="icon-sm" asChild>
  <Link href="/settings/cash-forecast" data-testid="cash-forecast-settings-link">
    <Settings className="h-4 w-4" />
  </Link>
</Button>
```

The `/settings/cash-forecast` page itself may need to be created or may already exist at a different path — check `src/lib/db/schema/cash-projections.ts` for the data model and build a simple threshold config form if needed.

### 11. Breadcrumbs — `src/components/shared/breadcrumbs.tsx`

Update any breadcrumb config that references removed nav paths. Ensure `/liabilities` and `/match-transactions` have proper breadcrumb entries.

---

## What NOT to Change

- **Dashboard** — no changes
- **Vendors / Donors** — no changes, these are already standalone pages
- **Compliance** — keep as-is (calendar/list view), no card groupings
- **Reports / Budgets** — no changes to the pages themselves
- **Payroll** — `/payroll` page already exists; "New Run" sub-link just gets removed from nav (still accessible from the payroll page itself)
- **Bank Rec** — page unchanged; gear icon for settings already exists

---

## New Routes Summary

| Route | Type | Notes |
|-------|------|-------|
| `/liabilities` | Landing page (cards + table) | NEW |
| `/liabilities/loans` | Sub-page | NEW stub |
| `/liabilities/accrued` | Sub-page | NEW stub |
| `/liabilities/deferred-revenue` | Sub-page | NEW stub |
| `/liabilities/security-deposits` | Sub-page | NEW stub |
| `/match-transactions` | Landing page (cards) | NEW |
| `/settings/cash-forecast` | Settings page | NEW if not existing |

---

## Build Order

1. **Nav items + sidebar** (items 1-2) — immediate visual win, can test right away
2. **Settings landing page update** (item 8) — quick, page already exists
3. **"Make Journal Entry" button** (item 9) — small, self-contained
4. **Revenue page reorder + table** (item 3) — page exists, moderate work
5. **Expenses page + Bank Transactions card + table** (item 4) — page exists, moderate work
6. **Match Transactions landing page** (item 7) — new page, but just cards linking to existing pages
7. **Liabilities landing page + sub-pages** (item 6) — most new code
8. **Cash forecast gear icon** (item 10) — small, depends on verifying existing settings page
9. **Breadcrumb cleanup** (item 11) — final polish
