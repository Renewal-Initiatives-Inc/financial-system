import { describe, expect, it } from 'vitest'
import { insertPledgeSchema, updatePledgeSchema } from '../pledges'

describe('Pledge validation', () => {
  it('valid pledge passes', () => {
    const result = insertPledgeSchema.safeParse({
      donorId: 1,
      amount: '500.00',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('valid pledge with expected date passes', () => {
    const result = insertPledgeSchema.safeParse({
      donorId: 1,
      amount: '1000.00',
      expectedDate: '2026-06-30',
      fundId: 2,
    })
    expect(result.success).toBe(true)
  })

  it('missing donorId fails', () => {
    const result = insertPledgeSchema.safeParse({
      amount: '500.00',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('invalid amount format fails', () => {
    const result = insertPledgeSchema.safeParse({
      donorId: 1,
      amount: '-500',
      fundId: 2,
    })
    expect(result.success).toBe(false)
  })

  it('missing fundId fails', () => {
    const result = insertPledgeSchema.safeParse({
      donorId: 1,
      amount: '500.00',
    })
    expect(result.success).toBe(false)
  })

  it('update schema allows partial updates', () => {
    const result = updatePledgeSchema.safeParse({
      status: 'RECEIVED',
    })
    expect(result.success).toBe(true)
  })

  it('update schema accepts valid pledge statuses', () => {
    for (const status of ['PLEDGED', 'RECEIVED', 'WRITTEN_OFF'] as const) {
      const result = updatePledgeSchema.safeParse({ status })
      expect(result.success).toBe(true)
    }
  })

  it('update schema rejects invalid status', () => {
    const result = updatePledgeSchema.safeParse({
      status: 'INVALID',
    })
    expect(result.success).toBe(false)
  })
})
