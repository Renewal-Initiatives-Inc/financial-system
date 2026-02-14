'use client'

import { createContext, useContext, useState, useCallback, type ReactNode } from 'react'
import type { CopilotContextPackage } from '@/lib/copilot/types'
import { getContextForPage } from '@/lib/copilot/contexts'
import { useCopilot } from './use-copilot'
import { CopilotPanel } from './copilot-panel'
import { CopilotToggle } from './copilot-toggle'

interface CopilotContextValue {
  isOpen: boolean
  open: () => void
  close: () => void
  setPageContext: (pageId: string, data?: Record<string, unknown>) => void
}

const CopilotContext = createContext<CopilotContextValue>({
  isOpen: false,
  open: () => {},
  close: () => {},
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

  const open = useCallback(() => setIsOpen(true), [])
  const close = useCallback(() => setIsOpen(false), [])

  const setPageContext = useCallback(
    (pageId: string, data?: Record<string, unknown>) => {
      setContext(getContextForPage(pageId, data))
    },
    []
  )

  return (
    <CopilotContext.Provider value={{ isOpen, open, close, setPageContext }}>
      <div className="flex h-full">
        <div className="flex-1 overflow-auto">{children}</div>
        <CopilotPanel
          isOpen={isOpen}
          onClose={close}
          messages={messages}
          isStreaming={isStreaming}
          error={error}
          onSendMessage={sendMessage}
          onClearChat={clearChat}
        />
      </div>
      <CopilotToggle isOpen={isOpen} onClick={open} />
    </CopilotContext.Provider>
  )
}
