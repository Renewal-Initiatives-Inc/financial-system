import {
  LayoutDashboard,
  BookOpen,
  ListTree,
  Wallet,
  TrendingUp,
  Receipt,
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
}

export const navItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Transactions', href: '/transactions', icon: BookOpen },
  { label: 'Chart of Accounts', href: '/accounts', icon: ListTree },
  { label: 'Funds', href: '/funds', icon: Wallet },
  { label: 'Revenue', href: '/revenue', icon: TrendingUp },
  { label: 'Expenses', href: '/expenses', icon: Receipt },
  { label: 'Payroll', href: '/payroll', icon: Users },
  { label: 'Bank Rec', href: '/bank-rec', icon: Scale },
  { label: 'Reports', href: '/reports', icon: FileText },
  { label: 'Budgets', href: '/budgets', icon: PieChart },
  { label: 'Compliance', href: '/compliance', icon: ShieldCheck },
  { label: 'Vendors', href: '/vendors', icon: Building2 },
  { label: 'Tenants', href: '/tenants', icon: Home },
  { label: 'Donors', href: '/donors', icon: Heart },
  { label: 'Assets', href: '/assets', icon: Landmark },
  { label: 'Settings', href: '/settings', icon: Settings },
]
