# Phase 1 — Project Scaffolding & Dev Environment

**Status:** NOT STARTED
**Phase:** 1 of 22
**Dependencies:** Phase 0 (Technology Stack Decisions) — COMPLETE
**Next Phase:** Phase 2 — Core Database Schema & Seed Data

---

## Summary

Stand up a working Next.js project with the full toolchain, CI pipeline, and a deployable shell. Every pattern is derived from the expense-reports-homegrown codebase (the most current RI Next.js app) with adaptations for financial-system's sidebar-based layout.

---

## Dependency Verification

Before starting, confirm:

- [x] Phase 0 complete — all 16 technology decisions documented in `technology_decisions.md`
- [ ] Neon account accessible — can create 3 databases
- [ ] Vercel account accessible — can create project and link to GitHub repo
- [ ] GitHub repo created: `Renewal-Initiatives-Inc/financial-system`
- [ ] Zitadel OIDC app registered for financial-system (client ID, issuer URL)
- [ ] App Portal URL known for "Back to App Portal" link

---

## Tasks

### Task 1: Initialize Next.js 15 Project

**Command:**
```bash
npx create-next-app@latest . --app --ts --tailwind --eslint --src-dir --import-alias "@/*"
```

**Notes:**
- Run from the `financial-system/` directory (repo already exists)
- Uses `--src-dir` to match expense-reports-homegrown's `src/` structure
- Uses `--import-alias "@/*"` to get `@/*` → `./src/*` path alias in tsconfig
- Generates: `src/app/`, `src/app/globals.css`, `src/app/layout.tsx`, `src/app/page.tsx`, `next.config.ts`, `tsconfig.json`, `postcss.config.mjs`, `eslint.config.mjs`, `package.json`, `tailwind.config.ts` (if any — Tailwind 4 may not need it)

**Version targets** (match expense-reports-homegrown):
- `next`: 16.x (latest stable — expense-reports uses 16.1.6)
- `react` / `react-dom`: 19.x
- `typescript`: ^5
- `tailwindcss`: ^4
- `eslint`: ^9

**Files created/modified:**
- `package.json`
- `tsconfig.json`
- `next.config.ts`
- `postcss.config.mjs`
- `eslint.config.mjs`
- `src/app/layout.tsx`
- `src/app/page.tsx`
- `src/app/globals.css`

---

### Task 2: Install Core Dependencies

**Production dependencies:**
```bash
npm install drizzle-orm @neondatabase/serverless zod swr next-auth@beta \
  class-variance-authority clsx tailwind-merge lucide-react next-themes \
  sonner radix-ui @tanstack/react-table recharts
```

**Dev dependencies:**
```bash
npm install -D drizzle-kit @vitejs/plugin-react vitest jsdom \
  @testing-library/react @testing-library/jest-dom @testing-library/user-event \
  @playwright/test dotenv @tailwindcss/postcss tw-animate-css \
  prettier eslint-config-prettier eslint-plugin-prettier
```

**Package alignment with expense-reports-homegrown:**

| Package | Expense-Reports Version | Note |
|---------|------------------------|------|
| `next` | 16.1.6 | Use latest 16.x |
| `react` / `react-dom` | 19.2.3 | Use latest 19.x |
| `next-auth` | ^5.0.0-beta.30 | v5 beta |
| `drizzle-orm` | ^0.45.1 | Latest |
| `drizzle-kit` | ^0.31.8 | Latest |
| `@neondatabase/serverless` | ^1.0.2 | Latest |
| `zod` | ^4.3.6 | Latest |
| `swr` | ^2.4.0 | Latest |
| `tailwindcss` | ^4 | v4 |
| `radix-ui` | ^1.4.3 | Unified package |
| `vitest` | ^4.0.18 | Latest |
| `@playwright/test` | ^1.58.1 | Latest |

**Not needed in Phase 1** (install in later phases):
- `@anthropic-ai/sdk` — Phase 15 (AI Copilot)
- `plaid` — Phase 10 (Bank Feeds)
- `postmark` — Phase 9 (Email)
- `@react-pdf/renderer`, `pdf-lib` — Phase 12 (Reports/PDF)

**Files modified:**
- `package.json`
- `package-lock.json`

---

### Task 3: Initialize shadcn/ui with Forest Green Theme

**Command:**
```bash
npx shadcn@latest init
```

**Configuration choices:**
- Style: **New York**
- Base color: **Neutral** (we override with forest green)
- CSS variables: **Yes**

**Post-init: Replace globals.css theme**

Copy the forest green theme from expense-reports-homegrown's `globals.css` exactly. This includes:
- `@import 'tailwindcss'` and `@import 'tw-animate-css'`
- `@theme inline` block with all CSS variable mappings
- `:root` block with forest green primary `oklch(0.35 0.09 145)`
- Sidebar color variables
- Chart color variables
- Base layer styles

**Reference:** expense-reports-homegrown `src/app/globals.css` (lines 1-97)

**Install initial shadcn/ui components** (needed for shell):
```bash
npx shadcn@latest add button dropdown-menu avatar separator \
  sheet sidebar breadcrumb sonner tooltip
```

**Files created/modified:**
- `src/app/globals.css` — overwritten with forest green theme
- `src/components/ui/` — shadcn components added
- `src/lib/utils.ts` — `cn()` helper (auto-created by shadcn)
- `components.json` — shadcn config

---

### Task 4: Configure postcss.config.mjs

Match expense-reports-homegrown pattern:

```js
const config = {
  plugins: {
    '@tailwindcss/postcss': {},
  },
}

export default config
```

**File:** `postcss.config.mjs`

---

### Task 5: Configure ESLint

Match expense-reports-homegrown pattern:

```js
import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'
import eslintConfigPrettier from 'eslint-config-prettier'

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  eslintConfigPrettier,
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
  ]),
])

export default eslintConfig
```

**File:** `eslint.config.mjs`

---

### Task 6: Configure next.config.ts

Minimal config (no image remotePatterns needed yet — add later for blob storage):

```ts
import type { NextConfig } from 'next'

const nextConfig: NextConfig = {}

export default nextConfig
```

**File:** `next.config.ts`

---

### Task 7: Configure tsconfig.json

Match expense-reports-homegrown pattern:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts",
    "**/*.mts"
  ],
  "exclude": ["node_modules"]
}
```

**File:** `tsconfig.json`

---

### Task 8: Create Three Neon Databases

**Manual step** (Neon console or CLI):

1. Create `financial-system-dev` — for local development
2. Create `financial-system-staging` — for staging/preview deploys
3. Create `financial-system-prod` — for production

**Record connection strings** for each. Format:
```
postgres://user:password@ep-xxx.us-east-2.aws.neon.tech/financial-system-dev?sslmode=require
```

---

### Task 9: Configure Environment Variables

**Create `.env.local`:**
```env
# Authentication - NextAuth.js
AUTH_SECRET=<generate with: openssl rand -base64 32>

# Zitadel OIDC Configuration (using PKCE - no client secret needed)
AUTH_ZITADEL_ISSUER=https://your-zitadel-instance.zitadel.cloud
AUTH_ZITADEL_CLIENT_ID=<from Zitadel console>

# NextAuth URL (automatically set in Vercel, needed for local dev)
NEXTAUTH_URL=http://localhost:3000

# Database - Neon PostgreSQL
DATABASE_URL=<dev database connection string>

# App Portal URL (for "Back to App Portal" link)
APP_PORTAL_URL=https://app-portal.renewalinitiatives.org
```

**Create `.env.example`** (committed to git, no secrets):
```env
# Authentication - NextAuth.js
# Generate with: openssl rand -base64 32
AUTH_SECRET=

# Zitadel OIDC Configuration (using PKCE - no client secret needed)
AUTH_ZITADEL_ISSUER=https://your-zitadel-instance.zitadel.cloud
AUTH_ZITADEL_CLIENT_ID=

# NextAuth URL (automatically set in Vercel, needed for local dev)
NEXTAUTH_URL=http://localhost:3000

# Database - Neon PostgreSQL
DATABASE_URL=postgres://user:password@host/database?sslmode=require

# App Portal URL (for "Back to App Portal" link)
APP_PORTAL_URL=https://app-portal.renewalinitiatives.org
```

**Vercel environment variables** (set in Vercel dashboard):
- Staging: `DATABASE_URL` → staging connection string
- Production: `DATABASE_URL` → production connection string
- All environments: `AUTH_SECRET`, `AUTH_ZITADEL_ISSUER`, `AUTH_ZITADEL_CLIENT_ID`, `APP_PORTAL_URL`

**Ensure `.gitignore`** includes:
```
.env.local
.env*.local
```

**Files created:**
- `.env.local` (not committed)
- `.env.example` (committed)

---

### Task 10: Set Up Drizzle Config

**Reference:** expense-reports-homegrown `drizzle.config.ts`

```ts
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: '.env.local' })

export default defineConfig({
  schema: './src/lib/db/schema/index.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
```

**Add npm scripts** to `package.json`:
```json
{
  "scripts": {
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

**Files created/modified:**
- `drizzle.config.ts`
- `package.json` (scripts)

---

### Task 11: Create Database Client

**Reference:** expense-reports-homegrown `src/lib/db/index.ts`

```ts
import { neon, type NeonQueryFunction } from '@neondatabase/serverless'
import { drizzle, type NeonHttpDatabase } from 'drizzle-orm/neon-http'
import * as schema from './schema'

function createDb(): NeonHttpDatabase<typeof schema> | null {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    console.warn('DATABASE_URL is not set. Database operations will fail.')
    return null
  }
  const sql: NeonQueryFunction<boolean, boolean> = neon(connectionString)
  return drizzle(sql, { schema })
}

const _db = createDb()

export const db = new Proxy({} as NeonHttpDatabase<typeof schema>, {
  get(_target, prop) {
    if (!_db) {
      throw new Error('Database not configured. Please set DATABASE_URL environment variable.')
    }
    return Reflect.get(_db, prop)
  },
})

export type Database = typeof db
```

**Create placeholder schema:**

`src/lib/db/schema/index.ts`:
```ts
// Schema definitions will be added in Phase 2
// This file exists so drizzle.config.ts and db/index.ts can reference it
```

**Files created:**
- `src/lib/db/index.ts`
- `src/lib/db/schema/index.ts`

---

### Task 12: Configure next-auth v5 with Zitadel OIDC

**Reference:** expense-reports-homegrown `src/lib/auth.ts` — adapt for financial-system.

**`src/lib/auth.ts`:**

Key adaptations from expense-reports-homegrown:
- Change app role check from `'app:expense-reports-homegrown'` to `'app:financial-system'`
- Remove the `upsertUser` call (no user table in Phase 1 — add in Phase 2 if needed)
- Keep everything else identical: Zitadel OIDC provider with PKCE, JWT strategy, role extraction, authorized callback

```ts
import NextAuth from 'next-auth'
import type { NextAuthConfig, Session } from 'next-auth'
import 'next-auth/jwt'

interface ZitadelRoles {
  [key: string]: { [orgId: string]: string }
}

export type AppRole = 'user' | 'admin'

declare module 'next-auth/jwt' {
  interface JWT {
    role?: AppRole
    sub?: string
  }
}

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      image?: string
      role: AppRole
    }
  }
}

function hasAppAccess(roles: ZitadelRoles | undefined): boolean {
  if (!roles) return false
  return !!roles['admin'] || !!roles['app:financial-system']
}

function extractRole(roles: ZitadelRoles | undefined): AppRole {
  if (!roles) return 'user'
  if (roles['admin']) return 'admin'
  const appRoles = roles['app:financial-system']
  if (appRoles) {
    const hasAdmin = Object.values(appRoles).some((role) => role === 'admin')
    if (hasAdmin) return 'admin'
  }
  return 'user'
}

export const authConfig: NextAuthConfig = {
  providers: [
    {
      id: 'zitadel',
      name: 'Zitadel',
      type: 'oidc',
      issuer: process.env.AUTH_ZITADEL_ISSUER,
      clientId: process.env.AUTH_ZITADEL_CLIENT_ID,
      client: { token_endpoint_auth_method: 'none' },
      checks: ['pkce', 'state'],
      authorization: {
        params: {
          scope: 'openid email profile urn:zitadel:iam:org:project:id:zitadel:aud',
        },
      },
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name || profile.preferred_username,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
  callbacks: {
    async signIn({ profile }) {
      const roles =
        (profile?.['urn:zitadel:iam:org:project:roles'] as ZitadelRoles) ||
        (profile?.['roles'] as ZitadelRoles)
      if (!hasAppAccess(roles)) return false
      return true
    },
    async jwt({ token, account, profile }) {
      if (account && profile) {
        token.sub = profile.sub as string
        const roles =
          (profile['urn:zitadel:iam:org:project:roles'] as ZitadelRoles) ||
          (profile['roles'] as ZitadelRoles)
        token.role = extractRole(roles)
      }
      return token
    },
    async session({ session, token }): Promise<Session> {
      return {
        ...session,
        user: {
          ...session.user,
          id: token.sub || '',
          role: token.role || 'user',
        },
      }
    },
    async authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user
      const isOnLogin = request.nextUrl.pathname.startsWith('/login')
      const isOnAuthApi = request.nextUrl.pathname.startsWith('/api/auth')
      if (isOnAuthApi) return true
      if (isOnLogin && isLoggedIn) return Response.redirect(new URL('/', request.nextUrl))
      if (isOnLogin) return true
      return isLoggedIn
    },
  },
  pages: { signIn: '/login' },
  session: { strategy: 'jwt' },
  trustHost: true,
}

export const { handlers, auth, signIn, signOut } = NextAuth(authConfig)
```

**`src/middleware.ts`:**
```ts
import { auth } from '@/lib/auth'

export default auth

export const config = {
  matcher: ['/((?!api/auth|_next/static|_next/image|favicon.ico).*)'],
}
```

**`src/app/api/auth/[...nextauth]/route.ts`:**
```ts
import { handlers } from '@/lib/auth'

export const { GET, POST } = handlers
```

**`src/app/login/page.tsx`:**

Simple login page with "Sign in with Zitadel" button. Matches expense-reports-homegrown pattern.

**Files created:**
- `src/lib/auth.ts`
- `src/middleware.ts`
- `src/app/api/auth/[...nextauth]/route.ts`
- `src/app/login/page.tsx`

---

### Task 13: Create Providers Component

**Reference:** expense-reports-homegrown `src/components/providers.tsx`

```tsx
'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from '@/components/ui/sonner'
import { ReactNode } from 'react'

interface ProvidersProps {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <SessionProvider>
      {children}
      <Toaster richColors position="top-right" />
    </SessionProvider>
  )
}
```

**File:** `src/components/providers.tsx`

---

### Task 14: Create App Shell Layout with Sidebar Navigation

Financial-system uses a **sidebar layout** (unlike expense-reports-homegrown's top-nav header). This matches the navigation needs of 16 sections.

**`src/app/layout.tsx`** — Root layout:
```tsx
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { Providers } from '@/components/providers'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Financial System | Renewal Initiatives',
  description: 'Fund accounting system for Renewal Initiatives, Inc.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
```

**`src/app/(protected)/layout.tsx`** — Protected layout with sidebar:
```tsx
import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopBar } from '@/components/layout/app-top-bar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ReactNode } from 'react'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopBar user={session.user} />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
```

**Sidebar navigation structure** (from design.md Section 3.1):

| Icon | Label | Route | Section |
|------|-------|-------|---------|
| LayoutDashboard | Dashboard | `/` | (dashboard) |
| BookOpen | Transactions | `/transactions` | GL entries |
| ListTree | Chart of Accounts | `/accounts` | Account management |
| Wallet | Funds | `/funds` | Fund management |
| TrendingUp | Revenue | `/revenue` | Rent, grants, donations |
| Receipt | Expenses | `/expenses` | Reimbursements, PO, Ramp |
| Users | Payroll | `/payroll` | Payroll runs |
| Scale | Bank Rec | `/bank-rec` | Bank reconciliation |
| FileText | Reports | `/reports` | 29 reports |
| PieChart | Budgets | `/budgets` | Budget & projections |
| ShieldCheck | Compliance | `/compliance` | Calendar & allocation |
| Building2 | Vendors | `/vendors` | Vendor management |
| Home | Tenants | `/tenants` | Tenant management |
| Heart | Donors | `/donors` | Donor management |
| Landmark | Assets | `/assets` | Fixed assets |
| Settings | Settings | `/settings` | System config |

**Files created:**
- `src/app/layout.tsx` (overwrite generated)
- `src/app/(protected)/layout.tsx`
- `src/components/layout/app-sidebar.tsx`
- `src/components/layout/app-top-bar.tsx`
- `src/components/layout/nav-items.ts` (sidebar navigation config)

---

### Task 15: Build Breadcrumbs Component (SYS-P0-018)

**Requirement:** Auto-generated from App Router route hierarchy. Reads `usePathname()` and resolves display names from route metadata. No per-page configuration.

**Pattern:** Use shadcn/ui `Breadcrumb` component.

```tsx
'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'

// Static route display names
const ROUTE_NAMES: Record<string, string> = {
  '': 'Dashboard',
  'transactions': 'Transactions',
  'accounts': 'Chart of Accounts',
  'funds': 'Funds',
  'revenue': 'Revenue',
  'expenses': 'Expenses',
  'payroll': 'Payroll',
  'bank-rec': 'Bank Reconciliation',
  'reports': 'Reports',
  'budgets': 'Budgets',
  'compliance': 'Compliance',
  'vendors': 'Vendors',
  'tenants': 'Tenants',
  'donors': 'Donors',
  'assets': 'Assets',
  'settings': 'Settings',
}
```

**Integration:** Rendered in `AppTopBar` above the page content area.

**Entity name resolution:** In Phase 1, breadcrumbs use static route names only. Dynamic segment resolution (e.g., vendor name instead of vendor ID) will be added in later phases as entities are built.

**File:** `src/components/shared/breadcrumbs.tsx`

---

### Task 16: Build UserMenu Component (SYS-P0-019, SYS-P0-020)

**Requirements:**
- Current user name and email (from session)
- "Back to App Portal" link (`APP_PORTAL_URL` env var) — SYS-P0-020
- Sign Out action

**Reference:** expense-reports-homegrown `src/components/layout/user-menu.tsx` — adapt:
- Remove `RoleBadge` (no RBAC in financial-system)
- Remove Profile link (not needed for 2-5 users)
- Add "Back to App Portal" link with `ExternalLink` icon

```tsx
'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface UserMenuProps {
  user: {
    name: string
    email: string
    image?: string
  }
}

export function UserMenu({ user }: UserMenuProps) {
  return (
    <DropdownMenu>
      {/* Avatar trigger */}
      {/* Name + email label */}
      {/* "Back to App Portal" link → process.env.NEXT_PUBLIC_APP_PORTAL_URL */}
      {/* Sign Out → signOut({ callbackUrl: '/login' }) */}
    </DropdownMenu>
  )
}
```

**Note:** `APP_PORTAL_URL` must be exposed as `NEXT_PUBLIC_APP_PORTAL_URL` since UserMenu is a client component. Add to `.env.local` and `.env.example`.

**Files created:**
- `src/components/layout/user-menu.tsx`

**data-testid attributes** (per naming_conventions.md):
- `data-testid="user-menu-trigger"`
- `data-testid="user-menu-name"`
- `data-testid="user-menu-email"`
- `data-testid="user-menu-portal-link"`
- `data-testid="user-menu-signout"`

---

### Task 17: Create 16 Placeholder Route Groups

Each section gets a `page.tsx` that renders a heading and placeholder text. This verifies routing works and provides navigation targets for the sidebar.

**Directory structure:**
```
src/app/(protected)/
├── (dashboard)/
│   └── page.tsx              # Dashboard home
├── transactions/
│   └── page.tsx              # Transactions list
├── accounts/
│   └── page.tsx              # Chart of accounts
├── funds/
│   └── page.tsx              # Fund management
├── revenue/
│   └── page.tsx              # Revenue recording
├── expenses/
│   └── page.tsx              # Expense processing
├── payroll/
│   └── page.tsx              # Payroll runs
├── bank-rec/
│   └── page.tsx              # Bank reconciliation
├── reports/
│   └── page.tsx              # Reports hub
├── budgets/
│   └── page.tsx              # Budget management
├── compliance/
│   └── page.tsx              # Compliance calendar
├── vendors/
│   └── page.tsx              # Vendor management
├── tenants/
│   └── page.tsx              # Tenant management
├── donors/
│   └── page.tsx              # Donor management
├── assets/
│   └── page.tsx              # Fixed assets
└── settings/
    └── page.tsx              # System settings
```

**Each placeholder page pattern:**
```tsx
export default function TransactionsPage() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight">Transactions</h1>
      <p className="text-muted-foreground mt-2">Transaction management will be built in Phase 4.</p>
    </div>
  )
}
```

**Also create API route directories:**
```
src/app/api/
├── auth/[...nextauth]/route.ts  # Already created in Task 12
├── cron/                         # Placeholder for scheduled jobs
└── webhooks/                     # Placeholder for Plaid webhooks
```

**Files created:** 16 `page.tsx` files + API route placeholders

---

### Task 18: Set Up Vitest Config

**Reference:** expense-reports-homegrown `vitest.config.ts`

```ts
import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
```

**Create test setup:**

`src/test/setup.ts`:
```ts
import '@testing-library/jest-dom'
```

**Add npm scripts:**
```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage"
  }
}
```

**Files created:**
- `vitest.config.ts`
- `src/test/setup.ts`

---

### Task 19: Set Up Playwright Config

**Reference:** expense-reports-homegrown `playwright.config.ts`

```ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

**Create e2e directory:**
```
e2e/
└── smoke.spec.ts     # Basic smoke test: app loads, login page renders
```

**Add npm scripts:**
```json
{
  "scripts": {
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

**Files created:**
- `playwright.config.ts`
- `e2e/smoke.spec.ts`

---

### Task 20: Configure GitHub Actions CI

**Note:** expense-reports-homegrown has no CI workflow yet. Create one for financial-system.

**`.github/workflows/ci.yml`:**
```yaml
name: CI

on:
  push:
    branches: [main, staging]
  pull_request:
    branches: [main, staging]

jobs:
  lint-and-typecheck:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run lint
      - run: npx tsc --noEmit

  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npm run test:run

  e2e:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: npm
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npm run test:e2e
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL_STAGING }}
      AUTH_SECRET: ${{ secrets.AUTH_SECRET }}
      AUTH_ZITADEL_ISSUER: ${{ secrets.AUTH_ZITADEL_ISSUER }}
      AUTH_ZITADEL_CLIENT_ID: ${{ secrets.AUTH_ZITADEL_CLIENT_ID }}
```

**Files created:**
- `.github/workflows/ci.yml`

---

### Task 21: Set Up Vercel Project

**Manual steps:**

1. Create Vercel project linked to `Renewal-Initiatives-Inc/financial-system` GitHub repo
2. Configure production branch: `main`
3. Configure preview deployments for all other branches
4. Set environment variables per environment:
   - **Production:** `DATABASE_URL` (prod), `AUTH_SECRET`, `AUTH_ZITADEL_ISSUER`, `AUTH_ZITADEL_CLIENT_ID`, `NEXT_PUBLIC_APP_PORTAL_URL`
   - **Preview:** `DATABASE_URL` (staging), same auth vars
5. Verify build settings: Framework = Next.js, Root = `.`, Build command = `npm run build`

**No `vercel.json` needed** — defaults are correct for Next.js.

---

### Task 22: Add npm Scripts Summary

Final `package.json` scripts section:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "eslint .",
    "lint:fix": "eslint . --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui",
    "db:generate": "drizzle-kit generate",
    "db:migrate": "drizzle-kit migrate",
    "db:push": "drizzle-kit push",
    "db:studio": "drizzle-kit studio"
  }
}
```

---

### Task 23: Write Initial Tests

**Unit test — Breadcrumbs component:**
`src/components/shared/breadcrumbs.test.tsx`
- Renders "Dashboard" for root path
- Renders multi-segment breadcrumb for `/vendors`
- Links are clickable except the last segment (current page)

**Unit test — utils:**
`src/lib/utils.test.ts`
- Verify `cn()` merges classes correctly

**Smoke E2E test:**
`e2e/smoke.spec.ts`
- App loads without errors
- Unauthenticated user is redirected to login page
- Login page renders the sign-in button

---

### Task 24: Verify End-to-End

1. **Local dev:** `npm run dev` — app starts, login page renders, sidebar appears after auth
2. **Build:** `npm run build` — compiles without errors
3. **Lint:** `npm run lint` — passes clean
4. **Type check:** `npx tsc --noEmit` — passes
5. **Unit tests:** `npm run test:run` — all pass
6. **Deploy to Vercel:** Push to `main`, verify deployment succeeds
7. **Auth flow:** Click sign in → redirected to Zitadel → login → redirected back → sidebar + user menu visible
8. **Navigation:** Click each sidebar item → correct placeholder page loads with breadcrumb
9. **CI:** Open a PR → GitHub Actions runs lint, type check, tests → all green

---

## Files Created — Complete List

```
financial-system/
├── .env.example
├── .env.local                          (not committed)
├── .github/
│   └── workflows/
│       └── ci.yml
├── drizzle.config.ts
├── e2e/
│   └── smoke.spec.ts
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── playwright.config.ts
├── postcss.config.mjs
├── tsconfig.json
├── vitest.config.ts
└── src/
    ├── app/
    │   ├── globals.css                 (forest green theme)
    │   ├── layout.tsx                  (root layout)
    │   ├── login/
    │   │   └── page.tsx
    │   ├── api/
    │   │   └── auth/
    │   │       └── [...nextauth]/
    │   │           └── route.ts
    │   └── (protected)/
    │       ├── layout.tsx              (sidebar + auth check)
    │       ├── (dashboard)/
    │       │   └── page.tsx
    │       ├── transactions/
    │       │   └── page.tsx
    │       ├── accounts/
    │       │   └── page.tsx
    │       ├── funds/
    │       │   └── page.tsx
    │       ├── revenue/
    │       │   └── page.tsx
    │       ├── expenses/
    │       │   └── page.tsx
    │       ├── payroll/
    │       │   └── page.tsx
    │       ├── bank-rec/
    │       │   └── page.tsx
    │       ├── reports/
    │       │   └── page.tsx
    │       ├── budgets/
    │       │   └── page.tsx
    │       ├── compliance/
    │       │   └── page.tsx
    │       ├── vendors/
    │       │   └── page.tsx
    │       ├── tenants/
    │       │   └── page.tsx
    │       ├── donors/
    │       │   └── page.tsx
    │       ├── assets/
    │       │   └── page.tsx
    │       └── settings/
    │           └── page.tsx
    ├── components/
    │   ├── layout/
    │   │   ├── app-sidebar.tsx
    │   │   ├── app-top-bar.tsx
    │   │   ├── nav-items.ts
    │   │   └── user-menu.tsx
    │   ├── providers.tsx
    │   ├── shared/
    │   │   ├── breadcrumbs.tsx
    │   │   └── breadcrumbs.test.tsx
    │   └── ui/                         (shadcn/ui components)
    │       ├── avatar.tsx
    │       ├── breadcrumb.tsx
    │       ├── button.tsx
    │       ├── dropdown-menu.tsx
    │       ├── separator.tsx
    │       ├── sheet.tsx
    │       ├── sidebar.tsx
    │       ├── sonner.tsx
    │       └── tooltip.tsx
    ├── lib/
    │   ├── auth.ts
    │   ├── db/
    │   │   ├── index.ts
    │   │   └── schema/
    │   │       └── index.ts            (placeholder)
    │   └── utils.ts                    (cn() helper — from shadcn init)
    │       └── utils.test.ts
    ├── middleware.ts
    └── test/
        └── setup.ts
```

---

## Acceptance Criteria

From `implementation_plan.md` Phase 1 deliverable:

- [ ] **Deployable Next.js app** — `npm run build` succeeds, Vercel deployment works
- [ ] **Working auth** — Zitadel login flow redirects correctly, session persists
- [ ] **Navigation shell** — Sidebar with 16 sections, all routes render placeholder pages
- [ ] **Breadcrumb trail** — Every page shows correct breadcrumbs (SYS-P0-018)
- [ ] **User menu** — Shows user name/email, "Back to App Portal" link, Sign Out (SYS-P0-019, SYS-P0-020)
- [ ] **CI pipeline** — GitHub Actions runs lint, type check, unit tests, E2E on PR
- [ ] **Three Neon environments** — Dev, staging, prod databases created and connected
- [ ] **Forest green theme** — UI matches renewal-timesheets' visual language (Design Principle #6)
- [ ] **Test infrastructure** — Vitest + Playwright configured, initial tests pass
- [ ] **Naming conventions followed** — All files, components, test IDs per `naming_conventions.md`

From requirements.md:

- [ ] SYS-P0-018: Breadcrumbs auto-generated from route hierarchy
- [ ] SYS-P0-019: UserMenu with current user name/email and Sign Out
- [ ] SYS-P0-020: "Back to App Portal" cross-app link in UserMenu
- [ ] All interactive elements have `data-testid` attributes

---

## What's Next: Phase 2 — Core Database Schema & Seed Data

Phase 2 defines the complete core database schema in Drizzle and seeds the chart of accounts and funds:

1. Accounts table (44+ accounts with hierarchy)
2. Funds table (6 seed funds)
3. Transactions + transaction_lines tables
4. CIP cost codes table
5. Audit log table
6. Zod schemas for all tables
7. Seed scripts
8. Unit tests for seed data and constraints

**To start Phase 2:** Run `/plan-phase 2`
