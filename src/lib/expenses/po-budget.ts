/**
 * Pure utility functions for PO budget capacity calculations.
 * No database dependencies — safe for unit testing.
 */

const BUDGET_WARNING_THRESHOLD = 0.9 // 90%

export type BudgetStatus = {
  remaining: number
  percentUsed: number
  isWarning: boolean
  isOverBudget: boolean
}

export function calculateBudgetStatus(
  totalAmount: number,
  invoicedAmount: number
): BudgetStatus {
  const remaining = totalAmount - invoicedAmount
  const percentUsed = totalAmount > 0 ? invoicedAmount / totalAmount : 0

  return {
    remaining,
    percentUsed,
    isWarning: percentUsed >= BUDGET_WARNING_THRESHOLD && percentUsed < 1,
    isOverBudget: invoicedAmount > totalAmount,
  }
}

export function wouldExceedBudget(
  totalAmount: number,
  invoicedAmount: number,
  newInvoiceAmount: number
): boolean {
  return invoicedAmount + newInvoiceAmount > totalAmount
}
