/**
 * Pure utility functions for invoice GL posting logic.
 * No database dependencies — safe for unit testing.
 */

export type InvoiceGlLineConfig = {
  destinationAccountId: number
  apAccountId: number
  fundId: number
  amount: number
  cipCostCodeId: number | null
}

export type GlLine = {
  accountId: number
  fundId: number
  debit: number | null
  credit: number | null
  cipCostCodeId?: number | null
}

/**
 * Build GL entry lines for an invoice posting.
 * DR destination account (expense or CIP), CR Accounts Payable.
 * CIP cost code from PO flows to the debit line (inheritance).
 */
export function buildInvoiceGlLines(config: InvoiceGlLineConfig): GlLine[] {
  return [
    {
      accountId: config.destinationAccountId,
      fundId: config.fundId,
      debit: config.amount,
      credit: null,
      cipCostCodeId: config.cipCostCodeId,
    },
    {
      accountId: config.apAccountId,
      fundId: config.fundId,
      debit: null,
      credit: config.amount,
    },
  ]
}

/**
 * Validates whether a GL entry is balanced (total debits = total credits).
 */
export function isBalancedEntry(lines: GlLine[]): boolean {
  const totalDebits = lines.reduce((sum, l) => sum + (l.debit ?? 0), 0)
  const totalCredits = lines.reduce((sum, l) => sum + (l.credit ?? 0), 0)
  return Math.abs(totalDebits - totalCredits) < 0.005
}

// --- Payment Status Transitions ---

const VALID_PO_TRANSITIONS: Record<string, string[]> = {
  DRAFT: ['ACTIVE'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
}

const VALID_INVOICE_TRANSITIONS: Record<string, string[]> = {
  POSTED: ['PAID'],
}

export function isValidPoTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const allowed = VALID_PO_TRANSITIONS[currentStatus]
  return !!allowed && allowed.includes(newStatus)
}

export function isValidInvoiceTransition(
  currentStatus: string,
  newStatus: string
): boolean {
  const allowed = VALID_INVOICE_TRANSITIONS[currentStatus]
  return !!allowed && allowed.includes(newStatus)
}

// --- Aging Buckets ---

export type AgingBucket = 'CURRENT' | '30_DAYS' | '60_DAYS' | '90_PLUS'

export function getAgingBucket(invoiceDate: string, asOfDate?: string): AgingBucket {
  const today = asOfDate ? new Date(asOfDate) : new Date()
  const invoice = new Date(invoiceDate)
  const daysDiff = Math.floor(
    (today.getTime() - invoice.getTime()) / (1000 * 60 * 60 * 24)
  )

  if (daysDiff <= 30) return 'CURRENT'
  if (daysDiff <= 60) return '30_DAYS'
  if (daysDiff <= 90) return '60_DAYS'
  return '90_PLUS'
}
