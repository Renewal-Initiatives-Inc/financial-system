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
  funds: 'Funds',
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
  settings: 'Settings',
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
