#!/usr/bin/env node
/**
 * Stdio MCP server for Claude Desktop / Claude Code.
 *
 * Makes any project conversable by exposing its docs and code as MCP tools.
 *
 * Usage:
 *   npx project-chat-mcp --name "My Project" --docs ./docs --code ./src
 *   npx project-chat-mcp --config ./project-chat.config.json
 *
 * Add to claude_desktop_config.json:
 *   { "mcpServers": { "my-project": { "command": "npx", "args": ["project-chat-mcp", "--docs", "./docs", "--code", "./src"] } } }
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import * as fs from 'node:fs'
import { createProjectChatServer, type ProjectChatServerConfig } from './server.js'

function parseArgs(): ProjectChatServerConfig {
  const args = process.argv.slice(2)
  const config: Partial<ProjectChatServerConfig> = {}

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--config': {
        const configPath = args[++i]
        if (configPath && fs.existsSync(configPath)) {
          const fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
          Object.assign(config, fileConfig)
        }
        break
      }
      case '--name': config.name = args[++i]; break
      case '--description': config.description = args[++i]; break
      case '--docs': config.docsDir = args[++i]; break
      case '--code': config.codeDir = args[++i]; break
      case '--help':
        console.error(`project-chat-mcp: Make any project conversable via MCP

Usage:
  npx project-chat-mcp --name "My Project" --docs ./docs --code ./src
  npx project-chat-mcp --config ./project-chat.config.json

Options:
  --name <name>          Project name
  --description <desc>   One-sentence description
  --docs <dir>           Documentation directory
  --code <dir>           Source code directory
  --config <file>        JSON config file (same shape as ProjectChatServerConfig)
  --help                 Show this help`)
        process.exit(0)
    }
  }

  if (!config.name) {
    // Try to read name from package.json in cwd
    try {
      const pkg = JSON.parse(fs.readFileSync('package.json', 'utf-8'))
      config.name = pkg.name ?? 'project'
      config.description = config.description ?? pkg.description
    } catch {
      config.name = 'project'
    }
  }

  return config as ProjectChatServerConfig
}

async function main() {
  const config = parseArgs()
  const projectServer = createProjectChatServer(config)

  const server = new Server(
    { name: `project-chat:${projectServer.name}`, version: '0.1.0' },
    { capabilities: { tools: {} } }
  )

  // List tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: projectServer.tools.map(t => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema as any,
    })),
  }))

  // Call tool
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const result = await projectServer.callTool(
      request.params.name,
      (request.params.arguments ?? {}) as Record<string, unknown>,
    )
    return result as any
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)

  console.error(`project-chat-mcp: serving ${projectServer.fileCount} files from "${projectServer.name}"`)
}

main().catch(err => {
  console.error('project-chat-mcp fatal:', err)
  process.exit(1)
})
