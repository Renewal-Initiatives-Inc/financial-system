import { describe, it, expect } from 'vitest'
import {
  detectRestrictedFundExpenses,
  buildReleaseLines,
} from './restricted-fund-release'
import type { Account, Fund } from './types'
import type { TransactionLine } from '@/lib/validators'

// Helper to create a minimal Account
function makeAccount(
  overrides: Partial<Account> & { id: number; type: string }
): Account {
  return {
    code: '5000',
    name: 'Test Account',
    subType: null,
    normalBalance: 'DEBIT',
    isActive: true,
    form990Line: null,
    parentAccountId: null,
    isSystemLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Account
}

// Helper to create a minimal Fund
function makeFund(
  overrides: Partial<Fund> & { id: number; restrictionType: string }
): Fund {
  return {
    name: 'Test Fund',
    isActive: true,
    description: null,
    isSystemLocked: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as Fund
}

// Net asset accounts for release line building
const netAssetAccounts = {
  unrestricted: makeAccount({
    id: 100,
    code: '3000',
    name: 'Net Assets Without Donor Restrictions',
    type: 'NET_ASSET',
  }),
  restricted: makeAccount({
    id: 101,
    code: '3100',
    name: 'Net Assets With Donor Restrictions',
    type: 'NET_ASSET',
  }),
}

describe('detectRestrictedFundExpenses', () => {
  it('detects a single expense line to a restricted fund', () => {
    const expenseAccount = makeAccount({ id: 1, type: 'EXPENSE' })
    const restrictedFund = makeFund({ id: 10, restrictionType: 'RESTRICTED' })

    const accountMap = new Map([[1, expenseAccount]])
    const fundMap = new Map([[10, restrictedFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: 500, credit: null },
      { accountId: 2, fundId: 10, debit: null, credit: 500 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ fundId: 10, amount: 500 })
  })

  it('consolidates multiple expenses to the same restricted fund', () => {
    const expenseAccount1 = makeAccount({
      id: 1,
      type: 'EXPENSE',
      code: '5000',
    })
    const expenseAccount2 = makeAccount({
      id: 2,
      type: 'EXPENSE',
      code: '5100',
    })
    const restrictedFund = makeFund({ id: 10, restrictionType: 'RESTRICTED' })

    const accountMap = new Map([
      [1, expenseAccount1],
      [2, expenseAccount2],
    ])
    const fundMap = new Map([[10, restrictedFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: 300, credit: null },
      { accountId: 2, fundId: 10, debit: 200, credit: null },
      { accountId: 3, fundId: 10, debit: null, credit: 500 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ fundId: 10, amount: 500 })
  })

  it('creates separate release pairs for different restricted funds', () => {
    const expenseAccount = makeAccount({ id: 1, type: 'EXPENSE' })
    const massDev = makeFund({
      id: 10,
      restrictionType: 'RESTRICTED',
      name: 'MassDev',
    })
    const cpaFund = makeFund({
      id: 11,
      restrictionType: 'RESTRICTED',
      name: 'CPA',
    })

    const accountMap = new Map([[1, expenseAccount]])
    const fundMap = new Map([
      [10, massDev],
      [11, cpaFund],
    ])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: 100, credit: null },
      { accountId: 1, fundId: 11, debit: 200, credit: null },
      { accountId: 2, fundId: 10, debit: null, credit: 300 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)

    expect(result).toHaveLength(2)
    expect(result).toContainEqual({ fundId: 10, amount: 100 })
    expect(result).toContainEqual({ fundId: 11, amount: 200 })
  })

  it('ignores expenses to unrestricted funds', () => {
    const expenseAccount = makeAccount({ id: 1, type: 'EXPENSE' })
    const generalFund = makeFund({
      id: 1,
      restrictionType: 'UNRESTRICTED',
    })

    const accountMap = new Map([[1, expenseAccount]])
    const fundMap = new Map([[1, generalFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 1, debit: 500, credit: null },
      { accountId: 2, fundId: 1, debit: null, credit: 500 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)
    expect(result).toHaveLength(0)
  })

  it('ignores non-expense accounts debiting restricted funds', () => {
    const assetAccount = makeAccount({ id: 1, type: 'ASSET' })
    const restrictedFund = makeFund({ id: 10, restrictionType: 'RESTRICTED' })

    const accountMap = new Map([[1, assetAccount]])
    const fundMap = new Map([[10, restrictedFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: 500, credit: null },
      { accountId: 2, fundId: 10, debit: null, credit: 500 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)
    expect(result).toHaveLength(0)
  })

  it('ignores credit lines to restricted funds (refund scenario)', () => {
    const expenseAccount = makeAccount({ id: 1, type: 'EXPENSE' })
    const restrictedFund = makeFund({ id: 10, restrictionType: 'RESTRICTED' })

    const accountMap = new Map([[1, expenseAccount]])
    const fundMap = new Map([[10, restrictedFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: null, credit: 500 },
      { accountId: 2, fundId: 10, debit: 500, credit: null },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)
    expect(result).toHaveLength(0)
  })

  it('handles $0.01 expense amount', () => {
    const expenseAccount = makeAccount({ id: 1, type: 'EXPENSE' })
    const restrictedFund = makeFund({ id: 10, restrictionType: 'RESTRICTED' })

    const accountMap = new Map([[1, expenseAccount]])
    const fundMap = new Map([[10, restrictedFund]])

    const lines: TransactionLine[] = [
      { accountId: 1, fundId: 10, debit: 0.01, credit: null },
      { accountId: 2, fundId: 10, debit: null, credit: 0.01 },
    ]

    const result = detectRestrictedFundExpenses(lines, accountMap, fundMap)

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({ fundId: 10, amount: 0.01 })
  })
})

describe('buildReleaseLines', () => {
  it('creates DR 3100 and CR 3000 for each restricted fund expense', () => {
    const expenses = [{ fundId: 10, amount: 500 }]
    const lines = buildReleaseLines(expenses, netAssetAccounts)

    expect(lines).toHaveLength(2)

    // DR Net Assets With Donor Restrictions (3100)
    expect(lines[0]).toEqual({
      accountId: 101, // restricted (3100)
      fundId: 10,
      debit: 500,
      credit: null,
      cipCostCodeId: null,
      memo: null,
    })

    // CR Net Assets Without Donor Restrictions (3000)
    expect(lines[1]).toEqual({
      accountId: 100, // unrestricted (3000)
      fundId: 10,
      debit: null,
      credit: 500,
      cipCostCodeId: null,
      memo: null,
    })
  })

  it('creates separate pairs for multiple funds', () => {
    const expenses = [
      { fundId: 10, amount: 100 },
      { fundId: 11, amount: 200 },
    ]
    const lines = buildReleaseLines(expenses, netAssetAccounts)

    expect(lines).toHaveLength(4)

    // Fund 10 pair
    expect(lines[0]).toMatchObject({
      accountId: 101,
      fundId: 10,
      debit: 100,
    })
    expect(lines[1]).toMatchObject({
      accountId: 100,
      fundId: 10,
      credit: 100,
    })

    // Fund 11 pair
    expect(lines[2]).toMatchObject({
      accountId: 101,
      fundId: 11,
      debit: 200,
    })
    expect(lines[3]).toMatchObject({
      accountId: 100,
      fundId: 11,
      credit: 200,
    })
  })

  it('returns empty array when no expenses', () => {
    const lines = buildReleaseLines([], netAssetAccounts)
    expect(lines).toHaveLength(0)
  })
})
