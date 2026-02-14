# Security Deposits — Architecture

## Current Scope (Phase 19)

- **Deposit Collection**: GL entry DR 1020 (Escrow), CR 2060 (Liability). MA max enforcement.
- **Receipt Tracking**: 3 mandatory receipts per tenant (collection, 30-day bank details, statement of condition).
- **Interest Calculation**: Annual interest per MA G.L. c. 186 § 15B. Rate capped at 5%.
- **Compliance Calendar**: Deadlines for receipts, interest anniversaries, tax filings.
- **Security Deposit Register**: Per-tenant breakdown reconciling to GL 2060 + 1020.

## Deferred: Move-Out Deposit Return (P2)

The move-out workflow (TXN-P0-051) is deferred until tenants occupy units. No schema changes are needed — existing tables accommodate the workflow:

### Extension Points

1. **`security_deposit_receipts`** — supports `move_out_inspection` receipt type
2. **`compliance_deadlines`** — supports 30-day return deadline (`one_time` recurrence, `tenant` category)
3. **`security_deposit_interest_payments`** — supports final prorated interest calculation

### Move-Out Workflow (Future)

1. Tenant gives notice / lease ends
2. System creates `move_out_inspection` receipt with due date
3. Final prorated interest calculated from last anniversary to move-out date
4. Itemized deductions recorded (damage, unpaid rent, etc.)
5. Refund = deposit + accrued interest - deductions
6. GL entry: DR 2060 (release liability), CR 1020 (release escrow), with adjustments
7. 30-day compliance deadline created for refund delivery
8. Audit trail captures full workflow

### Key Principle

All move-out logic lives in this module (`src/lib/security-deposits/`). The GL engine and audit trail are already sufficient — no new infrastructure needed.

## Files

| File | Purpose |
|------|---------|
| `collect.ts` | Deposit collection + GL entry + receipt/deadline creation |
| `interest.ts` | Interest calculation + GL entry generation |
| `proration.ts` | MA rent proration formula (pure functions) |
| `README.md` | This file |
