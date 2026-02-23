// New: unified MCP server
export { createProjectChatServer } from './server.js'
export type { ProjectChatServerConfig } from './server.js'

// Types
export type {
  ProjectChatTool,
  ProjectChatMcpServer,
  ToolResult,
  AnthropicToolDefinition,
  JsonSchema,
} from './types.js'
export { isProjectChatServer } from './types.js'

// Indexer utilities (for custom tools that need file access)
export { searchIndex, extractSnippet } from './indexer.js'
export type { IndexedFile } from './indexer.js'

// Legacy: Agent SDK-based MCP servers (still work with createAgentHandler)
export { createPageContextServer } from './page-context.js'
export { createProjectContextServer } from './project-context.js'
export type { ProjectContextConfig } from './project-context.js'
