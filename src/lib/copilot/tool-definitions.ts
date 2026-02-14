import type { CopilotToolDefinition } from './types'

/**
 * Tool definitions are pure data objects (JSON schemas).
 * Safe to import from both client and server components.
 * Tool handlers are in separate files and only imported server-side.
 */

export const taxLawSearchDefinition: CopilotToolDefinition = {
  name: 'taxLawSearch',
  description:
    'Search the tax law knowledge corpus for information about IRC sections, ASC standards, IRS publications, and MA compliance rules. Returns relevant excerpts with source citations.',
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (e.g., "501(c)(3) operational test", "MACRS depreciation rates")',
      },
      topics: {
        type: 'array',
        items: { type: 'string' },
        description:
          'Optional topic filters: exempt-org, fund-accounting, depreciation, payroll-tax, ma-compliance, reporting, construction',
      },
    },
    required: ['query'],
  },
}

export const regulationLookupDefinition: CopilotToolDefinition = {
  name: 'regulationLookup',
  description:
    'Fetch a specific Treasury Regulation section from the eCFR (Electronic Code of Federal Regulations). Use for looking up specific regulatory text.',
  input_schema: {
    type: 'object',
    properties: {
      citation: {
        type: 'string',
        description: 'CFR citation (e.g., "26 CFR 1.501(c)(3)-1(d)(1)(ii)")',
      },
    },
    required: ['citation'],
  },
}

export const nonprofitExplorerDefinition: CopilotToolDefinition = {
  name: 'nonprofitExplorerLookup',
  description:
    'Query ProPublica Nonprofit Explorer to find comparable organizations or look up specific EINs. Can also return validated functional allocation benchmarks for RI comparable orgs.',
  input_schema: {
    type: 'object',
    properties: {
      ein: {
        type: 'string',
        description: 'Specific EIN to look up (e.g., "04-3538884")',
      },
      query: {
        type: 'string',
        description: 'Search query to find organizations (single keywords work best)',
      },
      includeBenchmarks: {
        type: 'boolean',
        description: 'Include validated functional allocation benchmarks for RI comparable orgs',
      },
    },
  },
}

export const searchTransactionsDefinition: CopilotToolDefinition = {
  name: 'searchTransactions',
  description:
    'Search GL transaction history. Can filter by keyword, date range, account, or fund.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search memo text (optional)' },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      accountId: { type: 'number', description: 'Filter by account ID (optional)' },
      fundId: { type: 'number', description: 'Filter by fund ID (optional)' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
  },
}

export const searchAccountsDefinition: CopilotToolDefinition = {
  name: 'searchAccounts',
  description:
    'Search the chart of accounts by name, code, or type. Returns account details with current balances.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search by account name or code (optional)' },
      type: {
        type: 'string',
        description: 'Filter by account type: ASSET, LIABILITY, NET_ASSET, REVENUE, EXPENSE (optional)',
      },
      activeOnly: { type: 'boolean', description: 'Only return active accounts (default true)' },
    },
  },
}

export const getAccountBalanceDefinition: CopilotToolDefinition = {
  name: 'getAccountBalance',
  description:
    'Calculate the balance of a specific account, optionally as of a specific date.',
  input_schema: {
    type: 'object',
    properties: {
      accountId: { type: 'number', description: 'Account ID' },
      asOfDate: { type: 'string', description: 'As-of date YYYY-MM-DD (optional, defaults to today)' },
    },
    required: ['accountId'],
  },
}

export const getFundBalanceDefinition: CopilotToolDefinition = {
  name: 'getFundBalance',
  description:
    'Calculate the balance of a specific fund, including assets, liabilities, and net assets breakdown.',
  input_schema: {
    type: 'object',
    properties: {
      fundId: { type: 'number', description: 'Fund ID' },
      asOfDate: { type: 'string', description: 'As-of date YYYY-MM-DD (optional, defaults to today)' },
    },
    required: ['fundId'],
  },
}

export const searchAuditLogDefinition: CopilotToolDefinition = {
  name: 'searchAuditLog',
  description:
    'Search the audit log for changes to accounts, transactions, funds, and other entities.',
  input_schema: {
    type: 'object',
    properties: {
      entityType: {
        type: 'string',
        description: 'Filter by entity type (e.g., "account", "transaction", "fund", "vendor")',
      },
      entityId: { type: 'number', description: 'Filter by specific entity ID' },
      action: {
        type: 'string',
        description: 'Filter by action: created, updated, voided, reversed, deactivated, signed_off, imported, posted',
      },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
  },
}
