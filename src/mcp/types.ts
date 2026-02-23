/**
 * Framework-agnostic MCP server types.
 *
 * These types decouple from both the Agent SDK and the MCP SDK,
 * allowing the same server to work as:
 * - In-process function calls (chat handler)
 * - Agent SDK MCP server (agent handler)
 * - Stdio MCP server (Claude Desktop / Claude Code)
 */

/** JSON Schema for tool input parameters */
export interface JsonSchema {
  type: 'object'
  properties: Record<string, {
    type: string
    description?: string
    enum?: string[]
  }>
  required?: string[]
}

/** Result from executing a tool */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>
  isError?: boolean
}

/** A tool that the MCP server exposes */
export interface ProjectChatTool {
  name: string
  description: string
  inputSchema: JsonSchema
  handler: (args: Record<string, unknown>) => Promise<ToolResult>
}

/** Anthropic API tool definition format */
export interface AnthropicToolDefinition {
  name: string
  description: string
  input_schema: JsonSchema
}

/** The MCP server interface — the core abstraction */
export interface ProjectChatMcpServer {
  /** Server name */
  name: string

  /** All registered tools */
  tools: ProjectChatTool[]

  /** System prompt describing the project */
  systemPrompt: string

  /** Number of indexed files */
  fileCount: number

  /** Execute a tool by name */
  callTool(name: string, args: Record<string, unknown>): Promise<ToolResult>

  /** Get tools in Anthropic Messages API format */
  toAnthropicTools(): AnthropicToolDefinition[]

  /** Re-index project files */
  reindex(): void
}

/**
 * Type guard: is this a ProjectChatMcpServer (new) or an Agent SDK config (legacy)?
 */
export function isProjectChatServer(obj: unknown): obj is ProjectChatMcpServer {
  return (
    typeof obj === 'object' &&
    obj !== null &&
    'callTool' in obj &&
    'toAnthropicTools' in obj &&
    'tools' in obj
  )
}
