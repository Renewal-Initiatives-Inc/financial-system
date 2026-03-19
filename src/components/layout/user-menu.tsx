'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ExternalLink, LogOut } from 'lucide-react'
import { signOut } from 'next-auth/react'

interface UserMenuProps {
  user: {
    name: string
    email: string
    image?: string
  }
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function UserMenu({ user }: UserMenuProps) {
  const portalUrl = process.env.NEXT_PUBLIC_APP_PORTAL_URL

  return (
    <DropdownMenu>
      <DropdownMenuTrigger data-testid="user-menu-trigger" className="focus:outline-none">
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.image} alt={user.name} />
          <AvatarFallback className="text-xs font-bold text-white" style={{ backgroundColor: '#2c5530' }}>{getInitials(user.name)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col gap-1">
            <p data-testid="user-menu-name" className="text-sm font-medium">
              {user.name}
            </p>
            <p data-testid="user-menu-email" className="text-xs text-muted-foreground">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {portalUrl && (
          <DropdownMenuItem data-testid="user-menu-portal-link" asChild>
            <a href={portalUrl} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="mr-2 h-4 w-4" />
              Back to App Portal
            </a>
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          data-testid="user-menu-signout"
          onClick={() => signOut({ callbackUrl: '/login' })}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
