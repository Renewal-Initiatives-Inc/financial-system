# Integration Spec: app-portal

**Direction:** Financial-system READS from app-portal. No writes.
**Mechanism:** Direct Postgres read via restricted `financial_system_reader` role on app-portal's Neon DB.
**Requirements:** INT-P0-003, INT-P0-010, INT-P0-011, INT-P0-012, D-124, D-132

---

## What Financial-System Reads

### 1. Authentication / Session

Financial-system authenticates users via Zitadel (same OIDC provider app-portal uses). next-auth handles the session. No direct DB read needed for auth — it's token-based.

### 2. Employee Data (People API)

Financial-system reads employee data for **payroll calculations** and **user identity**.

**Fields needed from app-portal DB:**

| Field | Type | Used For | Req |
|-------|------|----------|-----|
| `id` | UUID | FK reference in payroll entries | INT-P0-010 |
| `name` | string | Display in payroll register, W-2 | INT-P0-010 |
| `email` | string | Display, notifications | INT-P0-010 |
| `compensation_type` | enum: PER_TASK / SALARIED | Gross pay calculation method | INT-P0-012, D-119 |
| `annual_salary` | decimal | Salaried employees: hourly rate = annual ÷ expected_annual_hours | INT-P0-012, D-119 |
| `expected_annual_hours` | integer | Salaried employees: hourly rate denominator | INT-P0-012, D-119 |
| `exempt_status` | enum: EXEMPT / NON_EXEMPT | Overtime eligibility (1.5× for NON_EXEMPT over 40hr/week) | INT-P0-012, D-120 |
| `calculated_hourly_rate` | decimal (computed) | = annual_salary ÷ expected_annual_hours | INT-P0-012 |
| `federal_filing_status` | string | Federal income tax withholding (Pub 15-T) | TXN-P0-035 |
| `federal_allowances` | integer | Federal withholding calculation | TXN-P0-035 |
| `state_filing_status` | string | MA state tax withholding (Circular M) | TXN-P0-035 |
| `state_allowances` | integer | MA withholding calculation | TXN-P0-035 |
| `tax_id` (SSN) | encrypted (AES-256-GCM) | W-2 generation | TXN-P0-036 |
| `address` | string | W-2 generation | TXN-P0-036 |
| `active` | boolean | Filter for active employees only | — |

**Encryption note:** Tax IDs are AES-256-GCM encrypted in app-portal's DB. Encryption/decryption happens in app-portal's application layer. Financial-system reads the encrypted value and must have the `PEOPLE_ENCRYPTION_KEY` env var to decrypt at runtime. (D-132)

---

## Changes Needed in app-portal

### Must Add (Not Yet in Schema per INT-P0-012)

These fields need to be added to app-portal's employee/people table:

- [ ] `compensation_type` — enum: `PER_TASK` | `SALARIED`
- [ ] `annual_salary` — decimal, nullable (only for SALARIED)
- [ ] `expected_annual_hours` — integer, nullable (only for SALARIED)
- [ ] `exempt_status` — enum: `EXEMPT` | `NON_EXEMPT`
- [ ] `calculated_hourly_rate` — computed or stored decimal

### Must Verify (May Already Exist)

- [ ] `federal_filing_status` and `federal_allowances` — for W-4 withholding
- [ ] `state_filing_status` and `state_allowances` — for MA M-4 withholding
- [ ] `tax_id` (SSN) — encrypted, for W-2/1099
- [ ] `address` — for W-2 mailing

### UI Needed in app-portal

- [ ] Admin form for entering/editing compensation profile (compensation_type, salary, hours, exempt status)
- [ ] Admin form for withholding elections (W-4 / M-4 data entry)
- [ ] New hire onboarding must include these fields

### Postgres Role

- [ ] Create `financial_system_reader` role with SELECT-only on relevant tables
- [ ] Grant to financial-system's connection string

---

## Cross-Neon Connectivity

app-portal and financial-system are separate Neon projects. Connection options (to be determined at build time per D-131):
1. Cross-project connection string (financial-system connects to app-portal's Neon DB directly)
2. Co-locate in single Neon project with separate databases
3. Neon's cross-database query feature (if available)

---

## Build Notes

*(Add discoveries here during implementation)*

