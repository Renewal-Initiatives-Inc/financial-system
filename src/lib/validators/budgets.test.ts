import { describe, it, expect } from 'vitest'
import {
  insertBudgetSchema,
  insertBudgetLineSchema,
  updateBudgetLineSchema,
} from './budgets'
import {
  insertCashProjectionLineSchema,
} from './cash-projections'

describe('insertBudgetSchema', () => {
  it('accepts valid budget', () => {
    const result = insertBudgetSchema.safeParse({
      fiscalYear: 2026,
      createdBy: 'jeff',
    })
    expect(result.success).toBe(true)
  })

  it('rejects fiscal year below 2025', () => {
    const result = insertBudgetSchema.safeParse({
      fiscalYear: 2020,
      createdBy: 'jeff',
    })
    expect(result.success).toBe(false)
  })

  it('defaults status to DRAFT', () => {
    const result = insertBudgetSchema.parse({
      fiscalYear: 2026,
      createdBy: 'jeff',
    })
    expect(result.status).toBe('DRAFT')
  })
})

describe('insertBudgetLineSchema', () => {
  it('accepts valid EVEN spread line', () => {
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 12000,
      spreadMethod: 'EVEN',
      monthlyAmounts: Array(12).fill(1000),
    })
    expect(result.success).toBe(true)
  })

  it('accepts valid ONE_TIME spread line', () => {
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 5000,
      spreadMethod: 'ONE_TIME',
      monthlyAmounts: [0, 0, 0, 0, 0, 5000, 0, 0, 0, 0, 0, 0],
    })
    expect(result.success).toBe(true)
  })

  it('rejects ONE_TIME with multiple non-zero months', () => {
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 5000,
      spreadMethod: 'ONE_TIME',
      monthlyAmounts: [2500, 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, 0],
    })
    expect(result.success).toBe(false)
  })

  it('rejects when monthly amounts do not sum to annual', () => {
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 12000,
      spreadMethod: 'CUSTOM',
      monthlyAmounts: [1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 500],
    })
    expect(result.success).toBe(false)
  })

  it('accepts EVEN spread with rounding tolerance', () => {
    // $10,000 / 12 = $833.33 × 11 + $833.37 = $10,000.00
    const monthly = Array(11).fill(833.33)
    monthly.push(833.37)
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 10000,
      spreadMethod: 'EVEN',
      monthlyAmounts: monthly,
    })
    expect(result.success).toBe(true)
  })

  it('rejects wrong array length', () => {
    const result = insertBudgetLineSchema.safeParse({
      budgetId: 1,
      accountId: 10,
      fundId: 1,
      annualAmount: 12000,
      spreadMethod: 'EVEN',
      monthlyAmounts: [6000, 6000],
    })
    expect(result.success).toBe(false)
  })
})

describe('updateBudgetLineSchema', () => {
  it('accepts partial update', () => {
    const result = updateBudgetLineSchema.safeParse({
      annualAmount: 15000,
    })
    expect(result.success).toBe(true)
  })

  it('accepts empty update', () => {
    const result = updateBudgetLineSchema.safeParse({})
    expect(result.success).toBe(true)
  })
})

describe('insertCashProjectionLineSchema', () => {
  it('rejects override amount without note', () => {
    const result = insertCashProjectionLineSchema.safeParse({
      projectionId: 1,
      month: 3,
      sourceLabel: 'Rent Income',
      autoAmount: 5000,
      overrideAmount: 6000,
      overrideNote: null,
      lineType: 'INFLOW',
      sortOrder: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts override amount with note', () => {
    const result = insertCashProjectionLineSchema.safeParse({
      projectionId: 1,
      month: 3,
      sourceLabel: 'Rent Income',
      autoAmount: 5000,
      overrideAmount: 6000,
      overrideNote: 'Expected rent increase',
      lineType: 'INFLOW',
      sortOrder: 0,
    })
    expect(result.success).toBe(true)
  })

  it('accepts line without override', () => {
    const result = insertCashProjectionLineSchema.safeParse({
      projectionId: 1,
      month: 3,
      sourceLabel: 'Rent Income',
      autoAmount: 5000,
      lineType: 'INFLOW',
      sortOrder: 0,
    })
    expect(result.success).toBe(true)
  })

  it('rejects invalid month', () => {
    const result = insertCashProjectionLineSchema.safeParse({
      projectionId: 1,
      month: 13,
      sourceLabel: 'Rent Income',
      autoAmount: 5000,
      lineType: 'INFLOW',
      sortOrder: 0,
    })
    expect(result.success).toBe(false)
  })
})
