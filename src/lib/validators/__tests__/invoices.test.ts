import { describe, expect, it } from 'vitest'
import { insertInvoiceSchema, updateInvoiceSchema } from '../invoices'

describe('Invoice validation', () => {
  const validInvoice = {
    purchaseOrderId: 1,
    vendorId: 5,
    amount: 2500.0,
    invoiceDate: '2026-02-01',
  }

  it('valid invoice with required fields passes', () => {
    const result = insertInvoiceSchema.safeParse(validInvoice)
    expect(result.success).toBe(true)
  })

  it('valid invoice with all fields passes', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceNumber: 'INV-2026-001',
      dueDate: '2026-03-01',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing purchaseOrderId', () => {
    const { purchaseOrderId, ...noPoId } = validInvoice
    const result = insertInvoiceSchema.safeParse(noPoId)
    expect(result.success).toBe(false)
  })

  it('rejects missing vendorId', () => {
    const { vendorId, ...noVendorId } = validInvoice
    const result = insertInvoiceSchema.safeParse(noVendorId)
    expect(result.success).toBe(false)
  })

  it('rejects zero amount', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative amount', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      amount: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects amount with more than 2 decimal places', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 100.999,
    })
    expect(result.success).toBe(false)
  })

  it('accepts amount with exactly 2 decimal places', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 100.99,
    })
    expect(result.success).toBe(true)
  })

  it('accepts large amounts', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      amount: 9999999999999.99,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing invoiceDate', () => {
    const { invoiceDate, ...noDate } = validInvoice
    const result = insertInvoiceSchema.safeParse(noDate)
    expect(result.success).toBe(false)
  })

  it('rejects invalid invoiceDate format', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: '02/01/2026',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid invoiceDate value', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceDate: '2026-13-01',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null invoiceNumber', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceNumber: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts null dueDate', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      dueDate: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invoiceNumber longer than 100 characters', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceNumber: 'A'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('accepts invoiceNumber at 100 characters', () => {
    const result = insertInvoiceSchema.safeParse({
      ...validInvoice,
      invoiceNumber: 'A'.repeat(100),
    })
    expect(result.success).toBe(true)
  })
})

describe('Update Invoice validation', () => {
  it('allows partial updates', () => {
    const result = updateInvoiceSchema.safeParse({
      invoiceNumber: 'INV-UPDATED',
    })
    expect(result.success).toBe(true)
  })

  it('allows status update', () => {
    const result = updateInvoiceSchema.safeParse({
      paymentStatus: 'POSTED',
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid payment statuses', () => {
    for (const status of [
      'POSTED',
      'PAID',
    ] as const) {
      const result = updateInvoiceSchema.safeParse({ paymentStatus: status })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid payment status', () => {
    const result = updateInvoiceSchema.safeParse({
      paymentStatus: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('allows empty object (no-op update)', () => {
    const result = updateInvoiceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('allows setting dueDate to null', () => {
    const result = updateInvoiceSchema.safeParse({
      dueDate: null,
    })
    expect(result.success).toBe(true)
  })
})
