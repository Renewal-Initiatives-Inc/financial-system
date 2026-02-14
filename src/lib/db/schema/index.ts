import { relations } from 'drizzle-orm'

export * from './enums'
export * from './accounts'
export * from './funds'
export * from './transactions'
export * from './transaction-lines'
export * from './cip-cost-codes'
export * from './audit-log'

// Re-import for relations definitions
import { accounts } from './accounts'
import { funds } from './funds'
import { transactions } from './transactions'
import { transactionLines } from './transaction-lines'
import { cipCostCodes } from './cip-cost-codes'

// --- Relations ---

export const accountsRelations = relations(accounts, ({ one, many }) => ({
  parent: one(accounts, {
    fields: [accounts.parentAccountId],
    references: [accounts.id],
    relationName: 'accountHierarchy',
  }),
  children: many(accounts, { relationName: 'accountHierarchy' }),
  transactionLines: many(transactionLines),
}))

export const fundsRelations = relations(funds, ({ many }) => ({
  transactionLines: many(transactionLines),
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
