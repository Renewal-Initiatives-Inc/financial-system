import { z } from 'zod'

/**
 * Zod schemas for validating AI-provided tool inputs before execution.
 * Derived from tool definitions in tool-definitions.ts.
 * .passthrough() is NOT used — unknown fields are stripped.
 */

export const taxLawSearchSchema = z.object({
  query: z.string(),
  topics: z.array(z.string()).optional(),
})

export const regulationLookupSchema = z.object({
  citation: z.string(),
})

export const nonprofitExplorerLookupSchema = z.object({
  ein: z.string().optional(),
  query: z.string().optional(),
  includeBenchmarks: z.boolean().optional(),
})

export const searchTransactionsSchema = z.object({
  query: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  accountId: z.number().optional(),
  fundId: z.number().optional(),
  limit: z.number().optional(),
})

export const searchAccountsSchema = z.object({
  query: z.string().optional(),
  type: z.string().optional(),
  activeOnly: z.boolean().optional(),
})

export const getAccountBalanceSchema = z.object({
  accountId: z.number(),
  asOfDate: z.string().optional(),
})

export const getFundBalanceSchema = z.object({
  fundId: z.number(),
  asOfDate: z.string().optional(),
})

export const govInfoSearchSchema = z.object({
  query: z.string().optional(),
  collection: z.enum(['FR', 'USCODE', 'CFR', 'PLAW']).optional(),
  template: z
    .enum([
      'annualRateReview',
      'exemptOrgChanges',
      'form990Changes',
      'informationReturnChanges',
      'taxLegislation',
      'cfrCitationChanges',
    ])
    .optional(),
  templateArgs: z
    .object({
      year: z.number().optional(),
      sinceDate: z.string().optional(),
      citation: z.string().optional(),
    })
    .optional(),
  packageId: z.string().optional(),
  granuleId: z.string().optional(),
})

export const searchAuditLogSchema = z.object({
  entityType: z.string().optional(),
  entityId: z.number().optional(),
  action: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  limit: z.number().optional(),
})

/** Map of tool name → Zod schema for input validation */
export const toolSchemas: Record<string, z.ZodType> = {
  taxLawSearch: taxLawSearchSchema,
  regulationLookup: regulationLookupSchema,
  nonprofitExplorerLookup: nonprofitExplorerLookupSchema,
  searchTransactions: searchTransactionsSchema,
  searchAccounts: searchAccountsSchema,
  getAccountBalance: getAccountBalanceSchema,
  getFundBalance: getFundBalanceSchema,
  govInfoSearch: govInfoSearchSchema,
  searchAuditLog: searchAuditLogSchema,
}
