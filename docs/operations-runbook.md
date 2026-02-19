# Operations Runbook

Reference for monitoring, troubleshooting, and maintaining the financial system in production.

---

## Environments

| Environment | URL | Branch | Database | Plaid |
|-------------|-----|--------|----------|-------|
| Production | `finance.renewalinitiatives.org` | `main` | `financial-system-prod` | `production` |
| Staging | Vercel preview URL | `staging` | `financial-system-staging` | `sandbox` |
| Development | `localhost:3000` | feature branches | `financial-system-dev` | `sandbox` |

---

## Where to Check for Errors

| System | Dashboard | What to Look For |
|--------|-----------|-----------------|
| **Vercel** | vercel.com > Project > Functions | Function errors, timeouts (>60s), deployment failures |
| **Vercel Cron** | vercel.com > Project > Settings > Cron Jobs | Missed executions, error responses |
| **Postmark** | account.postmarkapp.com > Activity | Bounced emails, failed deliveries, delivery rate |
| **Plaid** | dashboard.plaid.com > Activity | Disconnected items, auth errors, webhook failures |
| **Ramp** | ramp.com > Developer > Logs | API errors, rate limiting |
| **Neon** | console.neon.tech | Connection limits, storage usage, query performance |

---

## Cron Jobs

Nine automated jobs run on Vercel's cron infrastructure. All verify `CRON_SECRET` and are idempotent.

| Job | Schedule (UTC) | Route | What It Does |
|-----|----------------|-------|-------------|
| Ramp sync | Daily 06:00 | `/api/cron/ramp-sync` | Syncs Ramp credit card transactions, auto-categorizes, batch-posts to GL |
| Plaid sync | Daily 07:00 | `/api/cron/plaid-sync` | Syncs bank transactions from Plaid, handles adds/modifications/removals |
| Compliance reminders | Daily 06:00 | `/api/cron/compliance-reminders` | Sends 30-day and 7-day deadline reminder emails via Postmark |
| Staging processor | Every 15min (weekdays 12-22 UTC) | `/api/cron/staging-processor` | Posts expense reports and timesheets from staging table to GL |
| Depreciation | 1st of month 06:00 | `/api/cron/depreciation` | Generates monthly depreciation journal entries |
| Interest accrual | 28th of month 06:00 | `/api/cron/interest-accrual` | Accrues AHP loan interest |
| Prepaid amortization | 1st of month 06:00 | `/api/cron/prepaid-amortization` | Amortizes prepaid expense schedules |
| Rent accrual | 1st of month 06:00 | `/api/cron/rent-accrual` | Accrues monthly rent for all tenants |
| Security deposit interest | 1st of month 06:00 | `/api/cron/security-deposit-interest` | Calculates and posts security deposit interest |

### Manual Trigger

Cron jobs can be triggered manually via curl:

```bash
curl -X GET "https://finance.renewalinitiatives.org/api/cron/plaid-sync" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Troubleshooting Cron Failures

1. Check Vercel function logs for the failed route
2. Verify `CRON_SECRET` env var matches the Authorization header
3. If timeout (>60s): check for slow DB queries, consider adding pagination
4. If Plaid sync fails: check Plaid dashboard for disconnected items, re-authenticate if needed
5. If Ramp sync fails: verify `RAMP_CLIENT_ID`/`RAMP_CLIENT_SECRET` are valid
6. Idempotency: safe to re-trigger any job manually — duplicate runs are no-ops

---

## Common Issues and Resolutions

### Plaid connection drops

**Symptoms:** Plaid sync cron logs "ITEM_LOGIN_REQUIRED" error, Postmark alert sent.

**Resolution:**
1. Navigate to Bank Rec > Bank Settings in the app
2. Re-launch Plaid Link for the affected account
3. User re-authenticates with UMass Five
4. Next sync will pull any missed transactions

### Ramp API errors

**Symptoms:** Ramp sync cron returns 401 or 403.

**Resolution:**
1. Check Ramp Developer dashboard for app status
2. Verify `RAMP_CLIENT_ID` and `RAMP_CLIENT_SECRET` in Vercel env vars
3. Regenerate credentials if expired

### Postmark bounced emails

**Symptoms:** Donor acknowledgment or compliance reminder not received.

**Resolution:**
1. Check Postmark Activity tab for the specific message
2. If bounced: verify recipient email, check if mailbox exists
3. If spam-blocked: review Postmark sender score, check SPF/DKIM records
4. Template issues: verify `POSTMARK_DONOR_ACK_TEMPLATE` matches Postmark template slug

### Database connection issues

**Symptoms:** "Database not configured" errors, connection timeouts.

**Resolution:**
1. Verify `DATABASE_URL` in Vercel env vars
2. Check Neon console for connection limits (max 100 for Pro plan)
3. Ensure pooled connection string is used (not direct)
4. Check Neon project status for maintenance windows

### Build/deployment failures

**Symptoms:** Vercel deploy fails, TypeScript errors.

**Resolution:**
1. Check Vercel deployment logs for specific error
2. Run `npx tsc --noEmit` locally to reproduce
3. ESLint errors won't block build (warnings only in next.config)
4. If dependency issue: delete `node_modules` and `package-lock.json`, run `npm install`

---

## Staging Environment

| Setting | Value |
|---------|-------|
| **Branch** | `staging` |
| **Database** | `financial-system-staging` (Neon) |
| **Plaid** | `sandbox` mode |
| **Ramp** | Not connected (no staging Ramp credentials) |

### Development Workflow

```
feature-branch → staging → main
     ↓              ↓        ↓
  local dev     preview    production
                deploy     deploy
```

1. Create feature branch from `main`
2. Develop and test locally against `financial-system-dev`
3. Merge to `staging` — Vercel auto-deploys preview
4. Test in staging with staging DB (sandbox APIs)
5. Merge `staging` to `main` — Vercel auto-deploys production

### Resetting Staging Database

```bash
# Pull staging DB URL from Vercel
vercel env run --environment preview -- printenv DATABASE_URL_UNPOOLED

# Run migrations (use unpooled URL)
DATABASE_URL=<staging-unpooled-url> npx drizzle-kit migrate

# Re-seed reference data (use pooled URL)
DATABASE_URL=<staging-pooled-url> npx tsx src/lib/db/seed/index.ts

# Re-seed compliance deadlines
DATABASE_URL=<staging-pooled-url> npx tsx -e "
import { seedComplianceDeadlines } from './src/lib/db/seed/compliance-deadlines';
seedComplianceDeadlines().then(r => console.log(r));
"
```

### Testing Cron Jobs in Staging

Staging crons run on the same schedule as production. To test manually, get the staging preview URL from Vercel and the staging `CRON_SECRET`:

```bash
curl "https://<staging-preview-url>/api/cron/depreciation" \
  -H "Authorization: Bearer $STAGING_CRON_SECRET"
```

Staging uses Plaid sandbox mode — transactions are synthetic.

---

## Neon Database Branches

After the initial QBO import, a baseline branch was created:

```bash
# Create a branch snapshot
neonctl branches create --name baseline-import-YYYY-MM-DD --project-id $NEON_PROJECT_ID

# Reset to clean imported state
neonctl branches delete --name <branch> --project-id $NEON_PROJECT_ID
neonctl branches create --name <new-branch> --parent baseline-import-YYYY-MM-DD --project-id $NEON_PROJECT_ID
```

---

## Escalation Path

1. **First response:** Jeff investigates using this runbook
2. **Code investigation:** Use Claude Code to diagnose and fix
3. **External service issues:** Contact Plaid/Ramp/Postmark/Neon support
4. **Data integrity:** Always check GL invariants (debits = credits) before and after any manual fix

---

## Key Invariants to Monitor

| ID | Invariant | How to Verify |
|----|-----------|--------------|
| INV-001 | Total debits = total credits (global) | Balance Sheet report, trial balance |
| INV-010 | Per-fund debits = credits | Filter reports by individual fund |
| INV-007 | Restricted fund releases balance | Check net asset transfers on Activities report |

If any invariant is violated, stop and investigate before proceeding. Do not override with manual entries.
