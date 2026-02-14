'use client'

import { type ReactNode } from 'react'
import { CopilotProvider } from './copilot-provider'

interface CopilotWrapperProps {
  children: ReactNode
  userId: string
}

/**
 * Client component wrapper for the CopilotProvider.
 * Used in the server-rendered protected layout to bridge the server/client boundary.
 */
export function CopilotWrapper({ children, userId }: CopilotWrapperProps) {
  return (
    <CopilotProvider userId={userId}>
      {children}
    </CopilotProvider>
  )
}
