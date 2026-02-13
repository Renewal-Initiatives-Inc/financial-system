# Chunk 4: Bank Reconciliation — Discovery

**Status:** ✅ Complete (as of 2026-02-13)

Matching GL transactions to bank statements. Handles bank feed imports via Plaid API, automated match suggestions with user confirmation, reconciliation of both bank-to-GL and GL-to-bank directions, and formal reconciliation sign-off.

---

## Discovery Sessions

### Session 1: Bank Feed Integration & Matching Model (2026-02-13)

**Context:** Renewal Initiatives has 2 bank accounts at UMass Five Credit Union (checking ...0180, savings ...0172) and a Ramp corporate credit card. Current reconciliation is via QBO auto-matching through direct bank feed. Moving to custom system requires own bank feed strategy.

**Questions resolved:**

1. **Bank Feed Integration Method** — ✅ **ANSWERED: Plaid `/transactions/sync` API.**
   - Jeff confirmed via direct call with Plaid that API access is available
   - Cost: $0.30/account/month × 2 accounts = $0.60/month
   - Third account (escrow, per D-069) will be added later at same bank — $0.90/month total
   - Plaid `/transactions/sync` is cursor-based incremental sync returning `added`, `modified`, `removed` arrays
   - Sign convention: positive amounts = money out (debits from account), negative = money in (credits to account)
   - Pending-to-posted transitions: pending transaction appears in `removed`, posted version appears in `added`
   - Available transaction fields: `transaction_id`, `account_id`, `amount`, `date`, `authorized_date`, `merchant_name`, `personal_finance_category` (primary/detailed/confidence level), `pending`, `payment_channel`, `counterparties`, `location`
   - Webhook available: `SYNC_UPDATES_AVAILABLE` for real-time notification
   - Default history: 90 days, up to 24 months available
   - **Decision: D-093**

2. **Sync Trigger** — ✅ **ANSWERED: Daily scheduled sync.**
   - System pulls transactions once daily via scheduled job
   - Not real-time webhook-driven (overkill for <20 transactions/month)
   - Manual "sync now" button available for on-demand refresh
   - **Decision: D-094**

3. **Transaction Matching Model** — ✅ **ANSWERED: Trust-escalation model (suggest → confirm → rule → auto-approve).**
   - All bank transactions land in a review queue
   - System suggests matches based on amount, date proximity, payee/merchant name
   - User sees all items including AI's suggested matches — nothing is auto-completed
   - User confirms or rejects each suggested match
   - On confirmation, system offers: "Create a rule for future transactions like this?"
   - If user creates rule AND future transaction matches rule criteria → auto-approved match (no user confirmation needed)
   - Same pattern as Ramp categorization from Chunk 3 (consistent UX)
   - **Decision: D-095**

4. **Unmatched Bank Transactions — Inline GL Creation** — ✅ **ANSWERED: Allow for bank-originated items with guardrails.**
   - Bank-originated transactions (fees, interest income, surprise ACH debits) often have no prior GL entry
   - System allows creating GL entry directly from reconciliation screen for these items
   - Guardrails:
     - Threshold prompt for amounts above a configurable limit (e.g., >$100 triggers "are you sure this isn't something that should go through the full entry workflow?")
     - Audit trail marks these entries as "bank-originated" for review
     - Complex items (large unexpected deposits, unfamiliar debits) directed to full journal entry workflow
   - Risks acknowledged and mitigated:
     - Lazy categorization (cash-basis masquerading as accrual) → threshold prompt catches this
     - Missing documentation → audit trail flags bank-originated entries for review
     - Fund attribution shortcuts → inline GL creation still requires fund assignment
   - **Decision: D-096**

5. **GL-Only Items in Reconciliation** — ✅ **ANSWERED: Two-way reconciliation (bank-to-GL AND GL-to-bank).**
   - Standard bank rec only checks bank → GL direction ("does everything the bank shows match our books?")
   - More valuable: also check GL → bank direction ("does everything our GL says about cash match the bank?")
   - GL-only cash entries with no bank counterpart must be identified and explained:
     - Legitimate GL-only items: opening balance (D-015), depreciation (D-019), loan forgiveness (D-023) — these never hit the bank
     - Problem GL-only items: mispostings to cash accounts, journal entries that debited cash incorrectly, fund transfers recorded on GL but not executed at bank
   - Reconciliation view shows unmatched items from BOTH sides
   - Reconciliation is only "complete" when both bank and GL sides are fully accounted for: matched, or explicitly marked as timing differences (outstanding checks, deposits in transit), or explicitly marked as GL-only with explanation
   - GAAP/FASB: No single codification section mandates specific reconciliation format, but AU-C 315 (auditing standards) and COSO framework treat bank reconciliation as fundamental internal control. ASC 230 (Cash Flows) implicitly requires GL cash to tie to balance sheet. The two-way approach catches errors that bank-to-book-only methods miss.
   - **Decision: D-097**

6. **Ramp Credit Card Reconciliation** — ✅ **ANSWERED: 1-level at bank rec layer, with Ramp statement cross-check.**
   - Individual Ramp transactions are already categorized and recorded in GL through Chunk 3 expense workflow
   - At bank rec level: match the single Ramp autopay settlement (e.g., $900 debit from checking) to the single GL entry recording that payment
   - Ramp statement cross-check: system verifies that sum of categorized Ramp transactions for the period equals Ramp settlement amount debited from bank
   - If mismatch (e.g., disputed charge, mid-cycle refund), system flags for investigation
   - This keeps bank rec clean (1 transaction to match) while still catching Ramp discrepancies
   - **Decision: D-098**

7. **Reconciliation Completion & Sign-Off** — ✅ **ANSWERED: Formal sign-off with auditable edit capability.**
   - Reconciliation has a formal completion action: records who reconciled, when, and the reconciled balance
   - Previously reconciled items can be edited if errors are discovered
   - Any change to a previously-reconciled item requires a note explaining the change
   - All changes to reconciled items are logged in audit trail
   - Consistent with D-045 (no period locking — all periods remain open) but adds accountability layer
   - **Decision: D-099**

8. **Escrow Account** — ✅ **ANSWERED: Third Plaid account, same bank, added when opened.**
   - Per D-069 (Security Deposit Escrow), escrow account doesn't exist yet
   - Will be a third account at UMass Five, connected via Plaid when opened
   - Same reconciliation workflow applies; per-tenant tracking is GL-level concern (D-069), not bank rec concern
   - Plaid cost increases to $0.90/month with third account
   - **Decision: D-100**

---

### Session 1 (continued): Outstanding Items Resolution

9. **Outstanding Checks / Deposits in Transit** — ✅ **ANSWERED: Simple "outstanding" status, no system-enforced aging.**
   - GL payment entries that haven't matched a bank transaction appear as "outstanding" in reconciliation view
   - Single category — no distinction between outstanding checks vs. deposits in transit (user can see from context)
   - No aging logic, no stale check flags, no system rules to enforce timeframes
   - Transaction date is visible; user knows today's date and can assess staleness themselves
   - If a check is truly stale, user voids it through normal D-053 void workflow
   - **Decision: D-101**

10. **Opening Balance / History Rebuild** — ✅ **ANSWERED: Full history from account origination with $0 starting balance.**
    - No FY25 "cutover balance" problem — RI will rebuild transaction history from the very start of the bank accounts
    - Starting balance is $0 (accounts were opened when the company had $0 net cash)
    - Small number of historical transactions makes full rebuild feasible
    - Initial reconciliation round covers the full history to validate everything ties
    - This supersedes the D-033 conversion concern for bank rec purposes — no need to validate a mid-stream opening balance
    - Plaid provides up to 24 months of history on initial sync (covers RI's full operating history)
    - **Decision: D-102**

11. **Multi-Transaction Matching (1:many, many:1)** — ✅ **ANSWERED: Yes, with bank transaction splitting.**
    - One bank transaction can match to multiple GL entries (1:many) — e.g., single deposit containing multiple tenant rent checks
    - User can "split" a bank transaction into multiple lines, assigning each line to a GL account, fund, etc.
    - Key use case: outside property manager deposits net amount (rents collected minus management fee) as single bank deposit → user splits into individual revenue lines and expense line for management fee
    - Many:1 matching (multiple bank transactions to one GL entry) is the simpler case — just link multiple bank items to one GL entry
    - Split lines must sum to the original bank transaction amount (system validates)
    - **Decision: D-103**

### Session 1 (continued): Final Resolutions

12. **AR Reconciliation Tie-In** — ✅ **ANSWERED: No special AR logic in bank rec. AR aging report is the right tool.**
    - When tenant rent is accrued (month N) and cash arrives (month N+1), the GL cash debit matches the bank deposit through normal matching
    - AR reduction (DR Cash, CR Accounts Receivable) is a GL posting concern, not a bank rec concern
    - AR aging report (D-026) is the tool for investigating *why* cash hasn't arrived
    - Bank rec stays focused on: does the bank match the GL? AR timing is an AR report problem.
    - **Decision: D-104**

13. **AHP Loan Interest Accrual** — ✅ **ANSWERED: Known GL-only category, same as depreciation.**
    - Monthly accrual (DR Interest Expense, CR Accrued Interest Payable) is GL-only — no bank transaction
    - Annual payment hits the bank and matches normally through standard bank→GL matching
    - In two-way rec, monthly accruals show up as expected GL-only items in the GL→bank direction
    - Pre-configured as known GL-only category alongside depreciation (D-019) and opening balance (D-015)
    - **Decision: D-105**

14. **Plaid Pending Transactions** — ✅ **ANSWERED: Show as informational (not matchable).**
    - Pending transactions displayed in a separate section of the reconciliation view
    - Visually distinct (greyed out or similar) — user can see what's coming
    - Not matchable — cannot be linked to GL entries while pending
    - When they post (Plaid moves them from `removed` to `added` with new transaction_id), they enter the normal matching queue
    - Informational display helps user understand why a recent GL entry doesn't have a bank match yet ("oh, it's still pending")
    - **Decision: D-106**

15. **Match Confidence Scoring** — ✅ **ANSWERED: Exact amount + date window (±3 days), merchant name as tiebreaker.**
    - Primary match criterion: exact amount match (no fuzzy matching — too risky for financial data)
    - Date window: ±3 days between GL entry date and bank transaction date
    - Tiebreaker: when multiple GL entries match the same amount within the date window, merchant/payee name similarity ranks suggestions
    - No fuzzy amount matching in v1 (amounts either match or they don't)
    - Criteria to be refined based on actual usage patterns after launch
    - For split transactions (D-103): matching also considers whether unmatched GL entries sum to the bank transaction amount
    - **Decision: D-107**

---

## Key Decisions Made This Session

| Decision | Summary |
|----------|---------|
| D-093 | Plaid API for bank feeds ($0.30/account/month) |
| D-094 | Daily scheduled sync |
| D-095 | Trust-escalation matching model |
| D-096 | Inline GL creation from bank rec for bank-originated items |
| D-097 | Two-way reconciliation (bank→GL and GL→bank) |
| D-098 | 1-level Ramp rec with statement cross-check |
| D-099 | Formal sign-off with auditable edit capability |
| D-100 | Third Plaid account for escrow when opened |
| D-101 | Outstanding items — simple status, no aging rules |
| D-102 | Full history rebuild from $0, no mid-stream cutover |
| D-103 | Multi-transaction matching with bank transaction splitting |
| D-104 | AR timing handled by AR aging report, not bank rec |
| D-105 | AHP interest accrual — known GL-only category |
| D-106 | Plaid pending transactions — show as informational, not matchable |
| D-107 | Match criteria — exact amount ±3 days, merchant name tiebreaker |

## Cross-Chunk Impacts Identified

- **Chunk 3:** Ramp statement cross-check (D-098) requires Chunk 3's categorized transaction totals
- **Chunk 5 (D-069):** Escrow account reconciliation (D-100) adds third account
- **Chunk 5 (D-070):** Security deposit interest calculation feeds into bank rec as known GL-only items
- **Chunk 7 (D-091):** Cash projection reads bank balances — bank rec provides the validated balances
- **Chunk 8:** Plaid API integration requirements (authentication, token management, sync scheduling)
