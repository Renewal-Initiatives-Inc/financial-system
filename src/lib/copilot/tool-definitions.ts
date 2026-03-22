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
    'Calculate the balance of a specific fund, including assets, liabilities, and retained earnings breakdown.',
  input_schema: {
    type: 'object',
    properties: {
      fundId: { type: 'number', description: 'Fund ID' },
      asOfDate: { type: 'string', description: 'As-of date YYYY-MM-DD (optional, defaults to today)' },
    },
    required: ['fundId'],
  },
}

export const govInfoSearchDefinition: CopilotToolDefinition = {
  name: 'govInfoSearch',
  description: `Search the official U.S. Government GovInfo database for Federal Register entries, IRC text, Treasury Regulations, and Public Laws. Use this to check for regulatory changes, new IRS guidance (revenue rulings, revenue procedures, treasury decisions, IRS notices), tax legislation, or to verify whether laws/regulations have been amended.

Supports Lucene-style field operators:
- agency:"Internal Revenue Service" — filter by agency
- cfrcitation:(26 CFR 1.501) — find rules affecting a specific CFR section
- publishdate:range(2025-01-01, 2025-12-31) — date range filter
- section:rule | section:prorule | section:notice — FR document type

Pre-built query templates are available for common compliance checks:
- annualRateReview: SS wage base, Pub 15-T, withholding table updates
- exemptOrgChanges: IRS actions affecting 501(c)(3) / tax-exempt orgs
- form990Changes: Form 990 / 990-EZ / 990-T revisions
- informationReturnChanges: 1099 threshold or reporting changes
- taxLegislation: new public laws affecting the tax code
- cfrCitationChanges: rulemaking touching a specific CFR section`,
  input_schema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description:
          'Search query. Use field operators for precision (e.g., agency:"Internal Revenue Service" "revenue ruling" publishdate:range(2025-01-01,))',
      },
      collection: {
        type: 'string',
        enum: ['FR', 'USCODE', 'CFR', 'PLAW'],
        description:
          'Limit to a specific collection: FR (Federal Register — IRS rules/notices), USCODE (IRC text), CFR (Treasury Regulations), PLAW (Public Laws). Omit to search all.',
      },
      template: {
        type: 'string',
        enum: [
          'annualRateReview',
          'exemptOrgChanges',
          'form990Changes',
          'informationReturnChanges',
          'taxLegislation',
          'cfrCitationChanges',
        ],
        description:
          'Use a pre-built query template instead of a raw query. Provide templateArgs for parameters.',
      },
      templateArgs: {
        type: 'object',
        properties: {
          year: { type: 'number', description: 'Year for annualRateReview template' },
          sinceDate: {
            type: 'string',
            description: 'Start date (YYYY-MM-DD) for change-tracking templates',
          },
          citation: {
            type: 'string',
            description: 'CFR citation for cfrCitationChanges template (e.g., "26 CFR 1.501")',
          },
        },
        description: 'Arguments for the selected template',
      },
      packageId: {
        type: 'string',
        description:
          'If provided, fetch details for a specific package/granule instead of searching. Use a packageId from a previous search result.',
      },
      granuleId: {
        type: 'string',
        description: 'Optional granule ID within a package (for more specific content)',
      },
    },
  },
}

export const searchBankTransactionsDefinition: CopilotToolDefinition = {
  name: 'searchBankTransactions',
  description:
    'Search the Plaid bank transaction feed. Returns raw bank transactions with merchant name, amount, date, pending status, and match tier (1=auto-matched, 2=needs review, 3=exception, null=unclassified). Use this to verify whether a specific payment appeared in the bank feed, check matching status, or investigate unreconciled items.',
  input_schema: {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search merchant name (optional)' },
      dateFrom: { type: 'string', description: 'Start date YYYY-MM-DD (optional)' },
      dateTo: { type: 'string', description: 'End date YYYY-MM-DD (optional)' },
      matchTier: {
        type: 'number',
        description: 'Filter by match tier: 1=auto-matched, 2=needs review, 3=exception (optional)',
      },
      isPending: { type: 'boolean', description: 'Filter to pending-only transactions (optional)' },
      limit: { type: 'number', description: 'Max results (default 20, max 50)' },
    },
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
