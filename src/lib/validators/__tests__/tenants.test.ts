import { describe, expect, it } from 'vitest'
import { insertTenantSchema, updateTenantSchema } from '../tenants'

describe('Tenant validation', () => {
  it('valid tenant with all fields passes', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Jane Smith',
      unitNumber: '1A',
      leaseStart: '2026-01-01',
      leaseEnd: '2027-01-01',
      monthlyRent: '1500.00',
      fundingSourceType: 'TENANT_DIRECT',
      moveInDate: '2026-01-01',
      securityDepositAmount: '1500.00',
      escrowBankRef: 'BankOfAmerica-1234',
      depositDate: '2026-01-01',
      interestRate: '3.5000',
      statementOfConditionDate: '2026-01-01',
    })
    expect(result.success).toBe(true)
  })

  it('valid tenant with minimal fields', () => {
    const result = insertTenantSchema.safeParse({
      name: 'John Doe',
      unitNumber: '2B',
      monthlyRent: '800.00',
      fundingSourceType: 'VASH',
    })
    expect(result.success).toBe(true)
  })

  it('security deposit ≤ monthly rent passes (TXN-P0-049)', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: '1500.00',
      fundingSourceType: 'TENANT_DIRECT',
      securityDepositAmount: '1200.00',
    })
    expect(result.success).toBe(true)
  })

  it('security deposit = monthly rent passes (exactly equal is allowed)', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: '1500.00',
      fundingSourceType: 'TENANT_DIRECT',
      securityDepositAmount: '1500.00',
    })
    expect(result.success).toBe(true)
  })

  it('security deposit > monthly rent rejected with MA law citation', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: '1500.00',
      fundingSourceType: 'TENANT_DIRECT',
      securityDepositAmount: '1500.01',
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const depositError = result.error.issues.find(
        (i) => i.path.includes('securityDepositAmount')
      )
      expect(depositError?.message).toContain('MA G.L. c. 186 § 15B')
    }
  })

  it('rejects empty unit number', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '',
      monthlyRent: '800.00',
      fundingSourceType: 'TENANT_DIRECT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = insertTenantSchema.safeParse({
      name: '',
      unitNumber: '1A',
      monthlyRent: '800.00',
      fundingSourceType: 'TENANT_DIRECT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid monthly rent format', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: 'abc',
      fundingSourceType: 'TENANT_DIRECT',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid funding source type', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: '800.00',
      fundingSourceType: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('accepts all valid funding source types', () => {
    const types = [
      'TENANT_DIRECT',
      'VASH',
      'MRVP',
      'SECTION_8',
      'OTHER_VOUCHER',
    ] as const
    for (const t of types) {
      const result = insertTenantSchema.safeParse({
        name: 'Test',
        unitNumber: '1A',
        monthlyRent: '800.00',
        fundingSourceType: t,
      })
      expect(result.success).toBe(true)
    }
  })

  it('no security deposit passes (optional field)', () => {
    const result = insertTenantSchema.safeParse({
      name: 'Test',
      unitNumber: '1A',
      monthlyRent: '800.00',
      fundingSourceType: 'TENANT_DIRECT',
    })
    expect(result.success).toBe(true)
  })

  it('update schema validates deposit against rent when both provided', () => {
    const result = updateTenantSchema.safeParse({
      monthlyRent: '1000.00',
      securityDepositAmount: '1500.00',
    })
    expect(result.success).toBe(false)
  })
})
