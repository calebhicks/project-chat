# project-chat

Drop-in chat widget that lets users talk to your project. Powered by the Claude Agent SDK with MCP-based access to docs, code, and page context. The agent doesn't just respond generically — it actually searches your project files.

## Architecture

Three layers, clean separation:

```
Client     → React components (AgentChat, ChatPanel, ChatBubble) + hooks (useAgentChat)
             Vanilla JS embed for non-React (mountProjectChat)
Server     → Handler wrapping Agent SDK query() → SSE stream to client
             Framework adapters: Next.js, Express, Hono
MCP        → In-process MCP servers providing project context to the agent
             Page context (URL, title) + Project context (docs/code search index)
Protocol   → Shared SSE event types between client and server
```

The client never talks to Claude directly. It POSTs to your backend, which calls the Agent SDK with MCP servers attached. The API key stays server-side.

## Key Files

| File | What it does |
|------|-------------|
| `src/server/handler.ts` | Core handler — wraps `query()`, validates input, manages sessions, maps SDKMessage to SSE events |
| `src/server/session-store.ts` | SessionStore interface + MemorySessionStore (pluggable for Redis/DB) |
| `src/server/adapters/nextjs.ts` | Next.js App Router adapter — `createNextHandler(handler)` → `{ POST }` |
| `src/server/adapters/express.ts` | Express adapter — `createExpressHandler(handler)` |
| `src/server/adapters/hono.ts` | Hono adapter — `createHonoHandler(handler)` |
| `src/mcp/project-context.ts` | Indexes docs/code at startup, exposes search_docs, search_code, read_file, list_files, get_project_summary |
| `src/mcp/page-context.ts` | Holds current page URL/title/content, updated per-request from frontend metadata |
| `src/client/components/AgentChat.tsx` | Full widget: floating bubble + slide-out panel + message list + input |
| `src/client/components/Markdown.tsx` | Lightweight markdown renderer (code blocks, inline code, bold, italic, links, headers, lists) |
| `src/client/hooks/useAgentChat.ts` | Core hook: manages connection, messages, streaming, session, stop/clear |
| `src/client/hooks/useStreamParser.ts` | Parses SSE event stream into typed ChatEvent objects |
| `src/client/hooks/useSession.ts` | localStorage session persistence |
| `src/client/context/AgentChatProvider.tsx` | React context for widget config (endpoint, theme, title, etc.) |
| `src/client/embed.ts` | Vanilla JS entry — `mountProjectChat(config)` for non-React projects |
| `src/shared/protocol.ts` | SSE event types, ChatRequest, ChatMessage, serialization helpers |

## Entry Points

| Import | What | Use when |
|--------|------|----------|
| `project-chat` | React components + hooks | React projects (Next.js, Vite, Remix) |
| `project-chat/embed` | `mountProjectChat()` vanilla JS | Non-React projects (Astro, static HTML) |
| `project-chat/server` | Handler + framework adapters | Backend API route |
| `project-chat/mcp` | MCP server factories | Configuring project context |
| `project-chat/protocol` | SSE types + helpers | Custom integrations, type imports |

## Commands

```bash
npm run build         # Build all entry points (tsup)
npm run dev           # Watch mode
npm run typecheck     # TypeScript check
npm test              # Run tests (25 tests)
npm run test:watch    # Watch mode tests
```

## Server API

### createHandler(config)

The core factory. Returns an `AgentChatHandler` with `handleMessage()` that yields `ChatEvent` objects.

```typescript
import { createHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',
  codeDir: './src',
})

const handler = createHandler({
  systemPrompt: 'You help users understand this project.',
  model: 'claude-sonnet-4-5-20250514',  // default
  allowedTools: ['Read', 'Glob', 'Grep'],  // default: read-only
  cwd: process.cwd(),
  mcpServers: {
    project: projectContext.server,
  },
  maxBudgetUsd: 0.25,   // per-request cap
  maxTurns: 10,          // per-request cap
  maxInputLength: 4000,  // character limit
  sessionStore: new MemorySessionStore(),  // pluggable
  onMessageStart: (sessionId) => {},
  onMessageEnd: (sessionId) => {},
  onError: (error, sessionId) => {},
})
```

### Framework adapters

| Framework | Adapter | Pattern |
|-----------|---------|---------|
| Next.js App Router | `createNextHandler(handler)` | `export const { POST } = createNextHandler(handler)` |
| Express | `createExpressHandler(handler)` | `app.post('/api/chat', createExpressHandler(handler))` |
| Hono | `createHonoHandler(handler)` | `app.post('/api/chat', createHonoHandler(handler))` |

Each adapter converts its framework's request/response into the handler's `ChatRequest`/SSE-stream interface.

### HandlerConfig reference

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `systemPrompt` | string | Generic helper prompt | What the agent should do |
| `model` | string | `claude-sonnet-4-5-20250514` | Claude model |
| `allowedTools` | string[] | `['Read', 'Glob', 'Grep']` | Agent SDK tools (read-only default) |
| `mcpServers` | Record<string, McpServerConfig> | `{}` | MCP servers for project context |
| `cwd` | string | `process.cwd()` | Working directory for file tools |
| `maxBudgetUsd` | number | `0.25` | Per-request spend cap |
| `maxTurns` | number | `10` | Per-request turn limit |
| `maxInputLength` | number | `4000` | Message character limit |
| `sessionStore` | SessionStore | `MemorySessionStore` | Session persistence |
| `apiKey` | string | `ANTHROPIC_API_KEY` env | API key (server-side only) |

## MCP Servers

### createProjectContextServer(config)

Indexes docs and code at startup. No external dependencies — uses a keyword index in memory.

```typescript
const ctx = createProjectContextServer({
  docsDir: './docs',           // markdown, text files
  codeDir: './src',            // source code
  docExtensions: ['.md', '.mdx', '.txt', '.rst'],  // defaults
  codeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', ...],  // defaults
  excludeDirs: ['node_modules', 'dist', '.git', ...],  // defaults
  maxFileSize: 100_000,        // skip files > 100KB
  apiSpec: './openapi.yaml',   // optional API spec
})

// ctx.server → pass directly to handler's mcpServers
// ctx.fileCount → number of indexed files (getter, updates on reindex)
// ctx.reindex() → re-scan directories (e.g., after deploy)
```

**Tools exposed to agent:**
| Tool | Purpose |
|------|---------|
| `search_docs(query)` | Keyword search across doc files, returns top 5 excerpts |
| `search_code(query)` | Keyword search across code files, returns top 5 snippets |
| `read_file(path)` | Read a specific indexed file by relative path |
| `list_files(filter?)` | List all indexed files, optionally filtered |
| `get_project_summary()` | README content + file count + optional API spec preview |

### createPageContextServer()

Holds current page metadata. Updated per-request by the handler.

```typescript
const page = createPageContextServer()
// page.server → pass to mcpServers
// page.updateContext(pageData, contentData, metadata) → called per-request
```

**Tools exposed:**
| Tool | Purpose |
|------|---------|
| `get_current_page()` | URL, title, pathname, custom metadata |
| `get_page_content()` | Extracted headings, text, code blocks (if frontend sends them) |

### Custom MCP servers

Add any Agent SDK MCP server — in-process, stdio, or HTTP:

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const customServer = createSdkMcpServer({
  name: 'my-context',
  tools: [
    tool('get_user', 'Get user details', { id: z.string() }, async ({ id }) => {
      const user = await db.users.find(id)
      return { content: [{ type: 'text', text: JSON.stringify(user) }] }
    }),
  ],
})

// Pass to handler:
mcpServers: {
  project: projectContext.server,
  custom: customServer,             // in-process SDK server
  postgres: { command: 'npx', args: ['@modelcontextprotocol/server-postgres', connStr] },  // stdio
}
```

## Client API

### Drop-in widget (React)

```tsx
import { AgentChatProvider, AgentChat } from 'project-chat'

<AgentChatProvider config={{
  endpoint: '/api/chat',
  title: 'Help',
  greeting: 'Ask me anything!',
  theme: 'system',
  position: 'bottom-right',
  showToolUse: true,
  maxMessageLength: 4000,
}}>
  <AgentChat />
</AgentChatProvider>
```

**Next.js App Router requires `ssr: false`** — the widget uses browser APIs. Use `dynamic(() => ..., { ssr: false })` wrapper. See `.claude/skills/integrate-project-chat.md` Phase 4.

### Custom UI (React hook)

```tsx
import { useAgentChat } from 'project-chat'

const { messages, send, stop, isStreaming, activeTools, sessionId, clearHistory, error } = useAgentChat({
  endpoint: '/api/chat',
})
```

### Vanilla JS (non-React)

```typescript
import { mountProjectChat } from 'project-chat/embed'

const unmount = mountProjectChat({
  endpoint: '/api/chat',
  title: 'Help',
  greeting: 'Ask me anything!',
})
// unmount() to remove
```

### AgentChatConfig reference

| Field | Type | Default | Purpose |
|-------|------|---------|---------|
| `endpoint` | string | **required** | Backend SSE endpoint URL |
| `sessionId` | `string \| 'auto'` | `'auto'` | `'auto'` = localStorage |
| `position` | string | `'bottom-right'` | Bubble position |
| `theme` | `'light' \| 'dark' \| 'system' \| ThemeConfig` | `'system'` | Color theme |
| `title` | string | `'Chat'` | Panel header |
| `greeting` | string | — | Initial assistant message |
| `placeholder` | string | `'Ask a question...'` | Input placeholder |
| `showToolUse` | boolean | `true` | Show "Searching docs..." indicators |
| `maxMessageLength` | number | `4000` | Input character limit |
| `onError` | function | — | Error callback |

### ThemeConfig

```typescript
{
  mode: 'light' | 'dark',
  accentColor?: string,      // default: '#6366f1' (indigo)
  fontFamily?: string,       // default: system font stack
  borderRadius?: string,     // default: '12px'
  chatBubbleColor?: string,  // default: uses accentColor
  userBubbleColor?: string,  // default: uses accentColor
}
```

## SSE Protocol

Client POSTs `ChatRequest`, server streams back `ChatEvent` objects as SSE:

```typescript
// Client → Server
{ message: string, sessionId?: string, context?: { page?, pageContent?, metadata? } }

// Server → Client (SSE events)
session        → { sessionId }
content_delta  → { text }           // streaming text chunks
tool_use_start → { id, tool, input? }  // agent started using a tool
tool_use_end   → { id, tool }       // tool finished
message_end    → { id }             // message complete
done           → { sessionId }      // conversation turn complete
error          → { message, code? } // error occurred
```

## Conventions

1. **API key stays server-side.** Never import `project-chat/server` or `project-chat/mcp` from client code.
2. **Default tools are read-only.** `Read`, `Glob`, `Grep` — safe for public-facing widgets. Add `Write`, `Edit`, `Bash` only if you trust all users.
3. **MCP servers from factories are ready-to-use.** `createProjectContextServer().server` and `createPageContextServer().server` return complete MCP configs. Pass them directly to `mcpServers` — no wrapping needed.
4. **Zod v4 for MCP tool schemas.** The Agent SDK uses Zod v4 (bundled as a dependency). Import `z` from `'zod'` when defining custom MCP tools.
5. **SSE over WebSocket.** Simpler, works with standard HTTP infrastructure. The communication is inherently unidirectional during streaming.
6. **Inline styles for isolation.** The widget uses inline styles with CSS custom properties. No stylesheet import needed. Fully isolated from the host page.
7. **SessionStore is pluggable.** Default is `MemorySessionStore` (single-process). Implement the `SessionStore` interface for Redis, database, etc.
8. **Non-blocking by design.** The chat widget never blocks the host app's rendering or navigation.

## Integration Skills

Skills in `.claude/skills/` guide Claude Code through autonomous integration:

| Skill | What it does |
|-------|-------------|
| `integrate-project-chat.md` | Master 5-phase integration: analyze host → install → backend → frontend → verify |
| `add-mcp-context.md` | Add custom database/API/service MCP context sources |
| `customize-theme.md` | Match the widget to the host's design system |
| `deploy-project-chat.md` | Production deployment: security, rate limiting, budget caps, monitoring |

**Start with:** `integrate-project-chat.md` — it dispatches to the others as needed.

## Testing

```bash
npm test    # 25 tests across 4 files

# Test files:
src/shared/protocol.test.ts       # SSE serialization/parsing (6 tests)
src/server/session-store.test.ts   # CRUD, expiry (4 tests)
src/server/handler.test.ts         # Validation, sessions, streaming, errors (9 tests)
src/mcp/project-context.test.ts    # Indexing, exclusions, reindex, maxFileSize (6 tests)
```

Handler tests mock the Agent SDK's `query()` function to test the full message mapping pipeline without API calls.
