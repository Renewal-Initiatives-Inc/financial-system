import { describe, expect, it } from 'vitest'
import {
  insertAccountSchema,
  insertFundSchema,
  insertCipCostCodeSchema,
} from '@/lib/validators'
import { seedAccounts } from './accounts'
import { seedFunds } from './funds'
import { seedCipCostCodes } from './cip-cost-codes'

describe('Seed data passes Zod validation', () => {
  describe('accounts', () => {
    it.each(seedAccounts.map((a) => [a.code, a]))(
      'account %s passes insertAccountSchema',
      (_code, account) => {
        const { parentCode: _parentCode, ...data } = account as typeof account & {
          parentCode?: string
        }
        const result = insertAccountSchema.safeParse(data)
        expect(result.success).toBe(true)
      }
    )
  })

  describe('funds', () => {
    it.each(seedFunds.map((f) => [f.name, f]))(
      'fund "%s" passes insertFundSchema',
      (_name, fund) => {
        const result = insertFundSchema.safeParse(fund)
        expect(result.success).toBe(true)
      }
    )
  })

  describe('CIP cost codes', () => {
    it.each(seedCipCostCodes.map((c) => [c.code, c]))(
      'cost code %s passes insertCipCostCodeSchema',
      (_code, costCode) => {
        const result = insertCipCostCodeSchema.safeParse(costCode)
        expect(result.success).toBe(true)
      }
    )
  })
})
