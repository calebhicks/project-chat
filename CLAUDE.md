# project-chat

Intercom-style "chat with this project" widget powered by the Claude Agent SDK. Drop it into any web project — the agent gets MCP-based access to the project's docs, code, and page context.

## Architecture

Three layers, one package, four entry points:

| Entry point | Import | Purpose |
|-------------|--------|---------|
| `.` | `import { AgentChat } from 'project-chat'` | React widget (components + hooks) |
| `./server` | `import { createHandler } from 'project-chat/server'` | Backend handler wrapping Agent SDK `query()` |
| `./mcp` | `import { createProjectContext } from 'project-chat/mcp'` | MCP server factories for project context |
| `./protocol` | `import { ChatEvent } from 'project-chat/protocol'` | Shared types (SSE events, requests) |

### Data flow

1. User types message in React widget
2. Widget POSTs `{ message, sessionId, context }` to configured endpoint
3. Server handler calls Agent SDK `query()` with MCP servers attached
4. Agent uses MCP tools to search docs, read code, understand page context
5. `SDKMessage` stream maps to `ChatEvent` SSE events back to client
6. Widget renders streaming text, tool indicators, errors

### MCP context layer

The differentiator. Two built-in MCP servers:

- **Page context** — knows current URL, title, page content. Updated per-request from frontend metadata.
- **Project context** — indexes docs and code at startup. Exposes `search_docs`, `search_code`, `read_file`, `list_files`, `get_project_summary`.

Both use in-process `type: "sdk"` MCP (no subprocess overhead). Consumers add their own MCP servers for database, API, or custom context.

## Build

- `tsup` builds server + MCP (CJS + ESM for Node.js)
- `vite` builds client (ESM with React as peer dep)
- `npm run build` runs both sequentially

## Key conventions

- Default tools are read-only: `Read`, `Glob`, `Grep`. Consumer opts in to write tools.
- SSE for streaming (not WebSocket). Simpler, works with standard HTTP infra.
- Inline styles with CSS custom properties for theming. No stylesheet import needed.
- `SessionStore` interface is pluggable. Default is in-memory.
- API key stays server-side. Never in client bundle.

## Files

```
src/
  client/         React components + hooks
  server/         Backend handler + framework adapters
  mcp/            MCP server factories
  shared/         Protocol types shared between client and server
.claude/skills/   Integration skills for Claude Code
examples/         Next.js and Express examples
```
