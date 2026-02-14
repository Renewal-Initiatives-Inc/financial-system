# Phase 7: Revenue Recording — Execution Plan

**Goal:** Build all revenue entry paths — rent, grants, donations, earned income, pledges, in-kind contributions, AHP loan forgiveness. Establish the first cron job pattern (rent accrual). Connect Postmark for donor acknowledgment letters.

**Dependencies (verified):**
- Phase 5 (Journal Entry & Transactions) — GL engine (`createTransaction`), transaction list, correction workflows
- Phase 6 (Vendors, Tenants, Donors) — CRUD for all three entity types, `AccountSelector`, `FundSelector` components

**Requirement IDs satisfied:** TXN-P0-004 through TXN-P0-016, TXN-P0-052, TXN-P0-053, DM-P0-016 through DM-P0-022, DM-P0-025

---

## Step 1: New Database Tables & Enums

### 1a. New enums in `src/lib/db/schema/enums.ts`

```
grantTypeEnum: 'CONDITIONAL' | 'UNCONDITIONAL'
grantStatusEnum: 'ACTIVE' | 'COMPLETED' | 'CANCELLED'
pledgeStatusEnum: 'PLEDGED' | 'RECEIVED' | 'WRITTEN_OFF'
```

### 1b. `grants` table — `src/lib/db/schema/grants.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| funderId | integer FK vendors | The funding organization |
| amount | numeric(15,2) NOT NULL | Award amount |
| type | grantTypeEnum NOT NULL | Conditional vs unconditional |
| conditions | text, nullable | Free-text conditions for conditional grants |
| startDate | date, nullable | |
| endDate | date, nullable | |
| fundId | integer FK funds NOT NULL | Which restricted fund |
| status | grantStatusEnum NOT NULL, default 'ACTIVE' | |
| isUnusualGrant | boolean, default false | Per Reg. 1.509(a)-3(c)(4) |
| createdAt | timestamp, defaultNow | |
| updatedAt | timestamp, defaultNow | |

Indexes: `grants_funder_id_idx`, `grants_fund_id_idx`, `grants_status_idx`

### 1c. `pledges` table — `src/lib/db/schema/pledges.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | |
| donorId | integer FK donors NOT NULL | |
| amount | numeric(15,2) NOT NULL | |
| expectedDate | date, nullable | When payment is expected |
| fundId | integer FK funds NOT NULL | |
| status | pledgeStatusEnum NOT NULL, default 'PLEDGED' | |
| glTransactionId | integer FK transactions, nullable | GL entry ID when recorded |
| createdAt | timestamp, defaultNow | |
| updatedAt | timestamp, defaultNow | |

Indexes: `pledges_donor_id_idx`, `pledges_fund_id_idx`, `pledges_status_idx`

### 1d. `ahpLoan` singleton config table — `src/lib/db/schema/ahp-loan.ts`

| Column | Type | Notes |
|--------|------|-------|
| id | serial PK | Always 1 row |
| creditLimit | numeric(15,2) NOT NULL | $3.5M |
| currentDrawnAmount | numeric(15,2) NOT NULL | |
| currentInterestRate | numeric(7,5) NOT NULL | e.g., 0.03000 |
| rateEffectiveDate | date NOT NULL | |
| annualPaymentDate | varchar(5) | 'MM-DD' format, e.g., '12-31' |
| lastPaymentDate | date, nullable | |
| updatedAt | timestamp, defaultNow | |

No indexes needed (singleton).

### 1e. Update schema `index.ts`

- Export new tables: `grants`, `pledges`, `ahpLoan`
- Add relations:
  - `grantsRelations`: `funder → vendors`, `fund → funds`
  - `pledgesRelations`: `donor → donors`, `fund → funds`, `glTransaction → transactions`
  - `donorsRelations`: add `many(pledges)`
  - `vendorsRelations`: add `many(grants)`

### 1f. Run migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

**Files created:**
- `src/lib/db/schema/grants.ts`
- `src/lib/db/schema/pledges.ts`
- `src/lib/db/schema/ahp-loan.ts`

**Files modified:**
- `src/lib/db/schema/enums.ts` (3 new enums)
- `src/lib/db/schema/index.ts` (exports + relations)

---

## Step 2: Validators

### 2a. `src/lib/validators/grants.ts`

- `insertGrantSchema`: funder_id (required), amount (positive decimal), type (conditional/unconditional), conditions (required if conditional, optional if unconditional), startDate, endDate, fundId (required), isUnusualGrant (boolean default false)
- `updateGrantSchema`: partial version for edits
- Types: `InsertGrant`, `UpdateGrant`

### 2b. `src/lib/validators/pledges.ts`

- `insertPledgeSchema`: donorId (required), amount (positive decimal), expectedDate (optional), fundId (required)
- `updatePledgeSchema`: partial for status changes
- Types: `InsertPledge`, `UpdatePledge`

### 2c. `src/lib/validators/revenue.ts`

Schemas for all revenue recording forms:

- `rentPaymentSchema`: tenantId, amount, date, fundId (defaults to General Fund)
- `rentAdjustmentSchema`: tenantId, adjustmentType (enum: PRORATION/HARDSHIP/VACATE), amount, date, fundId, note (required, min 1 char — mandatory annotation per TXN-P0-006)
- `donationSchema`: donorId, amount, date, fundId, contributionSourceType (GOVERNMENT/PUBLIC/RELATED_PARTY), isUnusualGrant (boolean, default false)
- `earnedIncomeSchema`: amount, description, date, accountId (revenue accounts only), fundId (defaults to General Fund)
- `investmentIncomeSchema`: amount, date
- `ahpLoanForgivenessSchema`: amount, date
- `inKindContributionSchema`: amount, description, date, fundId, inKindType (GOODS/SERVICES/FACILITY_USE)
- `grantCashReceiptSchema`: grantId, amount, date
- `grantConditionMetSchema`: grantId, amount (partial or full), date, note

### 2d. Update `src/lib/validators/index.ts`

- Re-export all new validators

**Files created:**
- `src/lib/validators/grants.ts`
- `src/lib/validators/pledges.ts`
- `src/lib/validators/revenue.ts`

**Files modified:**
- `src/lib/validators/index.ts`

---

## Step 3: Revenue Business Logic

### 3a. Rent proration calculator — `src/lib/revenue/rent-proration.ts`

Per MA G.L. c. 186 § 4 (TXN-P0-007):
```
dailyRate = monthlyRent / actualCalendarDaysInMonth
proratedAmount = dailyRate * daysOccupied
```

Export: `calculateProratedRent(monthlyRent: number, year: number, month: number, moveDate: Date, isMoveIn: boolean): { dailyRate: number, daysOccupied: number, amount: number }`

### 3b. Rent accrual logic — `src/lib/revenue/rent-accrual.ts`

Monthly batch function for the cron job:
- Query all active tenants
- For each tenant: build GL entry (DR Accounts Receivable 1100, CR Rental Income 4000)
- Fund defaults to General Fund (tenants don't have a fund column — rental income is unrestricted)
- Source type: `SYSTEM`, isSystemGenerated: true
- Memo: `"Monthly rent accrual - {tenant name} - Unit {unit} - {month/year}"`
- Returns: list of created transaction IDs, any errors
- Idempotency: check if accrual already exists for tenant+month before creating

### 3c. Donor acknowledgment logic — `src/lib/revenue/donor-acknowledgment.ts`

- `shouldSendAcknowledgment(amount: number): boolean` — threshold check (>$250 per TXN-P0-011)
- `buildAcknowledgmentData(donor, donation)` — assemble template data (name, date, amount, no-goods-or-services statement)
- `sendDonorAcknowledgment(data)` — call Postmark API with template

### 3d. AHP loan operations — `src/lib/revenue/ahp-loan.ts`

- `getAhpLoanConfig()` — fetch singleton row
- `recordLoanForgiveness(amount, date, userId)` — create GL entry (DR AHP Loan Payable 2100, CR Donation Income 4200), reduce creditLimit by forgivenAmount, audit log
- `getAvailableCredit()` — creditLimit - currentDrawnAmount

### 3e. Grant operations — `src/lib/revenue/grants.ts`

- `recordUnconditionalGrant(grant, userId)` — GL entry: DR Grants Receivable 1110, CR Grant Revenue 4100, coded to restricted fund. Auto-triggers restricted fund release if expense.
- `recordGrantCashReceipt(grantId, amount, date, userId)` — GL entry: DR Cash, CR Grants Receivable 1110
- `recordConditionalGrantCash(grant, userId)` — GL entry: DR Cash, CR Refundable Advance 2050
- `recognizeConditionalGrant(grantId, amount, date, note, userId)` — GL entry: DR Refundable Advance 2050, CR Grant Revenue 4100

**Files created:**
- `src/lib/revenue/rent-proration.ts`
- `src/lib/revenue/rent-accrual.ts`
- `src/lib/revenue/donor-acknowledgment.ts`
- `src/lib/revenue/ahp-loan.ts`
- `src/lib/revenue/grants.ts`
- `src/lib/revenue/index.ts`

---

## Step 4: Postmark Integration

### 4a. Postmark client — `src/lib/integrations/postmark.ts`

- Initialize Postmark `ServerClient` with env var `POSTMARK_API_KEY`
- `sendTemplateEmail(templateAlias, to, templateModel)` — wrapper
- `sendDonorAcknowledgmentEmail(to, data)` — uses donor acknowledgment template
- Template includes: Heather's signature image, RI letterhead, donor name, date, amount, no-goods-or-services statement
- Error handling: catch and log failures, don't block GL entry creation

### 4b. Environment variable

- `POSTMARK_API_KEY` — add to `.env.example` and Vercel env config
- `POSTMARK_DONOR_ACK_TEMPLATE` — template alias or ID

**Files created:**
- `src/lib/integrations/postmark.ts`

**Files modified:**
- `.env.example` (add Postmark vars)

**Package to install:**
- `postmark`

---

## Step 5: Cron Job — Rent Accrual

### 5a. `src/app/api/cron/rent-accrual/route.ts`

First cron job in the system — establishes the pattern for all future crons.

```typescript
export async function GET(request: Request) {
  // 1. Verify cron secret (Vercel CRON_SECRET header)
  // 2. Determine current month (or accept month param for backfill)
  // 3. Call rentAccrualBatch(year, month)
  // 4. Return JSON summary: { tenantsProcessed, entriesCreated, errors }
}
```

- Vercel cron authentication: check `Authorization: Bearer ${CRON_SECRET}` header
- Scheduled for 1st of each month via `vercel.json`

### 5b. `vercel.json` (create)

```json
{
  "crons": [
    {
      "path": "/api/cron/rent-accrual",
      "schedule": "0 6 1 * *"
    }
  ]
}
```

6 AM UTC on the 1st of each month.

**Files created:**
- `src/app/api/cron/rent-accrual/route.ts`
- `vercel.json`

---

## Step 6: Revenue Pages & Server Actions

### Architecture

Revenue gets a hub page at `/revenue` with navigation to sub-sections. Each revenue type gets its own recording form, all flowing through the GL engine.

### 6a. Revenue hub page — `src/app/(protected)/revenue/page.tsx`

Replace the stub. Revenue landing page with navigation cards linking to each sub-section:
- Rent (accrual review, payments, adjustments)
- Grants (record, cash receipt, condition met)
- Donations
- Pledges
- Earned Income
- Investment Income
- AHP Loan Forgiveness
- In-Kind Contributions

### 6b. Server actions — `src/app/(protected)/revenue/actions.ts`

All revenue recording actions, following the established pattern:

**Queries:**
- `getRecentRevenue(limit?)` — recent revenue transactions (source filter)
- `getRentAccruals(year, month)` — rent accruals for a period
- `getGrants(filters?)` — grant list with funder name
- `getGrantById(id)` — grant detail with funding history
- `getPledges(filters?)` — pledge list with donor name
- `getPledgeById(id)` — pledge detail
- `getDonations(filters?)` — donations with donor name (fulfills donor giving history stub)
- `getAhpLoanStatus()` — current AHP loan state

**Mutations (all audit-logged, all through GL engine):**
- `recordRentPayment(data, userId)` — DR Cash, CR AR
- `recordRentAdjustment(data, userId)` — DR/CR adjustment accounts with mandatory note
- `recordDonation(data, userId)` — DR Cash/Pledges Receivable, CR Donation Income. Triggers Postmark if >$250
- `createGrant(data, userId)` — insert into grants table + GL entry based on type
- `recordGrantCashReceipt(data, userId)` — DR Cash, CR Grants Receivable
- `recognizeConditionalGrantRevenue(data, userId)` — DR Refundable Advance, CR Grant Revenue
- `createPledge(data, userId)` — insert into pledges table + GL entry (DR Pledges Receivable, CR Donation Income)
- `recordPledgePayment(pledgeId, amount, date, userId)` — DR Cash, CR Pledges Receivable, update pledge status
- `recordEarnedIncome(data, userId)` — DR Cash/AR, CR selected revenue account
- `recordInvestmentIncome(data, userId)` — DR Cash, CR Investment Income
- `recordAhpLoanForgiveness(data, userId)` — DR AHP Loan Payable, CR Donation Income, update ahpLoan
- `recordInKindContribution(data, userId)` — DR appropriate asset/expense, CR In-Kind revenue account

### 6c. Rent pages

**`/revenue/rent/page.tsx`** — Rent overview dashboard:
- Current month accrual status (which tenants accrued, total)
- Quick actions: Record Payment, Record Adjustment
- Link to run manual accrual (for backfill/testing)

**`/revenue/rent/payment/page.tsx`** — Rent payment receipt form:
- Tenant selector (active tenants only)
- Auto-fills: unit number, monthly rent, outstanding AR balance
- Amount, Date, Fund (defaults General Fund)
- GL: DR Cash (Checking), CR Accounts Receivable
- `data-testid` attributes on all interactive elements

**`/revenue/rent/adjustment/page.tsx`** — Rent adjustment form:
- Tenant selector
- Adjustment type: Proration / Hardship / Vacate (radio group)
- Amount, Date, Fund
- Explanatory note (required — cannot submit blank per TXN-P0-006)
- For Proration: auto-calculate button using MA proration formula (move-in/move-out date → prorated amount)
- GL: DR/CR to appropriate adjustment account (4010/4020/4030)

### 6d. Grant pages

**`/revenue/grants/page.tsx`** — Grant list:
- DataTable: funder name, amount, type (conditional/unconditional badge), fund, status, remaining balance
- Create Grant button → dialog or dedicated page

**`/revenue/grants/new/page.tsx`** — Create Grant form:
- Funder selector (from vendors, filtered to relevant)
- Amount, Type (conditional/unconditional toggle)
- Conditions field (shown only for conditional, required)
- Start date, End date, Fund selector (restricted funds)
- isUnusualGrant checkbox (with HelpTooltip explaining Reg. 1.509(a)-3(c)(4))
- On save: creates grant record + GL entry

**`/revenue/grants/[id]/page.tsx`** — Grant detail:
- Grant info (funder, amount, type, conditions, dates, fund)
- Funding history: list of cash receipts and revenue recognitions
- Remaining balance (for conditional: refundable advance balance; for unconditional: grants receivable balance)
- Actions: Record Cash Receipt, Recognize Revenue (conditional only), Edit Grant

### 6e. Donation page

**`/revenue/donations/page.tsx`** — Donation recording form + recent donations list:
- Donor selector (with link to create new donor inline)
- Amount, Date
- Fund selector (restricted or unrestricted)
- Contribution source type: Government / Public / Related Party (required per DM-P0-018, with HelpTooltip explaining Schedule A implications)
- isUnusualGrant checkbox (hidden by default, shown via "advanced" toggle with HelpTooltip)
- On save: GL entry + Postmark acknowledgment if >$250
- Recent donations table below form

### 6f. Pledge page

**`/revenue/pledges/page.tsx`** — Pledge list + recording form:
- Create Pledge form: donor selector, amount, expected date, fund
- GL entry: DR Pledges Receivable, CR Donation Income
- Pledge list table: donor, amount, expected date, status, fund
- Row actions: Record Payment (changes status to RECEIVED)

### 6g. Other revenue pages

**`/revenue/earned-income/page.tsx`** — Earned income recording:
- Amount, Description, Date
- Account selector (filtered to revenue accounts only)
- Fund selector (defaults to General/Unrestricted)
- GL: DR Cash/AR, CR selected revenue account

**`/revenue/investment-income/page.tsx`** — Investment income recording:
- Amount, Date
- GL: DR Cash, CR Investment Income (4400)

**`/revenue/ahp-forgiveness/page.tsx`** — AHP loan forgiveness recording:
- Current loan status display (drawn, available, rate)
- Amount to forgive
- Date
- GL: DR AHP Loan Payable (2100), CR Donation Income (4200)
- Warning if amount > currentDrawnAmount
- Updates ahpLoan.creditLimit (permanently reduces)

**`/revenue/in-kind/page.tsx`** — In-kind contribution recording:
- Type selector: Goods / Services / Facility Use
- Amount (FMV), Description, Date, Fund
- GL: DR appropriate account, CR In-Kind Goods (4500) / In-Kind Services (4510) / In-Kind Facility Use (4520)
- HelpTooltip explaining ASC 958-605 3-part test for services

**Files created (pages):**
- `src/app/(protected)/revenue/page.tsx` (replace stub)
- `src/app/(protected)/revenue/actions.ts`
- `src/app/(protected)/revenue/rent/page.tsx`
- `src/app/(protected)/revenue/rent/payment/page.tsx`
- `src/app/(protected)/revenue/rent/adjustment/page.tsx`
- `src/app/(protected)/revenue/grants/page.tsx`
- `src/app/(protected)/revenue/grants/new/page.tsx`
- `src/app/(protected)/revenue/grants/[id]/page.tsx`
- `src/app/(protected)/revenue/donations/page.tsx`
- `src/app/(protected)/revenue/pledges/page.tsx`
- `src/app/(protected)/revenue/earned-income/page.tsx`
- `src/app/(protected)/revenue/investment-income/page.tsx`
- `src/app/(protected)/revenue/ahp-forgiveness/page.tsx`
- `src/app/(protected)/revenue/in-kind/page.tsx`

**Client components (as needed per page — follow donors/tenants pattern):**
- Form components within each page directory or as separate `*-client.tsx` files
- Reuse existing `AccountSelector`, `FundSelector`, `DataTable`, `HelpTooltip`

---

## Step 7: Wire Donor Giving History

### 7a. Update `src/app/(protected)/donors/actions.ts`

Replace `getDonorGivingSummary()` stub with real implementation:
- Query transactions where donorId matches (via donation records or transaction source reference)
- Sum total giving, list recent gifts with date/amount/fund
- Returns: `{ totalGiving, giftCount, recentGifts: { date, amount, fund, type }[] }`

### 7b. Update donor detail page

- Replace "Giving History" placeholder card with real data from `getDonorGivingSummary()`
- Show: total lifetime giving, recent gifts table, link to full donation history in revenue section

**Files modified:**
- `src/app/(protected)/donors/actions.ts`
- `src/app/(protected)/donors/[id]/donor-detail-client.tsx`

---

## Step 8: Help Tooltips

### 8a. Add revenue-specific terms to `src/lib/help/terms.ts`

New terms to add:
- `rent-accrual` — Monthly recognition of rental income when due (1st of month). DR Accounts Receivable, CR Rental Income.
- `rent-proration` — MA G.L. c. 186 § 4: daily rate = monthly rent / calendar days in month × days occupied. Required for move-in and move-out.
- `rent-adjustment` — Adjustments to rental income: Proration (move-in/out), Hardship (reduced rent), Vacate (early termination). Each recorded in separate GL accounts with mandatory explanatory note.
- `grant-conditional` — Revenue recognized only when conditions are met (ASC 958). Recorded as Refundable Advance (liability) until conditions satisfied.
- `grant-unconditional` — Revenue recognized immediately at award (ASC 958). DR Grants Receivable, CR Grant Revenue.
- `refundable-advance` — Liability account for conditional grant cash received before conditions are met. Reclassified to Grant Revenue when conditions satisfied.
- `pledge` — Written promise by a donor to contribute. Recognized immediately: DR Pledges Receivable, CR Donation Income. No PV discounting.
- `contribution-source-type` — IRS classification for Schedule A public support test: Government, Public, or Related Party. Required on every contribution for future compliance.
- `unusual-grant` — Per Reg. 1.509(a)-3(c)(4), excludable from Schedule A public support test numerator and denominator. Examples: one-time large gifts attracted by unusual events.
- `donor-acknowledgment` — IRS-required written acknowledgment for donations >$250. Includes donor name, date, amount, and statement regarding goods/services provided.
- `in-kind-contribution` — Non-cash contribution at fair market value. Three types: Goods (donated physical assets), Services (specialized services meeting ASC 958-605 3-part test), Facility Use.
- `earned-income` — Revenue from exchange transactions (farm lease, fees). Classified as unrestricted. Schedule A Line 10a but not Line 1.
- `investment-income` — Interest and investment returns on unrestricted cash. Classified as unrestricted revenue.
- `ahp-loan-forgiveness` — AHP loan principal forgiven. Treated as unconditional donation: DR AHP Loan Payable, CR Donation Income. Permanently reduces maximum available credit.
- `grant-cash-receipt` — Cash received on an unconditional grant receivable. DR Cash, CR Grants Receivable. Does not trigger new revenue — revenue was recognized at award.

**Files modified:**
- `src/lib/help/terms.ts`

---

## Step 9: Tests

### 9a. Unit tests — `src/lib/revenue/rent-proration.test.ts`

- 30-day month (June): move-in on 15th → 16 days × dailyRate
- 31-day month (January): move-in on 1st → full month
- 28-day month (February non-leap): move-out on 14th → 14 days
- 29-day month (February leap year): full month
- Edge case: move-in on last day of month → 1 day
- Edge case: move-out on 1st of month → 1 day
- Rounding: verify to 2 decimal places

### 9b. Unit tests — `src/lib/revenue/rent-accrual.test.ts`

- Active tenant generates accrual entry
- Inactive tenant skipped
- Idempotency: running twice for same month doesn't duplicate
- Multiple tenants generate separate entries
- Each entry has source_type = SYSTEM, is_system_generated = true
- Correct accounts: DR 1100 (AR), CR 4000 (Rental Income)

### 9c. Unit tests — `src/lib/revenue/grants.test.ts`

- Unconditional grant creates GL entry with DR Grants Receivable, CR Grant Revenue
- Unconditional grant to restricted fund triggers net asset release (verify via GL engine)
- Conditional grant cash creates DR Cash, CR Refundable Advance (no revenue)
- Condition-met recognition creates DR Refundable Advance, CR Grant Revenue
- Cash receipt on unconditional reduces grants receivable

### 9d. Unit tests — `src/lib/revenue/donor-acknowledgment.test.ts`

- Amount > $250 → shouldSendAcknowledgment returns true
- Amount = $250 → returns false (strictly greater than)
- Amount < $250 → returns false
- buildAcknowledgmentData includes required fields

### 9e. Validator tests — `src/lib/validators/__tests__/grants.test.ts`

- Valid grant with all fields passes
- Missing funderId fails
- Conditional grant without conditions fails
- Unconditional grant with conditions passes (optional)
- Negative amount fails

### 9f. Validator tests — `src/lib/validators/__tests__/pledges.test.ts`

- Valid pledge passes
- Missing donorId fails
- Negative amount fails

### 9g. Validator tests — `src/lib/validators/__tests__/revenue.test.ts`

- Rent adjustment without note fails (mandatory annotation)
- Donation without contribution source type fails
- AHP forgiveness with negative amount fails
- In-kind contribution with valid type passes

### 9h. Schema tests — update `src/lib/db/schema/schema.test.ts`

- Verify grants table has expected columns
- Verify pledges table has expected columns
- Verify ahpLoan table has expected columns
- Verify new enums have correct values

### 9i. E2E test — `tests/e2e/revenue/donation.spec.ts`

1. Navigate to /revenue/donations
2. Fill in donation form (select donor, enter amount > $250, select fund, select source type)
3. Submit
4. Verify success toast
5. Verify GL entry created (navigate to transactions, find the entry)
6. Verify Postmark acknowledgment triggered (mock Postmark — verify API call made)

### 9j. E2E test — `tests/e2e/revenue/grant.spec.ts`

1. Navigate to /revenue/grants/new
2. Create unconditional grant (select funder, enter amount, select restricted fund)
3. Submit
4. Verify grant appears in grant list
5. Navigate to grant detail
6. Record cash receipt
7. Verify GL entries

**Files created:**
- `src/lib/revenue/rent-proration.test.ts`
- `src/lib/revenue/rent-accrual.test.ts`
- `src/lib/revenue/grants.test.ts`
- `src/lib/revenue/donor-acknowledgment.test.ts`
- `src/lib/validators/__tests__/grants.test.ts`
- `src/lib/validators/__tests__/pledges.test.ts`
- `src/lib/validators/__tests__/revenue.test.ts`
- `tests/e2e/revenue/donation.spec.ts`
- `tests/e2e/revenue/grant.spec.ts`

**Files modified:**
- `src/lib/db/schema/schema.test.ts`

---

## Step 10: Seed Data

### 10a. AHP loan seed — in migration or seed script

Insert singleton row into `ahp_loan`:
- creditLimit: 3500000.00
- currentDrawnAmount: 0.00 (will be set during FY25 migration)
- currentInterestRate: 0.03000 (placeholder — actual rate TBD)
- rateEffectiveDate: '2025-01-01'
- annualPaymentDate: '12-31'
- lastPaymentDate: null

---

## Execution Order

Tasks are grouped into batches that can be executed sequentially. Within each batch, items are independent and could be parallelized.

### Batch A: Foundation (schema + validators + business logic)
1. Step 1: Database tables, enums, migration
2. Step 2: Validators
3. Step 3a: Rent proration calculator
4. Step 3b: Rent accrual logic
5. Step 3c: Donor acknowledgment logic
6. Step 3d: AHP loan operations
7. Step 3e: Grant operations

### Batch B: Infrastructure
8. Step 4: Postmark integration
9. Step 5: Cron job + vercel.json
10. Step 10: AHP loan seed data

### Batch C: Revenue pages (can start after Batch A)
11. Step 6a: Revenue hub page
12. Step 6b: Server actions
13. Step 6c: Rent pages (overview, payment, adjustment)
14. Step 6d: Grant pages (list, create, detail)
15. Step 6e: Donation page
16. Step 6f: Pledge page
17. Step 6g: Other revenue pages (earned income, investment income, AHP forgiveness, in-kind)

### Batch D: Connections
18. Step 7: Wire donor giving history
19. Step 8: Help tooltips

### Batch E: Tests
20. Step 9a-9d: Unit tests (revenue logic)
21. Step 9e-9g: Validator tests
22. Step 9h: Schema tests
23. Step 9i-9j: E2E tests

---

## Acceptance Criteria

| Requirement | Acceptance Test |
|-------------|----------------|
| TXN-P0-004 | Monthly rent accrual cron generates DR AR, CR Rental Income per active tenant |
| TXN-P0-005 | Rent payment form records DR Cash, CR AR with tenant selector |
| TXN-P0-006 | Rent adjustment requires type (Proration/Hardship/Vacate) + mandatory note |
| TXN-P0-007 | Proration calculator uses MA formula (monthly rent / calendar days * days occupied) |
| TXN-P0-008 | Unconditional grant: DR Grants Receivable, CR Grant Revenue to restricted fund |
| TXN-P0-009 | Conditional grant: DR Cash → CR Refundable Advance; on conditions met → DR Refundable Advance, CR Grant Revenue |
| TXN-P0-010 | Donation: DR Cash, CR Donation Income with contribution source type tag |
| TXN-P0-011 | Donations >$250 trigger Postmark acknowledgment letter |
| TXN-P0-013 | Earned income: DR Cash/AR, CR revenue account, defaults unrestricted |
| TXN-P0-014 | Investment income: DR Cash, CR Investment Income |
| TXN-P0-015 | AHP forgiveness: DR AHP Loan Payable, CR Donation Income, reduces max credit |
| TXN-P0-016 | Pledge: DR Pledges Receivable, CR Donation Income |
| TXN-P0-052 | In-kind contributions post to correct revenue account (Goods/Services/Facility Use) |
| DM-P0-016 | Donor entity with giving history queryable |
| DM-P0-017 | Each donation links to donor_id |
| DM-P0-018 | Contribution source type tag on every contribution (government/public/related_party) |
| DM-P0-021 | Grant entity with type, conditions, fund, status |
| DM-P0-022 | Pledge entity with donor, amount, expected date, fund, status |
| DM-P0-025 | AHP loan singleton config with credit_limit, drawn_amount, rate, dates |
| INV-007 | Restricted fund expenses auto-generate net asset release (already in GL engine — verify with restricted grant test) |
| INV-011 | All revenue entries carry correct source_type (MANUAL for user-entered, SYSTEM for cron) |
| INV-012 | All mutations audit-logged |

---

## File Summary

### New files (33)
- `src/lib/db/schema/grants.ts`
- `src/lib/db/schema/pledges.ts`
- `src/lib/db/schema/ahp-loan.ts`
- `src/lib/validators/grants.ts`
- `src/lib/validators/pledges.ts`
- `src/lib/validators/revenue.ts`
- `src/lib/revenue/rent-proration.ts`
- `src/lib/revenue/rent-accrual.ts`
- `src/lib/revenue/donor-acknowledgment.ts`
- `src/lib/revenue/ahp-loan.ts`
- `src/lib/revenue/grants.ts`
- `src/lib/revenue/index.ts`
- `src/lib/integrations/postmark.ts`
- `src/app/api/cron/rent-accrual/route.ts`
- `vercel.json`
- `src/app/(protected)/revenue/page.tsx` (replace stub)
- `src/app/(protected)/revenue/actions.ts`
- `src/app/(protected)/revenue/rent/page.tsx`
- `src/app/(protected)/revenue/rent/payment/page.tsx`
- `src/app/(protected)/revenue/rent/adjustment/page.tsx`
- `src/app/(protected)/revenue/grants/page.tsx`
- `src/app/(protected)/revenue/grants/new/page.tsx`
- `src/app/(protected)/revenue/grants/[id]/page.tsx`
- `src/app/(protected)/revenue/donations/page.tsx`
- `src/app/(protected)/revenue/pledges/page.tsx`
- `src/app/(protected)/revenue/earned-income/page.tsx`
- `src/app/(protected)/revenue/investment-income/page.tsx`
- `src/app/(protected)/revenue/ahp-forgiveness/page.tsx`
- `src/app/(protected)/revenue/in-kind/page.tsx`
- `src/lib/revenue/rent-proration.test.ts`
- `src/lib/revenue/rent-accrual.test.ts`
- `src/lib/revenue/grants.test.ts`
- `src/lib/revenue/donor-acknowledgment.test.ts`

### Test files (6 new)
- `src/lib/validators/__tests__/grants.test.ts`
- `src/lib/validators/__tests__/pledges.test.ts`
- `src/lib/validators/__tests__/revenue.test.ts`
- `tests/e2e/revenue/donation.spec.ts`
- `tests/e2e/revenue/grant.spec.ts`
- `src/lib/db/schema/schema.test.ts` (modified)

### Modified files (6)
- `src/lib/db/schema/enums.ts`
- `src/lib/db/schema/index.ts`
- `src/lib/validators/index.ts`
- `src/lib/help/terms.ts`
- `src/app/(protected)/donors/actions.ts`
- `src/app/(protected)/donors/[id]/donor-detail-client.tsx`

### Package to install
- `postmark`
