import { describe, expect, it } from 'vitest'
import { insertGrantSchema, updateGrantSchema } from '../grants'

describe('Grant validation', () => {
  it('valid unconditional grant passes', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '50000.00',
      type: 'UNCONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('valid conditional grant with conditions passes', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '100000.00',
      type: 'CONDITIONAL',
      conditions: 'Must complete building renovation by Dec 2026',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('missing funderId fails', () => {
    const result = insertGrantSchema.safeParse({
      amount: '50000.00',
      type: 'UNCONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('conditional grant without conditions fails', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '100000.00',
      type: 'CONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('unconditional grant with conditions passes (optional)', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '50000.00',
      type: 'UNCONDITIONAL',
      conditions: 'Some notes about usage',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('invalid amount format fails', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '-5000',
      type: 'UNCONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('missing amount fails', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      type: 'UNCONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('invalid grant type fails', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '50000.00',
      type: 'INVALID',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('applies default for isUnusualGrant', () => {
    const result = insertGrantSchema.safeParse({
      funderId: 1,
      amount: '50000.00',
      type: 'UNCONDITIONAL',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('update schema allows partial updates', () => {
    const result = updateGrantSchema.safeParse({
      status: 'COMPLETED',
    })
    expect(result.success).toBe(true)
  })

  it('update schema rejects invalid status', () => {
    const result = updateGrantSchema.safeParse({
      status: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})
