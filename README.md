# Financial System

Custom financial management system for [Renewal Initiatives](https://renewalinitiatives.org), a Massachusetts 501(c)(3) nonprofit focused on affordable housing and regenerative agriculture — replacing QuickBooks Online with purpose-built software.

**"Personal Software"** — Built for 2-5 users, single tenant, no multi-tenant design. Going 10x deeper on what the org actually needs rather than broad COTS feature coverage.

## What It Does

- **Double-entry general ledger** with fund accounting for nonprofit compliance
- **Bank reconciliation** via Plaid bank feeds (automated matching)
- **Revenue tracking** — grants, donations, rental income, farm sales with donor management
- **Expense/AP management** with vendor tracking, W-9 collection, and 1099 generation
- **Fixed asset management** — depreciation schedules, prepaid expense amortization
- **Budget management** with variance reporting
- **IRS 990 and MA AG compliance** — support test calculations, deadline tracking, contract extraction
- **Board reporting** — financial statements, dashboards, and PDF generation
- **Cross-system integrations** — timesheets create payroll GL entries, expense reports create AP entries
- **AI copilot** — contextual GAAP/990 assistant powered by Claude
- **QBO migration engine** — import and review QuickBooks data with deterministic matching

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router), React 19 |
| Language | TypeScript |
| Database | PostgreSQL (Neon serverless) via Drizzle ORM |
| Auth | NextAuth v5 + Zitadel OIDC |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Tables | TanStack Table |
| Charts | Recharts |
| Banking | Plaid (bank feeds) |
| AI | Anthropic Claude (contract extraction, copilot) |
| PDF | @react-pdf/renderer + pdf-lib |
| Email | Postmark |
| File Storage | Vercel Blob |
| Testing | Vitest (unit), Playwright (E2E) |
| Hosting | Vercel |

## Getting Started

```bash
# Prerequisites: Node 20+, npm
npm install

# Set up environment
cp .env.example .env.local

# Run database migrations
npx drizzle-kit migrate

# Seed the database
npm run db:seed

# Start development
npm run dev
```

## Project Structure

```
src/
  app/
    (protected)/     Auth-gated routes
      accounts/      Chart of accounts
      assets/        Fixed assets & depreciation
      bank-rec/      Bank reconciliation
      budgets/       Budget management
      compliance/    IRS 990, MA AG, deadlines
      donors/        Donor management
      expenses/      Expense/AP tracking
      payroll/       Payroll obligations
      reports/       Financial statements
      revenue/       Revenue/AR, grants, donations
      tenants/       Tenant/rental management
      transactions/  General ledger
      vendors/       Vendor management, W-9, 1099
    api/             API routes (auth, copilot, reports, upload)
  lib/               Business logic (GL engine, compliance, integrations)
  components/        React UI components
drizzle/             SQL migrations (0000-0023)
docs/                Policies, runbooks, user guide
e2e/                 Playwright end-to-end tests
```

## Built With

Built by a non-developer + [Claude Code](https://claude.ai/claude-code) as a demonstration of AI-assisted application development.

## License

[MIT](LICENSE)
