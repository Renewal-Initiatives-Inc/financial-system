import { describe, expect, it } from 'vitest'
import { insertVendorSchema, updateVendorSchema } from '../vendors'

describe('Vendor validation', () => {
  it('valid vendor with all fields passes', () => {
    const result = insertVendorSchema.safeParse({
      name: 'Acme Corp',
      address: '123 Main St',
      taxId: '12-3456789',
      entityType: 'c_corp',
      is1099Eligible: true,
      defaultAccountId: 1,
      defaultFundId: 1,
      w9Status: 'COLLECTED',
      w9CollectedDate: '2026-01-15',
    })
    expect(result.success).toBe(true)
  })

  it('valid vendor with minimal fields (name only + defaults)', () => {
    const result = insertVendorSchema.safeParse({
      name: 'Simple Vendor',
    })
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.is1099Eligible).toBe(false)
      expect(result.data.w9Status).toBe('NOT_REQUIRED')
    }
  })

  it('rejects empty name', () => {
    const result = insertVendorSchema.safeParse({
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('accepts various tax ID formats', () => {
    const formats = ['12-3456789', '123456789', '99-0000001']
    for (const taxId of formats) {
      const result = insertVendorSchema.safeParse({
        name: 'Test',
        taxId,
      })
      expect(result.success).toBe(true)
    }
  })

  it('accepts null tax ID', () => {
    const result = insertVendorSchema.safeParse({
      name: 'Test',
      taxId: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid w9Status', () => {
    const result = insertVendorSchema.safeParse({
      name: 'Test',
      w9Status: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid w9 statuses', () => {
    for (const status of ['COLLECTED', 'PENDING', 'NOT_REQUIRED'] as const) {
      const result = insertVendorSchema.safeParse({
        name: 'Test',
        w9Status: status,
      })
      expect(result.success).toBe(true)
    }
  })

  it('update schema allows partial updates', () => {
    const result = updateVendorSchema.safeParse({
      name: 'Updated Name',
    })
    expect(result.success).toBe(true)
  })

  it('update schema allows isActive toggle', () => {
    const result = updateVendorSchema.safeParse({
      isActive: false,
    })
    expect(result.success).toBe(true)
  })
})
