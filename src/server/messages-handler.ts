/**
 * Lightweight chat handler using the Anthropic Messages API directly.
 *
 * No Agent SDK subprocess. Calls the API, runs the tool loop in-process,
 * streams responses as SSE events. Same interface as the agent handler.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { MessageParam } from '@anthropic-ai/sdk/resources/messages.js'
import type { ChatRequest, ChatEvent } from '../shared/protocol.js'
import type { ProjectChatMcpServer, AnthropicToolDefinition } from '../mcp/types.js'
import { MemorySessionStore, type SessionStore } from './session-store.js'
import { runToolLoop } from './tool-loop.js'

export interface MessagesHandlerConfig {
  /** MCP servers providing project context */
  servers: Record<string, ProjectChatMcpServer>

  /** System prompt. Falls back to first server's systemPrompt. */
  systemPrompt?: string

  /** Claude model. Defaults to claude-sonnet-4-5-20250514. */
  model?: string

  /** Max response tokens. Defaults to 4096. */
  maxTokens?: number

  /** Max tool loop iterations. Defaults to 10. */
  maxToolTurns?: number

  /** Max messages to keep in history. Defaults to 20. */
  maxHistoryMessages?: number

  /** Max input message length. Defaults to 4000. */
  maxInputLength?: number

  /** Session store. Defaults to in-memory. */
  sessionStore?: SessionStore

  /** Anthropic API key. Defaults to ANTHROPIC_API_KEY env var. */
  apiKey?: string

  /** Lifecycle hooks */
  onMessageStart?: (sessionId: string) => void
  onMessageEnd?: (sessionId: string) => void
  onError?: (error: Error, sessionId?: string) => void
}

export interface AgentChatHandler {
  handleMessage(req: ChatRequest): AsyncGenerator<ChatEvent>
}

export function createMessagesHandler(config: MessagesHandlerConfig): AgentChatHandler {
  const {
    servers,
    model = 'claude-sonnet-4-5-20250514',
    maxTokens = 4096,
    maxToolTurns = 10,
    maxHistoryMessages = 20,
    maxInputLength = 4000,
    onMessageStart,
    onMessageEnd,
    onError,
  } = config

  // Resolve system prompt: explicit > first server's > generic
  const systemPrompt = config.systemPrompt
    ?? Object.values(servers)[0]?.systemPrompt
    ?? 'You are a helpful assistant. Use the available tools to answer questions accurately.'

  const sessionStore = config.sessionStore ?? new MemorySessionStore()

  // Build namespaced tool list from all servers
  const tools: AnthropicToolDefinition[] = []
  for (const [prefix, server] of Object.entries(servers)) {
    for (const tool of server.toAnthropicTools()) {
      tools.push({
        ...tool,
        name: `${prefix}__${tool.name}`,
      })
    }
  }

  const client = new Anthropic({
    apiKey: config.apiKey ?? process.env.ANTHROPIC_API_KEY,
  })

  return {
    async *handleMessage(req: ChatRequest): AsyncGenerator<ChatEvent> {
      // Validate
      if (!req.message || typeof req.message !== 'string') {
        yield { event: 'error', data: { message: 'Message is required', code: 'INVALID_INPUT' } }
        return
      }
      if (req.message.length > maxInputLength) {
        yield { event: 'error', data: { message: `Message exceeds ${maxInputLength} characters`, code: 'INPUT_TOO_LONG' } }
        return
      }

      // Session
      const clientSessionId = req.sessionId ?? crypto.randomUUID()
      let session = await sessionStore.get(clientSessionId)

      if (!session) {
        session = {
          history: [],
          createdAt: Date.now(),
          lastActiveAt: Date.now(),
          messageCount: 0,
        }
      }

      session.lastActiveAt = Date.now()
      session.messageCount++

      onMessageStart?.(clientSessionId)
      yield { event: 'session', data: { sessionId: clientSessionId } }

      try {
        // Build messages from history + new user message
        const history = (session.history ?? []) as MessageParam[]

        // Include page context in the user message if provided
        let userContent = req.message
        if (req.context?.page) {
          const { title, pathname } = req.context.page
          userContent = `[User is on: "${title}" at ${pathname}]\n\n${req.message}`
        }

        const messages: MessageParam[] = [
          ...history,
          { role: 'user', content: userContent },
        ]

        // Run the tool loop
        for await (const event of runToolLoop({
          client,
          model,
          systemPrompt,
          messages,
          tools,
          servers,
          maxTokens,
          maxToolTurns,
        })) {
          yield event
        }

        // Save conversation history (trim to max)
        const newHistory = messages.slice(-maxHistoryMessages)
        session.history = newHistory as any
        await sessionStore.set(clientSessionId, session)

        yield { event: 'done', data: { sessionId: clientSessionId } }
        onMessageEnd?.(clientSessionId)
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err))
        onError?.(error, clientSessionId)
        yield { event: 'error', data: { message: error.message, code: 'API_ERROR' } }
      }
    },
  }
}
