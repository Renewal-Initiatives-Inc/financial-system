import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { AppSidebar } from '@/components/layout/app-sidebar'
import { AppTopBar } from '@/components/layout/app-top-bar'
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar'
import { ReactNode } from 'react'

export default async function ProtectedLayout({ children }: { children: ReactNode }) {
  const session = await auth()
  if (!session?.user) redirect('/login')

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <AppTopBar user={session.user} />
        <main className="flex-1 px-4 py-6 md:px-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}
