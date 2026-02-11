# Employee Payroll Data API Specification

**Integration:** internal-app-registry-auth → financial-system
**Purpose:** Fetch employee master data for payroll processing
**Status:** ✅ Spec Complete (Updated 2026-02-11)
**Related Decisions:** D-017 (Employee Master Data in internal-app-registry-auth)

**API Version:** v1 (current)
**Last Updated:** 2026-02-11 — Naming convention fixes committed to app-portal

---

## Changelog

**2026-02-11 — Naming Convention Fixes**
- Response field: `last_updated` → `updated_at` (list and detail endpoints)
- Webhook payload field: `timestamp` → `sent_at`
- Database tables: `employee_payroll` → `employee_payrolls`, `payroll_audit_log` → `payroll_audit_logs`
- All endpoint paths, auth headers, and other fields unchanged

---

## Overview

The app portal at `tools.renewalinitiatives.org` exposes a REST API for querying employee payroll data. The financial system integrates with these endpoints to fetch employee master data when processing approved timesheets from renewal-timesheets.

**Workflow:**
1. renewal-timesheets sends approved timesheet (employee ID, hours, rate, period, task code)
2. financial-system receives timesheet via API
3. financial-system calls internal-app-registry-auth API to fetch employee payroll data (tax IDs, withholding elections)
4. financial-system calculates gross pay, withholdings, net pay
5. financial-system creates GL payroll entry

---

## Authentication

All endpoints require an `X-API-Key` header. The key is a shared secret stored as `PAYROLL_API_KEY` in the financial system's environment.

**Required Environment Variable:**
```
PAYROLL_API_KEY=GPXosNFmdKsPF3G+IkcZ4r5UiTClQ+vrC8OPrLohx7M=
```

---

## Base URL

**Production:** `https://tools.renewalinitiatives.org`

---

## Endpoints

### 1. List Payroll-Enabled Employees

**Endpoint:** `GET /api/v1/users/payroll`

**Query Parameters:**
- `limit` (optional): Max 100, default 50
- `offset` (optional): Default 0

**Request Example:**
```
GET /api/v1/users/payroll?limit=50&offset=0
Headers:
  X-API-Key: GPXosNFmdKsPF3G+IkcZ4r5UiTClQ+vrC8OPrLohx7M=
```

**Response (200):**
```json
{
  "users": [
    {
      "user_id": "zitadel-user-id",
      "legal_name": "Jane Doe",
      "worker_type": "W2_EMPLOYEE",
      "pay_frequency": "BIWEEKLY",
      "payroll_enabled": true,
      "updated_at": "2026-02-11T12:00:00.000Z"
    }
  ],
  "count": 1,
  "limit": 50,
  "offset": 0
}
```

**Notes:**
- No tax IDs in this response (by design — use individual endpoint for sensitive data)
- `worker_type` enum: `W2_EMPLOYEE` | `CONTRACTOR_1099`
- `pay_frequency` enum: `WEEKLY` | `BIWEEKLY` | `MONTHLY`

**Use Case:** Initial sync, employee directory, detecting new/changed employees

---

### 2. Get Individual Employee Payroll Data

**Endpoint:** `GET /api/v1/users/{user_id}/payroll`

**Path Parameters:**
- `user_id` (required): Zitadel user ID (from timesheets or employee list)

**Request Example:**
```
GET /api/v1/users/zitadel-user-id-123/payroll
Headers:
  X-API-Key: GPXosNFmdKsPF3G+IkcZ4r5UiTClQ+vrC8OPrLohx7M=
```

**Response (200):**
```json
{
  "user_id": "zitadel-user-id",
  "legal_name": "Jane Doe",
  "federal_tax_id": "123-45-6789",
  "state_tax_id": "12-3456789",
  "worker_type": "W2_EMPLOYEE",
  "pay_frequency": "BIWEEKLY",
  "payroll_enabled": true,
  "withholding_elections": {
    "federal_income_tax": {
      "enabled": true,
      "filing_status": "SINGLE",
      "allowances": 0,
      "additional_withholding": 0
    },
    "state_income_tax": {
      "enabled": true,
      "state": "MA",
      "allowances": 0,
      "additional_withholding": 0
    },
    "social_security": {
      "enabled": true
    },
    "medicare": {
      "enabled": true
    },
    "retirement_401k": {
      "enabled": true,
      "type": "PERCENTAGE",
      "value": 6
    },
    "hsa": {
      "enabled": false
    },
    "workers_comp": {
      "enabled": false
    }
  },
  "updated_at": "2026-02-11T12:00:00.000Z"
}
```

**Response (404):**
```json
{
  "error": "Not found",
  "message": "User not found or payroll not enabled"
}
```

**Notes:**
- Includes decrypted tax IDs (SSN, state tax ID)
- Full withholding elections for payroll calculations
- `filing_status` enum: `SINGLE` | `MARRIED_JOINT` | `MARRIED_SEPARATE` | `HEAD_OF_HOUSEHOLD`
- `retirement_401k.type` enum: `PERCENTAGE` | `FIXED_AMOUNT`

**Use Case:** Processing a specific employee's timesheet, calculating withholdings

---

### 3. Get Payroll Audit Trail

**Endpoint:** `GET /api/v1/users/{user_id}/payroll/audit`

**Path Parameters:**
- `user_id` (required): Zitadel user ID

**Request Example:**
```
GET /api/v1/users/zitadel-user-id-123/payroll/audit
Headers:
  X-API-Key: GPXosNFmdKsPF3G+IkcZ4r5UiTClQ+vrC8OPrLohx7M=
```

**Response (200):**
```json
{
  "entries": [
    {
      "id": "uuid",
      "field_name": "legal_name",
      "old_value": "Jane Smith",
      "new_value": "Jane Doe",
      "changed_by": "admin-user-id",
      "changed_at": "2026-02-11T12:00:00.000Z"
    },
    {
      "id": "uuid",
      "field_name": "federal_tax_id",
      "old_value": "XXX-XX-6789",
      "new_value": "XXX-XX-1234",
      "changed_by": "admin-user-id",
      "changed_at": "2026-02-10T15:30:00.000Z"
    }
  ],
  "count": 2
}
```

**Notes:**
- Tax ID values are masked in audit entries (e.g., `XXX-XX-6789`)
- Sorted by `changed_at` descending (newest first)

**Use Case:** Compliance tracking, investigating payroll discrepancies, change history

---

## Error Responses

**401 Unauthorized:**
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing API key"
}
```
- Check `X-API-Key` header
- Verify `PAYROLL_API_KEY` environment variable

**404 Not Found:**
```json
{
  "error": "Not found",
  "message": "User not found or payroll not enabled"
}
```
- User ID doesn't exist
- User exists but `payroll_enabled = false`

**503 Service Unavailable:**
```json
{
  "error": "Service unavailable"
}
```
- Database unreachable
- Retry with exponential backoff

---

## Webhook Integration (Optional)

The app portal can POST payroll change events to the financial system for real-time notifications of employee data changes.

**Configuration:**
- Set `PAYROLL_WEBHOOK_URL` environment variable in the app portal (e.g., `https://financial-system.renewalinitiatives.org/webhooks/payroll`)
- The portal will POST to this URL on payroll data changes

**Webhook Payload:**
```json
{
  "event": "payroll.employee.created",
  "user_id": "zitadel-user-id",
  "changed_fields": ["legal_name", "federal_tax_id", "worker_type"],
  "sent_at": "2026-02-11T12:00:00.000Z"
}
```

**Event Types:**
- `payroll.employee.created` — New employee enabled for payroll
- `payroll.employee.updated` — Existing employee payroll data changed

**Notes:**
- No sensitive data (tax IDs, withholding details) in webhook payloads
- Financial system should call `GET /api/v1/users/{user_id}/payroll` to fetch updated data
- The portal retries 3 times with exponential backoff (1s, 2s, 4s) on failure
- Webhook endpoint should return 2xx status to acknowledge receipt

**Use Case:** Invalidate cached employee data, trigger re-sync, alert admins of changes

---

## Integration Checklist

**Financial System Implementation:**
- [ ] Add `PAYROLL_API_KEY` to environment variables (production + staging)
- [ ] Implement API client with `X-API-Key` header authentication
- [ ] Cache employee payroll data (refresh daily or on webhook notification)
- [ ] Handle 401 (invalid API key), 404 (employee not found), 503 (retry logic)
- [ ] Map API response to internal payroll calculation logic
- [ ] Implement webhook endpoint (optional, for real-time updates)
- [ ] Test with staging environment first
- [ ] Document API key rotation procedure

**App Portal Configuration (if using webhooks):**
- [ ] Set `PAYROLL_WEBHOOK_URL` in app portal environment variables
- [ ] Verify webhook payload delivery and retries
- [ ] Monitor webhook delivery failures

---

## Security Considerations

1. **API Key Storage:** Store `PAYROLL_API_KEY` in encrypted environment variables, not in code
2. **HTTPS Only:** All API calls must use HTTPS
3. **Tax ID Handling:** Federal/state tax IDs are PII — encrypt at rest, minimize logging, never log in plaintext
4. **Audit Trail:** Log all API calls to employee payroll endpoint (who fetched whose data, when)
5. **Key Rotation:** API key should be rotatable without system downtime (support key versioning)
6. **Webhook Validation:** If using webhooks, verify request origin (IP allowlist or signature verification)

---

## Data Flow Example

**Scenario:** Processing a biweekly timesheet for employee "Jane Doe"

1. **Timesheet arrives from renewal-timesheets:**
   ```json
   {
     "timesheet_id": "ts-123",
     "user_id": "zitadel-user-id-123",
     "hours": 80,
     "hourly_rate": 25.00,
     "period_start": "2026-02-01",
     "period_end": "2026-02-14",
     "task_code": "SARE"
   }
   ```

2. **Financial system fetches employee payroll data:**
   ```
   GET /api/v1/users/zitadel-user-id-123/payroll
   ```

3. **Calculate payroll:**
   - Gross pay: 80 hours × $25/hr = $2,000
   - Federal income tax withholding: calculated using W-4 elections from API response
   - State income tax: calculated using MA allowances from API response
   - Social Security: 6.2% × $2,000 = $124
   - Medicare: 1.45% × $2,000 = $29
   - 401(k) contribution: 6% × $2,000 = $120
   - Net pay: $2,000 - withholdings

4. **Create GL entry:**
   ```
   Debit: Salaries & Wages (SARE Fund) — $2,000
   Credit: Payroll Payable — Net pay
   Credit: Federal Income Tax Payable — Withholding amount
   Credit: State Income Tax Payable — Withholding amount
   Credit: Social Security Payable — $124
   Credit: Medicare Payable — $29
   Credit: 401(k) Payable — $120
   ```

5. **Record payroll obligation in GL**
   - Status: Approved (from timesheet)
   - Fund: SARE Fund (from task code "SARE")
   - Employee: zitadel-user-id-123
   - Pay period: 2026-02-01 to 2026-02-14

---

## Testing

**Staging Environment:**
- Base URL: `https://staging-tools.renewalinitiatives.org` (if available)
- Use separate `PAYROLL_API_KEY` for staging

**Test Cases:**
1. Fetch employee list (verify pagination)
2. Fetch individual employee (verify tax IDs decrypt correctly)
3. Fetch non-existent employee (verify 404 handling)
4. Invalid API key (verify 401 handling)
5. Calculate withholdings using API data (verify math)
6. Webhook delivery (if implemented)

---

## Future Enhancements (Post-MVP)

- **Bank Account Info:** Add direct deposit routing/account numbers to API response
- **Pay Rate Storage:** Store hourly/salary rates in auth system (currently comes from timesheets)
- **Bulk Fetch:** `POST /api/v1/users/payroll/bulk` with `user_ids` array for batch processing
- **Historical Withholdings:** Track W-4 election history (effective dates)
- **State-Specific Rules:** MA unemployment insurance, disability insurance rates
