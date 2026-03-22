/**
 * Invoice-to-bank-transaction matching module.
 * Finds outstanding invoices that match a bank transaction by amount,
 * vendor name (fuzzy), date proximity, and description.
 *
 * Handles both AP invoices (outflows) and AR invoices (inflows/deposits).
 */

import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { invoices, vendors, purchaseOrders, funds } from '@/lib/db/schema'
import { jaroWinklerSimilarity, normalizeMerchantName } from './string-similarity'

// --- Types ---

export type OutstandingInvoice = {
  invoiceId: number
  direction: 'AP' | 'AR'
  purchaseOrderId: number | null
  poNumber: string | null
  vendorId: number | null
  vendorName: string
  invoiceNumber: string | null
  invoiceAmount: string
  invoiceDate: string
  fundId: number | null
}

export type InvoiceMatchCandidate = {
  invoiceId: number
  direction: 'AP' | 'AR'
  purchaseOrderId: number | null
  poNumber: string | null
  vendorName: string
  invoiceAmount: string
  invoiceDate: string
  confidenceScore: number
  matchReason: string
}

export type BankTransactionInput = {
  amount: string
  date: string
  merchantName: string | null
  category: string | null
}

// --- Scoring weights ---

const WEIGHT_AMOUNT = 0.40
const WEIGHT_VENDOR = 0.30
const WEIGHT_DATE = 0.15
const WEIGHT_DESCRIPTION = 0.15

const MIN_CANDIDATE_SCORE = 60
const DATE_DECAY_DAYS = 30

// --- Vendor name normalization ---

/**
 * Normalize a vendor name for comparison.
 * Strips LLC, Inc, Corp, punctuation, collapses whitespace, lowercases.
 */
export function normalizeVendorName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(llc|inc|corp|ltd|co|corporation|incorporated|company)\b/gi, '')
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// --- Outstanding invoices query ---

export async function getOutstandingInvoices(): Promise<OutstandingInvoice[]> {
  // Fetch both AP and AR outstanding invoices in parallel
  const [apRows, arRows] = await Promise.all([
    // AP invoices: join to vendors and POs
    db
      .select({
        invoiceId: invoices.id,
        purchaseOrderId: invoices.purchaseOrderId,
        poId: purchaseOrders.id,
        vendorId: invoices.vendorId,
        vendorName: vendors.name,
        invoiceNumber: invoices.invoiceNumber,
        invoiceAmount: invoices.amount,
        invoiceDate: invoices.invoiceDate,
        fundId: invoices.fundId,
      })
      .from(invoices)
      .leftJoin(vendors, eq(invoices.vendorId, vendors.id))
      .leftJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
      .where(
        and(
          eq(invoices.paymentStatus, 'POSTED'),
          eq(invoices.direction, 'AP')
        )
      ),
    // AR invoices: join to funds for the funder name
    db
      .select({
        invoiceId: invoices.id,
        invoiceNumber: invoices.invoiceNumber,
        invoiceAmount: invoices.amount,
        invoiceDate: invoices.invoiceDate,
        fundId: invoices.fundId,
        fundName: funds.name,
      })
      .from(invoices)
      .leftJoin(funds, eq(invoices.fundId, funds.id))
      .where(
        and(
          eq(invoices.paymentStatus, 'POSTED'),
          eq(invoices.direction, 'AR')
        )
      ),
  ])

  const apInvoices: OutstandingInvoice[] = apRows.map((r) => ({
    invoiceId: r.invoiceId,
    direction: 'AP' as const,
    purchaseOrderId: r.purchaseOrderId,
    poNumber: r.poId ? `PO-${r.poId}` : null,
    vendorId: r.vendorId,
    vendorName: r.vendorName ?? 'Unknown',
    invoiceNumber: r.invoiceNumber,
    invoiceAmount: r.invoiceAmount,
    invoiceDate: r.invoiceDate,
    fundId: r.fundId,
  }))

  const arInvoices: OutstandingInvoice[] = arRows.map((r) => ({
    invoiceId: r.invoiceId,
    direction: 'AR' as const,
    purchaseOrderId: null,
    poNumber: null,
    vendorId: null,
    vendorName: r.fundName ?? 'Unknown Fund',
    invoiceNumber: r.invoiceNumber,
    invoiceAmount: r.invoiceAmount,
    invoiceDate: r.invoiceDate,
    fundId: r.fundId,
  }))

  return [...apInvoices, ...arInvoices]
}

// --- Scoring functions ---

function scoreAmount(bankAmount: number, invoiceAmount: number, direction: 'AP' | 'AR'): number {
  // AP invoices: bank amount is negative (outflow), invoice amount is positive.
  // AR invoices: bank amount is positive (inflow/deposit), invoice amount is positive.
  // Compare absolute values with ±$0.01 tolerance.
  const diff = Math.abs(Math.abs(bankAmount) - invoiceAmount)
  if (diff > 0.01) return 0
  // Verify sign direction: AP = negative bank txn, AR = positive bank txn
  if (direction === 'AP' && bankAmount > 0) return 0
  if (direction === 'AR' && bankAmount < 0) return 0
  return 100
}

function scoreVendor(bankMerchant: string | null, vendorName: string): number {
  if (!bankMerchant) return 0
  const normalizedBank = normalizeVendorName(normalizeMerchantName(bankMerchant))
  const normalizedVendor = normalizeVendorName(vendorName)
  if (!normalizedBank || !normalizedVendor) return 0
  return jaroWinklerSimilarity(normalizedBank, normalizedVendor) * 100
}

function scoreDate(bankDate: string, invoiceDate: string): number {
  const bankTime = new Date(bankDate).getTime()
  const invoiceTime = new Date(invoiceDate).getTime()
  const daysDiff = Math.abs(bankTime - invoiceTime) / (1000 * 60 * 60 * 24)
  if (daysDiff <= 0) return 100
  if (daysDiff >= DATE_DECAY_DAYS) return 0
  return Math.round(100 * (1 - daysDiff / DATE_DECAY_DAYS))
}

function scoreDescription(bankCategory: string | null, poDescription: string | null): number {
  if (!bankCategory || !poDescription) return 0
  const normalizedBank = normalizeVendorName(bankCategory)
  const normalizedPo = normalizeVendorName(poDescription)
  if (!normalizedBank || !normalizedPo) return 0
  return jaroWinklerSimilarity(normalizedBank, normalizedPo) * 100
}

// --- Main matching function ---

/**
 * Match a bank transaction against outstanding invoices.
 * Returns ranked candidates above the confidence threshold.
 *
 * Pass `outstandingInvoices` to avoid re-querying when matching in bulk.
 */
export function matchBankTransactionToInvoices(
  bankTxn: BankTransactionInput,
  outstandingInvoices: OutstandingInvoice[],
  poDescriptions?: Map<number, string | null>
): InvoiceMatchCandidate[] {
  if (outstandingInvoices.length === 0) return []

  const bankAmount = parseFloat(bankTxn.amount)
  const candidates: InvoiceMatchCandidate[] = []

  for (const inv of outstandingInvoices) {
    const invoiceAmount = parseFloat(inv.invoiceAmount)

    const amountScore = scoreAmount(bankAmount, invoiceAmount, inv.direction)
    // Amount must be an exact match for the candidate to be viable
    if (amountScore === 0) continue

    const vendorScore = scoreVendor(bankTxn.merchantName, inv.vendorName)
    const dateScore = scoreDate(bankTxn.date, inv.invoiceDate)

    const poDesc = inv.purchaseOrderId && poDescriptions
      ? poDescriptions.get(inv.purchaseOrderId) ?? null
      : null
    const descScore = scoreDescription(bankTxn.category, poDesc)

    const composite = Math.round(
      amountScore * WEIGHT_AMOUNT +
      vendorScore * WEIGHT_VENDOR +
      dateScore * WEIGHT_DATE +
      descScore * WEIGHT_DESCRIPTION
    )

    if (composite >= MIN_CANDIDATE_SCORE) {
      const reasons: string[] = []
      const dirLabel = inv.direction === 'AR' ? 'AR ' : ''
      reasons.push(`${dirLabel}Amount: exact match ($${invoiceAmount.toFixed(2)})`)
      if (vendorScore >= 70) {
        const counterparty = inv.direction === 'AR' ? 'Fund' : 'Vendor'
        reasons.push(`${counterparty}: "${inv.vendorName}" (${Math.round(vendorScore)}%)`)
      }
      if (dateScore >= 50) reasons.push(`Date: within ${DATE_DECAY_DAYS}d`)

      candidates.push({
        invoiceId: inv.invoiceId,
        direction: inv.direction,
        purchaseOrderId: inv.purchaseOrderId,
        poNumber: inv.poNumber,
        vendorName: inv.vendorName,
        invoiceAmount: inv.invoiceAmount,
        invoiceDate: inv.invoiceDate,
        confidenceScore: composite,
        matchReason: reasons.join('; '),
      })
    }
  }

  // Sort by confidence descending
  candidates.sort((a, b) => b.confidenceScore - a.confidenceScore)
  return candidates
}
