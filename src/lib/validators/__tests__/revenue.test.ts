import { describe, expect, it } from 'vitest'
import {
  rentPaymentSchema,
  rentAdjustmentSchema,
  donationSchema,
  earnedIncomeSchema,
  investmentIncomeSchema,
  ahpLoanForgivenessSchema,
  inKindContributionSchema,
  grantCashReceiptSchema,
  grantConditionMetSchema,
} from '../revenue'

describe('Rent payment validation', () => {
  it('valid rent payment passes', () => {
    const result = rentPaymentSchema.safeParse({
      tenantId: 1,
      amount: '1500.00',
      date: '2026-02-01',
      fundId: 1,
    })
    expect(result.success).toBe(true)
  })

  it('invalid amount fails', () => {
    const result = rentPaymentSchema.safeParse({
      tenantId: 1,
      amount: 'abc',
      date: '2026-02-01',
      fundId: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('Rent adjustment validation', () => {
  it('valid adjustment passes', () => {
    const result = rentAdjustmentSchema.safeParse({
      tenantId: 1,
      adjustmentType: 'PRORATION',
      amount: '500.00',
      date: '2026-02-01',
      fundId: 1,
      note: 'Move-in proration for February',
    })
    expect(result.success).toBe(true)
  })

  it('adjustment without note fails (mandatory annotation)', () => {
    const result = rentAdjustmentSchema.safeParse({
      tenantId: 1,
      adjustmentType: 'HARDSHIP',
      amount: '200.00',
      date: '2026-02-01',
      fundId: 1,
      note: '',
    })
    expect(result.success).toBe(false)
  })

  it('invalid adjustment type fails', () => {
    const result = rentAdjustmentSchema.safeParse({
      tenantId: 1,
      adjustmentType: 'INVALID',
      amount: '500.00',
      date: '2026-02-01',
      fundId: 1,
      note: 'Some note',
    })
    expect(result.success).toBe(false)
  })
})

describe('Donation validation', () => {
  it('valid donation passes', () => {
    const result = donationSchema.safeParse({
      donorId: 1,
      amount: '500.00',
      date: '2026-02-01',
      fundId: 1,
      contributionSourceType: 'PUBLIC',
    })
    expect(result.success).toBe(true)
  })

  it('donation without contribution source type fails', () => {
    const result = donationSchema.safeParse({
      donorId: 1,
      amount: '500.00',
      date: '2026-02-01',
      fundId: 1,
    })
    expect(result.success).toBe(false)
  })

  it('all source types are valid', () => {
    for (const type of ['GOVERNMENT', 'PUBLIC', 'RELATED_PARTY'] as const) {
      const result = donationSchema.safeParse({
        donorId: 1,
        amount: '100.00',
        date: '2026-02-01',
        fundId: 1,
        contributionSourceType: type,
      })
      expect(result.success).toBe(true)
    }
  })

  it('defaults isUnusualGrant to false', () => {
    const result = donationSchema.parse({
      donorId: 1,
      amount: '100.00',
      date: '2026-02-01',
      fundId: 1,
      contributionSourceType: 'PUBLIC',
    })
    expect(result.isUnusualGrant).toBe(false)
  })
})

describe('AHP loan forgiveness validation', () => {
  it('valid forgiveness passes', () => {
    const result = ahpLoanForgivenessSchema.safeParse({
      amount: '50000.00',
      date: '2026-02-01',
    })
    expect(result.success).toBe(true)
  })

  it('invalid amount format fails', () => {
    const result = ahpLoanForgivenessSchema.safeParse({
      amount: '-5000',
      date: '2026-02-01',
    })
    expect(result.success).toBe(false)
  })
})

describe('In-kind contribution validation', () => {
  it('valid in-kind contribution passes', () => {
    const result = inKindContributionSchema.safeParse({
      amount: '5000.00',
      description: 'Donated office furniture',
      date: '2026-02-01',
      fundId: 1,
      inKindType: 'GOODS',
    })
    expect(result.success).toBe(true)
  })

  it('all in-kind types are valid', () => {
    for (const type of ['GOODS', 'SERVICES', 'FACILITY_USE'] as const) {
      const result = inKindContributionSchema.safeParse({
        amount: '1000.00',
        description: 'Test contribution',
        date: '2026-02-01',
        fundId: 1,
        inKindType: type,
      })
      expect(result.success).toBe(true)
    }
  })

  it('missing description fails', () => {
    const result = inKindContributionSchema.safeParse({
      amount: '5000.00',
      description: '',
      date: '2026-02-01',
      fundId: 1,
      inKindType: 'GOODS',
    })
    expect(result.success).toBe(false)
  })
})

describe('Earned income validation', () => {
  it('valid earned income passes', () => {
    const result = earnedIncomeSchema.safeParse({
      amount: '2500.00',
      description: 'Farm lease payment',
      date: '2026-02-01',
      accountId: 5,
      fundId: 1,
    })
    expect(result.success).toBe(true)
  })

  it('missing description fails', () => {
    const result = earnedIncomeSchema.safeParse({
      amount: '2500.00',
      description: '',
      date: '2026-02-01',
      accountId: 5,
      fundId: 1,
    })
    expect(result.success).toBe(false)
  })
})

describe('Investment income validation', () => {
  it('valid investment income passes', () => {
    const result = investmentIncomeSchema.safeParse({
      amount: '150.75',
      date: '2026-02-01',
    })
    expect(result.success).toBe(true)
  })
})

describe('Grant cash receipt validation', () => {
  it('valid grant cash receipt passes', () => {
    const result = grantCashReceiptSchema.safeParse({
      grantId: 1,
      amount: '25000.00',
      date: '2026-02-01',
    })
    expect(result.success).toBe(true)
  })

  it('missing grantId fails', () => {
    const result = grantCashReceiptSchema.safeParse({
      amount: '25000.00',
      date: '2026-02-01',
    })
    expect(result.success).toBe(false)
  })
})

describe('Grant condition met validation', () => {
  it('valid condition met passes', () => {
    const result = grantConditionMetSchema.safeParse({
      grantId: 1,
      amount: '25000.00',
      date: '2026-02-01',
      note: 'Renovation milestone completed',
    })
    expect(result.success).toBe(true)
  })

  it('missing note fails (required for condition recognition)', () => {
    const result = grantConditionMetSchema.safeParse({
      grantId: 1,
      amount: '25000.00',
      date: '2026-02-01',
      note: '',
    })
    expect(result.success).toBe(false)
  })
})
