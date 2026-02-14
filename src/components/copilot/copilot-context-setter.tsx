'use client'

import { useEffect } from 'react'
import { useCopilotContext } from './copilot-provider'

interface CopilotContextSetterProps {
  pageId: string
  data?: Record<string, unknown>
}

/**
 * Client component that sets the copilot context when mounted.
 * Drop this into any page to configure the copilot for that page.
 */
export function CopilotContextSetter({ pageId, data }: CopilotContextSetterProps) {
  const { setPageContext } = useCopilotContext()

  useEffect(() => {
    setPageContext(pageId, data)
  }, [pageId, data, setPageContext])

  return null
}
