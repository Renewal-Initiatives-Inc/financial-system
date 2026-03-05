'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { CopilotContextPackage } from '@/lib/copilot/types'
import { getContextForPage } from '@/lib/copilot/contexts'
import { useCopilot } from './use-copilot'
import { CopilotPanel } from './copilot-panel'
import { CopilotToggle } from './copilot-toggle'

interface CopilotContextValue {
  open: boolean
  openPanel: () => void
  closePanel: () => void
  setPageContext: (pageId: string, data?: Record<string, unknown>) => void
}

const CopilotContext = createContext<CopilotContextValue>({
  open: false,
  openPanel: () => {},
  closePanel: () => {},
  setPageContext: () => {},
})

export function useCopilotContext() {
  return useContext(CopilotContext)
}

interface CopilotProviderProps {
  children: ReactNode
  userId: string
  initialPageId?: string
}

export function CopilotProvider({
  children,
  userId,
  initialPageId = 'dashboard',
}: CopilotProviderProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [context, setContext] = useState<CopilotContextPackage>(() =>
    getContextForPage(initialPageId)
  )

  const { messages, isStreaming, error, sendMessage, clearChat } = useCopilot({
    context,
    userId,
  })

  const openPanel = useCallback(() => setIsOpen(true), [])
  const closePanel = useCallback(() => setIsOpen(false), [])

  const setPageContext = useCallback(
    (pageId: string, data?: Record<string, unknown>) => {
      setContext(getContextForPage(pageId, data))
    },
    []
  )

  return (
    <CopilotContext.Provider value={{ open: isOpen, openPanel, closePanel, setPageContext }}>
      {children}
      <CopilotPanel
        open={isOpen}
        onClose={closePanel}
        messages={messages}
        isStreaming={isStreaming}
        error={error}
        onSendMessage={sendMessage}
        onClearChat={clearChat}
      />
      <CopilotToggle open={isOpen} onClick={openPanel} />
    </CopilotContext.Provider>
  )
}
