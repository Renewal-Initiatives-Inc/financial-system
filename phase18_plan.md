# Phase 18: AI Copilot — Execution Plan

**Phase:** 18 of 22
**Dependencies:** Phase 5 minimum (can start earlier; full context needs all features)
**Current state:** Phases 1-4 complete. `@anthropic-ai/sdk` already in package.json.
**Requirements satisfied:** SYS-P0-001 through SYS-P0-004, D-128, D-129, D-130

---

## Strategy

Phase 18 is architected to be **incrementally useful**. The copilot infrastructure ships as a complete, working system with context packages for the pages that exist today (accounts, funds, dashboard). As future phases ship (5-17, 19), each new page adds its context package — the copilot automatically picks it up. No re-architecture needed.

**Build order:**
1. Core infrastructure (types, API proxy, panel component)
2. Knowledge layer (static corpus + eCFR client)
3. Copilot tools (taxLawSearch, regulationLookup, nonprofitExplorerLookup)
4. Context packages (one per page/feature area)
5. Layout integration + conversation persistence
6. Tests

---

## Step 1: Core Types & Configuration

### 1.1 Create `src/lib/copilot/types.ts`

Define the core interfaces that every context package implements.

```typescript
// Context package shape — each page exports one
interface CopilotContextPackage {
  pageId: string                           // e.g., "accounts", "bank-rec"
  pageDescription: string                  // human-readable for system prompt
  data: Record<string, unknown>            // current page state/data
  tools: CopilotToolDefinition[]           // available tools on this page
  knowledge: string[]                      // topic keys to load from corpus
}

// Tool definition for Anthropic tool_use
interface CopilotToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>    // JSON Schema
}

// Chat message types
interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
}

// API request/response shapes
interface CopilotRequest {
  messages: CopilotMessage[]
  context: CopilotContextPackage
}

interface CopilotResponse {
  content: string
  toolCalls?: Array<{
    name: string
    input: Record<string, unknown>
    result: unknown
  }>
}
```

**File:** `src/lib/copilot/types.ts`
**Acceptance:** Types compile, no runtime code yet.

---

### 1.2 Create `src/lib/copilot/config.ts`

Copilot configuration constants.

```typescript
export const COPILOT_CONFIG = {
  model: 'claude-sonnet-4-5-20250929',  // cost-effective for copilot
  maxTokens: 4096,
  systemPromptPrefix: `You are a financial accounting assistant for Renewal Initiatives, Inc., a Massachusetts 501(c)(3) nonprofit. You help with GAAP nonprofit accounting, fund accounting, MA compliance, and IRS reporting. Always cite authoritative sources (IRC sections, ASC standards, IRS publications) when answering tax or compliance questions. Be concise and actionable.`,
}
```

**File:** `src/lib/copilot/config.ts`

---

## Step 2: Copilot API Proxy

### 2.1 Create `src/app/api/copilot/route.ts`

Server-side proxy that assembles the system prompt from context package and forwards to Anthropic API with streaming.

**Logic:**
1. Receive POST with `{ messages, context }` from client
2. Validate auth (session check)
3. Assemble system prompt:
   - Base system prompt (config prefix)
   - Page context description + data summary
   - Loaded knowledge documents (from context.knowledge keys)
4. Build Anthropic API request with tools from context.tools
5. Stream response back to client
6. If tool_use blocks returned, execute tools server-side, feed results back, continue

**Key implementation details:**
- Use `@anthropic-ai/sdk` with streaming (`stream: true`)
- Return `ReadableStream` via Next.js route handler for SSE
- Tool execution happens server-side in a loop (max 5 tool calls per turn)
- Auth check: reject 401 if no valid session

**File:** `src/app/api/copilot/route.ts`
**Acceptance:** POST endpoint accepts messages + context, returns streaming text.

---

### 2.2 Create `src/lib/copilot/tool-executor.ts`

Server-side tool execution engine. When Anthropic returns a `tool_use` block, this module routes to the correct handler.

**Tools to register:**
- `taxLawSearch` → searches static knowledge corpus
- `regulationLookup` → fetches from eCFR API
- `nonprofitExplorerLookup` → queries ProPublica API
- `searchTransactions` → queries GL transaction history
- `searchAccounts` → queries chart of accounts
- `getAccountBalance` → calculates account balance
- `getFundBalance` → calculates fund balance
- `searchAuditLog` → queries audit log

**Pattern:**
```typescript
const toolHandlers: Record<string, (input: any) => Promise<unknown>> = {
  taxLawSearch: handleTaxLawSearch,
  regulationLookup: handleRegulationLookup,
  // ...
}

export async function executeTool(name: string, input: unknown): Promise<unknown>
```

**File:** `src/lib/copilot/tool-executor.ts`
**Acceptance:** Each tool handler returns structured data or error.

---

## Step 3: Tax Law Knowledge Layer

### 3.1 Create knowledge corpus directory structure

```
src/lib/copilot/knowledge/
├── index.ts                    # Corpus loader + topic-based retrieval
├── exempt-org-rules/
│   ├── irc-501c3.txt          # IRC § 501(c)(3) exempt status rules
│   ├── irc-170-contributions.txt  # IRC § 170 charitable contributions
│   ├── irc-509-public-charity.txt # IRC § 509(a) public charity tests
│   ├── irc-4946-disqualified-persons.txt  # IRC § 4946 disqualified person definitions
│   ├── schedule-a-public-support.txt      # Schedule A computation: 2% rule, gov't vs public classification, RI-specific revenue mix analysis
│   └── pub-557-excerpts.txt   # IRS Pub 557 (Tax-Exempt Status)
├── fund-accounting/
│   ├── asc-958-overview.txt   # ASC 958 net asset classification
│   ├── restricted-funds.txt   # Donor restriction rules
│   ├── net-asset-releases.txt # Release mechanics
│   └── nonprofit-basics.txt   # nonprofitaccountingbasics.org content
├── depreciation/
│   ├── irc-168-macrs.txt      # IRC § 168 MACRS
│   ├── pub-946-excerpts.txt   # IRS Pub 946 useful life tables
│   └── asc-360-impairment.txt # ASC 360 fixed asset rules
├── payroll-tax/
│   ├── pub-15t-excerpts.txt   # Federal withholding methods
│   ├── circular-m-excerpts.txt # MA state withholding
│   └── fica-rules.txt         # Social Security + Medicare
├── ma-compliance/
│   ├── gl-c186-security-deposits.txt  # MA tenant law
│   ├── form-pc-instructions.txt       # MA AG charity filing
│   └── ma-nonprofit-faq.txt          # mass.gov nonprofit FAQ
├── reporting/
│   ├── form-990-instructions.txt      # 990 Part IX line guidance
│   ├── donor-acknowledgment.txt       # IRC § 170(f)(8), Pub 1771
│   ├── functional-expenses.txt        # GAAP vs 990 format rules
│   ├── functional-allocation-defaults.txt  # Per-sub-type default splits + comparable org data (see content spec below)
│   └── public-support-test.txt        # IRC § 509(a), Reg. 1.509(a)-3 — Schedule A Part II: 33⅓% threshold, 2% per-donor limit, unusual grant exclusion (Reg. 1.509(a)-3(c)(4)), rental income routing (Line 10a not Line 1)
└── construction/
    ├── asc-835-20-interest-cap.txt    # Interest capitalization
    ├── irc-263a-capitalization.txt     # Capitalization rules
    └── cip-conversion-rules.txt       # PIS date + component allocation
```

Each `.txt` file is a curated, plain-text extract (500-3000 words) from the authoritative source. Files include:
- Source citation at the top (e.g., "Source: IRC § 170(f)(8)(A)-(B)")
- Relevant excerpts, not full documents
- RI-specific annotations where applicable

**Content spec for `functional-allocation-defaults.txt` (from Feb 2025 MCP research):**

This file powers the copilot's ability to explain and advise on functional expense allocation. Include:

1. **Default splits by account sub-type** — the same values seeded in Phase 17's `functional-defaults.ts`:
   - `Property Ops` → 100/0/0 (permanent) — property taxes, insurance, utilities, repairs, landscaping
   - `Non-Cash` → 100/0/0 (permanent) — depreciation on program assets
   - `Financial` → 100/0/0 (permanent) — AHP loan interest is property debt
   - `Payroll` → 70/25/5 — ED/bookkeeper blended role; lower fundraising weight than typical
   - `Operating` → 80/20/0 — catch-all for misc operating costs

2. **Rationale grounded in comparable orgs** — cite the three validated comps:
   - Falcon Housing Corp (04-3538884): 75.6/24.4/0.0 — closest to RI, single MA property, no fundraising staff
   - Pioneer Valley Habitat (04-3049506): 78.0/9.6/12.3 — active fundraising, less relevant to RI
   - Valley CDC (22-2906466): 85.2/14.5/0.3 — multi-property, government-funded, RI growth target

3. **Outlier guidance** — program % below 65% or above 90% warrants CPA review. Watchdog orgs flag <65%. Above 90% may indicate understated M&G

4. **Time study guidance** — for Payroll sub-type, IRS expects a reasonable method. Hours log by function is the gold standard. 70/25/5 default fits RI's ED/bookkeeper role; review annually

5. **Form 990 Part IX context** — functional allocation reported on Part IX, totals on Line 25. Method described in Part XI Line 2

**Key content for new exempt-org files (from Feb 2025 MCP research):**

`irc-4946-disqualified-persons.txt` — Defines who is a "disqualified person" under IRC § 4946: substantial contributors (cumulative gifts > $5K AND > 2% of total contributions per § 507(d)(2)), foundation managers (board members, officers, trustees), family members (spouse, ancestors, children, grandchildren, great-grandchildren, and their spouses — siblings NOT included per § 4946(d)), 20%+ owners of substantial contributor entities, 35%+ controlled corporations/partnerships/trusts. **RI-specific note:** The disqualified person concept is primarily relevant to (1) private foundations (Chapter 42 excise taxes) and (2) 509(a)(2) organizations (Schedule A Part III Line 7a exclusion). RI is classified 170(b)(1)(A)(vi) and files Schedule A Part II, which has NO disqualified person exclusion. Part II uses a universal 2% cap (Line 5) that applies to ALL donors equally. The § 4946 reference in Part II Line 5 is limited to an **aggregation rule**: contributions from persons related under § 4946(a)(1)(C)-(G) are treated as made by one person for purposes of the 2% cap. This requires donor relationship grouping, not a disqualified person boolean. No `is_disqualified_person` field is needed on the donors table. The concept remains relevant for Schedule L (transactions with interested persons) disclosure if RI ever files a full Form 990.

`schedule-a-public-support.txt` — Schedule A Part II (170(b)(1)(A)(vi)) computation mechanics. Government contributions (Line 3) get full credit with no per-donor cap. Public contributions (Line 1) are subject to the universal 2% rule (Line 5): for each donor, the portion of their aggregate 5-year contributions exceeding 2% of total support (Line 11) is excluded from public support. The 2% cap does NOT apply to contributions from governmental units (§ 170(b)(1)(A)(v)) or other publicly supported organizations. When applying the 2% cap, contributions from persons related under § 4946(a)(1)(C)-(G) (family members, 20%+ entity owners, 35%+ controlled entities) are aggregated as if from one person. RI-specific analysis: during construction, most support is government (AHP, CPA, MassDev) — public support test easily met. Post-construction risk: rental income is program service revenue reported on Line 12 (total support denominator) but NOT on Line 1 (public support numerator). If RI shifts to rental-income-dominant, the public support percentage could erode after the 5-year grace period (~FY2030). The `contribution_source_type` tag (government/public/related_party) on DM-P0-018 captures the classification needed for this computation. The three values map to Schedule A as follows: `government` → Line 3 (full credit, exempt from 2% cap), `public` → Line 1 (subject to 2% cap), `related_party` → Line 1 (subject to 2% cap; contributions from related persons are aggregated per § 4946(a)(1)(C)-(G) for cap purposes).

**Files:** ~22-27 knowledge files
**Acceptance:** Files exist, are loadable, and are organized by topic.

---

### 3.2 Create `src/lib/copilot/knowledge/index.ts`

Knowledge corpus loader and topic-based retrieval.

```typescript
// Maps topic keys to file paths
const topicMap: Record<string, string[]> = {
  'exempt-org': ['exempt-org-rules/irc-501c3.txt', ...],
  'fund-accounting': ['fund-accounting/asc-958-overview.txt', ...],
  'depreciation': ['depreciation/pub-946-excerpts.txt', ...],
  // ...
}

// Load knowledge for given topic keys
export function loadKnowledge(topics: string[]): string
// Returns concatenated relevant documents with headers
```

At this scale (~50-100 docs, each 500-3000 words), topic-based selection is sufficient. No vector DB needed.

**File:** `src/lib/copilot/knowledge/index.ts`
**Acceptance:** `loadKnowledge(['fund-accounting', 'depreciation'])` returns relevant text.

---

### 3.3 Create `src/lib/copilot/ecfr-client.ts`

eCFR REST API client for real-time Treasury Regulation lookup.

**API:** `https://www.ecfr.gov/api/versioner/v1/full/{date}/title-{title}.xml`
**Approach:**
- Fetch specific CFR sections on demand (title 26, part 1)
- Parse XML response to extract section text
- Cache responses (in-memory Map with TTL, since regulations change infrequently)
- Return plain text with citation header

```typescript
export async function fetchRegulation(citation: string): Promise<{
  citation: string
  text: string
  effectiveDate: string
} | null>
```

**File:** `src/lib/copilot/ecfr-client.ts`
**Acceptance:** `fetchRegulation('26 CFR 1.501(c)(3)-1')` returns regulation text.

---

### 3.4 Create `src/lib/copilot/propublica-client.ts`

ProPublica Nonprofit Explorer API client for comparable org lookup.

**API:** `https://projects.propublica.org/nonprofits/api/v2/`
**Endpoints:**
- `search.json?q={query}` — search orgs (note: short queries work best)
- `organizations/{ein}.json` — org details
- `organizations/{ein}/filings.json` — 990 filings with financial data

```typescript
export async function searchNonprofits(query: string): Promise<OrgSummary[]>
export async function getOrganization(ein: string): Promise<OrgDetail | null>
export async function getFinancials(ein: string): Promise<Financial[] | null>
```

**Implementation notes from MCP testing:**
- Multi-word searches often return 0 results; use single keywords
- EIN-based lookups are reliable and rich
- ProPublica API returns financial totals but **not** Part IX functional breakdowns — PDF download + parsing is needed for line-item detail
- Validated RI comps: Falcon Housing Corp (04-3538884), Pioneer Valley Habitat (04-3049506), Valley CDC (22-2906466)

**Functional allocation benchmark data (from Feb 2025 990 PDF analysis):**
| Org | EIN | Program | M&G | Fundraising | Notes |
|-----|-----|---------|-----|-------------|-------|
| Falcon Housing Corp | 04-3538884 | 75.6% | 24.4% | 0.0% | Closest comp to RI — small MA housing nonprofit, no fundraising staff |
| Pioneer Valley Habitat | 04-3049506 | 78.0% | 9.6% | 12.3% | Fundraising-heavy model, less relevant to RI |
| Valley CDC | 22-2906466 | 85.2% | 14.5% | 0.3% | Growth target — larger, more efficient |

This data is consumed by the `nonprofitExplorerLookup` tool (Step 4.3) and the compliance context package (Step 6.5) for the Phase 17 functional allocation wizard.

**File:** `src/lib/copilot/propublica-client.ts`
**Acceptance:** EIN lookup returns org data.

---

## Step 4: Copilot Tools

### 4.1 `taxLawSearch` tool

Searches the static knowledge corpus by keyword/topic.

**Input:** `{ query: string, topics?: string[] }`
**Output:** `{ results: Array<{ source: string, excerpt: string, relevance: string }> }`

Searches across all loaded knowledge files using simple text matching (includes/regex). Returns top 3-5 results with source citations.

**File:** `src/lib/copilot/tools/tax-law-search.ts`

---

### 4.2 `regulationLookup` tool

Fetches a specific Treasury Regulation section via eCFR API.

**Input:** `{ citation: string }` (e.g., "26 CFR 1.501(c)(3)-1(d)(1)(ii)")
**Output:** `{ citation: string, text: string, effectiveDate: string }`

Uses the eCFR client from Step 3.3.

**File:** `src/lib/copilot/tools/regulation-lookup.ts`

---

### 4.3 `nonprofitExplorerLookup` tool

Queries ProPublica to find comparable organizations or look up specific EINs.

**Input:** `{ ein?: string, query?: string, includeBenchmarks?: boolean }`
**Output:** `{ organization?: OrgDetail, searchResults?: OrgSummary[], benchmarks?: FunctionalBenchmark[] }`

Uses the ProPublica client from Step 3.4. When `includeBenchmarks` is true, returns the validated functional allocation benchmarks for RI's comparable orgs (see Step 3.4 benchmark table). This powers the Phase 17 functional allocation wizard's benchmark comparison panel.

**Benchmark response shape:**
```typescript
interface FunctionalBenchmark {
  orgName: string
  ein: string
  programPct: number
  mgaPct: number
  fundraisingPct: number
  notes: string
}
```

**File:** `src/lib/copilot/tools/nonprofit-explorer.ts`

---

### 4.4 Database query tools

Tools that query the financial-system database for copilot responses.

**`searchTransactions`**
- Input: `{ query?: string, dateFrom?: string, dateTo?: string, accountId?: number, fundId?: number, limit?: number }`
- Output: transaction summaries (id, date, memo, amount, source type)

**`searchAccounts`**
- Input: `{ query?: string, type?: string, activeOnly?: boolean }`
- Output: account list (code, name, type, balance)

**`getAccountBalance`**
- Input: `{ accountId: number, asOfDate?: string }`
- Output: `{ balance: string, debitTotal: string, creditTotal: string }`

**`getFundBalance`**
- Input: `{ fundId: number, asOfDate?: string }`
- Output: `{ balance: string, assets: string, liabilities: string, netAssets: string }`

**`searchAuditLog`**
- Input: `{ entityType?: string, entityId?: number, action?: string, dateFrom?: string, dateTo?: string, limit?: number }`
- Output: audit log entries (timestamp, user, action, summary)

**Files:**
- `src/lib/copilot/tools/search-transactions.ts`
- `src/lib/copilot/tools/search-accounts.ts`
- `src/lib/copilot/tools/get-account-balance.ts`
- `src/lib/copilot/tools/get-fund-balance.ts`
- `src/lib/copilot/tools/search-audit-log.ts`

**Acceptance:** Each tool queries DB and returns structured results.

---

## Step 5: Copilot Panel UI Component

### 5.1 Create `src/components/copilot/CopilotPanel.tsx`

Right-side sliding panel using shadcn/ui Sheet component.

**UI structure:**
- Sheet (right side, ~400px wide)
- Header: "AI Assistant" title + close button + "New Chat" button
- Message list: scrollable area with user/assistant messages
- Streaming indicator: animated dots while assistant is responding
- Input area: text input + send button (Enter to send, Shift+Enter for newline)
- Collapsible: toggle button persists in bottom-right corner when closed

**Behavior:**
- Messages stream in real-time (SSE from API)
- Tool calls show as collapsible "Searching..." / "Looking up..." indicators
- Assistant messages render markdown (bold, lists, code, links)
- Auto-scroll to bottom on new messages
- Input disabled while assistant is responding

**File:** `src/components/copilot/CopilotPanel.tsx`

---

### 5.2 Create `src/components/copilot/CopilotToggle.tsx`

Persistent toggle button for opening/closing the copilot panel.

**UI:** Fixed-position button in bottom-right corner. Icon: MessageSquare from lucide-react. Badge shows unread indicator if copilot was used on this page before.

**File:** `src/components/copilot/CopilotToggle.tsx`

---

### 5.3 Create `src/components/copilot/CopilotMessage.tsx`

Individual message bubble component.

**Variants:**
- User message: right-aligned, muted background
- Assistant message: left-aligned, card background, markdown rendering
- Tool call indicator: inline, collapsible, shows tool name + brief result

**File:** `src/components/copilot/CopilotMessage.tsx`

---

### 5.4 Create `src/components/copilot/useCopilot.ts` (hook)

Client-side hook managing copilot state and API communication.

```typescript
function useCopilot(context: CopilotContextPackage) {
  // State: messages[], isStreaming, error
  // Methods: sendMessage(text), clearChat()
  // Handles SSE streaming from /api/copilot
  // Manages conversation history
}
```

**File:** `src/components/copilot/useCopilot.ts`

---

## Step 6: Context Packages

Each page exports a `getCopilotContext()` function returning a `CopilotContextPackage`. Context packages for pages that don't exist yet are created as stubs and filled in when those phases ship.

### 6.1 Context package registry

**File:** `src/lib/copilot/contexts/index.ts`

Maps page IDs to context package factories. Each factory receives page-specific props (current data, form state, etc.) and returns a `CopilotContextPackage`.

---

### 6.2 Accounts context (`src/lib/copilot/contexts/accounts.ts`)

- **Data:** Current account list, selected account details, account hierarchy
- **Tools:** `searchAccounts`, `getAccountBalance`, `taxLawSearch`
- **Knowledge:** `['fund-accounting', 'reporting']`
- **Description:** "User is viewing the Chart of Accounts. Help with account types, GAAP classifications, Form 990 line mapping, and account hierarchy."

---

### 6.3 Funds context (`src/lib/copilot/contexts/funds.ts`)

- **Data:** Fund list, selected fund details, fund balances
- **Tools:** `getFundBalance`, `searchTransactions`, `taxLawSearch`
- **Knowledge:** `['fund-accounting', 'exempt-org']`
- **Description:** "User is managing funds. Help with fund restrictions, net asset classification, and ASC 958 requirements."

---

### 6.4 Dashboard context (`src/lib/copilot/contexts/dashboard.ts`)

- **Data:** Dashboard section summaries (cash, alerts, rent, funds, recent activity)
- **Tools:** `searchTransactions`, `searchAccounts`, `getFundBalance`, `getAccountBalance`
- **Knowledge:** `['fund-accounting']`
- **Description:** "User is on the dashboard overview. Help navigate to relevant reports and answer questions about the organization's financial position."

---

### 6.5 Stub contexts for future pages

Create minimal context packages for pages that will ship in later phases. Each stub has:
- Appropriate pageId and description
- Empty data (populated when phase ships)
- Relevant tools and knowledge topics pre-assigned

**Stub files:**
- `src/lib/copilot/contexts/transactions.ts` — Phase 5
- `src/lib/copilot/contexts/vendors.ts` — Phase 6
- `src/lib/copilot/contexts/tenants.ts` — Phase 6
- `src/lib/copilot/contexts/donors.ts` — Phase 6
  - Pre-populate: **Tools:** `taxLawSearch`, `nonprofitExplorerLookup`
  - Pre-populate: **Knowledge:** `['exempt-org']`
  - Pre-populate: **Description:** "User is managing donors. Help with: (1) Contribution source type tagging — guide users to choose government/public/related_party correctly, as this data feeds the deferred Schedule A Part II calculation (~FY2030). Government sources get full credit (Line 3); all other donors are subject to the universal 2% cap (Line 5). (2) Donor relationship awareness — contributions from related persons (family members, controlled entities per § 4946(a)(1)(C)-(G)) are aggregated as one person for the 2% cap. Note: RI files Part II (170(b)(1)(A)(vi)), which has NO disqualified person exclusion — that concept applies only to Part III (509(a)(2)) organizations. (3) Donor acknowledgment requirements per IRC § 170(f)(8) for gifts ≥$250."
- `src/lib/copilot/contexts/revenue.ts` — Phase 7
  - Pre-populate: **Tools:** `taxLawSearch`, `searchAccounts`, `getFundBalance`
  - Pre-populate: **Knowledge:** `['exempt-org', 'fund-accounting']`
  - Pre-populate: **Description:** "User is recording revenue. Help with: (1) contribution_source_type classification — government (AHP, CPA, MassDev grants), public (individual/corporate donations), related_party (donations from officers/board/family). (2) Grant type assessment — conditional vs unconditional per ASC 958-605. (3) Fund assignment — restricted fund for donor-restricted contributions, General Fund for unrestricted."
- `src/lib/copilot/contexts/expenses.ts` — Phase 8
- `src/lib/copilot/contexts/ramp.ts` — Phase 9
- `src/lib/copilot/contexts/payroll.ts` — Phase 10
- `src/lib/copilot/contexts/assets.ts` — Phase 11
- `src/lib/copilot/contexts/bank-rec.ts` — Phase 12
- `src/lib/copilot/contexts/budgets.ts` — Phase 14
- `src/lib/copilot/contexts/reports.ts` — Phase 15
- `src/lib/copilot/contexts/compliance.ts` — Phase 17
  - Pre-populate: **Tools:** `nonprofitExplorerLookup` (with `includeBenchmarks: true`), `taxLawSearch`
  - Pre-populate: **Knowledge:** `['reporting', 'exempt-org']` — include `public-support-test.txt` and `schedule-a-public-support.txt` for Schedule A guidance
  - Pre-populate: **Description:** "User is on the compliance page. Help with Form 990 preparation, functional allocation defaults (three-tier system: permanent rules > prior-year > sub-type defaults), comparable org benchmarking, and public support test monitoring. Reference validated comps: Falcon Housing (75.6% program), Pioneer Valley Habitat (78.0%), Valley CDC (85.2%). Flag outliers below 65% or above 90% program allocation. For public support questions: the 2% threshold applies to ALL donors (not just related_party), unusual grants are excludable per Reg. 1.509(a)-3(c)(4), and rental income enters Total Support (Line 10a) but not Public Support (Line 1) — RI's ratio will decline post-construction (~FY2028+). Public support trajectory review milestone exported from Phase 14 compliance constants."

Each stub follows the same interface and is ready to be filled in.

**Acceptance:** All context packages compile and return valid `CopilotContextPackage` objects.

---

## Step 7: CopilotProvider & Layout Integration

### 7.1 Create `src/components/copilot/CopilotProvider.tsx`

React context provider that:
- Wraps the protected layout
- Accepts the current page's context package
- Provides copilot state (open/closed, messages) to child components
- Renders the CopilotPanel and CopilotToggle

```typescript
interface CopilotProviderProps {
  children: ReactNode
  context: CopilotContextPackage
}
```

**File:** `src/components/copilot/CopilotProvider.tsx`

---

### 7.2 Modify `src/app/(protected)/layout.tsx`

Add the CopilotProvider to the protected layout. Each page passes its context via a client component wrapper.

**Approach:** Use a `CopilotContextSetter` client component that pages can call to update the current context package. The protected layout renders the copilot panel once, and it reads context from the provider.

**Modified file:** `src/app/(protected)/layout.tsx`

---

### 7.3 Add context to existing pages

Update `src/app/(protected)/accounts/` and `src/app/(protected)/funds/` page components to pass their context packages to the copilot provider.

**Modified files:**
- `src/app/(protected)/accounts/accounts-client.tsx`
- `src/app/(protected)/funds/funds-client.tsx`
- `src/app/(protected)/(dashboard)/page.tsx`

---

## Step 8: Conversation Persistence

### 8.1 Create conversation storage

Store conversation history per user per page in browser localStorage.

**Key format:** `copilot:${userId}:${pageId}`
**Stored data:** `{ messages: CopilotMessage[], lastUpdated: string }`
**Clear:** "New Chat" button in panel header, or auto-clear after 24h inactivity

No server-side persistence needed — conversations are ephemeral assistance, not audit records.

**File:** `src/lib/copilot/storage.ts`

---

## Step 9: Tests

### 9.1 Unit tests

| Test file | Tests |
|-----------|-------|
| `src/lib/copilot/knowledge/index.test.ts` | Knowledge corpus loads, topic filtering works, returns relevant content |
| `src/lib/copilot/ecfr-client.test.ts` | eCFR client parses citation, handles errors, caches responses |
| `src/lib/copilot/propublica-client.test.ts` | ProPublica client handles EIN lookup, search, empty results |
| `src/lib/copilot/tools/tax-law-search.test.ts` | Search returns relevant results with citations |
| `src/lib/copilot/tools/search-transactions.test.ts` | Transaction search with filters returns correct data |
| `src/lib/copilot/tools/search-accounts.test.ts` | Account search returns correct data |
| `src/lib/copilot/tools/get-account-balance.test.ts` | Balance calculation matches GL data |
| `src/lib/copilot/tools/get-fund-balance.test.ts` | Fund balance calculation matches GL data |
| `src/lib/copilot/tool-executor.test.ts` | Tool executor routes to correct handler, handles unknown tools |
| `src/lib/copilot/contexts/*.test.ts` | Each context package returns valid shape |
| `src/lib/copilot/storage.test.ts` | localStorage persistence, expiry, clear |

### 9.2 E2E test

**File:** `tests/e2e/copilot.spec.ts`

- Open copilot panel on accounts page
- Verify panel opens with correct header
- Type a question and send
- Verify response appears (mock Anthropic API)
- Close panel, reopen, verify conversation persisted
- Click "New Chat", verify conversation cleared

---

## File Manifest

### New files (create)

| File | Purpose |
|------|---------|
| `src/lib/copilot/types.ts` | Core types (CopilotContextPackage, CopilotMessage, etc.) |
| `src/lib/copilot/config.ts` | Copilot configuration constants |
| `src/lib/copilot/index.ts` | Barrel exports |
| `src/lib/copilot/tool-executor.ts` | Server-side tool execution router |
| `src/lib/copilot/storage.ts` | Client-side conversation persistence |
| `src/lib/copilot/ecfr-client.ts` | eCFR REST API client |
| `src/lib/copilot/propublica-client.ts` | ProPublica Nonprofit Explorer client |
| `src/lib/copilot/knowledge/index.ts` | Knowledge corpus loader |
| `src/lib/copilot/knowledge/exempt-org-rules/*.txt` | ~6 knowledge files (includes irc-4946-disqualified-persons.txt, schedule-a-public-support.txt) |
| `src/lib/copilot/knowledge/fund-accounting/*.txt` | ~4 knowledge files |
| `src/lib/copilot/knowledge/depreciation/*.txt` | ~3 knowledge files |
| `src/lib/copilot/knowledge/payroll-tax/*.txt` | ~3 knowledge files |
| `src/lib/copilot/knowledge/ma-compliance/*.txt` | ~3 knowledge files |
| `src/lib/copilot/knowledge/reporting/*.txt` | ~4 knowledge files (includes functional-allocation-defaults.txt) |
| `src/lib/copilot/knowledge/construction/*.txt` | ~3 knowledge files |
| `src/lib/copilot/tools/tax-law-search.ts` | taxLawSearch tool handler |
| `src/lib/copilot/tools/regulation-lookup.ts` | regulationLookup tool handler |
| `src/lib/copilot/tools/nonprofit-explorer.ts` | nonprofitExplorerLookup tool handler |
| `src/lib/copilot/tools/search-transactions.ts` | DB transaction search tool |
| `src/lib/copilot/tools/search-accounts.ts` | DB account search tool |
| `src/lib/copilot/tools/get-account-balance.ts` | DB account balance tool |
| `src/lib/copilot/tools/get-fund-balance.ts` | DB fund balance tool |
| `src/lib/copilot/tools/search-audit-log.ts` | DB audit log search tool |
| `src/lib/copilot/tools/index.ts` | Tool barrel exports |
| `src/lib/copilot/contexts/index.ts` | Context package registry |
| `src/lib/copilot/contexts/accounts.ts` | Accounts page context |
| `src/lib/copilot/contexts/funds.ts` | Funds page context |
| `src/lib/copilot/contexts/dashboard.ts` | Dashboard page context |
| `src/lib/copilot/contexts/transactions.ts` | Transactions context (stub) |
| `src/lib/copilot/contexts/vendors.ts` | Vendors context (stub) |
| `src/lib/copilot/contexts/tenants.ts` | Tenants context (stub) |
| `src/lib/copilot/contexts/donors.ts` | Donors context (stub) |
| `src/lib/copilot/contexts/revenue.ts` | Revenue context (stub) |
| `src/lib/copilot/contexts/expenses.ts` | Expenses context (stub) |
| `src/lib/copilot/contexts/ramp.ts` | Ramp context (stub) |
| `src/lib/copilot/contexts/payroll.ts` | Payroll context (stub) |
| `src/lib/copilot/contexts/assets.ts` | Assets context (stub) |
| `src/lib/copilot/contexts/bank-rec.ts` | Bank rec context (stub) |
| `src/lib/copilot/contexts/budgets.ts` | Budgets context (stub) |
| `src/lib/copilot/contexts/reports.ts` | Reports context (stub) |
| `src/lib/copilot/contexts/compliance.ts` | Compliance context (stub) |
| `src/app/api/copilot/route.ts` | Copilot API proxy endpoint |
| `src/components/copilot/CopilotPanel.tsx` | Right-side sliding panel |
| `src/components/copilot/CopilotToggle.tsx` | Persistent toggle button |
| `src/components/copilot/CopilotMessage.tsx` | Message bubble component |
| `src/components/copilot/CopilotProvider.tsx` | React context provider |
| `src/components/copilot/useCopilot.ts` | Client-side hook |
| `src/components/copilot/index.ts` | Barrel exports |
| Test files (11+ files) | Unit + E2E tests |

### Modified files

| File | Change |
|------|--------|
| `src/app/(protected)/layout.tsx` | Add CopilotProvider wrapper |
| `src/app/(protected)/accounts/accounts-client.tsx` | Pass context to copilot |
| `src/app/(protected)/funds/funds-client.tsx` | Pass context to copilot |
| `src/app/(protected)/(dashboard)/page.tsx` | Pass context to copilot |
| `src/components/providers.tsx` | No change needed (copilot provider is in protected layout) |

---

## Acceptance Criteria

### From requirements.md

| ID | Requirement | How satisfied |
|----|-------------|---------------|
| SYS-P0-001 | Every page includes right-panel AI copilot with page-specific context | CopilotPanel in protected layout, context packages per page |
| SYS-P0-002 | Copilot connects to Anthropic API via server-side proxy | `/api/copilot/route.ts` with streaming |
| SYS-P0-003 | v1: copilot within financial-system data only | All tools query local DB only (except eCFR/ProPublica for reference) |
| SYS-P0-004 | Supersedes standalone AI features (D-128 depreciation, D-130 transaction) | Context packages on those pages replace standalone features |

### From implementation_plan.md

| Task | How satisfied |
|------|---------------|
| Copilot panel component with chat UI | CopilotPanel.tsx with Sheet, messages, streaming |
| API proxy to Anthropic | `/api/copilot/route.ts` with tool execution loop |
| Context package interface | `CopilotContextPackage` type in types.ts |
| Tax law knowledge layer (~50-100 docs) | `knowledge/` directory with curated corpus |
| eCFR API client | `ecfr-client.ts` with caching |
| `taxLawSearch` tool | `tools/tax-law-search.ts` |
| `regulationLookup` tool | `tools/regulation-lookup.ts` |
| `nonprofitExplorerLookup` tool | `tools/nonprofit-explorer.ts` |
| Context packages for each page | 16 context files (3 full, 13 stubs) |
| Tool execution server-side | `tool-executor.ts` with handler routing |
| Conversation persistence | localStorage per user per page |
| Copilot panel in root layout | CopilotProvider in protected layout |

---

## Execution Order

The steps below are designed for sequential execution with `/execute-phase`.

1. **Core types & config** (types.ts, config.ts, index.ts)
2. **Knowledge corpus** (directory structure, ~20-25 .txt files, loader)
3. **External API clients** (ecfr-client.ts, propublica-client.ts)
4. **Copilot tools** (8 tool handlers + tool-executor.ts)
5. **Context packages** (registry + 16 context files)
6. **API proxy route** (/api/copilot/route.ts)
7. **UI components** (CopilotMessage, CopilotPanel, CopilotToggle, useCopilot hook)
8. **CopilotProvider + layout integration** (provider, layout modification, page updates)
9. **Conversation persistence** (storage.ts)
10. **Tests** (unit tests for tools, knowledge, clients, contexts; E2E test)

---

## Risk Notes

| Risk | Mitigation |
|------|-----------|
| Knowledge corpus accuracy | Source exclusively from primary authorities (IRC, CFR, IRS pubs). Include citation in every file. Review annually. |
| eCFR API availability | Cache aggressively (regulations change rarely). Graceful fallback to static knowledge if API is down. |
| Anthropic API costs | Use Sonnet (not Opus) for copilot. Max 4096 tokens per response. Streaming for perceived speed. |
| Context window size | Topic-based knowledge selection keeps prompts focused. Don't load all 50+ docs — only topics relevant to current page. |
| Copilot gives wrong tax advice | Always include "cite sources" instruction in system prompt. Disclaimer in panel header. Tax knowledge corpus is reference only. |

---

## Cross-Phase Dependencies (from Feb 2025 MCP Research)

Phase 18's knowledge corpus references Phase 6 schema decisions:

**Phase 6 donors table — no `is_disqualified_person` field needed.** RI is classified 170(b)(1)(A)(vi) and files Schedule A Part II, which uses a universal 2% cap (Line 5) on ALL donors — there is no disqualified person exclusion in Part II. The "Line 7a disqualified person exclusion" exists only in Part III, which is for 509(a)(2) organizations. RI is not a 509(a)(2) org.

**What Part II Line 5 actually needs from § 4946:** The IRS instructions for Line 5 state that contributions from persons related under § 4946(a)(1)(C)-(G) (family members, 20%+ entity owners, 35%+ controlled corporations/partnerships/trusts) are **aggregated as if made by one person** for the 2% cap. This is a donor grouping mechanism, not an exclusion mechanism. The future data model need (~FY2030) is a **donor relationship/family group feature**, not a boolean flag.

**What IS correct in Phase 6:** The `contribution_source_type` enum (GOVERNMENT/PUBLIC/RELATED_PARTY) on DM-P0-018 is correct and necessary. Government sources map to Part II Line 3 (full credit, exempt from 2% cap). Public and related_party sources map to Line 1 (subject to 2% cap). No enum change needed.

**Additional context from comparable org research:**
- Several small MA housing nonprofits carry negative net assets from development debt (Quadraplex Housing: -$439K, Caleb Housing: -$404K). RI should expect this pattern with $3.5M AHP loan + $487K deferred developer fee. This is normal for the sector — the copilot should be prepared to explain it when users ask about negative net asset balances on the balance sheet.
- Post-construction, RI's revenue shifts to rental income (program service revenue, NOT public support). The compliance context package should proactively flag this risk as RI approaches the end of its 5-year grace period.

---

## Dependencies Verification

Before starting Phase 18 execution:

- [x] `@anthropic-ai/sdk` in package.json (confirmed: ^0.74.0)
- [x] Auth working (NextAuth v5 + Zitadel)
- [x] Protected layout exists with sidebar structure
- [x] Help terms infrastructure exists (`src/lib/help/terms.ts`)
- [x] shadcn/ui Sheet component available (via radix-ui)
- [x] GL engine operational for DB query tools
- [x] Audit logger operational for audit log search tool
- [ ] ANTHROPIC_API_KEY environment variable configured (needed at runtime)
