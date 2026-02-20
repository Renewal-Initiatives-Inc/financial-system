// Shared types and utilities for all Phase 15 reports

export type ReportExportFormat = 'PDF' | 'CSV'

export type PeriodType = 'monthly' | 'quarterly' | 'ytd' | 'annual'

export interface ReportFilters {
  startDate: string
  endDate: string
  fundId?: number | null
  periodType?: PeriodType
}

export interface ReportMeta {
  title: string
  generatedAt: string // ISO timestamp
  filters: ReportFilters
  fundName?: string | null
}

export interface ComparisonRow {
  label: string
  currentPeriod: number
  yearToDate: number
  budget: number | null
  variance: number | null
  variancePercent: number | null
}

export interface ReportSection<T = ComparisonRow> {
  title: string
  rows: T[]
  total?: T
}

// --- Formatting utilities ---

export function formatCurrency(value: number): string {
  if (value < 0) {
    return `(${new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(value))})`
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(value)
}

export function formatPercent(value: number | null): string {
  if (value === null) return 'N/A'
  return `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`
}

export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

export function formatDate(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export function formatDateTime(date: string | Date): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// --- Date range helpers ---

export function getCurrentMonthRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth()
  const startDate = `${year}-${String(month + 1).padStart(2, '0')}-01`
  const lastDay = new Date(year, month + 1, 0).getDate()
  const endDate = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

export function getYTDRange(): { startDate: string; endDate: string } {
  const now = new Date()
  const year = now.getFullYear()
  const startDate = `${year}-01-01`
  const endDate = now.toISOString().split('T')[0]
  return { startDate, endDate }
}

export function getFiscalYearRange(year?: number): { startDate: string; endDate: string } {
  const fy = year ?? new Date().getFullYear()
  return { startDate: `${fy}-01-01`, endDate: `${fy}-12-31` }
}

export function getMonthRange(year: number, month: number): { startDate: string; endDate: string } {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`
  const lastDay = new Date(year, month, 0).getDate()
  const endDate = `${year}-${String(month).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

export function getQuarterRange(year: number, quarter: number): { startDate: string; endDate: string } {
  const startMonth = (quarter - 1) * 3 + 1
  const endMonth = startMonth + 2
  const startDate = `${year}-${String(startMonth).padStart(2, '0')}-01`
  const lastDay = new Date(year, endMonth, 0).getDate()
  const endDate = `${year}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { startDate, endDate }
}

// Report card definitions for the index page
export interface ReportCardDef {
  slug: string
  title: string
  description: string
  category: 'core' | 'operational' | 'fund' | 'specialized' | 'compliance' | 'payroll'
  isAvailable: boolean
}

export const REPORT_DEFINITIONS: ReportCardDef[] = [
  // Core Financial Statements
  { slug: 'balance-sheet', title: 'Statement of Financial Position', description: 'Assets, liabilities, and net assets with fund drill-down', category: 'core', isAvailable: true },
  { slug: 'activities', title: 'Statement of Activities', description: 'Revenue, expenses, and changes in net assets by restriction class', category: 'core', isAvailable: true },
  { slug: 'cash-flows', title: 'Statement of Cash Flows', description: 'Indirect method: operating, investing, and financing activities', category: 'core', isAvailable: true },
  { slug: 'functional-expenses', title: 'Statement of Functional Expenses', description: 'Expense matrix by function (Program/Admin/Fundraising) with GAAP/990 toggle', category: 'core', isAvailable: true },
  // Operational Dashboards
  { slug: 'cash-position', title: 'Cash Position Summary', description: 'Bank balances, payables, receivables, net available cash, AHP status', category: 'operational', isAvailable: true },
  { slug: 'ar-aging', title: 'AR Aging', description: 'Tenant, grant, and pledge receivables by aging bucket', category: 'operational', isAvailable: true },
  { slug: 'outstanding-payables', title: 'Outstanding Payables', description: 'AP, reimbursements, credit card, and accrued payables with aging', category: 'operational', isAvailable: true },
  { slug: 'rent-collection', title: 'Rent Collection Status', description: 'Billed vs collected by unit, occupancy, vacancy loss, collection rate', category: 'operational', isAvailable: true },
  // Fund & Grant Reports
  { slug: 'fund-drawdown', title: 'Fund Draw-Down / Restricted Funding Status', description: 'Per-fund awarded, spent, remaining with draw-down progress', category: 'fund', isAvailable: true },
  { slug: 'grant-compliance', title: 'Funding Compliance Tracking', description: 'Conditional grant progress, matching requirements, milestones', category: 'fund', isAvailable: true },
  { slug: 'fund-level', title: 'Fund-Level P&L and Balance Sheet', description: 'Single-fund financial position and activities', category: 'fund', isAvailable: true },
  // Specialized Reports
  { slug: 'property-expenses', title: 'Property Operating Expense Breakdown', description: '13 property expense categories with budget vs actual', category: 'specialized', isAvailable: true },
  { slug: 'utility-trends', title: 'Utility Trend Analysis', description: 'Electric, gas, water trends over time with line charts', category: 'specialized', isAvailable: true },
  { slug: 'security-deposit-register', title: 'Security Deposit Register', description: 'Tenant deposits, interest accrual, escrow reconciliation', category: 'specialized', isAvailable: true },
  // Phase 16: Audit & Compliance
  { slug: 'audit-log', title: 'Audit Log', description: 'System audit trail with action, entity, and user filtering', category: 'compliance', isAvailable: true },
  { slug: 'transaction-history', title: 'Transaction History', description: 'Full transaction journal with multi-field search and export', category: 'core', isAvailable: true },
  { slug: 'late-entries', title: 'Late Entries Report', description: 'Transactions entered after period close with aging analysis', category: 'compliance', isAvailable: true },
  { slug: 'compliance-calendar', title: 'Compliance Calendar', description: 'Tax, grant, tenant, and budget deadlines with status tracking', category: 'compliance', isAvailable: true },
  // Phase 16: Specialized Financial
  { slug: 'donor-giving-history', title: 'Donor Giving History', description: 'Donation trends by donor for stewardship and 990 reporting', category: 'fund', isAvailable: true },
  { slug: 'cash-projection', title: 'Cash Projection', description: '90-day forward cash flow forecast with scenario analysis', category: 'operational', isAvailable: true },
  { slug: 'ahp-loan-summary', title: 'AHP Loan Summary', description: 'AHP loan balance, draw schedule, and compliance status', category: 'fund', isAvailable: true },
  { slug: 'capital-budget', title: 'Capital Budget', description: 'CIP project budgets, actuals, and remaining authorization', category: 'specialized', isAvailable: true },
  { slug: 'ahp-annual-package', title: 'AHP Annual Package', description: 'Annual AHP compliance documentation package', category: 'fund', isAvailable: true },
  { slug: 'form-990-data', title: 'Form 990 Data', description: '990 line-item data export for CPA preparation', category: 'compliance', isAvailable: true },
  // Phase 16: Payroll Reports
  { slug: 'payroll-register', title: 'Payroll Register', description: 'Detailed payroll register by pay period with functional allocation', category: 'payroll', isAvailable: true },
  { slug: 'payroll-tax-liability', title: 'Payroll Tax Liability', description: 'Federal and state payroll tax obligations by quarter', category: 'payroll', isAvailable: true },
  { slug: 'w2-verification', title: 'W-2 Verification', description: 'Pre-filing W-2 data verification against payroll records', category: 'payroll', isAvailable: true },
  { slug: 'employer-payroll-cost', title: 'Employer Payroll Cost', description: 'Total employer cost per employee including benefits and taxes', category: 'payroll', isAvailable: true },
  { slug: 'quarterly-tax-prep', title: 'Quarterly Tax Prep', description: 'Quarterly 941/M-941 data for tax filing preparation', category: 'payroll', isAvailable: true },
  // Future reports (Coming Soon)
  { slug: 'trial-balance', title: 'Trial Balance', description: 'Full chart of accounts with debit/credit balances', category: 'core', isAvailable: false },
  { slug: 'general-ledger-detail', title: 'General Ledger Detail', description: 'Transaction-level detail by account and date range', category: 'core', isAvailable: false },
  { slug: 'donor-contribution-summary', title: 'Donor Contribution Summary', description: 'Donations by donor for acknowledgement letters and 990', category: 'fund', isAvailable: false },
  { slug: 'pledge-fulfillment', title: 'Pledge Fulfillment', description: 'Pledge status, expected vs received, aging', category: 'fund', isAvailable: false },
  { slug: 'vendor-1099-report', title: 'Vendor 1099 Report', description: '1099-eligible vendor payments for tax filing', category: 'specialized', isAvailable: false },
  { slug: 'payroll-summary', title: 'Payroll Summary', description: 'Payroll costs by employee, functional allocation, employer taxes', category: 'specialized', isAvailable: false },
]

export const CATEGORY_LABELS: Record<string, string> = {
  core: 'Core Financial Statements',
  operational: 'Operational Dashboards',
  fund: 'Fund & Funding Reports',
  specialized: 'Specialized Reports',
  compliance: 'Compliance & Tax',
  payroll: 'Payroll Reports',
}
