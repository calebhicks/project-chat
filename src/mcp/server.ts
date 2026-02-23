/**
 * Unified MCP server factory.
 *
 * Creates a ProjectChatMcpServer that works with:
 * - Messages API handler (in-process callTool)
 * - Agent SDK handler (via toSdkServer)
 * - Claude Desktop / Claude Code (via stdio CLI)
 */

import * as fs from 'node:fs'
import type {
  ProjectChatTool,
  ProjectChatMcpServer,
  ToolResult,
  AnthropicToolDefinition,
  JsonSchema,
} from './types.js'
import {
  indexDir,
  searchIndex,
  extractSnippet,
  DEFAULT_DOC_EXTENSIONS,
  DEFAULT_CODE_EXTENSIONS,
  DEFAULT_EXCLUDE_DIRS,
  type IndexedFile,
} from './indexer.js'

export interface ProjectChatServerConfig {
  /** Project name */
  name: string

  /** One-sentence description */
  description?: string

  /** Documentation directory */
  docsDir?: string

  /** Source code directory */
  codeDir?: string

  /** System prompt override. Auto-generated from name + description if not provided. */
  systemPrompt?: string

  /** Additional custom tools beyond the built-in search/read tools */
  tools?: ProjectChatTool[]

  /** File extensions for docs. Defaults to .md, .mdx, .txt, .rst */
  docExtensions?: string[]

  /** File extensions for code. Defaults to common source extensions. */
  codeExtensions?: string[]

  /** Directory names to skip. Defaults to node_modules, dist, .git, etc. */
  excludeDirs?: string[]

  /** Skip files larger than this (bytes). Defaults to 100KB. */
  maxFileSize?: number

  /** Path to OpenAPI/Swagger spec file. */
  apiSpec?: string
}

function textResult(text: string): ToolResult {
  return { content: [{ type: 'text', text }] }
}

function buildTools(files: IndexedFile[], apiSpecContent: string | null): ProjectChatTool[] {
  return [
    {
      name: 'search_docs',
      description: 'Search project documentation for relevant content. Returns matching excerpts with file paths.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Search query' } },
        required: ['query'],
      },
      handler: async (args) => {
        const q = args.query as string
        const docFiles = files.filter(f => f.type === 'doc')
        if (docFiles.length === 0) return textResult('No documentation files indexed.')
        const results = searchIndex(docFiles, q)
        if (results.length === 0) return textResult(`No doc matches for: "${q}"`)
        return textResult(results.map(f => {
          const snippet = extractSnippet(f.content, q)
          return `### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``
        }).join('\n\n'))
      },
    },
    {
      name: 'search_code',
      description: 'Search project source code. Returns matching snippets with file paths.',
      inputSchema: {
        type: 'object',
        properties: { query: { type: 'string', description: 'Function name, concept, or keyword' } },
        required: ['query'],
      },
      handler: async (args) => {
        const q = args.query as string
        const codeFiles = files.filter(f => f.type === 'code')
        if (codeFiles.length === 0) return textResult('No source code files indexed.')
        const results = searchIndex(codeFiles, q)
        if (results.length === 0) return textResult(`No code matches for: "${q}"`)
        return textResult(results.map(f => {
          const snippet = extractSnippet(f.content, q, 5)
          return `### ${f.path}\n\`\`\`\n${snippet}\n\`\`\``
        }).join('\n\n'))
      },
    },
    {
      name: 'read_file',
      description: 'Read the full contents of a specific indexed file.',
      inputSchema: {
        type: 'object',
        properties: { path: { type: 'string', description: 'File path relative to project root' } },
        required: ['path'],
      },
      handler: async (args) => {
        const filePath = args.path as string
        const file = files.find(f => f.path === filePath)
        if (!file) {
          return textResult(`File not found: ${filePath}\n\nAvailable:\n${files.slice(0, 20).map(f => `- ${f.path}`).join('\n')}`)
        }
        return textResult(`# ${file.path}\n\n\`\`\`\n${file.content}\n\`\`\``)
      },
    },
    {
      name: 'list_files',
      description: 'List all indexed project files, optionally filtered.',
      inputSchema: {
        type: 'object',
        properties: { filter: { type: 'string', description: 'Filter by name substring' } },
      },
      handler: async (args) => {
        const filter = args.filter as string | undefined
        let matching = files
        if (filter) {
          const lower = filter.toLowerCase()
          matching = files.filter(f => f.path.toLowerCase().includes(lower))
        }
        if (matching.length === 0) return textResult(filter ? `No files matching: "${filter}"` : 'No files indexed.')
        const docs = matching.filter(f => f.type === 'doc').map(f => f.path)
        const code = matching.filter(f => f.type === 'code').map(f => f.path)
        const parts: string[] = []
        if (docs.length) parts.push(`## Documentation (${docs.length})\n${docs.map(p => `- ${p}`).join('\n')}`)
        if (code.length) parts.push(`## Source Code (${code.length})\n${code.map(p => `- ${p}`).join('\n')}`)
        return textResult(parts.join('\n\n'))
      },
    },
    {
      name: 'get_project_summary',
      description: 'Get README content, file count, and structure overview.',
      inputSchema: { type: 'object', properties: {} },
      handler: async () => {
        const readme = files.find(f => f.path.toLowerCase() === 'readme.md')
        const parts: string[] = []
        parts.push(`**Indexed:** ${files.length} files (${files.filter(f => f.type === 'doc').length} docs, ${files.filter(f => f.type === 'code').length} code)`)
        if (readme) {
          const content = readme.content.length > 3000
            ? readme.content.slice(0, 3000) + '\n\n... (truncated)'
            : readme.content
          parts.push(`## README\n\n${content}`)
        }
        if (apiSpecContent) {
          parts.push(`## API Spec (preview)\n\`\`\`\n${apiSpecContent.split('\n').slice(0, 50).join('\n')}\n\`\`\``)
        }
        return textResult(parts.join('\n\n'))
      },
    },
  ]
}

export function createProjectChatServer(config: ProjectChatServerConfig): ProjectChatMcpServer {
  const {
    name,
    description,
    docsDir,
    codeDir,
    systemPrompt: customSystemPrompt,
    tools: customTools = [],
    docExtensions = DEFAULT_DOC_EXTENSIONS,
    codeExtensions = DEFAULT_CODE_EXTENSIONS,
    excludeDirs = DEFAULT_EXCLUDE_DIRS,
    maxFileSize = 100_000,
    apiSpec,
  } = config

  let files: IndexedFile[] = []

  function doIndex() {
    files = []
    if (docsDir) files.push(...indexDir(docsDir, 'doc', docExtensions, excludeDirs, maxFileSize))
    if (codeDir) files.push(...indexDir(codeDir, 'code', codeExtensions, excludeDirs, maxFileSize))
  }

  doIndex()

  let apiSpecContent: string | null = null
  if (apiSpec && fs.existsSync(apiSpec)) {
    try { apiSpecContent = fs.readFileSync(apiSpec, 'utf-8') } catch { /* skip */ }
  }

  const builtinTools = buildTools(files, apiSpecContent)
  const allTools = [...builtinTools, ...customTools]

  const systemPrompt = customSystemPrompt ?? [
    `You are a helpful assistant for ${name}${description ? ` — ${description}` : ''}.`,
    '',
    'You have access to the project\'s documentation and source code via tools.',
    'Use search_docs and search_code to find accurate information before answering.',
    'If you can\'t find the answer in the indexed files, say so — don\'t guess.',
  ].join('\n')

  const server: ProjectChatMcpServer = {
    name,
    tools: allTools,
    systemPrompt,
    get fileCount() { return files.length },

    async callTool(toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
      const tool = allTools.find(t => t.name === toolName)
      if (!tool) {
        return { content: [{ type: 'text', text: `Unknown tool: ${toolName}` }], isError: true }
      }
      try {
        return await tool.handler(args)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        return { content: [{ type: 'text', text: `Tool error: ${msg}` }], isError: true }
      }
    },

    toAnthropicTools(): AnthropicToolDefinition[] {
      return allTools.map(t => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema,
      }))
    },

    reindex() {
      doIndex()
    },
  }

  return server
}
