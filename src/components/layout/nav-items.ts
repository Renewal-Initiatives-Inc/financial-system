import {
  LayoutDashboard,
  TrendingUp,
  Receipt,
  Landmark,
  Wallet,
  Building2,
  Heart,
  ArrowLeftRight,
  Users,
  Scale,
  ShieldCheck,
  FileText,
  PieChart,
  ListTree,
  Clock,
  Database,
  Settings,
  SlidersHorizontal,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export const navSections: NavSection[] = [
  {
    items: [
      { label: 'Dashboard', href: '/', icon: LayoutDashboard },
      { label: 'Revenue', href: '/revenue', icon: TrendingUp },
      { label: 'Expenses', href: '/expenses', icon: Receipt },
      { label: 'Assets', href: '/assets', icon: Landmark },
      { label: 'Liabilities', href: '/liabilities', icon: Wallet },
      { label: 'Vendors', href: '/vendors', icon: Building2 },
      { label: 'Donors', href: '/donors', icon: Heart },
    ],
  },
  {
    label: 'Workflows',
    items: [
      { label: 'Match Transactions', href: '/match-transactions', icon: ArrowLeftRight },
      { label: 'Run Payroll', href: '/payroll', icon: Users },
      { label: 'Run Bank Reconcile', href: '/bank-rec', icon: Scale },
      { label: 'Compliance', href: '/compliance', icon: ShieldCheck },
    ],
  },
  {
    label: 'Plans',
    items: [
      { label: 'Reports', href: '/reports', icon: FileText },
      { label: 'Budgets', href: '/budgets', icon: PieChart },
    ],
  },
  {
    label: 'Settings',
    items: [
      { label: 'Chart of Accounts', href: '/accounts', icon: ListTree },
      { label: 'Timesheets & ERs', href: '/settings/staging', icon: Database },
      { label: 'Annual Rates', href: '/settings/rates', icon: Settings },
      { label: 'Allocations', href: '/compliance/functional-allocation', icon: SlidersHorizontal },
      { label: 'Data Retention', href: '/settings/data-retention', icon: Clock },
    ],
  },
]

// Flat list for backward compatibility
export const navItems: NavItem[] = navSections.flatMap((s) => s.items)
