# project-chat

Drop-in chat widget that lets users talk to your project. Powered by Claude Agent SDK with MCP-based access to your docs, code, and page context.

Think Intercom, but the agent actually understands your project.

## Quick Start (Next.js)

```bash
npm install project-chat
```

**`app/api/chat/route.ts`**

```typescript
import { createHandler, createNextHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',
  codeDir: './src',
})

const handler = createHandler({
  systemPrompt: 'You help users understand this project. Search docs and code to answer questions.',
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
  },
})

export const { POST } = createNextHandler(handler)
```

**`app/layout.tsx`**

```tsx
import { AgentChatProvider, AgentChat } from 'project-chat'

export default function Layout({ children }) {
  return (
    <html><body>
      {children}
      <AgentChatProvider config={{
        endpoint: '/api/chat',
        greeting: 'Ask me anything about this project.',
      }}>
        <AgentChat />
      </AgentChatProvider>
    </body></html>
  )
}
```

Set `ANTHROPIC_API_KEY` in your environment. Done.

## What makes this different

Most chat widgets are wrappers around an LLM API. This one gives the agent **MCP-based access to your project's actual context**:

- **Project context** — indexes your docs and source code. The agent searches them to answer questions accurately.
- **Page context** — knows what page the user is on. Answers are tailored to their current location.
- **Custom context** — add MCP servers for database queries, API lookups, user-specific data, or anything else.
- **Claude Code skills** — `.claude/skills/` files let Claude Code auto-integrate the widget into any project.

## Architecture

```
User → React Widget → SSE → Backend Handler → Agent SDK query() → MCP Servers
                                                                    ├── Project docs/code
                                                                    ├── Page context
                                                                    └── Your custom servers
```

Three layers, one package, four entry points:

| Import | What |
|--------|------|
| `project-chat` | React widget + hooks |
| `project-chat/server` | Backend handler + framework adapters |
| `project-chat/mcp` | MCP server factories |
| `project-chat/protocol` | Shared SSE types |

## Frontend API

### Drop-in widget

```tsx
<AgentChatProvider config={{
  endpoint: '/api/chat',
  position: 'bottom-right',       // bottom-right | bottom-left | top-right | top-left
  theme: 'system',                // light | dark | system | ThemeConfig
  title: 'Help',
  greeting: 'How can I help?',
  placeholder: 'Ask a question...',
  showToolUse: true,              // show "Searching docs..." indicators
  maxMessageLength: 4000,
}}>
  <AgentChat />
</AgentChatProvider>
```

### Custom UI via hook

```tsx
import { useAgentChat } from 'project-chat'

function MyChat() {
  const { messages, send, isStreaming, activeTools, error } = useAgentChat({
    endpoint: '/api/chat',
  })

  return (
    <div>
      {messages.map(m => <div key={m.id}>{m.content}</div>)}
      <input onKeyDown={e => e.key === 'Enter' && send(e.target.value)} />
    </div>
  )
}
```

## Server API

### Handler config

```typescript
createHandler({
  systemPrompt: string,              // What the agent should do
  model?: string,                    // Default: claude-sonnet-4-5-20250514
  allowedTools?: string[],           // Default: ['Read', 'Glob', 'Grep']
  mcpServers?: Record<string, McpServerConfig>,
  maxBudgetUsd?: number,             // Default: 0.25
  maxTurns?: number,                 // Default: 10
  maxInputLength?: number,           // Default: 4000
  sessionStore?: SessionStore,       // Default: in-memory
  onMessageStart?: (sessionId) => void,
  onMessageEnd?: (sessionId) => void,
  onError?: (error, sessionId) => void,
})
```

### Framework adapters

```typescript
// Next.js App Router
export const { POST } = createNextHandler(handler)

// Express
app.post('/api/chat', createExpressHandler(handler))

// Hono
app.post('/api/chat', createHonoHandler(handler))
```

## MCP Context

### Built-in: Project context

Indexes docs and code at startup. Exposes tools for the agent to search.

```typescript
createProjectContextServer({
  docsDir: './docs',
  codeDir: './src',
  include: ['**/*.md', '**/*.ts'],
  exclude: ['**/node_modules/**'],
  maxFileSize: 100000,
  apiSpec: './openapi.yaml',
})
```

### Built-in: Page context

Automatically knows what page the user is on (URL, title, pathname). The frontend sends this with every request.

```typescript
createPageContextServer()
```

### Custom MCP servers

Add any MCP server for project-specific context:

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const myServer = createSdkMcpServer({
  name: 'my-context',
  tools: [
    tool('get_user', 'Get user details', { id: z.string() }, async ({ id }) => {
      const user = await db.users.find(id)
      return { content: [{ type: 'text', text: JSON.stringify(user) }] }
    }),
  ],
})

// Add to handler
createHandler({
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
    'users': { type: 'sdk', instance: myServer },
  },
})
```

## Claude Code Skills

This library ships with `.claude/skills/` for autonomous integration:

- **`integrate-project-chat`** — 5-phase integration: analyze host, install, backend, frontend, verify
- **`add-mcp-context`** — Add custom database/API/service context
- **`customize-theme`** — Match the widget to the host's design system
- **`deploy-project-chat`** — Production: security, rate limiting, monitoring

## Security

- API key stays server-side (never in client bundle)
- Default tools are read-only: `Read`, `Glob`, `Grep`
- Budget caps per request (`maxBudgetUsd`)
- Turn limits per request (`maxTurns`)
- Input length validation (`maxInputLength`)
- Session store is pluggable (implement `SessionStore` for Redis, DB, etc.)

## License

MIT
