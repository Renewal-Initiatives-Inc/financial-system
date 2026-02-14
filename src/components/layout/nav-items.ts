import {
  LayoutDashboard,
  BookOpen,
  ListTree,
  Wallet,
  TrendingUp,
  Receipt,
  CreditCard,
  Users,
  Scale,
  FileText,
  PieChart,
  ShieldCheck,
  Building2,
  Home,
  Heart,
  Landmark,
  Settings,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
  indent?: boolean
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: BookOpen },
  { label: 'Chart of Accounts', href: '/accounts', icon: ListTree },
  { label: 'Funds', href: '/funds', icon: Wallet },
  { label: 'Revenue', href: '/revenue', icon: TrendingUp },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Ramp Credit Card', href: '/expenses/ramp', icon: CreditCard, indent: true },
  { label: 'Payroll', href: '/payroll', icon: Users },
  { label: 'New Run', href: '/payroll/runs/new', icon: Users, indent: true },
  { label: 'Bank Rec', href: '/bank-rec', icon: Scale },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Budgets', href: '/budgets', icon: PieChart },
  { label: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { label: 'Vendors', href: '/vendors', icon: Building2 },
  { label: 'Tenants', href: '/tenants', icon: Home },
  { label: 'Donors', href: '/donors', icon: Heart },
  { label: 'Assets', href: '/assets', icon: Landmark },
  { label: 'CIP Balances', href: '/assets/cip', icon: Landmark, indent: true },
  { label: 'Developer Fee', href: '/assets/developer-fee', icon: Landmark, indent: true },
  { label: 'Prepaid Expenses', href: '/assets/prepaid', icon: Landmark, indent: true },
  { label: 'Settings', href: '/settings', icon: Settings },
  { label: 'Annual Rates', href: '/settings/rates', icon: Settings, indent: true },
]
