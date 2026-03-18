/**
 * QBO-to-GL Account and Fund Mapping
 *
 * Maps QBO account names to our seed chart of accounts (69 accounts, codes 1000-5600)
 * and QBO class names to our 6 seed funds.
 *
 * The static mappings here will be finalized when we receive the actual QBO CSV export.
 * Placeholder entries are included with TODO comments for accounts we haven't confirmed yet.
 */

/**
 * QBO account name → seed account code mapping.
 * Keys are QBO's account names (case-insensitive matching applied at lookup time).
 * Values are our standardized account codes.
 */
export const QBO_ACCOUNT_MAPPING: Record<string, string> = {
  // ── Cash ──
  'Business Checking': '1000',
  'Checking': '1000',
  'UMass Five Checking (0180)': '1000',
  'Savings': '1010',
  'UMass Five Savings (0172)': '1010',
  'Security Deposit Escrow': '1020',
  'Undeposited Funds': '1000', // QBO transit account — settles to checking

  // ── Current Assets ──
  'Accounts Receivable': '1100',
  'Accounts Receivable (A/R)': '1100',
  'Grants Receivable': '1110',
  'Pledges Receivable': '1120',
  'Prepaid Expenses': '1200',
  'Prepaid Insurance': '1200',

  // ── Fixed Assets ──
  'Construction in Progress': '1500',
  'CIP - Hard Costs': '1510',
  'CIP - Soft Costs': '1520',
  'CIP - Reserves & Contingency': '1530',
  'CIP - Developer Fee': '1540',
  'CIP - Construction Interest': '1550',
  'Building - Lodging': '1600',
  'Building - Barn': '1610',
  'Building - Garage': '1620',
  'Equipment': '1700',

  // ── Contra-Assets ──
  'Accum. Depreciation - Lodging': '1800',
  'Accumulated Depreciation - Lodging': '1800',
  'Accum. Depreciation - Barn': '1810',
  'Accumulated Depreciation - Barn': '1810',
  'Accum. Depreciation - Garage': '1820',
  'Accumulated Depreciation - Garage': '1820',
  'Accum. Depreciation - Equipment': '1830',
  'Accumulated Depreciation - Equipment': '1830',

  // ── Current Liabilities ──
  'Accounts Payable': '2000',
  'Accounts Payable (A/P)': '2000',
  'Reimbursements Payable': '2010',
  'Employee Reimbursements Payable': '2010',
  'Credit Card Payable': '2020',
  'Credit Card': '2020',
  'Accrued Expenses Payable': '2030',
  'Accrued Expenses': '2030',
  'Deferred Revenue': '2040',
  'Refundable Advance': '2050',
  'Security Deposits Held': '2060',
  'Security Deposits': '2060',

  // ── Payroll Liabilities ──
  'Accrued Payroll Payable': '2100',
  'Federal Income Tax Payable': '2110',
  'State Income Tax Payable': '2120',
  'Social Security Payable': '2130',
  'Medicare Payable': '2140',
  'Workers Comp Payable': '2150',
  "Workers' Comp Payable": '2150',
  '401(k) Withholding Payable': '2160',

  // ── Long-Term Liabilities ──
  'AHP Loan Payable': '2500',
  'AHP Loan': '2500',
  'Loans Payable': '2500',
  'Deferred Developer Fee Payable': '2510',
  'Accrued Interest Payable': '2520',

  // ── Net Assets ──
  'Net Assets Without Donor Restrictions': '3000',
  'Unrestricted Net Assets': '3000',
  'Opening Balance Equity': '3000',
  'Retained Earnings': '3000',
  'Net Assets With Donor Restrictions': '3100',
  'Restricted Net Assets': '3100',

  // ── Revenue ──
  'Rental Income': '4000',
  'Rent Revenue': '4000',
  'Rental Income - Proration Adj.': '4010',
  'Rental Income - Hardship Adj.': '4020',
  'Rental Income - Vacate Adj.': '4030',
  'Vacancy Loss': '4040',
  'Grant Revenue': '4100',
  'Grants': '4100',
  'Donation Income': '4200',
  'Donations': '4200',
  'Contributions': '4200',
  'Earned Income': '4300',
  'Investment Income': '4400',
  'Interest Income': '4400',
  'In-Kind Goods': '4500',
  'In-Kind Services': '4510',
  'In-Kind Facility Use': '4520',

  // ── Expenses ──
  'Salaries & Wages': '5000',
  'Payroll Expenses': '5000',
  'Interest Expense': '5100',
  'Interest Paid': '5100',
  'Depreciation Expense': '5200',
  'Depreciation': '5200',
  'Bad Debt Expense': '5300',
  'Property Taxes': '5400',
  'Property Insurance': '5410',
  'Insurance Expense': '5410',
  'Insurance': '5410',
  'Business Insurance': '5410',
  'General Liability Insurance': '5410',
  'Management Fees': '5420',
  'Commissions': '5430',
  'Landscaping & Grounds': '5440',
  'Landscaping': '5440',
  'Repairs & Maintenance': '5450',
  'Repairs': '5450',
  'Maintenance': '5450',
  'Utilities - Electric': '5500',
  'Electric': '5500',
  'Utilities - Gas': '5510',
  'Gas': '5510',
  'Utilities - Water/Sewer': '5520',
  'Water/Sewer': '5520',
  'Water': '5520',
  'Utilities - Internet': '5530',
  'Internet': '5530',
  'Utilities - Security & Fire Monitoring': '5540',
  'Security & Fire Monitoring': '5540',
  'Utilities - Trash': '5550',
  'Trash': '5550',
  'Other Operating Costs': '5600',
  'Admin Operating Costs': '5600',
  'Miscellaneous': '5600',
  'Office Supplies': '5600',
  'Office Supplies & Expenses': '5600',
  'Taxes & Licenses': '5600',
  'Technology/Software': '5600',
  'Bank Charges & Fees': '5600',
  'Professional Fees (legal, accounting)': '5600',
  'Training': '5600',
  'Meals & Entertainment': '5600',
}

/**
 * QBO class name → seed fund name mapping.
 * QBO classes map to our fund structure.
 * AHP maps to General Fund — loan proceeds are unrestricted per board resolution (2026-02).
 */
export const QBO_FUND_MAPPING: Record<string, string> = {
  'General': 'General Fund',
  'General Fund': 'General Fund',
  'AHP': 'General Fund',
  'AHP Fund': 'General Fund',
  'CPA': 'CPA Fund',
  'CPA Fund': 'CPA Fund',
  'MassDev': 'MassDev Fund',
  'MassDev Fund': 'MassDev Fund',
  'MassDevelopment': 'MassDev Fund',
  'HTC': 'HTC Equity Fund',
  'HTC Equity': 'HTC Equity Fund',
  'HTC Equity Fund': 'HTC Equity Fund',
  'MassSave': 'MassSave Fund',
  'MassSave Fund': 'MassSave Fund',
}

export type AccountLookup = Map<string, number> // account code → DB id
export type FundLookup = Map<string, number> // fund name → DB id

/**
 * Build a lookup map from account code → account ID from the database.
 */
export async function buildAccountLookup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { select: (...args: any[]) => any }
): Promise<AccountLookup> {
  const { accounts } = await import('@/lib/db/schema')
  const rows = await db.select({ id: accounts.id, code: accounts.code }).from(accounts)
  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.code, row.id)
  }
  return lookup
}

/**
 * Build a lookup map from fund name → fund ID from the database.
 */
export async function buildFundLookup(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: { select: (...args: any[]) => any }
): Promise<FundLookup> {
  const { funds } = await import('@/lib/db/schema')
  const rows = await db.select({ id: funds.id, name: funds.name }).from(funds)
  const lookup = new Map<string, number>()
  for (const row of rows) {
    lookup.set(row.name, row.id)
  }
  return lookup
}

/**
 * Resolve a QBO account name to a database account ID.
 * Performs case-insensitive matching against the static mapping.
 */
export function resolveAccountId(
  qboAccountName: string,
  accountLookup: AccountLookup
): number {
  // First, try direct mapping
  const code = findAccountCode(qboAccountName)

  if (!code) {
    throw new AccountMappingError(
      `No mapping found for QBO account: "${qboAccountName}"`
    )
  }

  const accountId = accountLookup.get(code)
  if (!accountId) {
    throw new AccountMappingError(
      `Account code ${code} (mapped from "${qboAccountName}") not found in database`
    )
  }

  return accountId
}

/**
 * Find the account code for a QBO account name (case-insensitive).
 */
function findAccountCode(qboAccountName: string): string | undefined {
  // Try exact match first
  if (qboAccountName in QBO_ACCOUNT_MAPPING) {
    return QBO_ACCOUNT_MAPPING[qboAccountName]
  }

  // Try case-insensitive match
  const lower = qboAccountName.toLowerCase()
  for (const [key, value] of Object.entries(QBO_ACCOUNT_MAPPING)) {
    if (key.toLowerCase() === lower) {
      return value
    }
  }

  return undefined
}

/**
 * Resolve a QBO class name to a database fund ID.
 * Defaults to General Fund when class is empty (per D-024).
 */
export function resolveFundId(
  qboClassName: string,
  fundLookup: FundLookup
): number {
  const fundName = findFundName(qboClassName)

  const fundId = fundLookup.get(fundName)
  if (!fundId) {
    throw new FundMappingError(
      `Fund "${fundName}" (mapped from class "${qboClassName}") not found in database`
    )
  }

  return fundId
}

/**
 * Find the fund name for a QBO class name.
 * Defaults to "General Fund" for empty/blank class.
 */
function findFundName(qboClassName: string): string {
  if (!qboClassName.trim()) {
    return 'General Fund'
  }

  // Try exact match
  if (qboClassName in QBO_FUND_MAPPING) {
    return QBO_FUND_MAPPING[qboClassName]
  }

  // Try case-insensitive match
  const lower = qboClassName.toLowerCase()
  for (const [key, value] of Object.entries(QBO_FUND_MAPPING)) {
    if (key.toLowerCase() === lower) {
      return value
    }
  }

  throw new FundMappingError(
    `No mapping found for QBO class: "${qboClassName}"`
  )
}

/**
 * Return all QBO account names from parsed rows that don't have a mapping.
 * Use for pre-flight validation before import.
 */
export function getUnmappedAccounts(
  qboAccountNames: string[]
): string[] {
  const unmapped: string[] = []
  const seen = new Set<string>()

  for (const name of qboAccountNames) {
    if (seen.has(name)) continue
    seen.add(name)

    const code = findAccountCode(name)
    if (!code) {
      unmapped.push(name)
    }
  }

  return unmapped
}

/**
 * Return all QBO class names from parsed rows that don't have a mapping.
 */
export function getUnmappedClasses(
  qboClassNames: string[]
): string[] {
  const unmapped: string[] = []
  const seen = new Set<string>()

  for (const name of qboClassNames) {
    if (seen.has(name) || !name.trim()) continue
    seen.add(name)

    try {
      findFundName(name)
    } catch {
      unmapped.push(name)
    }
  }

  return unmapped
}

export class AccountMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AccountMappingError'
  }
}

export class FundMappingError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'FundMappingError'
  }
}
