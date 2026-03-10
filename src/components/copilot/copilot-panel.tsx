'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { X, MessageSquarePlus, Send, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { CopilotMessage } from './copilot-message'
import type { CopilotMessage as CopilotMessageType } from '@/lib/copilot/types'

interface CopilotPanelProps {
  open: boolean
  onClose: () => void
  messages: CopilotMessageType[]
  isStreaming: boolean
  error: string | null
  onSendMessage: (text: string) => void
  onClearChat: () => void
  workflowContent?: React.ReactNode
  defaultTab?: 'chat' | 'workflow'
}

export function CopilotPanel({
  open,
  onClose,
  messages,
  isStreaming,
  error,
  onSendMessage,
  onClearChat,
  workflowContent,
  defaultTab = 'chat',
}: CopilotPanelProps) {
  const [input, setInput] = useState('')
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll to bottom (use scrollTo on container to avoid scrollIntoView
  // propagating scroll to ancestor elements with overflow:hidden)
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' })
    }
  }, [messages])

  // Focus input when panel opens
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSend = useCallback(() => {
    if (!input.trim() || isStreaming) return
    onSendMessage(input)
    setInput('')
  }, [input, isStreaming, onSendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        handleSend()
      }
    },
    [handleSend]
  )

  if (!open) return null

  return (
    <div
      className="bg-background border-l flex flex-col shadow-lg fixed top-0 right-0 z-40 h-svh w-[400px]"
      data-testid="copilot-panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <h2 className="text-sm font-semibold">
          {workflowContent ? 'Compliance Assistant' : 'AI Assistant'}
        </h2>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClearChat}
            title="New Chat"
            data-testid="copilot-new-chat"
          >
            <MessageSquarePlus className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={onClose}
            title="Close"
            data-testid="copilot-close"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {workflowContent ? (
        <Tabs defaultValue={defaultTab} className="flex flex-col flex-1 min-h-0">
          <div className="border-b px-4 pt-1">
            <TabsList className="w-full">
              <TabsTrigger
                value="chat"
                className="flex-1"
                data-testid="copilot-tab-chat"
              >
                Chat
              </TabsTrigger>
              <TabsTrigger
                value="workflow"
                className="flex-1"
                data-testid="copilot-tab-workflow"
              >
                Workflow
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="chat" className="flex flex-col flex-1 min-h-0 mt-0">
            {/* Disclaimer */}
            <div className="bg-muted/50 border-b px-4 py-1.5">
              <p className="text-muted-foreground text-[10px]">
                AI responses are for reference only. Always verify tax and compliance advice with a qualified CPA.
              </p>
            </div>
            {/* Messages */}
            <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
              {messages.length === 0 && (
                <div className="text-muted-foreground flex flex-col items-center justify-center pt-12 text-center text-sm">
                  <MessageSquarePlus className="mb-3 h-8 w-8 opacity-50" />
                  <p>Ask me about accounting, tax law, or your financial data.</p>
                </div>
              )}
              {messages.map((msg, i) => (
                <CopilotMessage key={i} message={msg} />
              ))}
              {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex items-center gap-2">
                  <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                  <span className="text-muted-foreground text-sm">Thinking...</span>
                </div>
              )}
            </div>
            {/* Error */}
            {error && (
              <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-red-500">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="truncate">{error}</span>
              </div>
            )}
            {/* Input */}
            <div className="border-t px-4 py-3">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask a question..."
                  disabled={isStreaming}
                  rows={1}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                  data-testid="copilot-input"
                />
                <Button
                  size="icon"
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  data-testid="copilot-send"
                >
                  {isStreaming ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                </Button>
              </div>
              <p className="text-muted-foreground mt-1 text-[10px]">
                Enter to send, Shift+Enter for new line
              </p>
            </div>
          </TabsContent>

          <TabsContent value="workflow" className="flex-1 overflow-y-auto px-4 py-4 mt-0">
            {workflowContent}
          </TabsContent>
        </Tabs>
      ) : (
        <>
          {/* Disclaimer */}
          <div className="bg-muted/50 border-b px-4 py-1.5">
            <p className="text-muted-foreground text-[10px]">
              AI responses are for reference only. Always verify tax and compliance advice with a qualified CPA.
            </p>
          </div>

          {/* Messages */}
          <div ref={messagesContainerRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="text-muted-foreground flex flex-col items-center justify-center pt-12 text-center text-sm">
                <MessageSquarePlus className="mb-3 h-8 w-8 opacity-50" />
                <p>Ask me about accounting, tax law, or your financial data.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <CopilotMessage key={i} message={msg} />
            ))}
            {isStreaming && messages[messages.length - 1]?.role !== 'assistant' && (
              <div className="flex items-center gap-2">
                <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
                <span className="text-muted-foreground text-sm">Thinking...</span>
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 border-t px-4 py-2 text-sm text-red-500">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span className="truncate">{error}</span>
            </div>
          )}

          {/* Input */}
          <div className="border-t px-4 py-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask a question..."
                disabled={isStreaming}
                rows={1}
                className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex-1 resize-none rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:opacity-50"
                data-testid="copilot-input"
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                data-testid="copilot-send"
              >
                {isStreaming ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </div>
            <p className="text-muted-foreground mt-1 text-[10px]">
              Enter to send, Shift+Enter for new line
            </p>
          </div>
        </>
      )}
    </div>
  )
}
