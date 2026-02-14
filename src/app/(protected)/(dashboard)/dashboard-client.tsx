'use client'

import { CopilotContextSetter } from '@/components/copilot/copilot-context-setter'

export function DashboardClient() {
  return (
    <div>
      <CopilotContextSetter pageId="dashboard" />
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
      <p className="text-muted-foreground mt-2">Dashboard overview will be built in Phase 17.</p>
    </div>
  )
}
