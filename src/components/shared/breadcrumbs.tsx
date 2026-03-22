'use client'

import { usePathname } from 'next/navigation'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { Fragment } from 'react'

const ROUTE_NAMES: Record<string, string> = {
  '': 'Dashboard',
  transactions: 'Transactions',
  accounts: 'Chart of Accounts',
  revenue: 'Revenue',
  expenses: 'Expenses',
  payroll: 'Payroll',
  'bank-rec': 'Bank Reconciliation',
  reports: 'Reports',
  budgets: 'Budgets',
  compliance: 'Compliance',
  vendors: 'Vendors',
  tenants: 'Tenants',
  donors: 'Donors',
  assets: 'Assets',
  liabilities: 'Liabilities',
  'match-transactions': 'Match Transactions',
  settings: 'Settings',
  // Expenses sub-routes
  'purchase-orders': 'Purchase Orders',
  payables: 'Payables',
  ramp: 'Ramp',
  rules: 'Rules',
  invoices: 'Invoices',
  // Revenue sub-routes
  'funding-sources': 'Funding Sources',
  donations: 'Donations',
  'earned-income': 'Earned Income',
  'in-kind': 'In-Kind Donations',
  'investment-income': 'Investment Income',
  pledges: 'Pledges',
  rent: 'Rent',
  adjustment: 'Adjustment',
  payment: 'Payment',
  // Liabilities sub-routes
  loans: 'Notes Payable / Loans',
  accrued: 'Accrued Liabilities',
  'deferred-revenue': 'Deferred Revenue',
  'security-deposits': 'Security Deposits',
  // Assets sub-routes
  fixed: 'Fixed Assets',
  cip: 'Construction in Progress',
  convert: 'Convert',
  prepaid: 'Prepaid Expenses',
  'developer-fee': 'Developer Fee',
  // Compliance sub-routes
  '1099-prep': '1099 Prep',
  '990-readiness': '990 Readiness',
  'functional-allocation': 'Functional Allocation',
  // Budgets sub-routes
  'cash-projection': 'Cash Projection',
  // Payroll sub-routes
  runs: 'Payroll Runs',
  // Reports (common)
  'balance-sheet': 'Balance Sheet',
  activities: 'Income Statement',
  'cash-flows': 'Cash Flows',
  'cash-position': 'Cash Position',
  'functional-expenses': 'Functional Expenses',
  'fund-level': 'Fund Level',
  'fund-drawdown': 'Fund Drawdown',
  'ar-aging': 'AR Aging',
  'donor-giving-history': 'Donor Giving History',
  'property-expenses': 'Property Expenses',
  'outstanding-payables': 'Outstanding Payables',
  'payroll-register': 'Payroll Register',
  'payroll-tax-liability': 'Payroll Tax Liability',
  'employer-payroll-cost': 'Employer Payroll Cost',
  'quarterly-tax-prep': 'Quarterly Tax Prep',
  'w2-verification': 'W-2 Verification',
  'audit-log': 'Audit Log',
  'late-entries': 'Late Entries',
  'transaction-history': 'Transaction History',
  'utility-trends': 'Utility Trends',
  'rent-collection': 'Rent Collection',
  'security-deposit-register': 'Security Deposit Register',
  'board-pack': 'Board Pack',
  'form-990-data': 'Form 990 Data',
  'capital-budget': 'Capital Budget',
  // Accounts sub-routes
  'close-books': 'Close the Books',
  // Settings sub-routes
  rates: 'Rates',
  staging: 'Staging',
  // Generic
  new: 'New',
  edit: 'Edit',
}

export function Breadcrumbs() {
  const pathname = usePathname()
  const segments = pathname.split('/').filter(Boolean)

  if (segments.length === 0) {
    return (
      <Breadcrumb data-testid="breadcrumbs">
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbPage>Dashboard</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    )
  }

  return (
    <Breadcrumb data-testid="breadcrumbs">
      <BreadcrumbList>
        <BreadcrumbItem>
          <BreadcrumbLink href="/">Dashboard</BreadcrumbLink>
        </BreadcrumbItem>
        {segments.map((segment, index) => {
          const href = '/' + segments.slice(0, index + 1).join('/')
          const isLast = index === segments.length - 1
          const displayName = ROUTE_NAMES[segment] || segment

          return (
            <Fragment key={href}>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{displayName}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={href}>{displayName}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
