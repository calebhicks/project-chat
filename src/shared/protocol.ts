/**
 * Shared protocol types for project-chat SSE streaming.
 *
 * Used by both the server (to emit events) and the client (to parse them).
 */

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export interface PageContext {
  url: string
  pathname: string
  title: string
  referrer?: string
}

export interface PageContent {
  headings?: string[]
  text?: string
  codeBlocks?: string[]
}

export interface ChatRequest {
  message: string
  sessionId?: string
  context?: {
    page?: PageContext
    pageContent?: PageContent
    metadata?: Record<string, unknown>
  }
}

// ---------------------------------------------------------------------------
// Server → Client (SSE events)
// ---------------------------------------------------------------------------

export type ChatEvent =
  | { event: 'session'; data: { sessionId: string } }
  | { event: 'content_delta'; data: { text: string } }
  | { event: 'tool_use_start'; data: { id: string; tool: string; input?: unknown } }
  | { event: 'tool_use_end'; data: { id: string; tool: string } }
  | { event: 'thinking_start'; data: Record<string, never> }
  | { event: 'thinking_end'; data: Record<string, never> }
  | { event: 'message_end'; data: { id: string } }
  | { event: 'done'; data: { sessionId: string } }
  | { event: 'error'; data: { message: string; code?: string } }

// ---------------------------------------------------------------------------
// Chat message (used by both sides for history)
// ---------------------------------------------------------------------------

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: number
  toolUses?: ToolUseRecord[]
}

export interface ToolUseRecord {
  id: string
  tool: string
  status: 'running' | 'complete'
}

// ---------------------------------------------------------------------------
// SSE serialization helpers
// ---------------------------------------------------------------------------

export function serializeSSE(event: ChatEvent): string {
  return `event: ${event.event}\ndata: ${JSON.stringify(event.data)}\n\n`
}

export function parseSSELine(line: string): { field: string; value: string } | null {
  const colonIdx = line.indexOf(':')
  if (colonIdx === -1) return null
  const field = line.slice(0, colonIdx).trim()
  const value = line.slice(colonIdx + 1).trim()
  return { field, value }
}
