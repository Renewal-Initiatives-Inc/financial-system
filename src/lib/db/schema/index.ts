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
export * from './pledges'
export * from './annual-rate-config'
export * from './staging-records'
export * from './payroll'
export * from './purchase-orders'
export * from './invoices'
export * from './security-deposit-interest'
export * from './compliance-deadlines'
export * from './security-deposit-receipts'
export * from './bank-accounts'
export * from './bank-transactions'
export * from './bank-matches'
export * from './matching-rules'
export * from './reconciliation-sessions'
export * from './functional-allocations'
export * from './import-review'

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
import { pledges } from './pledges'
import { purchaseOrders } from './purchase-orders'
import { invoices } from './invoices'
import { stagingRecords } from './staging-records'
import { payrollRuns, payrollEntries } from './payroll'
import { securityDepositInterestPayments } from './security-deposit-interest'
import { complianceDeadlines } from './compliance-deadlines'
import { securityDepositReceipts } from './security-deposit-receipts'
import { bankAccounts } from './bank-accounts'
import { bankTransactions } from './bank-transactions'
import { bankMatches } from './bank-matches'
import { matchingRules } from './matching-rules'
import { reconciliationSessions } from './reconciliation-sessions'
import { functionalAllocations } from './functional-allocations'
import { importReviewItems } from './import-review'

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

export const fundsRelations = relations(funds, ({ one, many }) => ({
  funder: one(vendors, {
    fields: [funds.funderId],
    references: [vendors.id],
  }),
  transactionLines: many(transactionLines),
  budgetLines: many(budgetLines),
  complianceDeadlines: many(complianceDeadlines),
  arInvoices: many(invoices),
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

export const vendorsRelations = relations(vendors, ({ one, many }) => ({
  defaultAccount: one(accounts, {
    fields: [vendors.defaultAccountId],
    references: [accounts.id],
  }),
  defaultFund: one(funds, {
    fields: [vendors.defaultFundId],
    references: [funds.id],
  }),
  fundedSources: many(funds),
  purchaseOrders: many(purchaseOrders),
  invoices: many(invoices),
}))

export const tenantsRelations = relations(tenants, ({ many }) => ({
  securityDepositInterestPayments: many(securityDepositInterestPayments),
  securityDepositReceipts: many(securityDepositReceipts),
  complianceDeadlines: many(complianceDeadlines),
}))

export const donorsRelations = relations(donors, ({ many }) => ({
  pledges: many(pledges),
}))

export const pledgesRelations = relations(pledges, ({ one }) => ({
  donor: one(donors, {
    fields: [pledges.donorId],
    references: [donors.id],
  }),
  fund: one(funds, {
    fields: [pledges.fundId],
    references: [funds.id],
  }),
  glTransaction: one(transactions, {
    fields: [pledges.glTransactionId],
    references: [transactions.id],
  }),
}))

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

export const purchaseOrdersRelations = relations(
  purchaseOrders,
  ({ one, many }) => ({
    vendor: one(vendors, {
      fields: [purchaseOrders.vendorId],
      references: [vendors.id],
    }),
    glDestinationAccount: one(accounts, {
      fields: [purchaseOrders.glDestinationAccountId],
      references: [accounts.id],
    }),
    fund: one(funds, {
      fields: [purchaseOrders.fundId],
      references: [funds.id],
    }),
    cipCostCode: one(cipCostCodes, {
      fields: [purchaseOrders.cipCostCodeId],
      references: [cipCostCodes.id],
    }),
    invoices: many(invoices),
  })
)

export const invoicesRelations = relations(invoices, ({ one }) => ({
  purchaseOrder: one(purchaseOrders, {
    fields: [invoices.purchaseOrderId],
    references: [purchaseOrders.id],
  }),
  vendor: one(vendors, {
    fields: [invoices.vendorId],
    references: [vendors.id],
  }),
  fund: one(funds, {
    fields: [invoices.fundId],
    references: [funds.id],
  }),
  glTransaction: one(transactions, {
    fields: [invoices.glTransactionId],
    references: [transactions.id],
  }),
}))

export const stagingRecordsRelations = relations(
  stagingRecords,
  ({ one }) => ({
    fund: one(funds, {
      fields: [stagingRecords.fundId],
      references: [funds.id],
    }),
    glAccount: one(accounts, {
      fields: [stagingRecords.glAccountId],
      references: [accounts.id],
    }),
    glTransaction: one(transactions, {
      fields: [stagingRecords.glTransactionId],
      references: [transactions.id],
    }),
  })
)

export const payrollRunsRelations = relations(payrollRuns, ({ many }) => ({
  entries: many(payrollEntries),
}))

export const payrollEntriesRelations = relations(
  payrollEntries,
  ({ one }) => ({
    payrollRun: one(payrollRuns, {
      fields: [payrollEntries.payrollRunId],
      references: [payrollRuns.id],
    }),
    glTransaction: one(transactions, {
      fields: [payrollEntries.glTransactionId],
      references: [transactions.id],
    }),
    glEmployerTransaction: one(transactions, {
      fields: [payrollEntries.glEmployerTransactionId],
      references: [transactions.id],
    }),
  })
)

export const securityDepositInterestPaymentsRelations = relations(
  securityDepositInterestPayments,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [securityDepositInterestPayments.tenantId],
      references: [tenants.id],
    }),
    glTransaction: one(transactions, {
      fields: [securityDepositInterestPayments.glTransactionId],
      references: [transactions.id],
    }),
  })
)

export const complianceDeadlinesRelations = relations(
  complianceDeadlines,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [complianceDeadlines.tenantId],
      references: [tenants.id],
    }),
    fund: one(funds, {
      fields: [complianceDeadlines.fundId],
      references: [funds.id],
    }),
  })
)

export const securityDepositReceiptsRelations = relations(
  securityDepositReceipts,
  ({ one }) => ({
    tenant: one(tenants, {
      fields: [securityDepositReceipts.tenantId],
      references: [tenants.id],
    }),
  })
)

export const bankAccountsRelations = relations(
  bankAccounts,
  ({ one, many }) => ({
    glAccount: one(accounts, {
      fields: [bankAccounts.glAccountId],
      references: [accounts.id],
    }),
    bankTransactions: many(bankTransactions),
    reconciliationSessions: many(reconciliationSessions),
  })
)

export const bankTransactionsRelations = relations(
  bankTransactions,
  ({ one, many }) => ({
    bankAccount: one(bankAccounts, {
      fields: [bankTransactions.bankAccountId],
      references: [bankAccounts.id],
    }),
    matches: many(bankMatches),
  })
)

export const bankMatchesRelations = relations(bankMatches, ({ one }) => ({
  bankTransaction: one(bankTransactions, {
    fields: [bankMatches.bankTransactionId],
    references: [bankTransactions.id],
  }),
  glTransactionLine: one(transactionLines, {
    fields: [bankMatches.glTransactionLineId],
    references: [transactionLines.id],
  }),
  rule: one(matchingRules, {
    fields: [bankMatches.ruleId],
    references: [matchingRules.id],
  }),
  reconciliationSession: one(reconciliationSessions, {
    fields: [bankMatches.reconciliationSessionId],
    references: [reconciliationSessions.id],
  }),
}))

export const matchingRulesRelations = relations(
  matchingRules,
  ({ many }) => ({
    matches: many(bankMatches),
  })
)

export const reconciliationSessionsRelations = relations(
  reconciliationSessions,
  ({ one, many }) => ({
    bankAccount: one(bankAccounts, {
      fields: [reconciliationSessions.bankAccountId],
      references: [bankAccounts.id],
    }),
    matches: many(bankMatches),
  })
)

export const functionalAllocationsRelations = relations(
  functionalAllocations,
  ({ one }) => ({
    account: one(accounts, {
      fields: [functionalAllocations.accountId],
      references: [accounts.id],
    }),
  })
)

export const importReviewItemsRelations = relations(
  importReviewItems,
  ({ one }) => ({
    glTransaction: one(transactions, {
      fields: [importReviewItems.glTransactionId],
      references: [transactions.id],
    }),
  })
)
