'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { navSections } from './nav-items'
import { Landmark } from 'lucide-react'

export function AppSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar data-testid="app-sidebar">
      <SidebarHeader className="px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Landmark className="h-6 w-6 text-primary" />
          <span className="text-lg font-semibold">Financial System</span>
        </Link>
      </SidebarHeader>
      <SidebarContent>
        {navSections.map((section, sectionIndex) => (
          <SidebarGroup key={sectionIndex}>
            {section.label && (
              <SidebarGroupLabel>{section.label}</SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {section.items.map((item) => {
                  const isActive =
                    item.href === '/'
                      ? pathname === '/'
                      : pathname.startsWith(item.href)

                  return (
                    <SidebarMenuItem key={item.href}>
                      <SidebarMenuButton asChild isActive={isActive}>
                        <Link
                          href={item.href}
                          data-testid={`sidebar-nav-${item.href.replace(/\//g, '-').replace(/^-/, '') || 'dashboard'}`}
                        >
                          <item.icon className="h-4 w-4" />
                          <span>{item.label}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
