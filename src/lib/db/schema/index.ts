import { relations } from 'drizzle-orm'

export * from './enums'
export * from './accounts'
export * from './funds'
export * from './transactions'
export * from './transaction-lines'
export * from './cip-cost-codes'
export * from './audit-log'
export * from './vendors'
export * from './tenants'
export * from './donors'
export * from './budgets'
export * from './budget-lines'
export * from './cash-projections'
export * from './cash-projection-lines'
export * from './ramp-transactions'
export * from './categorization-rules'
export * from './fixed-assets'
export * from './cip-conversions'
export * from './cip-conversion-lines'
export * from './ahp-loan-config'
export * from './prepaid-schedules'

// Re-import for relations definitions
import { accounts } from './accounts'
import { funds } from './funds'
import { transactions } from './transactions'
import { transactionLines } from './transaction-lines'
import { cipCostCodes } from './cip-cost-codes'
import { budgets } from './budgets'
import { budgetLines } from './budget-lines'
import { cashProjections } from './cash-projections'
import { cashProjectionLines } from './cash-projection-lines'
import { vendors } from './vendors'
import { tenants } from './tenants'
import { donors } from './donors'
import { rampTransactions } from './ramp-transactions'
import { categorizationRules } from './categorization-rules'
import { fixedAssets } from './fixed-assets'
import { cipConversions } from './cip-conversions'
import { cipConversionLines } from './cip-conversion-lines'
import { prepaidSchedules } from './prepaid-schedules'

// --- Relations ---

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentAccountId],
    references: [accounts.id],
    relationName: 'accountHierarchy',
  }),
  children: many(accounts, { relationName: 'accountHierarchy' }),
  transactionLines: many(transactionLines),
  budgetLines: many(budgetLines),
}))

export const fundsRelations = relations(funds, ({ many }) => ({
  transactionLines: many(transactionLines),
  budgetLines: many(budgetLines),
}))

export const transactionsRelations = relations(transactions, ({ one, many }) => ({
  lines: many(transactionLines),
  reversalOf: one(transactions, {
    fields: [transactions.reversalOfId],
    references: [transactions.id],
    relationName: 'reversalChain',
  }),
  reversedBy: one(transactions, {
    fields: [transactions.reversedById],
    references: [transactions.id],
    relationName: 'reversalChain',
  }),
}))

export const transactionLinesRelations = relations(
  transactionLines,
  ({ one }) => ({
    transaction: one(transactions, {
      fields: [transactionLines.transactionId],
      references: [transactions.id],
    }),
    account: one(accounts, {
      fields: [transactionLines.accountId],
      references: [accounts.id],
    }),
    fund: one(funds, {
      fields: [transactionLines.fundId],
      references: [funds.id],
    }),
    cipCostCode: one(cipCostCodes, {
      fields: [transactionLines.cipCostCodeId],
      references: [cipCostCodes.id],
    }),
  })
)

export const cipCostCodesRelations = relations(cipCostCodes, ({ many }) => ({
  transactionLines: many(transactionLines),
}))

export const budgetsRelations = relations(budgets, ({ many }) => ({
  lines: many(budgetLines),
}))

export const budgetLinesRelations = relations(budgetLines, ({ one }) => ({
  budget: one(budgets, {
    fields: [budgetLines.budgetId],
    references: [budgets.id],
  }),
  account: one(accounts, {
    fields: [budgetLines.accountId],
    references: [accounts.id],
  }),
  fund: one(funds, {
    fields: [budgetLines.fundId],
    references: [funds.id],
  }),
}))

export const cashProjectionsRelations = relations(cashProjections, ({ many }) => ({
  lines: many(cashProjectionLines),
}))

export const cashProjectionLinesRelations = relations(
  cashProjectionLines,
  ({ one }) => ({
    projection: one(cashProjections, {
      fields: [cashProjectionLines.projectionId],
      references: [cashProjections.id],
    }),
  })
)

export const vendorsRelations = relations(vendors, ({ one }) => ({
  defaultAccount: one(accounts, {
    fields: [vendors.defaultAccountId],
    references: [accounts.id],
  }),
  defaultFund: one(funds, {
    fields: [vendors.defaultFundId],
    references: [funds.id],
  }),
}))

export const tenantsRelations = relations(tenants, () => ({}))

export const donorsRelations = relations(donors, () => ({}))

export const rampTransactionsRelations = relations(
  rampTransactions,
  ({ one }) => ({
    glAccount: one(accounts, {
      fields: [rampTransactions.glAccountId],
      references: [accounts.id],
    }),
    fund: one(funds, {
      fields: [rampTransactions.fundId],
      references: [funds.id],
    }),
    glTransaction: one(transactions, {
      fields: [rampTransactions.glTransactionId],
      references: [transactions.id],
    }),
    categorizationRule: one(categorizationRules, {
      fields: [rampTransactions.categorizationRuleId],
      references: [categorizationRules.id],
    }),
  })
)

export const categorizationRulesRelations = relations(
  categorizationRules,
  ({ one }) => ({
    glAccount: one(accounts, {
      fields: [categorizationRules.glAccountId],
      references: [accounts.id],
    }),
    fund: one(funds, {
      fields: [categorizationRules.fundId],
      references: [funds.id],
    }),
  })
)

export const fixedAssetsRelations = relations(fixedAssets, ({ one, many }) => ({
  parent: one(fixedAssets, {
    fields: [fixedAssets.parentAssetId],
    references: [fixedAssets.id],
    relationName: 'assetHierarchy',
  }),
  children: many(fixedAssets, { relationName: 'assetHierarchy' }),
  glAssetAccount: one(accounts, {
    fields: [fixedAssets.glAssetAccountId],
    references: [accounts.id],
  }),
  glAccumDeprAccount: one(accounts, {
    fields: [fixedAssets.glAccumDeprAccountId],
    references: [accounts.id],
  }),
  glExpenseAccount: one(accounts, {
    fields: [fixedAssets.glExpenseAccountId],
    references: [accounts.id],
  }),
  cipConversion: one(cipConversions, {
    fields: [fixedAssets.cipConversionId],
    references: [cipConversions.id],
  }),
}))

export const cipConversionsRelations = relations(
  cipConversions,
  ({ one, many }) => ({
    lines: many(cipConversionLines),
    glTransaction: one(transactions, {
      fields: [cipConversions.glTransactionId],
      references: [transactions.id],
    }),
  })
)

export const cipConversionLinesRelations = relations(
  cipConversionLines,
  ({ one }) => ({
    conversion: one(cipConversions, {
      fields: [cipConversionLines.conversionId],
      references: [cipConversions.id],
    }),
    sourceCipAccount: one(accounts, {
      fields: [cipConversionLines.sourceCipAccountId],
      references: [accounts.id],
    }),
    sourceCostCode: one(cipCostCodes, {
      fields: [cipConversionLines.sourceCostCodeId],
      references: [cipCostCodes.id],
    }),
    targetFixedAsset: one(fixedAssets, {
      fields: [cipConversionLines.targetFixedAssetId],
      references: [fixedAssets.id],
    }),
  })
)

export const prepaidSchedulesRelations = relations(
  prepaidSchedules,
  ({ one }) => ({
    glExpenseAccount: one(accounts, {
      fields: [prepaidSchedules.glExpenseAccountId],
      references: [accounts.id],
    }),
    glPrepaidAccount: one(accounts, {
      fields: [prepaidSchedules.glPrepaidAccountId],
      references: [accounts.id],
    }),
    fund: one(funds, {
      fields: [prepaidSchedules.fundId],
      references: [funds.id],
    }),
    sourceTransaction: one(transactions, {
      fields: [prepaidSchedules.sourceTransactionId],
      references: [transactions.id],
    }),
  })
)
