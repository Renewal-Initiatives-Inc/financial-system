import { eq, and, sql, notInArray } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  accounts,
  transactionLines,
  transactions,
  invoices,
  purchaseOrders,
  vendors,
} from '@/lib/db/schema'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgingBucket = 'current' | '31-60' | '61-90' | '90+'

export interface PayableRow {
  type: string // 'Accounts Payable' | 'Reimbursements Payable' | 'Credit Card Payable' | 'Accrued'
  vendorName?: string
  invoiceNumber?: string
  invoiceDate?: string
  dueDate?: string
  poNumber?: string
  amount: number
  agingBucket: AgingBucket
}

export interface PayableSection {
  title: string
  rows: PayableRow[]
  total: number
}

export interface OutstandingPayablesData {
  sections: PayableSection[]
  grandTotal: number
  invoiceDetail: PayableRow[] // AP detail with vendor/invoice info
  generatedAt: string
  agingSummary: {
    current: number
    '31-60': number
    '61-90': number
    '90+': number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PAYABLE_SUBTYPE_MAP: Record<string, string> = {
  'Accounts Payable': 'Accounts Payable',
  'Reimbursements Payable': 'Reimbursements Payable',
  'Credit Card Payable': 'Credit Card Payable',
  'Accrued': 'Accrued Liabilities',
  'Payroll Payable': 'Accrued Liabilities',
}

function getAgingBucket(dueDate: string | null | undefined): AgingBucket {
  if (!dueDate) return 'current'
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)
  const diffDays = Math.floor(
    (today.getTime() - due.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays <= 30) return 'current'
  if (diffDays <= 60) return '31-60'
  if (diffDays <= 90) return '61-90'
  return '90+'
}

function computeBalance(
  normalBalance: string,
  totalDebit: string,
  totalCredit: string
): number {
  const d = parseFloat(totalDebit) || 0
  const c = parseFloat(totalCredit) || 0
  return normalBalance === 'DEBIT' ? d - c : c - d
}

// ---------------------------------------------------------------------------
// Main query
// ---------------------------------------------------------------------------

export async function getOutstandingPayablesData(): Promise<OutstandingPayablesData> {
  const now = new Date().toISOString()

  // 1. Get GL balances for all payable-type liability accounts
  const payableSubTypes = Object.keys(PAYABLE_SUBTYPE_MAP)

  const glBalances = await db
    .select({
      accountId: accounts.id,
      accountCode: accounts.code,
      accountName: accounts.name,
      subType: accounts.subType,
      normalBalance: accounts.normalBalance,
      totalDebit: sql<string>`COALESCE(SUM(CAST(${transactionLines.debit} AS numeric)), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(CAST(${transactionLines.credit} AS numeric)), 0)`,
    })
    .from(accounts)
    .leftJoin(transactionLines, eq(transactionLines.accountId, accounts.id))
    .leftJoin(
      transactions,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(
      and(
        eq(accounts.type, 'LIABILITY'),
        eq(accounts.isActive, true),
        sql`${accounts.subType} IN (${sql.join(
          payableSubTypes.map((s) => sql`${s}`),
          sql`, `
        )})`,
        sql`(${transactions.id} IS NULL OR ${transactions.isVoided} = false)`
      )
    )
    .groupBy(
      accounts.id,
      accounts.code,
      accounts.name,
      accounts.subType,
      accounts.normalBalance
    )
    .orderBy(accounts.code)

  // 2. Get unpaid invoice detail for AP section
  const unpaidInvoices = await db
    .select({
      invoiceId: invoices.id,
      invoiceNumber: invoices.invoiceNumber,
      invoiceDate: invoices.invoiceDate,
      dueDate: invoices.dueDate,
      amount: invoices.amount,
      paymentStatus: invoices.paymentStatus,
      vendorName: vendors.name,
      poId: purchaseOrders.id,
      poDescription: purchaseOrders.description,
    })
    .from(invoices)
    .innerJoin(vendors, eq(invoices.vendorId, vendors.id))
    .innerJoin(purchaseOrders, eq(invoices.purchaseOrderId, purchaseOrders.id))
    .where(
      notInArray(invoices.paymentStatus, ['PAID', 'MATCHED_TO_PAYMENT'])
    )
    .orderBy(invoices.dueDate)

  // 3. Build invoice detail rows
  const invoiceDetail: PayableRow[] = unpaidInvoices.map((inv) => ({
    type: 'Accounts Payable',
    vendorName: inv.vendorName,
    invoiceNumber: inv.invoiceNumber ?? undefined,
    invoiceDate: inv.invoiceDate,
    dueDate: inv.dueDate ?? undefined,
    poNumber: inv.poId ? `PO-${inv.poId}` : undefined,
    amount: parseFloat(inv.amount),
    agingBucket: getAgingBucket(inv.dueDate),
  }))

  // 4. Build sections grouped by payable subType
  const sectionMap = new Map<string, PayableSection>()

  // Initialize sections with known titles
  const sectionOrder = [
    'Accounts Payable',
    'Reimbursements Payable',
    'Credit Card Payable',
    'Accrued Liabilities',
  ]
  for (const title of sectionOrder) {
    sectionMap.set(title, { title, rows: [], total: 0 })
  }

  for (const row of glBalances) {
    const balance = computeBalance(
      row.normalBalance,
      row.totalDebit,
      row.totalCredit
    )
    if (balance === 0) continue

    const sectionTitle =
      PAYABLE_SUBTYPE_MAP[row.subType ?? ''] ?? 'Accrued Liabilities'
    let section = sectionMap.get(sectionTitle)
    if (!section) {
      section = { title: sectionTitle, rows: [], total: 0 }
      sectionMap.set(sectionTitle, section)
    }

    // For AP section, use invoice detail instead of GL rows
    if (sectionTitle === 'Accounts Payable') {
      // We use the GL balance as the section total (may differ from invoice sum
      // due to manual AP journal entries without invoice records)
      section.total += balance
    } else {
      section.rows.push({
        type: sectionTitle,
        amount: balance,
        agingBucket: 'current', // non-AP sections don't have per-invoice aging
      })
      section.total += balance
    }
  }

  // Populate AP section rows from invoice detail
  const apSection = sectionMap.get('Accounts Payable')
  if (apSection) {
    apSection.rows = invoiceDetail
    // If GL balance wasn't set (no AP accounts in GL), derive from invoices
    if (apSection.total === 0 && invoiceDetail.length > 0) {
      apSection.total = invoiceDetail.reduce((s, r) => s + r.amount, 0)
    }
  }

  // Filter out empty sections and build ordered array
  const sections = sectionOrder
    .map((title) => sectionMap.get(title)!)
    .filter((s) => s.total !== 0 || s.rows.length > 0)

  const grandTotal = sections.reduce((s, sec) => s + sec.total, 0)

  // 5. Build aging summary from invoice detail
  const agingSummary = {
    current: 0,
    '31-60': 0,
    '61-90': 0,
    '90+': 0,
  }
  for (const inv of invoiceDetail) {
    agingSummary[inv.agingBucket] += inv.amount
  }

  return {
    sections,
    grandTotal,
    invoiceDetail,
    generatedAt: now,
    agingSummary,
  }
}
