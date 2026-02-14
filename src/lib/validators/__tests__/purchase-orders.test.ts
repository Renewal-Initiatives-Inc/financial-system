import { describe, expect, it } from 'vitest'
import {
  insertPurchaseOrderSchema,
  updatePurchaseOrderSchema,
} from '../purchase-orders'

describe('Purchase Order validation', () => {
  const validPo = {
    vendorId: 1,
    description: 'Office supplies contract',
    totalAmount: 5000.0,
    glDestinationAccountId: 10,
    fundId: 1,
  }

  it('valid PO with required fields passes', () => {
    const result = insertPurchaseOrderSchema.safeParse(validPo)
    expect(result.success).toBe(true)
  })

  it('valid PO with all fields passes', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      contractPdfUrl: 'https://blob.vercel-storage.com/contracts/test.pdf',
      cipCostCodeId: 3,
      status: 'ACTIVE',
      extractedMilestones: [{ name: 'Phase 1', date: '2026-06-01' }],
      extractedTerms: [{ type: 'NET_30' }],
      extractedCovenants: [{ description: 'Annual audit required' }],
    })
    expect(result.success).toBe(true)
  })

  it('defaults status to DRAFT', () => {
    const result = insertPurchaseOrderSchema.parse(validPo)
    expect(result.status).toBe('DRAFT')
  })

  it('rejects missing vendorId', () => {
    const { vendorId, ...noVendor } = validPo
    const result = insertPurchaseOrderSchema.safeParse(noVendor)
    expect(result.success).toBe(false)
  })

  it('rejects missing description', () => {
    const { description, ...noDesc } = validPo
    const result = insertPurchaseOrderSchema.safeParse(noDesc)
    expect(result.success).toBe(false)
  })

  it('rejects empty description', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      description: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero totalAmount', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      totalAmount: 0,
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative totalAmount', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      totalAmount: -100,
    })
    expect(result.success).toBe(false)
  })

  it('rejects totalAmount with more than 2 decimal places', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      totalAmount: 100.999,
    })
    expect(result.success).toBe(false)
  })

  it('accepts totalAmount with exactly 2 decimal places', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      totalAmount: 100.99,
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing glDestinationAccountId', () => {
    const { glDestinationAccountId, ...noAccount } = validPo
    const result = insertPurchaseOrderSchema.safeParse(noAccount)
    expect(result.success).toBe(false)
  })

  it('rejects missing fundId', () => {
    const { fundId, ...noFund } = validPo
    const result = insertPurchaseOrderSchema.safeParse(noFund)
    expect(result.success).toBe(false)
  })

  it('accepts null cipCostCodeId', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      cipCostCodeId: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid status', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      status: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid PO statuses', () => {
    for (const status of [
      'DRAFT',
      'ACTIVE',
      'COMPLETED',
      'CANCELLED',
    ] as const) {
      const result = insertPurchaseOrderSchema.safeParse({
        ...validPo,
        status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid contractPdfUrl format', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      contractPdfUrl: 'not-a-url',
    })
    expect(result.success).toBe(false)
  })

  it('accepts null contractPdfUrl', () => {
    const result = insertPurchaseOrderSchema.safeParse({
      ...validPo,
      contractPdfUrl: null,
    })
    expect(result.success).toBe(true)
  })
})

describe('Update Purchase Order validation', () => {
  it('allows partial updates', () => {
    const result = updatePurchaseOrderSchema.safeParse({
      description: 'Updated description',
    })
    expect(result.success).toBe(true)
  })

  it('allows updating totalAmount', () => {
    const result = updatePurchaseOrderSchema.safeParse({
      totalAmount: 7500.0,
    })
    expect(result.success).toBe(true)
  })

  it('allows empty object (no-op update)', () => {
    const result = updatePurchaseOrderSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects invalid totalAmount in update', () => {
    const result = updatePurchaseOrderSchema.safeParse({
      totalAmount: -50,
    })
    expect(result.success).toBe(false)
  })

  it('allows setting cipCostCodeId to null', () => {
    const result = updatePurchaseOrderSchema.safeParse({
      cipCostCodeId: null,
    })
    expect(result.success).toBe(true)
  })
})
