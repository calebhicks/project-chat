// Handler factory (auto-detects Messages API vs Agent SDK)
export { createHandler, createAgentHandler } from './handler.js'
export type { HandlerConfig, AgentChatHandler, McpServerConfig } from './handler.js'

// Messages handler (explicit, lightweight)
export { createMessagesHandler } from './messages-handler.js'
export type { MessagesHandlerConfig } from './messages-handler.js'

// Session management
export type { SessionStore, SessionData } from './session-store.js'
export { MemorySessionStore } from './session-store.js'

// Framework adapters
export { createNextHandler } from './adapters/nextjs.js'
export { createExpressHandler } from './adapters/express.js'
export { createHonoHandler } from './adapters/hono.js'
