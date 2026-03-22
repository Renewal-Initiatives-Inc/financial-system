'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import type { CopilotContextPackage, CopilotMessage, CopilotStreamEvent, CopilotToolCall } from '@/lib/copilot/types'
import { loadConversation, saveConversation, clearConversation } from '@/lib/copilot/storage'

interface UseCopilotOptions {
  context: CopilotContextPackage
  userId: string
}

interface UseCopilotReturn {
  messages: CopilotMessage[]
  isStreaming: boolean
  activeToolName: string | null
  error: string | null
  sendMessage: (text: string) => void
  clearChat: () => void
}

export function useCopilot({ context, userId }: UseCopilotOptions): UseCopilotReturn {
  const [messages, setMessages] = useState<CopilotMessage[]>(() =>
    loadConversation(userId, context.pageId)
  )
  const [isStreaming, setIsStreaming] = useState(false)
  const [activeToolName, setActiveToolName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Persist messages on change
  useEffect(() => {
    if (messages.length > 0) {
      saveConversation(userId, context.pageId, messages)
    }
  }, [messages, userId, context.pageId])

  const sendMessage = useCallback(
    async (text: string) => {
      if (isStreaming || !text.trim()) return

      setError(null)
      setIsStreaming(true)

      const userMessage: CopilotMessage = { role: 'user', content: text.trim() }
      const newMessages = [...messages, userMessage]
      setMessages(newMessages)

      // Create abort controller
      abortRef.current = new AbortController()

      try {
        const response = await fetch('/api/copilot', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: newMessages,
            context,
          }),
          signal: abortRef.current.signal,
        })

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}))
          throw new Error(errorData.error || `HTTP ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) throw new Error('No response stream')

        const decoder = new TextDecoder()
        let assistantContent = ''
        const toolCalls: CopilotToolCall[] = []
        let buffer = ''

        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })

          // Process SSE events
          const lines = buffer.split('\n')
          buffer = lines.pop() || '' // Keep incomplete line in buffer

          for (const line of lines) {
            if (!line.startsWith('data: ')) continue
            const data = line.slice(6)
            if (!data) continue

            try {
              const event: CopilotStreamEvent = JSON.parse(data)

              switch (event.type) {
                case 'text':
                  assistantContent += event.content
                  // Update the last assistant message with streaming content
                  setMessages((prev) => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        ...updated[lastIdx],
                        content: assistantContent,
                      }
                    } else {
                      updated.push({
                        role: 'assistant',
                        content: assistantContent,
                      })
                    }
                    return updated
                  })
                  break

                case 'tool_start':
                  setActiveToolName(event.name)
                  break

                case 'tool_result':
                  setActiveToolName(null)
                  toolCalls.push({
                    name: event.name,
                    input: {},
                    result: event.result,
                  })
                  break

                case 'done':
                  // Final update with complete content and tool calls
                  setMessages((prev) => {
                    const updated = [...prev]
                    const lastIdx = updated.length - 1
                    if (lastIdx >= 0 && updated[lastIdx].role === 'assistant') {
                      updated[lastIdx] = {
                        role: 'assistant',
                        content: event.content || assistantContent,
                        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
                      }
                    }
                    return updated
                  })
                  break

                case 'error':
                  setError(event.message)
                  break
              }
            } catch {
              // Skip malformed SSE events
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          // Request was aborted — not an error
        } else {
          setError(err instanceof Error ? err.message : 'An error occurred')
          // Remove the pending assistant message on error
          setMessages((prev) => {
            if (prev.length > 0 && prev[prev.length - 1].role === 'assistant' && !prev[prev.length - 1].content) {
              return prev.slice(0, -1)
            }
            return prev
          })
        }
      } finally {
        setIsStreaming(false)
        setActiveToolName(null)
        abortRef.current = null
      }
    },
    [messages, context, isStreaming]
  )

  const clearChat = useCallback(() => {
    if (abortRef.current) {
      abortRef.current.abort()
    }
    setMessages([])
    setError(null)
    setIsStreaming(false)
    clearConversation(userId, context.pageId)
  }, [userId, context.pageId])

  return { messages, isStreaming, activeToolName, error, sendMessage, clearChat }
}
