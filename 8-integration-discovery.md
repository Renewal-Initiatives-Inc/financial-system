# Chunk 8: Integration Layer — Discovery

**Status:** 🟡 Discovery (integration architecture partially defined)

API contracts and data flows between financial-system and existing app ecosystem. Three internal app integrations (all inbound), one external service (Ramp), one bank data feed (UMass Five).

---

## Inter-App Dependencies

**1. renewal-timesheets → financial-system** (D-008)
- Approved timesheets create GL payroll entries
- Data: employee ID, hours, rate, period, task code
- Task code maps to funds; defaults to General Fund
- API contract: TBD

**2. expense-reports-homegrown → financial-system** (D-007)
- Approved expense reports create GL expense/AP entries
- Data: payee, amount, category, fund, date, receipts
- Pivoting from QBO API to financial-system API
- API contract: TBD

**3. internal-app-registry-auth → financial-system** (D-006, D-017)
- Authentication/authorization (existing, working)
- Employee payroll master data (API exists at tools.renewalinitiatives.org)
- API spec: ✅ Complete — see `employee-payroll-data-spec.md`
- Base URL: `https://tools.renewalinitiatives.org`
- Endpoints: `/api/v1/users/payroll` (list), `/api/v1/users/{id}/payroll` (individual), `/api/v1/users/{id}/payroll/audit` (audit trail)
- Auth: `X-API-Key` header with `PAYROLL_API_KEY` environment variable
- Webhook support: Optional inbound webhook for real-time employee data change notifications

**4. Ramp credit card → financial-system** (D-021)
- Transaction import via API/export
- Pending queue → categorization → GL posting
- API/export mechanism: TBD

**5. UMass Five bank → financial-system**
- Bank statement data for reconciliation
- Export format: TBD (CSV, OFX, QFX, API?)

**6. proposal-rodeo → financial-system** (D-009)
- NO INTEGRATION (explicit decision)

## Key Questions

- renewal-timesheets: REST API or shared DB? Real-time or batch?
- expense-reports-homegrown: Per-expense or batch posting? Receipt transfers?
- ✅ ~~internal-app-registry-auth: What payroll data exists? Enhancement needed?~~ **ANSWERED:** REST API exists at tools.renewalinitiatives.org with full payroll data endpoints (see employee-payroll-data-spec.md)
- Ramp: API availability? Webhook or polling? Export fallback?
- UMass Five: Export formats? Frequency?
- API architecture: REST, shared DB, or event-driven?

## Dependencies

**From Chunk 1:**
- D-007, D-008: Integration requirements
- D-017: Employee master data API
- D-021: Ramp GL structure
- D-024: GL validation rules

**Depends On:**
- Chunk 1: GL must accept entries
- Chunk 3: Expense/payroll recording logic
