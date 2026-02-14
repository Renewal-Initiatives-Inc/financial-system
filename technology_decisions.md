# Technology Decisions — Financial System

**For:** Renewal Initiatives, Inc.
**Purpose:** Record every technology choice with rationale, tradeoffs, and dependencies.
**Philosophy:** Understanding over "best practices." Every choice should fit the actual constraints: 2-5 trusted users, small nonprofit budget, maintained by Jeff + Claude Code, must match existing RI app ecosystem.

---

## Confirmed Constraints

| Constraint | Detail |
|-----------|--------|
| Users | 2-5 fully trusted (Heather, Jeff, Damien) |
| Scale | <1,000 transactions/month, single property |
| Existing ecosystem | renewal-timesheets, expense-reports-homegrown, app-portal — all Next.js on Vercel + Neon |
| Authentication | Zitadel via app-portal (shared across all RI apps) |
| Budget | Small nonprofit — cost-sensitive |
| Maintenance | Jeff + Claude Code (no dedicated dev team) |
| Compliance | GAAP nonprofit accounting, MA tenant law, IRS 990/1099/W-2 |

---

## Decision Log

### Decision 1: Backend Language & Framework — Next.js (App Router)

- **Date:** 2026-02-13
- **Options Considered:**
  - Next.js — React full-stack framework, used by expense-reports-homegrown and proposal-rodeo
  - Vite + Express — used by renewal-timesheets (monorepo approach)
- **Rationale:** D-131 specifies Next.js on Vercel. Aligns with 2 of 3 existing RI apps. App Router provides server components, API routes, and cron support natively on Vercel.
- **Key Tradeoffs Accepted:** renewal-timesheets uses Vite + Express, so some patterns won't transfer directly.
- **Dependencies:** Determines hosting (Vercel), routing patterns, API structure.
- **Version:** Latest stable (Next.js 15+, React 19). Match expense-reports-homegrown's versions as the most current RI app.

---

### Decision 2: Database — Neon Postgres + Drizzle ORM

- **Date:** 2026-02-13
- **Options Considered:**
  - Drizzle ORM — type-safe, lightweight, used by all 3 RI apps (unanimous)
  - Prisma — heavier, more opinionated, not in current ecosystem
- **Rationale:** D-131 specifies Neon. Drizzle is unanimous across expense-reports-homegrown, proposal-rodeo, and renewal-timesheets. Type-safe queries, lightweight runtime, excellent Neon integration.
- **Key Tradeoffs Accepted:** Drizzle has a smaller community than Prisma, but the existing team expertise eliminates this concern.
- **Dependencies:** All database access, migrations, cross-Neon-project connectivity.
- **Packages:** `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless`

---

### Decision 3: Frontend Framework — React 19 (via Next.js)

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — determined by Decision 1.
- **Rationale:** Next.js App Router uses React. React 19 provides server components, actions, and improved performance.
- **Dependencies:** UI component library choices, state management patterns.

---

### Decision 4: Hosting & Deployment — Vercel

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — D-131 specifies Vercel.
- **Rationale:** All RI apps deploy on Vercel. Cron jobs, edge functions, environment variable management, and Neon integration all built in.
- **Dependencies:** Cron job scheduling (daily Plaid/Ramp sync, monthly depreciation, etc.), deployment environments.
- **Environments:** Dev + Prod (Vercel preview deployments serve as staging).

---

### Decision 5: Email Service — Postmark

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — already in use across all RI apps.
- **Rationale:** D-126 specifies Postmark. Already used by renewal-timesheets and proposal-rodeo. Donor acknowledgment letters use Postmark templates.
- **Package:** `postmark`

---

### Decision 6: Authentication — Zitadel via app-portal

- **Date:** 2026-02-13
- **Options Considered:**
  - next-auth with Zitadel provider — used by expense-reports and proposal-rodeo
  - react-oidc-context — used by renewal-timesheets
- **Rationale:** D-132 specifies app-portal as auth hub. For a Next.js app, next-auth with Zitadel OIDC provider is the natural fit (matches expense-reports-homegrown and proposal-rodeo patterns).
- **Package:** `next-auth` (v5)

---

### Decision 7: Validation — Zod

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — unanimous across all 3 RI apps.
- **Rationale:** Type-safe schema validation, integrates with Drizzle for DB schema inference and with form validation. Used everywhere in the ecosystem.
- **Package:** `zod`

---

### Decision 8: Package Manager — npm

- **Date:** 2026-02-13
- **Options Considered:**
  - npm — used by expense-reports-homegrown and proposal-rodeo
  - pnpm — used by renewal-timesheets (monorepo workspaces)
- **Rationale:** Financial-system is a single Next.js project (not a monorepo), so npm matches. 2 of 3 apps use npm.

---

### Decision 9: AI Integration — Anthropic SDK

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — D-129 specifies Anthropic API for copilot.
- **Rationale:** Already used by expense-reports-homegrown and proposal-rodeo. Powers the system-wide AI copilot (SYS-P0-001).
- **Package:** `@anthropic-ai/sdk`

---

### Decision 10: Bank Feed Integration — Plaid

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — D-093 specifies Plaid.
- **Rationale:** `/transactions/sync` API for daily bank feeds. $0.30/account/month. Full history rebuild from $0.
- **Package:** `plaid` (plaid-node SDK)

---

### Decision 11: UI/UX Foundations — Tailwind CSS 4 + shadcn/ui + TanStack Table

- **Date:** 2026-02-13
- **Options Considered:**
  - Tailwind + shadcn/ui + TanStack Table — full toolkit for forms AND data-heavy reports
  - Tailwind + shadcn/ui only — simpler, but basic table component insufficient for 29 reports
  - Tailwind + custom components — full control, excessive build work for this scope
- **Rationale:** Financial-system has 29 reports with sorting, filtering, fund drill-down, budget variance coloring, and comparison columns. TanStack Table is purpose-built for data-heavy tables. shadcn/ui handles forms, dialogs, navigation, copilot panel (Sheet component), and all non-table UI. Tailwind 4 matches expense-reports-homegrown. shadcn/ui's TanStack Table integration pattern is well-documented.
- **Key Tradeoffs Accepted:** Two component paradigms to understand (shadcn/ui for general UI, TanStack Table for data tables). TanStack Table is headless (you control rendering), which adds initial setup but gives full customization.
- **Dependencies:** Report components, bank reconciliation workspace, transaction lists, budget variance tables all use TanStack Table. Forms, dialogs, copilot panel use shadcn/ui.
- **Visual Language:** Reskin shadcn/ui default theme to match renewal-timesheets' visual design (forest green, spacing, typography) per Design Principle #6.
- **Accessibility:** WCAG AA / Section 508 baseline. shadcn/ui built on Radix UI primitives provides this.
- **Packages:** `tailwindcss`, `@tailwindcss/postcss`, `tailwind-merge`, `clsx`, `class-variance-authority`, `@radix-ui/*` (via shadcn/ui), `@tanstack/react-table`, `lucide-react`, `next-themes`

---

### Decision 12: PDF Generation — @react-pdf/renderer + pdf-lib

- **Date:** 2026-02-13
- **Options Considered:**
  - @react-pdf/renderer only — good for reports, awkward for IRS form filling
  - pdf-lib only — good for forms, tedious for report generation (low-level coordinate API)
  - @react-pdf/renderer + pdf-lib — right tool for each job
  - Puppeteer/Playwright PDF — requires headless browser, impractical on Vercel serverless
- **Rationale:** Two distinct PDF needs: (1) formatted report exports (29 reports, board pack, donor letters) suit React-component-based generation, (2) IRS forms (W-2, 1099-NEC) need pixel-precise field placement in official PDF templates. @react-pdf/renderer handles the first; pdf-lib handles the second.
- **Key Tradeoffs Accepted:** Two PDF libraries to learn and maintain. Worth it vs. fighting one library to do both jobs poorly.
- **Dependencies:** All report PDF export (RPT-P0-002), board pack (RPT-P0-007), W-2 generation (TXN-P0-036), 1099-NEC (TXN-P0-023), donor acknowledgment letters (TXN-P0-011).
- **Packages:** `@react-pdf/renderer`, `pdf-lib`

---

### Decision 13: Charts — shadcn/ui Charts (Recharts under the hood)

- **Date:** 2026-02-13
- **Options Considered:**
  - Recharts (standalone) — battle-tested, but requires manual styling to match UI
  - Tremor — Tailwind-native dashboard charts, but another component layer on top of shadcn/ui
  - Chart.js — canvas-based, less accessible, less React-native
  - shadcn/ui Charts — Recharts wrapped in shadcn/ui theming, automatic visual cohesion
- **Rationale:** shadcn/ui includes a Charts component set built on Recharts. Charts automatically inherit the same theme, colors, and spacing as all other UI components. No separate library to learn — it's part of the existing shadcn/ui component system. Covers all needs: line (utility trends), bar (budget vs actual), area (cash projection), and composable variants.
- **Key Tradeoffs Accepted:** Slightly less flexibility than raw Recharts for exotic chart types. Not a concern — financial-system needs standard chart types only.
- **Dependencies:** Dashboard widgets (Report #5, #8, #9), utility trend analysis (Report #13), budget variance (RPT-P0-005), cash projection (Report #15).
- **Packages:** `recharts` (peer dependency of shadcn/ui charts — already implied by Decision 11)

---

### Decision 14: Data Fetching — SWR + React Server Components

- **Date:** 2026-02-13
- **Options Considered:**
  - SWR for client-side fetching — already used by expense-reports-homegrown
  - Server components only — insufficient for interactive pages (bank rec, Ramp queue, copilot)
- **Rationale:** Hybrid approach. Server components handle initial data loading for most pages (fast, no loading spinners). SWR fills the gap for interactive pages that need client-side fetching: bank reconciliation workspace, Ramp categorization queue, dashboard auto-refresh, copilot context. Auto-revalidation on tab focus keeps data fresh.
- **Key Tradeoffs Accepted:** Two data loading paradigms (server + client). This is the standard Next.js App Router pattern, not a custom choice.
- **Dependencies:** Bank reconciliation workspace, Ramp categorization, dashboard widgets, copilot panel.
- **Package:** `swr`

---

### Decision 15: Testing — Vitest + Playwright

- **Date:** 2026-02-13
- **Options Considered:** Not applicable — unanimous across expense-reports-homegrown and proposal-rodeo.
- **Rationale:** Vitest for unit/integration tests (GL engine, payroll calculations, matching algorithm, fund accounting logic). Playwright for E2E tests (full user workflows across browser). React Testing Library for component tests. All three already in use across the ecosystem.
- **Key Tradeoffs Accepted:** None — this is the standard.
- **Dependencies:** CI/CD runs tests on push. E2E tests validate report generation, bank rec workflows, transaction entry.
- **Environment Notes:** macOS development, Vercel CI. Both Vitest and Playwright run consistently across macOS and Linux (Vercel CI).
- **Packages:** `vitest`, `@playwright/test`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `jsdom`

---

### Decision 16: Local Development & Deployment Environments

- **Date:** 2026-02-13
- **Options Considered:**
  - Local + Production only (current pattern for other RI apps)
  - Local + Staging + Production (three-tier)
  - Docker-based local development
- **Rationale:** Financial system has lower tolerance for production issues than timesheets/expense apps. Three-tier deployment: develop locally, test in staging, promote to production. Single developer (Jeff) — no need for Neon branching or Docker complexity.
- **Environment Setup:**

| Environment | Branch | URL | Database | Purpose |
|------------|--------|-----|----------|---------|
| Local | any | `localhost:3000` | Neon dev DB | Daily development |
| Staging | `staging` | Custom domain on Vercel preview | Neon staging DB | Pre-production testing |
| Production | `main` | Production domain on Vercel | Neon production DB | Live system |

- **Workflow:** Feature branches → merge to `staging` → test → merge to `main` (production).
- **Neon databases:** Three separate databases: `financial-system-dev`, `financial-system-staging`, `financial-system-prod`. Environment variables in Vercel set per environment.
- **Dev Machine:** macOS, Node.js 20+ (LTS), VS Code, npm, no Docker.
- **Cross-platform Notes:** macOS dev → Linux production (Vercel). No cross-platform concerns — Node.js and Next.js are fully portable. Playwright E2E tests run on both.

---

## Technology Stack Summary

| Category | Choice | Key Packages |
|----------|--------|-------------|
| Backend Framework | Next.js (App Router) | `next`, `react`, `react-dom` |
| Database | Neon Postgres + Drizzle ORM | `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` |
| UI Components | shadcn/ui + TanStack Table | `@radix-ui/*`, `@tanstack/react-table`, `lucide-react` |
| Styling | Tailwind CSS 4 | `tailwindcss`, `tailwind-merge`, `clsx`, `class-variance-authority` |
| Charts | shadcn/ui Charts (Recharts) | `recharts` |
| PDF Generation | @react-pdf/renderer + pdf-lib | `@react-pdf/renderer`, `pdf-lib` |
| Data Fetching | SWR + Server Components | `swr` |
| Validation | Zod | `zod` |
| Auth | next-auth (Zitadel) | `next-auth` |
| AI Copilot | Anthropic SDK | `@anthropic-ai/sdk` |
| Bank Feeds | Plaid | `plaid` |
| Email | Postmark | `postmark` |
| Testing | Vitest + Playwright | `vitest`, `@playwright/test`, `@testing-library/react` |
| Hosting | Vercel (3 environments) | — |
| Package Manager | npm | — |

