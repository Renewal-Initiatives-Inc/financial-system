'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, sql, desc, inArray, or } from 'drizzle-orm'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'
import { db } from '@/lib/db'
import {
  purchaseOrders,
  invoices,
  vendors,
  accounts,
  funds,
  cipCostCodes,
  transactionLines,
  transactions,
} from '@/lib/db/schema'
import {
  insertPurchaseOrderSchema,
  updatePurchaseOrderSchema,
  insertInvoiceSchema,
  type InsertPurchaseOrder,
  type UpdatePurchaseOrder,
  type InsertInvoice,
} from '@/lib/validators'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import { getUserId } from '@/lib/auth'

// --- Types ---

export type PurchaseOrderRow = typeof purchaseOrders.$inferSelect & {
  vendorName: string
  fundName: string
  accountCode: string
  accountName: string
  invoicedAmount: string
}

export type PurchaseOrderDetail = typeof purchaseOrders.$inferSelect & {
  vendorName: string
  fundName: string
  accountCode: string
  accountName: string
  cipCostCodeName: string | null
  invoicedAmount: string
  invoices: InvoiceRow[]
}

export type InvoiceRow = typeof invoices.$inferSelect & {
  glTransactionMemo?: string | null
}

// --- Purchase Order Queries ---

export async function getPurchaseOrders(filters?: {
  vendorId?: number
  status?: string
  fundId?: number
}): Promise<PurchaseOrderRow[]> {
  const conditions = []

  if (filters?.vendorId) {
    conditions.push(eq(purchaseOrders.vendorId, filters.vendorId))
  }
  if (filters?.status && filters.status !== 'all') {
    conditions.push(
      eq(
        purchaseOrders.status,
        filters.status as (typeof purchaseOrders.status.enumValues)[number]
      )
    )
  }
  if (filters?.fundId) {
    conditions.push(eq(purchaseOrders.fundId, filters.fundId))
  }

  const rows = await db
    .select({
      po: purchaseOrders,
      vendorName: vendors.name,
      fundName: funds.name,
      accountCode: accounts.code,
      accountName: accounts.name,
      invoicedAmount: sql<string>`COALESCE(
        (SELECT SUM(${invoices.amount}) FROM ${invoices} WHERE ${invoices.purchaseOrderId} = ${purchaseOrders.id}),
        '0'
      )`,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(funds, eq(purchaseOrders.fundId, funds.id))
    .innerJoin(
      accounts,
      eq(purchaseOrders.glDestinationAccountId, accounts.id)
    )
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(desc(purchaseOrders.createdAt))

  return rows.map((r) => ({
    ...r.po,
    vendorName: r.vendorName,
    fundName: r.fundName,
    accountCode: r.accountCode,
    accountName: r.accountName,
    invoicedAmount: r.invoicedAmount,
  }))
}

export async function getPurchaseOrderById(
  id: number
): Promise<PurchaseOrderDetail | null> {
  const [row] = await db
    .select({
      po: purchaseOrders,
      vendorName: vendors.name,
      fundName: funds.name,
      accountCode: accounts.code,
      accountName: accounts.name,
    })
    .from(purchaseOrders)
    .innerJoin(vendors, eq(purchaseOrders.vendorId, vendors.id))
    .innerJoin(funds, eq(purchaseOrders.fundId, funds.id))
    .innerJoin(
      accounts,
      eq(purchaseOrders.glDestinationAccountId, accounts.id)
    )
    .where(eq(purchaseOrders.id, id))

  if (!row) return null

  let cipCostCodeName: string | null = null
  if (row.po.cipCostCodeId) {
    const [code] = await db
      .select({ name: cipCostCodes.name })
      .from(cipCostCodes)
      .where(eq(cipCostCodes.id, row.po.cipCostCodeId))
    cipCostCodeName = code?.name ?? null
  }

  const invoiceRows = await db
    .select()
    .from(invoices)
    .where(eq(invoices.purchaseOrderId, id))
    .orderBy(desc(invoices.invoiceDate))

  const invoicedAmount = invoiceRows
    .reduce((sum, inv) => sum + parseFloat(inv.amount), 0)
    .toFixed(2)

  return {
    ...row.po,
    vendorName: row.vendorName,
    fundName: row.fundName,
    accountCode: row.accountCode,
    accountName: row.accountName,
    cipCostCodeName,
    invoicedAmount,
    invoices: invoiceRows,
  }
}

// --- Purchase Order Mutations ---

export async function createPurchaseOrder(
  data: InsertPurchaseOrder
): Promise<{ id: number }> {
  const userId = await getUserId()
  const validated = insertPurchaseOrderSchema.parse(data)

  const [newPo] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(purchaseOrders)
      .values({
        vendorId: validated.vendorId,
        description: validated.description,
        contractPdfUrl: validated.contractPdfUrl ?? null,
        totalAmount: String(validated.totalAmount),
        glDestinationAccountId: validated.glDestinationAccountId,
        fundId: validated.fundId,
        cipCostCodeId: validated.cipCostCodeId ?? null,
        status: validated.status ?? 'DRAFT',
        extractedMilestones: validated.extractedMilestones ?? null,
        extractedTerms: validated.extractedTerms ?? null,
        extractedCovenants: validated.extractedCovenants ?? null,
        createdBy: userId,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'purchase_order',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/expenses/purchase-orders')
  return { id: newPo.id }
}

export async function updatePurchaseOrder(
  id: number,
  data: UpdatePurchaseOrder,
  userId: string
): Promise<void> {
  const validated = updatePurchaseOrderSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))

    if (!existing) throw new Error(`Purchase order ${id} not found`)

    const beforeState = { ...existing }
    const updates: Record<string, unknown> = { updatedAt: new Date() }

    if (validated.description !== undefined)
      updates.description = validated.description
    if (validated.contractPdfUrl !== undefined)
      updates.contractPdfUrl = validated.contractPdfUrl
    if (validated.totalAmount !== undefined)
      updates.totalAmount = String(validated.totalAmount)
    if (validated.glDestinationAccountId !== undefined)
      updates.glDestinationAccountId = validated.glDestinationAccountId
    if (validated.fundId !== undefined) updates.fundId = validated.fundId
    if (validated.cipCostCodeId !== undefined)
      updates.cipCostCodeId = validated.cipCostCodeId
    if (validated.extractedMilestones !== undefined)
      updates.extractedMilestones = validated.extractedMilestones
    if (validated.extractedTerms !== undefined)
      updates.extractedTerms = validated.extractedTerms
    if (validated.extractedCovenants !== undefined)
      updates.extractedCovenants = validated.extractedCovenants

    await tx
      .update(purchaseOrders)
      .set(updates)
      .where(eq(purchaseOrders.id, id))

    const [updated] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'purchase_order',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/expenses/purchase-orders')
  revalidatePath(`/expenses/purchase-orders/${id}`)
}

export async function updatePurchaseOrderStatus(
  id: number,
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED',
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, id))

    if (!existing) throw new Error(`Purchase order ${id} not found`)

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      DRAFT: ['ACTIVE'],
      ACTIVE: ['COMPLETED', 'CANCELLED'],
    }

    const allowed = validTransitions[existing.status]
    if (!allowed || !allowed.includes(status)) {
      throw new Error(
        `Cannot transition PO from ${existing.status} to ${status}`
      )
    }

    await tx
      .update(purchaseOrders)
      .set({ status, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'purchase_order',
      entityId: id,
      beforeState: { status: existing.status },
      afterState: { status },
    })
  })

  revalidatePath('/expenses/purchase-orders')
  revalidatePath(`/expenses/purchase-orders/${id}`)
}

// --- Invoice Mutations ---

export async function createInvoice(
  data: InsertInvoice,
  userId: string
): Promise<{ id: number; glTransactionId: number }> {
  const validated = insertInvoiceSchema.parse(data)

  // 1. Look up PO for GL destination, fund, and CIP cost code
  const [po] = await db
    .select()
    .from(purchaseOrders)
    .where(eq(purchaseOrders.id, validated.purchaseOrderId))

  if (!po) throw new Error(`Purchase order ${validated.purchaseOrderId} not found`)

  // 2. Look up Accounts Payable account by code (system-locked)
  const [apAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2000'))

  if (!apAccount) {
    throw new Error(
      'Accounts Payable account (2000) not found. Run seed data first.'
    )
  }

  // 3. Look up vendor name for memo
  const [vendor] = await db
    .select({ name: vendors.name })
    .from(vendors)
    .where(eq(vendors.id, po.vendorId))

  // 4. Create invoice record first (need ID for sourceReferenceId)
  const [newInvoice] = await db
    .insert(invoices)
    .values({
      purchaseOrderId: validated.purchaseOrderId,
      vendorId: po.vendorId,
      invoiceNumber: validated.invoiceNumber ?? null,
      amount: String(validated.amount),
      invoiceDate: validated.invoiceDate,
      dueDate: validated.dueDate ?? null,
      paymentStatus: 'PENDING',
      createdBy: userId,
    })
    .returning()

  // 5. Create GL entry: DR destination, CR Accounts Payable
  const invoiceRef = validated.invoiceNumber || `INV-${newInvoice.id}`
  const txnResult = await createTransaction({
    date: validated.invoiceDate,
    memo: `Invoice ${invoiceRef} from ${vendor?.name ?? 'vendor'} against PO-${po.id}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `invoice:${newInvoice.id}`,
    isSystemGenerated: false,
    createdBy: userId,
    lines: [
      {
        accountId: po.glDestinationAccountId,
        fundId: po.fundId,
        debit: validated.amount,
        credit: null,
        cipCostCodeId: po.cipCostCodeId ?? null,
      },
      {
        accountId: apAccount.id,
        fundId: po.fundId,
        debit: null,
        credit: validated.amount,
      },
    ],
  })

  // 6. Update invoice with GL transaction ID and status
  await db
    .update(invoices)
    .set({
      glTransactionId: txnResult.transaction.id,
      paymentStatus: 'POSTED',
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, newInvoice.id))

  // 7. Audit log for invoice creation
  await db.transaction(async (tx) => {
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'invoice',
      entityId: newInvoice.id,
      afterState: {
        ...newInvoice,
        glTransactionId: txnResult.transaction.id,
        paymentStatus: 'POSTED',
      } as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/expenses/purchase-orders')
  revalidatePath(`/expenses/purchase-orders/${po.id}`)
  revalidatePath('/expenses/payables')

  return { id: newInvoice.id, glTransactionId: txnResult.transaction.id }
}

export async function dismissComplianceWarning(
  poId: number,
  warningType: string,
  warningMessage: string
): Promise<void> {
  const userId = await getUserId()

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(purchaseOrders)
      .where(eq(purchaseOrders.id, poId))

    if (!existing) throw new Error(`Purchase order ${poId} not found`)

    const dismissed = (existing.dismissedWarnings ?? []) as {
      type: string
      message: string
      dismissedAt: string
      dismissedBy: string
    }[]

    // Avoid duplicate dismissals
    const alreadyDismissed = dismissed.some(
      (d) => d.type === warningType && d.message === warningMessage
    )
    if (alreadyDismissed) return

    const updated = [
      ...dismissed,
      {
        type: warningType,
        message: warningMessage,
        dismissedAt: new Date().toISOString(),
        dismissedBy: userId,
      },
    ]

    await tx
      .update(purchaseOrders)
      .set({ dismissedWarnings: updated, updatedAt: new Date() })
      .where(eq(purchaseOrders.id, poId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'purchase_order',
      entityId: poId,
      beforeState: { dismissedWarnings: dismissed },
      afterState: { dismissedWarnings: updated },
    })
  })

  revalidatePath(`/expenses/purchase-orders/${poId}`)
}

export async function markPaymentInProcess(
  invoiceId: number,
  userId: string
): Promise<void> {
  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(invoices)
      .where(eq(invoices.id, invoiceId))

    if (!existing) throw new Error(`Invoice ${invoiceId} not found`)

    if (existing.paymentStatus !== 'POSTED') {
      throw new Error(
        `Cannot mark as payment in process: current status is ${existing.paymentStatus} (must be POSTED)`
      )
    }

    await tx
      .update(invoices)
      .set({ paymentStatus: 'PAYMENT_IN_PROCESS', updatedAt: new Date() })
      .where(eq(invoices.id, invoiceId))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'invoice',
      entityId: invoiceId,
      beforeState: { paymentStatus: 'POSTED' },
      afterState: { paymentStatus: 'PAYMENT_IN_PROCESS' },
    })
  })

  revalidatePath('/expenses/payables')
}

// --- Outstanding Payables ---

export type PayableItem = {
  type: 'AP' | 'REIMBURSEMENT' | 'CREDIT_CARD'
  vendorId: number | null
  vendorName: string
  amount: string
  date: string
  invoiceId?: number
  invoiceNumber?: string | null
  paymentStatus?: string
}

export async function getOutstandingPayables(): Promise<PayableItem[]> {
  const payables: PayableItem[] = []

  // 1. Accounts Payable — unpaid invoices
  const unpaidInvoices = await db
    .select({
      invoice: invoices,
      vendorName: vendors.name,
    })
    .from(invoices)
    .innerJoin(vendors, eq(invoices.vendorId, vendors.id))
    .where(
      and(
        inArray(invoices.paymentStatus, [
          'POSTED',
          'PAYMENT_IN_PROCESS',
        ])
      )
    )
    .orderBy(invoices.invoiceDate)

  for (const row of unpaidInvoices) {
    payables.push({
      type: 'AP',
      vendorId: row.invoice.vendorId,
      vendorName: row.vendorName,
      amount: row.invoice.amount,
      date: row.invoice.invoiceDate,
      invoiceId: row.invoice.id,
      invoiceNumber: row.invoice.invoiceNumber,
      paymentStatus: row.invoice.paymentStatus,
    })
  }

  // 2. Reimbursements Payable — unmatched credit balances on 2100 (Reimbursements Payable)
  const [reimbAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2100'))

  if (reimbAccount) {
    const reimbLines = await db
      .select({
        credit: transactionLines.credit,
        date: transactions.date,
        memo: transactions.memo,
        isVoided: transactions.isVoided,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          eq(transactionLines.accountId, reimbAccount.id),
          eq(transactions.isVoided, false)
        )
      )

    const reimbTotal = reimbLines.reduce(
      (sum, l) => sum + parseFloat(l.credit ?? '0'),
      0
    )
    const reimbDebits = reimbLines.reduce(
      (sum, l) => sum + parseFloat(l.credit ?? '0'), // credits increase liability
      0
    )

    // Simplified: net balance of the account
    const reimbBalance = await db
      .select({
        balance: sql<string>`COALESCE(SUM(COALESCE(${transactionLines.credit}, 0)) - SUM(COALESCE(${transactionLines.debit}, 0)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          eq(transactionLines.accountId, reimbAccount.id),
          eq(transactions.isVoided, false)
        )
      )

    const balance = parseFloat(reimbBalance[0]?.balance ?? '0')
    if (balance > 0.005) {
      payables.push({
        type: 'REIMBURSEMENT',
        vendorId: null,
        vendorName: 'Employee Reimbursements',
        amount: balance.toFixed(2),
        date: new Date().toISOString().split('T')[0],
      })
    }
  }

  // 3. Credit Card Payable — net balance on 2200 (Credit Card Payable)
  const [ccAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '2200'))

  if (ccAccount) {
    const ccBalance = await db
      .select({
        balance: sql<string>`COALESCE(SUM(COALESCE(${transactionLines.credit}, 0)) - SUM(COALESCE(${transactionLines.debit}, 0)), 0)`,
      })
      .from(transactionLines)
      .innerJoin(
        transactions,
        eq(transactionLines.transactionId, transactions.id)
      )
      .where(
        and(
          eq(transactionLines.accountId, ccAccount.id),
          eq(transactions.isVoided, false)
        )
      )

    const balance = parseFloat(ccBalance[0]?.balance ?? '0')
    if (balance > 0.005) {
      payables.push({
        type: 'CREDIT_CARD',
        vendorId: null,
        vendorName: 'Ramp Credit Card',
        amount: balance.toFixed(2),
        date: new Date().toISOString().split('T')[0],
      })
    }
  }

  return payables
}

// --- Vendor Payment Summary (for 1099 tracking) ---

export async function getVendorPaymentSummary(
  vendorId: number,
  year?: number
): Promise<{
  totalPaid: number
  payments: { invoiceId: number; amount: string; date: string; invoiceNumber: string | null }[]
}> {
  const targetYear = year ?? new Date().getFullYear()
  const yearStart = `${targetYear}-01-01`
  const yearEnd = `${targetYear}-12-31`

  const paidInvoices = await db
    .select()
    .from(invoices)
    .where(
      and(
        eq(invoices.vendorId, vendorId),
        inArray(invoices.paymentStatus, ['MATCHED_TO_PAYMENT', 'PAID']),
        sql`${invoices.invoiceDate} >= ${yearStart}`,
        sql`${invoices.invoiceDate} <= ${yearEnd}`
      )
    )
    .orderBy(desc(invoices.invoiceDate))

  const totalPaid = paidInvoices.reduce(
    (sum, inv) => sum + parseFloat(inv.amount),
    0
  )

  return {
    totalPaid,
    payments: paidInvoices.map((inv) => ({
      invoiceId: inv.id,
      amount: inv.amount,
      date: inv.invoiceDate,
      invoiceNumber: inv.invoiceNumber,
    })),
  }
}

// --- Vendor PO List (for vendor detail page) ---

export async function getVendorPurchaseOrders(
  vendorId: number
): Promise<
  {
    id: number
    description: string
    totalAmount: string
    invoicedAmount: string
    status: string
    createdAt: Date
  }[]
> {
  const rows = await db
    .select({
      id: purchaseOrders.id,
      description: purchaseOrders.description,
      totalAmount: purchaseOrders.totalAmount,
      status: purchaseOrders.status,
      createdAt: purchaseOrders.createdAt,
      invoicedAmount: sql<string>`COALESCE(
        (SELECT SUM(${invoices.amount}) FROM ${invoices} WHERE ${invoices.purchaseOrderId} = ${purchaseOrders.id}),
        '0'
      )`,
    })
    .from(purchaseOrders)
    .where(eq(purchaseOrders.vendorId, vendorId))
    .orderBy(desc(purchaseOrders.createdAt))

  return rows
}

// --- Lookup helpers for form dropdowns ---

export async function getActiveVendors(): Promise<
  { id: number; name: string }[]
> {
  return db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.isActive, true))
    .orderBy(vendors.name)
}

export async function getExpenseAndCipAccounts(): Promise<
  { id: number; code: string; name: string; subType: string | null }[]
> {
  return db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      subType: accounts.subType,
    })
    .from(accounts)
    .where(
      and(
        eq(accounts.isActive, true),
        sql`${accounts.parentAccountId} IS NOT NULL` // only postable (child) accounts
      )
    )
    .orderBy(accounts.code)
}

export async function getActiveFunds(): Promise<
  { id: number; name: string; restrictionType: string }[]
> {
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(
      and(
        eq(funds.isActive, true),
        or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
      )
    )
    .orderBy(funds.name)
}

export async function getActiveCipCostCodes(): Promise<
  { id: number; code: string; name: string; category: string }[]
> {
  return db
    .select({
      id: cipCostCodes.id,
      code: cipCostCodes.code,
      name: cipCostCodes.name,
      category: cipCostCodes.category,
    })
    .from(cipCostCodes)
    .where(eq(cipCostCodes.isActive, true))
    .orderBy(cipCostCodes.sortOrder)
}
