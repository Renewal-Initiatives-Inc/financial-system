import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { COPILOT_CONFIG } from '@/lib/copilot/config'
import { loadKnowledge } from '@/lib/copilot/knowledge'
import { executeTool } from '@/lib/copilot/tool-executor'
import type { CopilotRequest, CopilotStreamEvent, CopilotToolCall } from '@/lib/copilot/types'
import type { Tool, MessageParam, ContentBlockParam } from '@anthropic-ai/sdk/resources/messages'

const client = new Anthropic()

export async function POST(request: Request): Promise<Response> {
  // Auth check
  const session = await auth()
  if (!session?.user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let body: CopilotRequest
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid request body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const { messages, context } = body

  // Build system prompt
  const knowledgeText = loadKnowledge(context.knowledge)
  const dataContext = Object.keys(context.data).length > 0
    ? `\n\nCurrent page data:\n${JSON.stringify(context.data, null, 2)}`
    : ''

  const systemPrompt = [
    COPILOT_CONFIG.systemPromptPrefix,
    `\nCurrent page: ${context.pageDescription}`,
    dataContext,
    knowledgeText ? `\n\nReference knowledge:\n${knowledgeText}` : '',
  ].join('')

  // Build Anthropic tools from context
  const tools: Tool[] = context.tools.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Tool['input_schema'],
  }))

  // Convert messages to Anthropic format
  const anthropicMessages: MessageParam[] = messages.map((m) => ({
    role: m.role,
    content: m.content,
  }))

  // Stream the response with tool execution loop
  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      function send(event: CopilotStreamEvent) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
      }

      try {
        let currentMessages = [...anthropicMessages]
        let toolCallCount = 0
        const allToolCalls: CopilotToolCall[] = []
        let finalContent = ''

        // Tool execution loop
        while (toolCallCount < COPILOT_CONFIG.maxToolCalls) {
          const response = await client.messages.create({
            model: COPILOT_CONFIG.model,
            max_tokens: COPILOT_CONFIG.maxTokens,
            system: systemPrompt,
            messages: currentMessages,
            tools: tools.length > 0 ? tools : undefined,
            stream: true,
          })

          let currentText = ''
          let hasToolUse = false
          const toolUseBlocks: Array<{ id: string; name: string; input: Record<string, unknown> }> = []
          let currentToolId = ''
          let currentToolName = ''
          let currentToolInput = ''

          for await (const event of response) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'text') {
                // Text block starting
              } else if (event.content_block.type === 'tool_use') {
                hasToolUse = true
                currentToolId = event.content_block.id
                currentToolName = event.content_block.name
                currentToolInput = ''
                send({ type: 'tool_start', name: currentToolName })
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                currentText += event.delta.text
                send({ type: 'text', content: event.delta.text })
              } else if (event.delta.type === 'input_json_delta') {
                currentToolInput += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop') {
              if (currentToolId && currentToolName) {
                let parsedInput: Record<string, unknown> = {}
                try {
                  parsedInput = currentToolInput ? JSON.parse(currentToolInput) : {}
                } catch {
                  parsedInput = {}
                }
                toolUseBlocks.push({
                  id: currentToolId,
                  name: currentToolName,
                  input: parsedInput,
                })
                currentToolId = ''
                currentToolName = ''
                currentToolInput = ''
              }
            }
          }

          finalContent += currentText

          if (!hasToolUse || toolUseBlocks.length === 0) {
            // No tool calls — we're done
            break
          }

          // Execute tools and continue
          // Build assistant message content
          const assistantContent: ContentBlockParam[] = []
          if (currentText) {
            assistantContent.push({ type: 'text', text: currentText })
          }
          for (const tool of toolUseBlocks) {
            assistantContent.push({
              type: 'tool_use',
              id: tool.id,
              name: tool.name,
              input: tool.input,
            })
          }

          // Add assistant message
          currentMessages.push({ role: 'assistant', content: assistantContent })

          // Execute each tool and build tool_result messages
          const toolResults: ContentBlockParam[] = []
          for (const tool of toolUseBlocks) {
            const result = await executeTool(tool.name, tool.input)
            allToolCalls.push({
              name: tool.name,
              input: tool.input,
              result,
            })
            send({ type: 'tool_result', name: tool.name, result })
            toolResults.push({
              type: 'tool_result',
              tool_use_id: tool.id,
              content: JSON.stringify(result),
            })
            toolCallCount++
          }

          // Add tool results as user message
          currentMessages.push({ role: 'user', content: toolResults })
        }

        send({
          type: 'done',
          content: finalContent,
          toolCalls: allToolCalls.length > 0 ? allToolCalls : undefined,
        })
      } catch (error) {
        console.error('Copilot API error:', error)
        send({
          type: 'error',
          message: error instanceof Error ? error.message : 'An error occurred',
        })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
