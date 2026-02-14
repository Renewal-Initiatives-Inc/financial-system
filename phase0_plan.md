# Phase 0 — Technology Stack Decisions

**Status:** COMPLETE
**Phase:** 0 of 22
**Dependencies:** None (first phase)
**Next Phase:** Phase 1 — Project Scaffolding & Dev Environment

---

## Summary

All technology choices for the financial system have been finalized. 16 decisions are documented in `technology_decisions.md` with rationale, tradeoffs, and package selections.

---

## Decisions Made

| # | Decision | Choice | Packages |
|---|----------|--------|----------|
| 1 | Backend Framework | Next.js 15 (App Router) | `next`, `react`, `react-dom` |
| 2 | Database | Neon Postgres + Drizzle ORM | `drizzle-orm`, `drizzle-kit`, `@neondatabase/serverless` |
| 3 | Frontend | React 19 (via Next.js) | — |
| 4 | Hosting | Vercel (3 environments) | — |
| 5 | Email | Postmark | `postmark` |
| 6 | Auth | next-auth v5 (Zitadel OIDC) | `next-auth` |
| 7 | Validation | Zod | `zod` |
| 8 | Package Manager | npm | — |
| 9 | AI | Anthropic SDK | `@anthropic-ai/sdk` |
| 10 | Bank Feeds | Plaid | `plaid` |
| 11 | UI/UX | Tailwind 4 + shadcn/ui + TanStack Table | `tailwindcss`, `@tanstack/react-table`, `lucide-react`, etc. |
| 12 | PDF | @react-pdf/renderer + pdf-lib | `@react-pdf/renderer`, `pdf-lib` |
| 13 | Charts | shadcn/ui Charts (Recharts) | `recharts` |
| 14 | Data Fetching | SWR + Server Components | `swr` |
| 15 | Testing | Vitest + Playwright | `vitest`, `@playwright/test`, `@testing-library/react` |
| 16 | Environments | Local + Staging + Production | 3 Neon databases |

---

## Acceptance Criteria — All Satisfied

- [x] Every technology choice documented with rationale and tradeoffs
- [x] Package list finalized for each category
- [x] Ecosystem alignment verified (matches existing RI apps where applicable)
- [x] Deployment topology defined (3 environments: local, staging, production)
- [x] No open questions remaining

---

## What's Next: Phase 1 — Project Scaffolding & Dev Environment

Phase 1 is the first implementation phase. It stands up the working Next.js project with:

1. Project initialization (`create-next-app`)
2. Core dependency installation (Drizzle, Zod, SWR, next-auth, etc.)
3. shadcn/ui initialization with forest green theme
4. Three Neon databases created (dev, staging, prod)
5. Drizzle config pointing to Neon
6. next-auth v5 with Zitadel OIDC
7. App shell layout with sidebar navigation
8. Breadcrumbs and UserMenu shared components
9. Placeholder route groups for all 16 sections
10. Vitest + Playwright configuration
11. GitHub Actions CI pipeline
12. Vercel project with preview + production environments
13. Verification: deploy, auth flow, CI green

**To start Phase 1:** Run `/plan-phase 1`
