# Phase 6 Execution Plan: Supporting Entities — Vendors, Tenants, Donors

**Phase:** 6 of 22
**Dependencies:** Phase 4 (Accounts & Funds UI) — ✅ Complete
**Branch:** `phase-6-implementation` (from `main`)
**Estimated scope:** 3 entity types × (schema + validators + actions + list + create + detail) + help terms + tests

---

## Prerequisites Verification

Before starting, confirm these Phase 3-4 deliverables are working:

- [ ] GL engine operational (`src/lib/gl/engine.ts`)
- [ ] Audit logger operational (`src/lib/audit/logger.ts`)
- [ ] Accounts and Funds schema in DB with seed data
- [ ] TanStack Table `DataTable` component working (`src/components/shared/data-table.tsx`)
- [ ] Create dialog pattern established (see `accounts/create-account-dialog.tsx`)
- [ ] Detail page pattern established (see `accounts/[id]/account-detail-client.tsx`)
- [ ] Help tooltip system working (`src/lib/help/terms.ts` + `HelpTooltip` component)

---

## Step 1: Database Schema — New Enums

**File:** `src/lib/db/schema/enums.ts`

Add four new enums:

```
w9StatusEnum: 'COLLECTED', 'PENDING', 'NOT_REQUIRED'
fundingSourceTypeEnum: 'TENANT_DIRECT', 'VASH', 'MRVP', 'SECTION_8', 'OTHER_VOUCHER'
donorTypeEnum: 'INDIVIDUAL', 'CORPORATE', 'FOUNDATION', 'GOVERNMENT'
contributionSourceTypeEnum: 'GOVERNMENT', 'PUBLIC', 'RELATED_PARTY'
```

**Note:** `contributionSourceTypeEnum` is defined now (required by DM-P0-018 for Schedule A data capture) but used in Phase 7 (Revenue). Defining it here keeps all entity-related enums together. **Validated by MCP research (Feb 2025):** The 3-category enum (GOVERNMENT/PUBLIC/RELATED_PARTY) is sufficient for Schedule A Part II data capture — the 2% threshold test applies to ALL donors at computation time, not at data-capture time, so no finer-grained enum is needed.

**Acceptance criteria:** Enums created in DB via migration.

---

## Step 2: Database Schema — Vendors Table

**File:** `src/lib/db/schema/vendors.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| name | varchar(255) | NOT NULL | DM-P0-014 |
| address | text | nullable | DM-P0-014 |
| taxId | text | nullable (encrypted at rest by Neon TLS + app-layer AES-256-GCM) | DM-P0-014 |
| entityType | varchar(50) | nullable | DM-P0-014 |
| is1099Eligible | boolean | NOT NULL, default false | DM-P0-015 |
| defaultAccountId | integer | nullable FK → accounts | DM-P0-014 |
| defaultFundId | integer | nullable FK → funds | DM-P0-014 |
| w9Status | w9StatusEnum | NOT NULL, default 'NOT_REQUIRED' | DM-P0-014 |
| w9CollectedDate | date | nullable | DM-P0-014 |
| isActive | boolean | NOT NULL, default true | INV-013 |
| createdAt | timestamp | NOT NULL, defaultNow | — |
| updatedAt | timestamp | NOT NULL, defaultNow | — |

**Indexes:** `vendors_name_idx`, `vendors_is_active_idx`

**Note on tax_id encryption:** For Phase 6, store as plain text in the `text` column. The implementation plan specifies "encrypted at rest by Neon TLS + application-layer AES-256-GCM" — Neon TLS provides encryption in transit and at rest by default. Application-layer encryption for tax_id display masking (show last 4 only) is a polish item. The column is nullable because not all vendors have a tax ID (e.g., utility companies).

---

## Step 3: Database Schema — Tenants Table

**File:** `src/lib/db/schema/tenants.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| name | varchar(255) | NOT NULL | DM-P0-011 |
| unitNumber | varchar(20) | NOT NULL | DM-P0-011 |
| leaseStart | date | nullable | DM-P0-011 |
| leaseEnd | date | nullable | DM-P0-011 |
| monthlyRent | numeric(12,2) | NOT NULL | DM-P0-011 |
| fundingSourceType | fundingSourceTypeEnum | NOT NULL | DM-P0-011 |
| moveInDate | date | nullable | DM-P0-011 |
| securityDepositAmount | numeric(12,2) | nullable | DM-P0-013 |
| escrowBankRef | varchar(255) | nullable | DM-P0-013 |
| depositDate | date | nullable | DM-P0-013 |
| interestRate | numeric(5,4) | nullable | DM-P0-013 |
| statementOfConditionDate | date | nullable | DM-P0-013 |
| tenancyAnniversary | date | nullable (auto-set from moveInDate) | DM-P0-013 |
| isActive | boolean | NOT NULL, default true | INV-013 |
| createdAt | timestamp | NOT NULL, defaultNow | — |
| updatedAt | timestamp | NOT NULL, defaultNow | — |

**Indexes:** `tenants_unit_number_idx`, `tenants_is_active_idx`

**Validation rule (TXN-P0-049):** `securityDepositAmount` must be ≤ `monthlyRent`. Enforced at application layer (Zod validator), not DB constraint, per "warn don't block" principle — but this one is a legal max under MA law so we enforce it hard.

---

## Step 4: Database Schema — Donors Table

**File:** `src/lib/db/schema/donors.ts` (new)

| Column | Type | Constraints | Source |
|--------|------|-------------|--------|
| id | serial | PK | — |
| name | varchar(255) | NOT NULL | DM-P0-016 |
| address | text | nullable | DM-P0-016 |
| email | varchar(255) | nullable | DM-P0-016 |
| type | donorTypeEnum | NOT NULL | DM-P0-016 |
| firstGiftDate | date | nullable | DM-P0-016 |
| isActive | boolean | NOT NULL, default true | INV-013 |
| createdAt | timestamp | NOT NULL, defaultNow | — |
| updatedAt | timestamp | NOT NULL, defaultNow | — |

**Indexes:** `donors_name_idx`, `donors_is_active_idx`

Deliberately minimal per D-038: "Not a CRM — minimal tracking."

---

## Step 5: Schema Relations & Index File Updates

**File:** `src/lib/db/schema/index.ts`

Add:
- `export * from './vendors'`
- `export * from './tenants'`
- `export * from './donors'`
- `vendorsRelations`: defaultAccountId → accounts, defaultFundId → funds
- `tenantsRelations`: (no FKs to other tables yet — rent/AR comes in Phase 7)
- `donorsRelations`: (no FKs to other tables yet — donations come in Phase 7)

---

## Step 6: Run Migration

```bash
npx drizzle-kit generate
npx drizzle-kit push
```

Verify all three tables created with correct columns, types, and constraints.

---

## Step 7: Zod Validators — Vendors

**File:** `src/lib/validators/vendors.ts` (new)

```typescript
// insertVendorSchema
- name: z.string().min(1).max(255)
- address: z.string().nullable().optional()
- taxId: z.string().nullable().optional()
- entityType: z.string().max(50).nullable().optional()
- is1099Eligible: z.boolean().optional().default(false)
- defaultAccountId: z.number().int().positive().nullable().optional()
- defaultFundId: z.number().int().positive().nullable().optional()
- w9Status: z.enum(['COLLECTED', 'PENDING', 'NOT_REQUIRED']).optional().default('NOT_REQUIRED')
- w9CollectedDate: z.string().date().nullable().optional()  // ISO date string

// updateVendorSchema — all optional
- name, address, taxId, entityType, is1099Eligible, defaultAccountId, defaultFundId, w9Status, w9CollectedDate, isActive

// Type exports
- InsertVendor, UpdateVendor
```

---

## Step 8: Zod Validators — Tenants

**File:** `src/lib/validators/tenants.ts` (new)

```typescript
// insertTenantSchema
- name: z.string().min(1).max(255)
- unitNumber: z.string().min(1).max(20)
- leaseStart: z.string().date().nullable().optional()
- leaseEnd: z.string().date().nullable().optional()
- monthlyRent: z.string().regex(/^\d+(\.\d{1,2})?$/)  // decimal as string for Drizzle numeric
- fundingSourceType: z.enum(['TENANT_DIRECT', 'VASH', 'MRVP', 'SECTION_8', 'OTHER_VOUCHER'])
- moveInDate: z.string().date().nullable().optional()
- securityDepositAmount: z.string().regex(/^\d+(\.\d{1,2})?$/).nullable().optional()
- escrowBankRef: z.string().max(255).nullable().optional()
- depositDate: z.string().date().nullable().optional()
- interestRate: z.string().regex(/^\d+(\.\d{1,4})?$/).nullable().optional()
- statementOfConditionDate: z.string().date().nullable().optional()

// Custom refinement: securityDepositAmount <= monthlyRent (TXN-P0-049)
.refine((data) => {
  if (!data.securityDepositAmount) return true
  return parseFloat(data.securityDepositAmount) <= parseFloat(data.monthlyRent)
}, { message: 'Security deposit cannot exceed first month\'s rent (MA G.L. c. 186 § 15B)' })

// updateTenantSchema — all optional, same security deposit validation

// Type exports
- InsertTenant, UpdateTenant
```

---

## Step 9: Zod Validators — Donors

**File:** `src/lib/validators/donors.ts` (new)

```typescript
// insertDonorSchema
- name: z.string().min(1).max(255)
- address: z.string().nullable().optional()
- email: z.string().email().nullable().optional()  // validate email format if provided
- type: z.enum(['INDIVIDUAL', 'CORPORATE', 'FOUNDATION', 'GOVERNMENT'])
- firstGiftDate: z.string().date().nullable().optional()

// updateDonorSchema — all optional

// Type exports
- InsertDonor, UpdateDonor
```

---

## Step 10: Update Validator Index

**File:** `src/lib/validators/index.ts`

Add:
```typescript
export * from './vendors'
export * from './tenants'
export * from './donors'
```

---

## Step 11: Server Actions — Vendors

**File:** `src/app/(protected)/vendors/actions.ts` (new)

Functions:
1. `getVendors(filters?)` — list with optional search, 1099 filter, W-9 status filter, active filter
2. `getVendorById(id)` — full detail including payment totals (stub — populated in Phase 8)
3. `createVendor(data, userId)` — insert + audit log
4. `updateVendor(id, data, userId)` — fetch existing, update, audit log with before/after
5. `toggleVendorActive(id, active, userId)` — soft delete with audit. Guard: if vendor has transaction history (via transaction_lines FK, once vendor invoices exist in Phase 8), warn but allow deactivation
6. `getVendor1099Summary(vendorId, year)` — sum of payments for calendar year. Returns `{ totalPayments: number, threshold: 600, isOver: boolean }`. **Note:** This returns $0 until Phase 8 builds vendor invoices, but the query structure and UI placeholder should be in place now

**Pattern:** Follow `accounts/actions.ts` exactly — `'use server'`, Zod parse, `db.transaction()`, `logAudit()`, `revalidatePath()`.

---

## Step 12: Server Actions — Tenants

**File:** `src/app/(protected)/tenants/actions.ts` (new)

Functions:
1. `getTenants(filters?)` — list with optional search, funding source filter, active filter
2. `getTenantById(id)` — full detail including security deposit info
3. `createTenant(data, userId)` — insert + audit log. Auto-set `tenancyAnniversary` from `moveInDate` if provided
4. `updateTenant(id, data, userId)` — fetch existing, update, audit log. Recalculate `tenancyAnniversary` if `moveInDate` changes
5. `toggleTenantActive(id, active, userId)` — soft delete with audit

**Tenancy anniversary logic:** If `moveInDate` is set, `tenancyAnniversary` = same month/day as moveInDate, rolling forward to next occurrence. This is computed and stored (not computed on-the-fly) for compliance calendar integration.

---

## Step 13: Server Actions — Donors

**File:** `src/app/(protected)/donors/actions.ts` (new)

Functions:
1. `getDonors(filters?)` — list with optional search, type filter, active filter
2. `getDonorById(id)` — detail + total giving (stub — populated in Phase 7)
3. `createDonor(data, userId)` — insert + audit log
4. `updateDonor(id, data, userId)` — fetch existing, update, audit log
5. `toggleDonorActive(id, active, userId)` — soft delete with audit
6. `getDonorGivingSummary(donorId)` — returns `{ totalGiving: number, recentGifts: [] }`. Returns $0 until Phase 7 builds donation recording. **Schedule A note:** Per-donor giving totals from this function are critical for the public support test 2% threshold calculation (Schedule A Part II Line 5) — any donor whose cumulative giving exceeds 2% of total support has the excess excluded from public support. This applies to ALL donors, not just related_party types

---

## Step 14: Vendors List Page

**Files:**
- `src/app/(protected)/vendors/page.tsx` — server component, calls `getVendors()`, renders client
- `src/app/(protected)/vendors/vendors-client.tsx` — client component with filters + DataTable + Create button
- `src/app/(protected)/vendors/columns.tsx` — TanStack column definitions

**Columns:**
| Column | Features |
|--------|----------|
| Name | Sortable, searchable |
| Entity Type | Badge |
| 1099 Eligible | Yes/No badge (green/gray) |
| W-9 Status | Badge (Collected=green, Pending=yellow, Not Required=gray) |
| Default Account | Truncated name |
| Active | Badge |

**Filters:**
- Search (name)
- 1099 Eligible (All / Yes / No)
- W-9 Status (All / Collected / Pending / Not Required)
- Status (Active Only / All)

**Actions:**
- "Create Vendor" button → opens dialog
- Row click → `/vendors/[id]` detail page

---

## Step 15: Vendor Create Dialog

**File:** `src/app/(protected)/vendors/create-vendor-dialog.tsx`

**Fields:**
- Name * (Input)
- Address (Textarea)
- Tax ID (Input, masked display)
- Entity Type (Select: individual, sole_proprietor, llc, s_corp, c_corp, partnership, government)
- 1099 Eligible (Checkbox) + `<HelpTooltip term="1099-eligible" />`
- Default GL Account (Select, populated from accounts list)
- Default Fund (Select, populated from funds list)
- W-9 Status (Select: Collected / Pending / Not Required) + `<HelpTooltip term="w9-status" />`
- W-9 Collected Date (Date picker, shown only when status = Collected)

**Pattern:** Follow `create-account-dialog.tsx` — field state, validation, `useTransition`, toast, reset.

---

## Step 16: Vendor Detail Page

**Files:**
- `src/app/(protected)/vendors/[id]/page.tsx` — server component
- `src/app/(protected)/vendors/[id]/vendor-detail-client.tsx` — client component

**Sections:**
1. **Header:** Name, back link to `/vendors`
2. **Details card:** All editable fields (inline edit mode per accounts pattern)
3. **W-9 Tracking card:** Status badge, collected date, action button to mark collected
4. **1099 Tracking card:** Calendar year selector, total payments YTD, $600 threshold indicator. Shows "$0 — no payments recorded yet" until Phase 8
5. **Status card:** Active toggle with confirmation dialog

---

## Step 17: Tenants List Page

**Files:**
- `src/app/(protected)/tenants/page.tsx`
- `src/app/(protected)/tenants/tenants-client.tsx`
- `src/app/(protected)/tenants/columns.tsx`

**Columns:**
| Column | Features |
|--------|----------|
| Name | Sortable, searchable |
| Unit # | Sortable |
| Monthly Rent | Currency formatted ($X,XXX.XX) |
| Funding Source | Badge with color per source type |
| Lease End | Date formatted, red if past |
| Security Deposit | Currency formatted or "—" |
| Active | Badge |

**Filters:**
- Search (name, unit number)
- Funding Source (All / TENANT_DIRECT / VASH / MRVP / SECTION_8 / OTHER_VOUCHER)
- Status (Active Only / All)

---

## Step 18: Tenant Create Dialog

**File:** `src/app/(protected)/tenants/create-tenant-dialog.tsx`

**Fields:**
- Name * (Input)
- Unit Number * (Input)
- Lease Start (Date picker)
- Lease End (Date picker)
- Monthly Rent * (Number input, formatted)
- Funding Source Type * (Select) + `<HelpTooltip term="funding-source-type" />`
- Move-In Date (Date picker)
- **Security Deposit section** (collapsible or conditional):
  - Deposit Amount (Number input) + `<HelpTooltip term="security-deposit" />` — validation: ≤ monthly rent (TXN-P0-049)
  - Escrow Bank Reference (Input)
  - Deposit Date (Date picker)
  - Interest Rate (Number input, %) + hint: "Lesser of actual bank rate or 5% per MA G.L. c. 186 § 15B"
  - Statement of Condition Date (Date picker)

**Validation errors shown inline.** Security deposit max violation gets prominent error: "Security deposit cannot exceed first month's rent per MA G.L. c. 186 § 15B."

---

## Step 19: Tenant Detail Page

**Files:**
- `src/app/(protected)/tenants/[id]/page.tsx`
- `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx`

**Sections:**
1. **Header:** Name (Unit #), back link to `/tenants`
2. **Lease Details card:** Lease dates, monthly rent, funding source, move-in date. Inline edit
3. **Security Deposit card:** Amount, escrow bank, deposit date, interest rate, statement of condition date, tenancy anniversary (auto-calculated, read-only). `<HelpTooltip term="tenancy-anniversary" />`
4. **Rent & AR card:** Placeholder text: "Rent tracking available after Phase 7." Will show billed vs collected, AR balance
5. **Status card:** Active toggle

---

## Step 20: Donors List Page

**Files:**
- `src/app/(protected)/donors/page.tsx`
- `src/app/(protected)/donors/donors-client.tsx`
- `src/app/(protected)/donors/columns.tsx`

**Columns:**
| Column | Features |
|--------|----------|
| Name | Sortable, searchable |
| Type | Badge (Individual/Corporate/Foundation/Government) |
| Email | Truncated |
| First Gift Date | Date formatted or "—" |
| Total Giving | Currency formatted (stub: "$0" until Phase 7) |
| Active | Badge |

**Filters:**
- Search (name, email)
- Type (All / Individual / Corporate / Foundation / Government)
- Status (Active Only / All)

---

## Step 21: Donor Create Dialog

**File:** `src/app/(protected)/donors/create-donor-dialog.tsx`

**Fields:**
- Name * (Input)
- Address (Textarea)
- Email (Input, validated as email format)
- Type * (Select: Individual / Corporate / Foundation / Government)
- First Gift Date (Date picker)

Simplest of the three create forms.

---

## Step 22: Donor Detail Page

**Files:**
- `src/app/(protected)/donors/[id]/page.tsx`
- `src/app/(protected)/donors/[id]/donor-detail-client.tsx`

**Sections:**
1. **Header:** Name + type badge, back link to `/donors`
2. **Details card:** All editable fields. Inline edit
3. **Giving History card:** Placeholder: "Giving history available after Phase 7." Will show total giving, restricted vs unrestricted breakdown, recent gifts
4. **Status card:** Active toggle

---

## Step 23: Help Terms

**File:** `src/lib/help/terms.ts`

Add these terms:

| Slug | Text |
|------|------|
| `vendor` | A supplier or contractor that provides goods or services to the organization. Vendors are tracked for payment history and IRS 1099-NEC reporting. |
| `1099-eligible` | A vendor eligible for IRS Form 1099-NEC reporting. When calendar-year payments to an eligible vendor exceed $600, a 1099-NEC must be filed (IRC § 6041A). |
| `w9-status` | Tracking status for IRS Form W-9 (Request for Taxpayer Identification Number). Must be collected from 1099-eligible vendors before year-end to file 1099-NEC forms. |
| `entity-type` | Vendor classification (individual, LLC, S-corp, C-corp, partnership, government). Determines 1099 reporting requirements — corporations are generally exempt (IRC § 6041A(d)). |
| `tenant` | An individual or household occupying a unit in the property. Tracked for lease terms, rent collection, funding source, and security deposit compliance. |
| `funding-source-type` | The payment source for tenant rent: tenant-direct (self-pay), VASH (VA Supportive Housing), MRVP (MA Rental Voucher Program), Section 8 (HUD Housing Choice Voucher), or other voucher program. |
| `security-deposit` | Refundable deposit held in a separate interest-bearing escrow account per MA G.L. c. 186 § 15B. Maximum is first month's rent. Must earn interest at lesser of actual bank rate or 5%. |
| `tenancy-anniversary` | Annual anniversary of the tenant's move-in date. Triggers security deposit interest payment obligation under MA G.L. c. 186 § 15B. Non-compliance carries treble damages. |
| `escrow-bank-ref` | Reference to the separate interest-bearing bank account holding security deposits. MA law requires deposits be held in a Massachusetts bank, separate from operating funds. |
| `donor` | An individual, corporation, foundation, or government entity making charitable contributions. Tracked for giving history and IRS-required acknowledgment letters (IRC § 170(f)(8)). |
| `donor-type` | Classification of contribution source: individual, corporate, foundation, or government. Affects Schedule A public support test (IRC § 509(a)) — the 2% threshold applies to ALL donors (any donor giving >2% of total support has excess excluded from public support numerator). Deferred computation until ~FY2030; data capture is active now via `contribution_source_type` tag on donations. |

---

## Step 24: Unit Tests — Vendor 1099 Threshold

**File:** `src/lib/validators/__tests__/vendors.test.ts` (new)

Test cases:
- Valid vendor creation with all fields
- Valid vendor creation with minimal fields (name only + defaults)
- Invalid: empty name rejected
- W-9 collected date required when status = COLLECTED (application logic, not schema)
- Tax ID format acceptance (various formats)

**File:** `src/app/(protected)/vendors/__tests__/vendor-1099.test.ts` (new)

Test cases:
- `getVendor1099Summary` returns $0 when no payments exist
- Threshold flag set correctly at $600 boundary ($599.99 = false, $600.00 = true)
- Calendar year filtering (payments from different years not mixed)

---

## Step 25: Unit Tests — Tenant Security Deposit Validation

**File:** `src/lib/validators/__tests__/tenants.test.ts` (new)

Test cases:
- Valid tenant creation with all fields
- Valid tenant creation with minimal fields
- **Security deposit ≤ monthly rent passes** (TXN-P0-049)
- **Security deposit > monthly rent rejected** with MA law citation
- Security deposit = monthly rent passes (edge case: exactly equal is allowed)
- Tenancy anniversary auto-calculated from move-in date
- Invalid unit number rejected (empty string)
- Monthly rent must be positive

---

## Step 26: Unit Tests — Donor Validation

**File:** `src/lib/validators/__tests__/donors.test.ts` (new)

Test cases:
- Valid donor creation with all fields
- Valid donor with minimal fields (name + type)
- Invalid email format rejected
- Valid email passes
- All four donor types accepted

---

## Step 27: Integration Tests — CRUD & Audit Logging

**File:** `src/__tests__/entities-integration.test.ts` (new)

Test cases (using test database):
- Create vendor → verify in DB → verify audit log entry
- Update vendor → verify before/after in audit log
- Deactivate vendor → verify `isActive = false` + audit log
- Create tenant with security deposit → verify stored correctly
- Create donor → verify in DB
- All three entity types produce correct audit log entries with `entityType` field

---

## Step 28: E2E Test

**File:** `e2e/phase6-entities.spec.ts` (new)

Test flow:
1. Navigate to `/vendors` → verify empty state or list renders
2. Click "Create Vendor" → fill form → submit → verify appears in list
3. Click vendor row → verify detail page loads
4. Edit vendor name → save → verify updated
5. Navigate to `/tenants` → create tenant with security deposit validation
6. Try security deposit > monthly rent → verify error message
7. Set valid deposit → submit → verify created
8. Navigate to `/donors` → create donor → verify in list
9. Verify all three entity list pages show correct columns and filters

---

## File Summary

### New Files (25)

**Schema (3):**
- `src/lib/db/schema/vendors.ts`
- `src/lib/db/schema/tenants.ts`
- `src/lib/db/schema/donors.ts`

**Validators (3):**
- `src/lib/validators/vendors.ts`
- `src/lib/validators/tenants.ts`
- `src/lib/validators/donors.ts`

**Vendor UI (5):**
- `src/app/(protected)/vendors/actions.ts`
- `src/app/(protected)/vendors/vendors-client.tsx`
- `src/app/(protected)/vendors/columns.tsx`
- `src/app/(protected)/vendors/create-vendor-dialog.tsx`
- `src/app/(protected)/vendors/[id]/page.tsx`
- `src/app/(protected)/vendors/[id]/vendor-detail-client.tsx`

**Tenant UI (5):**
- `src/app/(protected)/tenants/actions.ts`
- `src/app/(protected)/tenants/tenants-client.tsx`
- `src/app/(protected)/tenants/columns.tsx`
- `src/app/(protected)/tenants/create-tenant-dialog.tsx`
- `src/app/(protected)/tenants/[id]/page.tsx`
- `src/app/(protected)/tenants/[id]/tenant-detail-client.tsx`

**Donor UI (5):**
- `src/app/(protected)/donors/actions.ts`
- `src/app/(protected)/donors/donors-client.tsx`
- `src/app/(protected)/donors/columns.tsx`
- `src/app/(protected)/donors/create-donor-dialog.tsx`
- `src/app/(protected)/donors/[id]/page.tsx`
- `src/app/(protected)/donors/[id]/donor-detail-client.tsx`

**Tests (5):**
- `src/lib/validators/__tests__/vendors.test.ts`
- `src/lib/validators/__tests__/tenants.test.ts`
- `src/lib/validators/__tests__/donors.test.ts`
- `src/__tests__/entities-integration.test.ts`
- `e2e/phase6-entities.spec.ts`

### Modified Files (4)

- `src/lib/db/schema/enums.ts` — add 4 new enums
- `src/lib/db/schema/index.ts` — add exports + relations for 3 new tables
- `src/lib/validators/index.ts` — add 3 new exports
- `src/lib/help/terms.ts` — add 11 new help terms

### Replaced Files (3)

- `src/app/(protected)/vendors/page.tsx` — replace placeholder
- `src/app/(protected)/tenants/page.tsx` — replace placeholder
- `src/app/(protected)/donors/page.tsx` — replace placeholder

---

## Requirements Satisfied

| Requirement | Description | How Satisfied |
|-------------|-------------|---------------|
| DM-P0-014 | Vendor entity with all fields | vendors schema + create/edit forms |
| DM-P0-015 | 1099 threshold tracking ($600) | `getVendor1099Summary()` + UI card |
| DM-P0-011 | Tenant entity with all fields | tenants schema + create/edit forms |
| DM-P0-012 | AR tracked at tenant/unit level | Schema supports it; AR recording in Phase 7 |
| DM-P0-013 | Security deposit tracking per tenant | All deposit fields + validation |
| DM-P0-016 | Donor entity (minimal CRM) | donors schema + create/edit forms |
| DM-P0-017 | Donation links to donor_id | Schema supports it; donation recording in Phase 7 |
| DM-P0-018 | Contribution source type tag | `contributionSourceTypeEnum` defined |
| TXN-P0-049 | Security deposit max = first month's rent | Zod refinement + UI error |
| INV-012 | Audit log for all mutations | All create/update/deactivate actions logged |
| INV-013 | Soft delete only | `isActive` toggle, no DELETE operations |
| SYS-P0-021 | Help tooltips on domain fields | 11 new terms added |

---

## Execution Order

Recommended build sequence (can parallelize within groups):

**Group A — Data layer (do first):**
1. Step 1: New enums
2. Steps 2-4: Three schema files
3. Step 5: Relations + index updates
4. Step 6: Run migration
5. Steps 7-10: Zod validators

**Group B — Server actions (after Group A):**
6. Steps 11-13: All three action files (can parallelize)

**Group C — UI pages (after Group B):**
7. Steps 14-16: Vendors list + create + detail
8. Steps 17-19: Tenants list + create + detail
9. Steps 20-22: Donors list + create + detail

**Group D — Polish (after Group C):**
10. Step 23: Help terms
11. Steps 24-28: All tests

---

## Notes

- **Tax ID masking:** Display last 4 digits only in UI (`***-**-1234`). Store full value. This is a UI concern, not a schema concern.
- **Vendor entity types:** Use a simple string field, not an enum. Entity types are reference data that may expand (sole proprietor, partnership, LLC treated as S-corp, etc.). Keeping it flexible avoids migration churn.
- **tenancyAnniversary auto-calculation:** Set in `createTenant` and `updateTenant` server actions. Not computed on read. Stored so compliance calendar can query upcoming anniversaries without recomputing.
- **Phase 7 stubs:** 1099 totals and donor giving history return $0 with informational messages until revenue/expense recording ships. This avoids broken UI while keeping the data structure ready.
- **No seed data needed:** Unlike accounts and funds, vendors/tenants/donors are user-created entities. No seed script.
- **Phase 18 copilot cross-reference:** The donors context package (Phase 18 Step 6.5 stub `contexts/donors.ts`) can leverage the `charity-mcp-server` pattern for FOUNDATION and GOVERNMENT donor types — the copilot can verify a grant funder's 501(c)(3) status or look up their 990 data via `nonprofitExplorerLookup`. No schema changes needed here; the donor `type` field already distinguishes org donors from individuals. The copilot uses the EIN provided conversationally, not stored in the donors table.
