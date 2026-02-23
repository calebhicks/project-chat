/**
 * Handler factory — auto-detects which backend to use.
 *
 * If mcpServers values are ProjectChatMcpServer instances → Messages API (lightweight)
 * If mcpServers values are Agent SDK configs → Agent SDK subprocess (full Claude Code)
 *
 * Both return the same AgentChatHandler interface. The client doesn't know or care.
 */

import type { ChatRequest, ChatEvent } from '../shared/protocol.js'
import type { SessionStore } from './session-store.js'
import { isProjectChatServer, type ProjectChatMcpServer } from '../mcp/types.js'
import { createMessagesHandler } from './messages-handler.js'

export { type AgentChatHandler } from './messages-handler.js'

/**
 * MCP server config for Agent SDK handler (legacy).
 */
export type McpServerConfig =
  | { type: 'sdk'; name: string; instance: unknown }
  | { command: string; args?: string[]; env?: Record<string, string> }
  | { type: 'http' | 'sse'; url: string }

export interface HandlerConfig {
  /** System prompt for the agent. */
  systemPrompt?: string

  /** Claude model. Defaults to claude-sonnet-4-5-20250514. */
  model?: string

  /**
   * MCP servers.
   * Pass ProjectChatMcpServer instances for the lightweight Messages API handler.
   * Pass Agent SDK configs (McpServerConfig) for the full Claude Code agent handler.
   */
  mcpServers?: Record<string, ProjectChatMcpServer | McpServerConfig>

  /** Tools the agent can use (Agent SDK handler only). */
  allowedTools?: string[]

  /** Working directory (Agent SDK handler only). */
  cwd?: string

  /** Max spend per request in USD. Defaults to 0.25. */
  maxBudgetUsd?: number

  /** Max agent/tool turns per request. Defaults to 10. */
  maxTurns?: number

  /** Max response tokens (Messages handler only). Defaults to 4096. */
  maxTokens?: number

  /** Max messages in conversation history (Messages handler only). Defaults to 20. */
  maxHistoryMessages?: number

  /** Session store. Defaults to in-memory. */
  sessionStore?: SessionStore

  /** Max input message length. Defaults to 4000. */
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

/**
 * Create a chat handler. Auto-detects which backend to use based on mcpServers type.
 */
export function createHandler(config: HandlerConfig) {
  const mcpServers = config.mcpServers ?? {}

  // Check if any server is a ProjectChatMcpServer (new style)
  const hasProjectChatServers = Object.values(mcpServers).some(isProjectChatServer)
  // Check if any server is an Agent SDK config (legacy style)
  const hasAgentSdkConfigs = Object.values(mcpServers).some(s => !isProjectChatServer(s))

  if (hasAgentSdkConfigs && !hasProjectChatServers) {
    // All servers are Agent SDK configs → use agent handler
    return createAgentHandler(config)
  }

  // Default: use Messages API handler (lightweight)
  const servers: Record<string, ProjectChatMcpServer> = {}
  for (const [key, value] of Object.entries(mcpServers)) {
    if (isProjectChatServer(value)) {
      servers[key] = value
    }
  }

  return createMessagesHandler({
    servers,
    systemPrompt: config.systemPrompt,
    model: config.model,
    maxTokens: config.maxTokens,
    maxToolTurns: config.maxTurns,
    maxHistoryMessages: config.maxHistoryMessages,
    maxInputLength: config.maxInputLength,
    sessionStore: config.sessionStore,
    apiKey: config.apiKey,
    onMessageStart: config.onMessageStart,
    onMessageEnd: config.onMessageEnd,
    onError: config.onError,
  })
}

/**
 * Explicitly create an Agent SDK handler.
 * Uses Claude Code subprocess — heavier but supports Write, Edit, Bash, subagents.
 */
export function createAgentHandler(config: HandlerConfig) {
  // Lazy import to avoid loading Agent SDK unless needed
  return {
    async *handleMessage(req: ChatRequest): AsyncGenerator<ChatEvent> {
      const { createAgentHandlerImpl } = await import('./agent-handler.js')
      const handler = createAgentHandlerImpl(config as any)
      yield* handler.handleMessage(req)
    },
  }
}
