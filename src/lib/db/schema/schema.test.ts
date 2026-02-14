import { describe, expect, it } from 'vitest'
import { seedAccounts } from '../seed/accounts'
import { seedFunds } from '../seed/funds'
import { seedCipCostCodes } from '../seed/cip-cost-codes'

describe('Seed data integrity', () => {
  // --- Account counts ---
  it('has 72 total seed accounts', () => {
    expect(seedAccounts).toHaveLength(72)
  })

  it('has correct count per type', () => {
    const byType = {
      ASSET: seedAccounts.filter((a) => a.type === 'ASSET'),
      LIABILITY: seedAccounts.filter((a) => a.type === 'LIABILITY'),
      NET_ASSET: seedAccounts.filter((a) => a.type === 'NET_ASSET'),
      REVENUE: seedAccounts.filter((a) => a.type === 'REVENUE'),
      EXPENSE: seedAccounts.filter((a) => a.type === 'EXPENSE'),
    }
    expect(byType.ASSET).toHaveLength(24)
    expect(byType.LIABILITY).toHaveLength(17)
    expect(byType.NET_ASSET).toHaveLength(2)
    expect(byType.REVENUE).toHaveLength(12)
    expect(byType.EXPENSE).toHaveLength(17)
  })

  // --- Account code uniqueness ---
  it('has no duplicate account codes', () => {
    const codes = seedAccounts.map((a) => a.code)
    const uniqueCodes = new Set(codes)
    expect(uniqueCodes.size).toBe(codes.length)
  })

  // --- Normal balance consistency ---
  it('all Asset accounts have normalBalance = DEBIT (except contra-assets)', () => {
    const assets = seedAccounts.filter(
      (a) => a.type === 'ASSET' && a.subType !== 'Contra-Asset'
    )
    for (const account of assets) {
      expect(account.normalBalance).toBe('DEBIT')
    }
  })

  it('all Contra-Asset accounts have normalBalance = CREDIT', () => {
    const contraAssets = seedAccounts.filter(
      (a) => a.type === 'ASSET' && a.subType === 'Contra-Asset'
    )
    expect(contraAssets.length).toBeGreaterThan(0)
    for (const account of contraAssets) {
      expect(account.normalBalance).toBe('CREDIT')
    }
  })

  it('all Liability accounts have normalBalance = CREDIT', () => {
    const liabilities = seedAccounts.filter((a) => a.type === 'LIABILITY')
    for (const account of liabilities) {
      expect(account.normalBalance).toBe('CREDIT')
    }
  })

  it('all Net Asset accounts have normalBalance = CREDIT', () => {
    const netAssets = seedAccounts.filter((a) => a.type === 'NET_ASSET')
    for (const account of netAssets) {
      expect(account.normalBalance).toBe('CREDIT')
    }
  })

  it('all Revenue accounts have normalBalance = CREDIT (except contra-revenue)', () => {
    const revenue = seedAccounts.filter(
      (a) =>
        a.type === 'REVENUE' &&
        a.subType !== 'Contra' &&
        a.subType !== 'Contra-Revenue'
    )
    for (const account of revenue) {
      expect(account.normalBalance).toBe('CREDIT')
    }
  })

  it('contra-revenue accounts have normalBalance = DEBIT', () => {
    const contraRevenue = seedAccounts.filter(
      (a) =>
        a.type === 'REVENUE' &&
        (a.subType === 'Contra' || a.subType === 'Contra-Revenue')
    )
    expect(contraRevenue.length).toBeGreaterThan(0)
    for (const account of contraRevenue) {
      expect(account.normalBalance).toBe('DEBIT')
    }
  })

  it('all Expense accounts have normalBalance = DEBIT', () => {
    const expenses = seedAccounts.filter((a) => a.type === 'EXPENSE')
    for (const account of expenses) {
      expect(account.normalBalance).toBe('DEBIT')
    }
  })

  // --- CIP hierarchy ---
  it('CIP parent (1500) exists and is system-locked', () => {
    const cipParent = seedAccounts.find((a) => a.code === '1500')
    expect(cipParent).toBeDefined()
    expect(cipParent!.isSystemLocked).toBe(true)
    expect(cipParent!.name).toBe('Construction in Progress')
  })

  it('CIP parent has exactly 5 children', () => {
    const cipChildren = seedAccounts.filter((a) => a.parentCode === '1500')
    expect(cipChildren).toHaveLength(5)
    const childCodes = cipChildren.map((c) => c.code).sort()
    expect(childCodes).toEqual(['1510', '1520', '1530', '1540', '1550'])
  })

  it('all CIP children are system-locked', () => {
    const cipChildren = seedAccounts.filter((a) => a.parentCode === '1500')
    for (const child of cipChildren) {
      expect(child.isSystemLocked).toBe(true)
    }
  })

  // --- Building / depreciation pairs ---
  it('each building account has a corresponding accumulated depreciation account', () => {
    const buildingPairs = [
      { building: '1600', accum: '1800' },
      { building: '1610', accum: '1810' },
      { building: '1620', accum: '1820' },
    ]
    for (const pair of buildingPairs) {
      const building = seedAccounts.find((a) => a.code === pair.building)
      const accum = seedAccounts.find((a) => a.code === pair.accum)
      expect(building).toBeDefined()
      expect(accum).toBeDefined()
      expect(building!.normalBalance).toBe('DEBIT')
      expect(accum!.normalBalance).toBe('CREDIT')
    }
  })

  // --- Fund seed data ---
  it('has 6 seed funds', () => {
    expect(seedFunds).toHaveLength(6)
  })

  it('General Fund is unrestricted and system-locked', () => {
    const generalFund = seedFunds.find((f) => f.name === 'General Fund')
    expect(generalFund).toBeDefined()
    expect(generalFund!.restrictionType).toBe('UNRESTRICTED')
    expect(generalFund!.isSystemLocked).toBe(true)
  })

  it('all non-General funds are restricted', () => {
    const otherFunds = seedFunds.filter((f) => f.name !== 'General Fund')
    expect(otherFunds).toHaveLength(5)
    for (const fund of otherFunds) {
      expect(fund.restrictionType).toBe('RESTRICTED')
    }
  })

  it('has no duplicate fund names', () => {
    const names = seedFunds.map((f) => f.name)
    expect(new Set(names).size).toBe(names.length)
  })

  // --- CIP cost codes ---
  it('has 17 seed cost codes (8 hard + 9 soft)', () => {
    expect(seedCipCostCodes).toHaveLength(17)
    const hard = seedCipCostCodes.filter((c) => c.category === 'HARD_COST')
    const soft = seedCipCostCodes.filter((c) => c.category === 'SOFT_COST')
    expect(hard).toHaveLength(8)
    expect(soft).toHaveLength(9)
  })

  it('has no duplicate cost code values', () => {
    const codes = seedCipCostCodes.map((c) => c.code)
    expect(new Set(codes).size).toBe(codes.length)
  })

  it('cost codes are sorted correctly within categories', () => {
    const hard = seedCipCostCodes.filter((c) => c.category === 'HARD_COST')
    const soft = seedCipCostCodes.filter((c) => c.category === 'SOFT_COST')

    for (let i = 1; i < hard.length; i++) {
      expect(hard[i].sortOrder!).toBeGreaterThan(hard[i - 1].sortOrder!)
    }
    for (let i = 1; i < soft.length; i++) {
      expect(soft[i].sortOrder!).toBeGreaterThan(soft[i - 1].sortOrder!)
    }
  })
})
