import { SidebarTrigger } from '@/components/ui/sidebar'
import { Separator } from '@/components/ui/separator'
import { Breadcrumbs } from '@/components/shared/breadcrumbs'
import { UserMenu } from './user-menu'

interface AppTopBarProps {
  user: {
    name: string
    email: string
    image?: string
  }
}

export function AppTopBar({ user }: AppTopBarProps) {
  return (
    <header className="flex h-14 items-center gap-2 border-b px-4">
      <SidebarTrigger data-testid="sidebar-trigger" />
      <Separator orientation="vertical" className="h-4" />
      <Breadcrumbs />
      <div className="ml-auto">
        <UserMenu user={user} />
      </div>
    </header>
  )
}
