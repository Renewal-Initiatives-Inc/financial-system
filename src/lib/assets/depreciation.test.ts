import { describe, it, expect } from 'vitest'
import {
  calculateMonthlyDepreciation,
  calculateAccumulatedDepreciation,
  calculateNetBookValue,
  isFullyDepreciated,
} from './depreciation'

describe('calculateMonthlyDepreciation', () => {
  it('standard calculation: (100000 - 0) / 480 = 208.33', () => {
    const result = calculateMonthlyDepreciation({
      cost: '100000',
      salvageValue: '0',
      usefulLifeMonths: 480,
    })
    expect(result).toBe(208.33)
  })

  it('with salvage value: (100000 - 5000) / 480 = 197.92', () => {
    const result = calculateMonthlyDepreciation({
      cost: '100000',
      salvageValue: '5000',
      usefulLifeMonths: 480,
    })
    expect(result).toBe(197.92)
  })

  it('returns 0 when depreciable basis is zero (cost equals salvage)', () => {
    const result = calculateMonthlyDepreciation({
      cost: '50000',
      salvageValue: '50000',
      usefulLifeMonths: 120,
    })
    expect(result).toBe(0)
  })

  it('returns 0 when depreciable basis is negative (salvage > cost)', () => {
    const result = calculateMonthlyDepreciation({
      cost: '5000',
      salvageValue: '10000',
      usefulLifeMonths: 60,
    })
    expect(result).toBe(0)
  })

  it('handles small values correctly: (1200 - 0) / 12 = 100', () => {
    const result = calculateMonthlyDepreciation({
      cost: '1200',
      salvageValue: '0',
      usefulLifeMonths: 12,
    })
    expect(result).toBe(100)
  })

  it('rounds to 2 decimal places: (10000 - 0) / 3 = 3333.33', () => {
    const result = calculateMonthlyDepreciation({
      cost: '10000',
      salvageValue: '0',
      usefulLifeMonths: 3,
    })
    expect(result).toBe(3333.33)
  })

  it('handles large asset cost: (3500000 - 0) / 480 = 7291.67', () => {
    const result = calculateMonthlyDepreciation({
      cost: '3500000',
      salvageValue: '0',
      usefulLifeMonths: 480,
    })
    expect(result).toBe(7291.67)
  })

  it('single month useful life: (12000 - 2000) / 1 = 10000', () => {
    const result = calculateMonthlyDepreciation({
      cost: '12000',
      salvageValue: '2000',
      usefulLifeMonths: 1,
    })
    expect(result).toBe(10000)
  })
})

describe('calculateAccumulatedDepreciation', () => {
  const asset = {
    cost: '120000',
    salvageValue: '0',
    usefulLifeMonths: 120,
    datePlacedInService: '2020-01-15',
  }

  it('calculates accumulated depreciation after 12 months', () => {
    // Monthly: 120000 / 120 = 1000
    // 12 months elapsed => 12000
    const result = calculateAccumulatedDepreciation(asset, '2021-01-15')
    expect(result).toBe(12000)
  })

  it('returns 0 when no date placed in service', () => {
    const noDateAsset = { ...asset, datePlacedInService: null }
    const result = calculateAccumulatedDepreciation(noDateAsset, '2025-06-30')
    expect(result).toBe(0)
  })

  it('returns 0 when asOfDate is before or equal to date placed in service', () => {
    const result = calculateAccumulatedDepreciation(asset, '2020-01-15')
    expect(result).toBe(0)
  })

  it('caps accumulated depreciation at depreciable basis', () => {
    // After 120 months the asset should be fully depreciated at 120000
    // Ask for 200 months later
    const result = calculateAccumulatedDepreciation(asset, '2037-01-15')
    expect(result).toBe(120000)
  })

  it('respects salvage value in cap calculation', () => {
    const assetWithSalvage = {
      cost: '120000',
      salvageValue: '20000',
      usefulLifeMonths: 120,
      datePlacedInService: '2020-01-15',
    }
    // Monthly: (120000 - 20000) / 120 = 833.33
    // After all 120 months: capped at 100000
    const result = calculateAccumulatedDepreciation(assetWithSalvage, '2037-01-15')
    expect(result).toBe(100000)
  })
})

describe('calculateNetBookValue', () => {
  const asset = {
    cost: '100000',
    salvageValue: '10000',
    usefulLifeMonths: 120,
    datePlacedInService: '2020-01-15',
  }

  it('returns cost when no depreciation has occurred (before PIS)', () => {
    const result = calculateNetBookValue(asset, '2020-01-15')
    expect(result).toBe(100000)
  })

  it('calculates NBV after partial depreciation', () => {
    // Monthly: (100000 - 10000) / 120 = 750
    // 12 months => accumulated = 9000
    // NBV = 100000 - 9000 = 91000
    const result = calculateNetBookValue(asset, '2021-01-15')
    expect(result).toBe(91000)
  })

  it('NBV does not go below salvage value', () => {
    // Fully depreciated and beyond
    const result = calculateNetBookValue(asset, '2040-01-15')
    // accumulated capped at 90000 (depreciable basis)
    // NBV = 100000 - 90000 = 10000 (salvage value)
    expect(result).toBe(10000)
  })
})

describe('isFullyDepreciated', () => {
  const asset = {
    cost: '12000',
    salvageValue: '0',
    usefulLifeMonths: 12,
    datePlacedInService: '2025-01-01',
  }

  it('returns false before useful life is exhausted', () => {
    const result = isFullyDepreciated(asset, '2025-06-01')
    expect(result).toBe(false)
  })

  it('returns true when useful life is fully exhausted', () => {
    const result = isFullyDepreciated(asset, '2026-01-01')
    expect(result).toBe(true)
  })

  it('returns true well past useful life', () => {
    const result = isFullyDepreciated(asset, '2030-01-01')
    expect(result).toBe(true)
  })

  it('returns false when no date placed in service', () => {
    const noDateAsset = { ...asset, datePlacedInService: null }
    const result = isFullyDepreciated(noDateAsset, '2030-01-01')
    expect(result).toBe(false)
  })
})
