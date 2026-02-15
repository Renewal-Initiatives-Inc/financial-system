# FY25 Data Migration — Import Process

One-time migration from QuickBooks Online (QBO) to the Renewal Initiatives financial system.

## Process Overview

1. Export General Journal CSV from QBO
2. Run import script in dry-run mode to validate
3. Fix any unmapped accounts/classes
4. Run import in live mode
5. Generate and review accrual adjustments
6. Verify data integrity
7. Sync Plaid bank history for reconciliation

## Quick Start

```bash
# Dry run (validate only)
npx tsx src/lib/migration/run-import.ts --csv-path ./qbo-export.csv --dry-run

# Live import
npx tsx src/lib/migration/run-import.ts --csv-path ./qbo-export.csv --env dev

# Force re-import (deletes existing FY25_IMPORT data first)
npx tsx src/lib/migration/run-import.ts --csv-path ./qbo-export.csv --force
```

### CLI Options

| Flag | Description |
|------|-------------|
| `--csv-path <path>` | Path to QBO General Journal CSV export (required) |
| `--dry-run` | Validate without writing to database |
| `--skip-adjustments` | Skip accrual-basis adjustments |
| `--force` | Delete existing FY25_IMPORT data before importing |
| `--env <env>` | Target environment: dev, staging, prod |

## Account Mapping

QBO account names are mapped to our standardized 69-account chart of accounts.
The full mapping is in `account-mapping.ts` → `QBO_ACCOUNT_MAPPING`.

| QBO Account Name | Our Code | Our Account Name |
|-----------------|----------|-----------------|
| Business Checking | 1000 | Checking |
| Savings | 1010 | Savings |
| Accounts Receivable (A/R) | 1100 | Accounts Receivable |
| Prepaid Insurance | 1200 | Prepaid Expenses |
| Construction in Progress | 1500 | Construction in Progress |
| Accounts Payable (A/P) | 2000 | Accounts Payable |
| AHP Loan Payable | 2500 | AHP Loan Payable |
| Rental Income | 4000 | Rental Income |
| Grant Revenue | 4100 | Grant Revenue |
| Donation Income | 4200 | Donation Income |
| Insurance Expense | 5410 | Property Insurance |
| Salaries & Wages | 5000 | Salaries & Wages |

See `account-mapping.ts` for the complete mapping including all aliases.

## Fund Mapping

QBO classes map to our 6 seed funds.

| QBO Class | Our Fund |
|-----------|----------|
| General / (blank) | General Fund |
| AHP | AHP Fund |
| CPA | CPA Fund |
| MassDev | MassDev Fund |
| HTC / HTC Equity | HTC Equity Fund |
| MassSave | MassSave Fund |

Blank class defaults to General Fund per design decision D-024.

## Accrual Adjustments (SYS-P0-012)

Four adjustments convert QBO cash-basis to our accrual-basis opening balances:

### a. Prepaid Insurance ($501)
```
DR Prepaid Expenses (1200)     $501   General Fund
CR Property Insurance (5410)   $501   General Fund
```
Rationale: Insurance policy extends beyond FY25 end date.

### b. Accrued Reimbursements — SKIPPED
The $4,472 reimbursement to Heather will be imported per-transaction (not as a blob)
to avoid double-counting. The split is:
- CIP Soft Costs: $1,875.58 → DR 1520 / AHP Fund
- Organizational Costs: $1,174.50 → DR 5600 / General Fund
- Operating Expenses: $1,421.88 → DR various / General Fund

### c. December Rent AR — SKIPPED ($0)
Building under construction in FY25, no tenants yet.

### d. AHP Loan Interest — SKIPPED ($0 accrual)
$100K drawn 11/18/2025 at 4.75%. Interest payment of $572.60 made 12/19/2025
covering through 12/31/2025. No accrual needed at year-end.

## Verification Checks

Post-import verification confirms data integrity:

| Check | Invariant | Description |
|-------|-----------|-------------|
| Total Balance | INV-001 | Sum(all debits) = Sum(all credits) |
| Fund Balance | INV-010 | Per fund: debits = credits |
| Account Balances | — | Match expected QBO ending balances |
| Transaction Count | — | Imported count matches CSV count |
| Audit Trail | INV-012 | Every transaction has audit log entry |
| Restricted Releases | INV-007 | Restricted expenses have paired releases |

## How to Re-Run (Idempotent)

The import is designed to be re-runnable:

1. All imported transactions use `sourceType = 'FY25_IMPORT'`
2. The `--force` flag deletes all existing FY25_IMPORT data
3. Related SYSTEM release transactions are also cleaned up
4. Re-run imports everything fresh

```bash
npx tsx src/lib/migration/run-import.ts --csv-path ./qbo-export.csv --force --env dev
```

## Architecture

```
qbo-csv-parser.ts        → Parse QBO CSV into structured data
account-mapping.ts       → Map QBO names to our chart of accounts
import-engine.ts         → Batch import via createTransaction()
accrual-adjustments.ts   → Cash→accrual adjustment entries
verification.ts          → Post-import integrity checks
conversion-summary.ts    → Human-readable summary report
plaid-history-sync.ts    → Pull Plaid bank history
reconciliation.ts        → Multi-source matching engine (QBO ↔ Bank ↔ Ramp)
run-import.ts            → CLI: import orchestrator
run-reconciliation.ts    → CLI: reconciliation runner
```

## Multi-Source Reconciliation

After import, run the reconciliation tool to verify QBO, bank, and Ramp agree:

```bash
npx tsx src/lib/migration/run-reconciliation.ts \
  --qbo ./qbo-export/journal-all.csv \
  --bank-checking ./qbo-export/umass5-checking.csv \
  --ramp ./qbo-export/ramp-transactions.csv \
  --cutoff-date 2026-02-15 \
  --output ./qbo-export/reconciliation-report.txt
```

Two reconciliation passes:
1. **QBO cash accounts (1000/1010/1020) ↔ UMass Five bank transactions**
2. **QBO credit card (2020) ↔ Ramp transactions**

Matching strategy (in priority order):
- Exact: same date + same amount
- Fuzzy 1-day: ±1 day + same amount
- Fuzzy 3-day: ±3 days + same amount
- Amount-only: ±7 days + same amount (flagged for manual review)

Exit codes: 0 = fully reconciled, 2 = unmatched transactions found.

Key design: All imports use `createTransaction()` from the GL engine, ensuring:
- INV-001: Balance check per transaction
- INV-002/003/004: Account/fund validation
- INV-007: Restricted fund auto-releases
- INV-012: Immutable audit logging

## Resolved Questions

1. **Fiscal year end date**: Calendar year (12/31/2025)
2. **Reimbursement**: Imported per-transaction, not as blob (avoids double-counting)
3. **Rent AR**: $0 — no tenants, building under construction
4. **AHP interest**: 4.75% on $100K drawn 11/18/2025; $572.60 paid 12/19 covers through 12/31; no accrual
5. **QBO account mapping**: Final mapping needs Heather's actual QBO chart of accounts (still pending)
