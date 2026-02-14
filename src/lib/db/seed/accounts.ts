import type { InsertAccount } from '@/lib/validators'

type SeedAccount = InsertAccount & { parentCode?: string }

// All 69 seed accounts from requirements.md Section 9.1
// parentCode is resolved to parentAccountId at seed time

export const seedAccounts: SeedAccount[] = [
  // ── Assets (24) ──
  { code: '1000', name: 'Checking', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '1010', name: 'Savings', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '1020', name: 'Security Deposit Escrow', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1030', name: 'Restricted Cash - Operating Reserve', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1040', name: 'Restricted Cash - Replacement Reserve', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1050', name: 'Restricted Cash - Transition Reserve', type: 'ASSET', subType: 'Cash', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1100', name: 'Accounts Receivable', type: 'ASSET', subType: 'Current Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1110', name: 'Grants Receivable', type: 'ASSET', subType: 'Current Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1120', name: 'Pledges Receivable', type: 'ASSET', subType: 'Current Asset', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '1200', name: 'Prepaid Expenses', type: 'ASSET', subType: 'Current Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1500', name: 'Construction in Progress', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1510', name: 'CIP - Hard Costs', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true, parentCode: '1500' },
  { code: '1520', name: 'CIP - Soft Costs', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true, parentCode: '1500' },
  { code: '1530', name: 'CIP - Reserves & Contingency', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true, parentCode: '1500' },
  { code: '1540', name: 'CIP - Developer Fee', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true, parentCode: '1500' },
  { code: '1550', name: 'CIP - Construction Interest', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true, parentCode: '1500' },
  { code: '1600', name: 'Building - Lodging', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1610', name: 'Building - Barn', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1620', name: 'Building - Garage', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: true },
  { code: '1700', name: 'Equipment', type: 'ASSET', subType: 'Fixed Asset', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '1800', name: 'Accum. Depreciation - Lodging', type: 'ASSET', subType: 'Contra-Asset', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '1810', name: 'Accum. Depreciation - Barn', type: 'ASSET', subType: 'Contra-Asset', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '1820', name: 'Accum. Depreciation - Garage', type: 'ASSET', subType: 'Contra-Asset', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '1830', name: 'Accum. Depreciation - Equipment', type: 'ASSET', subType: 'Contra-Asset', normalBalance: 'CREDIT', isSystemLocked: false },

  // ── Liabilities (17) ──
  { code: '2000', name: 'Accounts Payable', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2010', name: 'Reimbursements Payable', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2020', name: 'Credit Card Payable', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2030', name: 'Accrued Expenses Payable', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2040', name: 'Deferred Revenue', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2050', name: 'Refundable Advance', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2060', name: 'Security Deposits Held', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2100', name: 'Accrued Payroll Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2110', name: 'Federal Income Tax Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2120', name: 'State Income Tax Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2130', name: 'Social Security Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2140', name: 'Medicare Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2150', name: 'Workers Comp Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: false },
  { code: '2160', name: '401(k) Withholding Payable', type: 'LIABILITY', subType: 'Payroll', normalBalance: 'CREDIT', isSystemLocked: false },
  { code: '2500', name: 'AHP Loan Payable', type: 'LIABILITY', subType: 'Long-Term', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2510', name: 'Deferred Developer Fee Payable', type: 'LIABILITY', subType: 'Long-Term', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '2520', name: 'Accrued Interest Payable', type: 'LIABILITY', subType: 'Current', normalBalance: 'CREDIT', isSystemLocked: true },

  // ── Net Assets (2) ──
  { code: '3000', name: 'Net Assets Without Donor Restrictions', type: 'NET_ASSET', subType: 'Unrestricted', normalBalance: 'CREDIT', isSystemLocked: true },
  { code: '3100', name: 'Net Assets With Donor Restrictions', type: 'NET_ASSET', subType: 'Restricted', normalBalance: 'CREDIT', isSystemLocked: true },

  // ── Revenue (12) ──
  { code: '4000', name: 'Rental Income', type: 'REVENUE', subType: 'Operating', normalBalance: 'CREDIT', isSystemLocked: true, form990Line: '2' },
  { code: '4010', name: 'Rental Income - Proration Adj.', type: 'REVENUE', subType: 'Contra', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '4020', name: 'Rental Income - Hardship Adj.', type: 'REVENUE', subType: 'Contra', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '4030', name: 'Rental Income - Vacate Adj.', type: 'REVENUE', subType: 'Contra', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '4040', name: 'Vacancy Loss', type: 'REVENUE', subType: 'Contra-Revenue', normalBalance: 'DEBIT', isSystemLocked: false },
  { code: '4100', name: 'Grant Revenue', type: 'REVENUE', subType: 'Restricted', normalBalance: 'CREDIT', isSystemLocked: true, form990Line: '1e' },
  { code: '4200', name: 'Donation Income', type: 'REVENUE', subType: 'Contribution', normalBalance: 'CREDIT', isSystemLocked: true, form990Line: '1a' },
  { code: '4300', name: 'Earned Income', type: 'REVENUE', subType: 'Operating', normalBalance: 'CREDIT', isSystemLocked: false, form990Line: '2' },
  { code: '4400', name: 'Investment Income', type: 'REVENUE', subType: 'Operating', normalBalance: 'CREDIT', isSystemLocked: false, form990Line: '3' },
  { code: '4500', name: 'In-Kind Goods', type: 'REVENUE', subType: 'Contribution', normalBalance: 'CREDIT', isSystemLocked: false, form990Line: '1g' },
  { code: '4510', name: 'In-Kind Services', type: 'REVENUE', subType: 'Contribution', normalBalance: 'CREDIT', isSystemLocked: false, form990Line: '1g' },
  { code: '4520', name: 'In-Kind Facility Use', type: 'REVENUE', subType: 'Contribution', normalBalance: 'CREDIT', isSystemLocked: false, form990Line: '1g' },

  // ── Expenses (17) ──
  { code: '5000', name: 'Salaries & Wages', type: 'EXPENSE', subType: 'Payroll', normalBalance: 'DEBIT', isSystemLocked: true, form990Line: '5' },
  { code: '5100', name: 'Interest Expense', type: 'EXPENSE', subType: 'Financial', normalBalance: 'DEBIT', isSystemLocked: true, form990Line: '15' },
  { code: '5200', name: 'Depreciation Expense', type: 'EXPENSE', subType: 'Non-Cash', normalBalance: 'DEBIT', isSystemLocked: true, form990Line: '22' },
  { code: '5300', name: 'Bad Debt Expense', type: 'EXPENSE', subType: 'Operating', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5400', name: 'Property Taxes', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5410', name: 'Property Insurance', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5420', name: 'Management Fees', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '11g' },
  { code: '5430', name: 'Commissions', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5440', name: 'Landscaping & Grounds', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5450', name: 'Repairs & Maintenance', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5500', name: 'Utilities - Electric', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5510', name: 'Utilities - Gas', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5520', name: 'Utilities - Water/Sewer', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5530', name: 'Utilities - Internet', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5540', name: 'Utilities - Security & Fire Monitoring', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5550', name: 'Utilities - Trash', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
  { code: '5600', name: 'Other Operating Costs', type: 'EXPENSE', subType: 'Property Ops', normalBalance: 'DEBIT', isSystemLocked: false, form990Line: '24a' },
]
