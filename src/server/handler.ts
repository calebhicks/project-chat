/**
 * Core handler that wraps the Claude Agent SDK query() function.
 *
 * Framework-agnostic: returns an async generator of ChatEvents.
 * Framework adapters (nextjs.ts, express.ts, hono.ts) pipe this into SSE responses.
 */

import { query } from '@anthropic-ai/claude-agent-sdk'
import type { ChatRequest, ChatEvent } from '../shared/protocol.js'
import { MemorySessionStore, type SessionStore, type SessionData } from './session-store.js'

export interface McpServerConfig {
  command?: string
  args?: string[]
  type?: 'stdio' | 'http' | 'sse' | 'sdk'
  url?: string
  instance?: unknown
  env?: Record<string, string>
}

export interface HandlerConfig {
  /** System prompt for the agent. Describe the project and how the agent should help. */
  systemPrompt?: string

  /** Claude model to use. Defaults to claude-sonnet-4-5-20250514. */
  model?: string

  /** Tools the agent can use. Defaults to read-only: ['Read', 'Glob', 'Grep']. */
  allowedTools?: string[]

  /** MCP servers the agent has access to. This is where project context goes. */
  mcpServers?: Record<string, McpServerConfig>

  /** Max spend per request in USD. Defaults to 0.25. */
  maxBudgetUsd?: number

  /** Max agent turns per request. Defaults to 10. */
  maxTurns?: number

  /** Session store implementation. Defaults to in-memory. */
  sessionStore?: SessionStore

  /** Max input message length. Defaults to 4000 characters. */
  maxInputLength?: number

  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string

  /** Called when a message stream starts. */
  onMessageStart?: (sessionId: string) => void

  /** Called when a message stream ends. */
  onMessageEnd?: (sessionId: string) => void

  /** Called on error. */
  onError?: (error: Error, sessionId?: string) => void
}

export interface AgentChatHandler {
  /** Stream a response to a chat message. Returns an async generator of SSE events. */
  handleMessage(req: ChatRequest): AsyncGenerator<ChatEvent>
}

export function createHandler(config: HandlerConfig): AgentChatHandler {
  const {
    systemPrompt = 'You are a helpful assistant for this project. Answer questions using the tools available to you.',
    model = 'claude-sonnet-4-5-20250514',
    allowedTools = ['Read', 'Glob', 'Grep'],
    mcpServers = {},
    maxBudgetUsd = 0.25,
    maxTurns = 10,
    maxInputLength = 4000,
    onMessageStart,
    onMessageEnd,
    onError,
  } = config

  const sessionStore = config.sessionStore ?? new MemorySessionStore()

  return {
    async *handleMessage(req: ChatRequest): AsyncGenerator<ChatEvent> {
      // Validate input
      if (!req.message || typeof req.message !== 'string') {
        yield { event: 'error', data: { message: 'Message is required', code: 'INVALID_INPUT' } }
        return
      }
      if (req.message.length > maxInputLength) {
        yield { event: 'error', data: { message: `Message exceeds ${maxInputLength} characters`, code: 'INPUT_TOO_LONG' } }
        return
      }

      // Resolve or create session
      const clientSessionId = req.sessionId ?? crypto.randomUUID()
      let session = await sessionStore.get(clientSessionId)

      if (!session) {
        session = {
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 0,
        }
      }

      session.lastActiveAt = Date.now()
      session.messageCount++
      await sessionStore.set(clientSessionId, session)

      onMessageStart?.(clientSessionId)

      // Build the prompt — include page context if provided
      let prompt = req.message
      if (req.context?.page) {
        const { url, title, pathname } = req.context.page
        prompt = `[User is on page: ${title} (${pathname})]\n\n${req.message}`
      }

      try {
        // Build query options
        const queryOptions: Record<string, unknown> = {
          model,
          allowedTools,
          maxTurns,
          maxBudgetUsd,
          includePartialMessages: true,
          permissionMode: 'bypassPermissions',
          systemPrompt: {
            type: 'preset',
            preset: 'claude_code',
            append: systemPrompt,
          },
        }

        // Add MCP servers if any are configured
        if (Object.keys(mcpServers).length > 0) {
          queryOptions.mcpServers = mcpServers
        }

        // Resume session if we have a prior SDK session ID
        if (session.sdkSessionId) {
          queryOptions.resume = session.sdkSessionId
        }

        // Emit session ID to client immediately
        yield { event: 'session', data: { sessionId: clientSessionId } }

        // Stream the agent response
        const stream = query({ prompt, options: queryOptions as any })

        for await (const message of stream) {
          // Capture SDK session ID from init message
          if (message.type === 'system' && message.subtype === 'init') {
            session.sdkSessionId = (message as any).session_id
            await sessionStore.set(clientSessionId, session)
          }

          // Map assistant messages to content deltas
          if (message.type === 'assistant') {
            const assistantMsg = message as any
            if (assistantMsg.message?.content) {
              for (const block of assistantMsg.message.content) {
                if (block.type === 'text' && block.text) {
                  yield { event: 'content_delta', data: { text: block.text } }
                }
                if (block.type === 'tool_use') {
                  yield { event: 'tool_use_start', data: { id: block.id, tool: block.name, input: block.input } }
                  yield { event: 'tool_use_end', data: { id: block.id, tool: block.name } }
                }
              }
              yield { event: 'message_end', data: { id: assistantMsg.message?.id ?? crypto.randomUUID() } }
            }
          }

          // Result message — we're done
          if (message.type === 'result') {
            yield { event: 'done', data: { sessionId: clientSessionId } }
          }
        }

        onMessageEnd?.(clientSessionId)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        onError?.(error, clientSessionId)
        yield { event: 'error', data: { message: error.message, code: 'AGENT_ERROR' } }
      }
    },
  }
}
