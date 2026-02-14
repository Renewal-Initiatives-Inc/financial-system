import { describe, expect, it } from 'vitest'
import { insertDonorSchema, updateDonorSchema } from '../donors'

describe('Donor validation', () => {
  it('valid donor with all fields passes', () => {
    const result = insertDonorSchema.safeParse({
      name: 'Jane Foundation',
      address: '456 Oak Ave',
      email: 'info@janefoundation.org',
      type: 'FOUNDATION',
      firstGiftDate: '2025-06-15',
    })
    expect(result.success).toBe(true)
  })

  it('valid donor with minimal fields (name + type)', () => {
    const result = insertDonorSchema.safeParse({
      name: 'John Doe',
      type: 'INDIVIDUAL',
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = insertDonorSchema.safeParse({
      name: '',
      type: 'INDIVIDUAL',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email format', () => {
    const result = insertDonorSchema.safeParse({
      name: 'Test',
      type: 'INDIVIDUAL',
      email: 'not-an-email',
    })
    expect(result.success).toBe(false)
  })

  it('accepts valid email', () => {
    const result = insertDonorSchema.safeParse({
      name: 'Test',
      type: 'INDIVIDUAL',
      email: 'user@example.com',
    })
    expect(result.success).toBe(true)
  })

  it('accepts null email', () => {
    const result = insertDonorSchema.safeParse({
      name: 'Test',
      type: 'INDIVIDUAL',
      email: null,
    })
    expect(result.success).toBe(true)
  })

  it('accepts all four donor types', () => {
    const types = [
      'INDIVIDUAL',
      'CORPORATE',
      'FOUNDATION',
      'GOVERNMENT',
    ] as const
    for (const t of types) {
      const result = insertDonorSchema.safeParse({
        name: 'Test',
        type: t,
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects invalid donor type', () => {
    const result = insertDonorSchema.safeParse({
      name: 'Test',
      type: 'INVALID',
    })
    expect(result.success).toBe(false)
  })

  it('update schema allows partial updates', () => {
    const result = updateDonorSchema.safeParse({
      name: 'Updated Name',
    })
    expect(result.success).toBe(true)
  })

  it('update schema allows isActive toggle', () => {
    const result = updateDonorSchema.safeParse({
      isActive: false,
    })
    expect(result.success).toBe(true)
  })
})
