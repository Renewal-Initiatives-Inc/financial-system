# Chunk 4: Bank Reconciliation — Discovery

**Status:** 🔴 Not Started

Matching transactions in the system to bank statements. May involve bank feed imports or manual matching.

---

## Key Questions

- What bank export formats does UMass Five support? (CSV, OFX, QFX, API?)
- What's the current reconciliation process?
- How many bank accounts? (Answered: 2 — checking ...0180, savings ...0172)
- How to handle GL-only entries (depreciation, loan forgiveness)?
- AR timing gaps (accrued month N, received month N+1)?

## Dependencies

**From Chunk 1:**
- D-015: Opening balance is GL-only
- D-019: Depreciation is GL-only
- D-021: Ramp credit card timing
- D-022: AHP loan draws
- D-023: Loan forgiveness is GL-only
- D-025: Rental income accrual timing
- D-026: AR variance analysis
- D-027: Rent adjustments
