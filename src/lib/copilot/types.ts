/** Context package shape — each page exports one */
export interface CopilotContextPackage {
  pageId: string
  pageDescription: string
  data: Record<string, unknown>
  tools: CopilotToolDefinition[]
  knowledge: string[]
}

/** Tool definition for Anthropic tool_use */
export interface CopilotToolDefinition {
  name: string
  description: string
  input_schema: Record<string, unknown>
}

/** Chat message types */
export interface CopilotMessage {
  role: 'user' | 'assistant'
  content: string
  toolCalls?: CopilotToolCall[]
}

export interface CopilotToolCall {
  name: string
  input: Record<string, unknown>
  result: unknown
}

/** API request/response shapes */
export interface CopilotRequest {
  messages: CopilotMessage[]
  context: CopilotContextPackage
}

export interface CopilotResponse {
  content: string
  toolCalls?: CopilotToolCall[]
}

/** Streaming event types sent via SSE */
export type CopilotStreamEvent =
  | { type: 'text'; content: string }
  | { type: 'tool_start'; name: string }
  | { type: 'tool_result'; name: string; result: unknown }
  | { type: 'done'; content: string; toolCalls?: CopilotToolCall[] }
  | { type: 'error'; message: string }
