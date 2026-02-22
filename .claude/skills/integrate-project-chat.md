# Integrate project-chat

Autonomous integration of the project-chat widget into any web project. Analyzes the host, sets up the backend handler, configures MCP context, drops in the React widget, and verifies it end-to-end.

## When to use

Use this skill when:
- Asked to "add a chat widget" or "integrate project-chat"
- Asked to "add AI chat" or "chat with this project"
- Starting a new project-chat integration from scratch

## Overview

Five phases, each producing artifacts that feed the next:

```
Phase 1: Analyze    → Understand host framework, docs, code, design system
Phase 2: Install    → Package installed, env vars configured
Phase 3: Backend    → API route created with handler + MCP context
Phase 4: Frontend   → Widget mounted in app layout with matched theme
Phase 5: Verify     → Test message confirms agent can search project context
```

---

## Phase 1: Analyze the Host

**Goal:** Understand the project before writing code.

Read the following to map the integration:

1. **Framework detection** — Read `package.json` to identify: Next.js (App Router vs Pages), Express, Fastify, Hono, Vite + React, Remix, SvelteKit, etc.
2. **Documentation directory** — Look for `docs/`, `documentation/`, `wiki/`, or markdown files at root level (README.md, CONTRIBUTING.md, etc.)
3. **Source code directory** — Typically `src/`, `app/`, `lib/`, or root-level source files
4. **Existing API routes** — Where do API handlers live? (`app/api/`, `pages/api/`, `src/routes/`, `server/`)
5. **App layout** — Where is the root layout? (`app/layout.tsx`, `pages/_app.tsx`, `src/App.tsx`, `index.html`)
6. **Design system** — Check for: Tailwind config, CSS variables, theme provider, design tokens, brand colors
7. **Existing chat/AI** — Does the project already have chat or AI features? Avoid conflicts.

**Output:** Mental model of where each piece goes. No files created yet.

---

## Phase 2: Install

```bash
npm install project-chat
```

Add to `.env` (or `.env.local` for Next.js):

```
ANTHROPIC_API_KEY=sk-ant-...
```

**Important:** The API key must stay server-side. Never import it in client code.

---

## Phase 3: Backend Setup

**Goal:** Create the API route that handles chat requests.

### 3.1 Create the handler

Create a file at the appropriate location for the host framework:

| Framework | File path |
|-----------|-----------|
| Next.js App Router | `app/api/chat/route.ts` |
| Next.js Pages Router | `pages/api/chat.ts` |
| Express | `src/routes/chat.ts` or inline in `server.ts` |
| Hono | `src/routes/chat.ts` or inline |
| Fastify | `src/routes/chat.ts` |

### 3.2 Configure MCP context

This is the key step. The agent needs to know about the project.

```typescript
import { createHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',      // ← adjust to host's actual docs dir
  codeDir: './src',       // ← adjust to host's actual source dir
  include: ['**/*.md', '**/*.ts', '**/*.tsx'],  // ← adjust to relevant file types
  exclude: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
})

const handler = createHandler({
  systemPrompt: `You are a helpful assistant for [PROJECT_NAME].
You have access to the project's documentation and source code.
Search the docs and code to answer questions accurately.
If you don't know something, say so — don't make up answers.`,
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
  },
})
```

**Customize the system prompt** based on what the project does. Be specific.

### 3.3 Wire the framework adapter

| Framework | Pattern |
|-----------|---------|
| Next.js App Router | `export const { POST } = createNextHandler(handler)` |
| Express | `app.post('/api/chat', createExpressHandler(handler))` |
| Hono | `app.post('/api/chat', createHonoHandler(handler))` |

### 3.4 Optional: Add page context

If the project is a web app (not just docs), add the page context server so the agent knows what page the user is viewing:

```typescript
import { createPageContextServer } from 'project-chat/mcp'

const pageContext = createPageContextServer()

// Add to handler config:
mcpServers: {
  'project': { type: 'sdk', instance: projectContext.server },
  'page': { type: 'sdk', instance: pageContext.server },
}
```

---

## Phase 4: Frontend Setup

**Goal:** Mount the widget in the app layout.

### 4.1 Add the provider and widget

In the root layout (the component that wraps all pages):

```tsx
import { AgentChatProvider, AgentChat } from 'project-chat'

// Inside the layout component, at the end of <body> or the root wrapper:
<AgentChatProvider config={{
  endpoint: '/api/chat',
  title: '[Project Name]',
  greeting: 'Hi! Ask me anything about [Project Name].',
  placeholder: 'Ask a question...',
}}>
  <AgentChat />
</AgentChatProvider>
```

### 4.2 Match the theme

Read the host's design system and configure the theme:

```typescript
// If the project uses Tailwind or has clear brand colors:
config={{
  endpoint: '/api/chat',
  theme: {
    mode: 'light',           // or 'dark', or 'system'
    accentColor: '#6366f1',  // ← extract from host's primary color
    fontFamily: 'inherit',   // ← use host's font stack
    borderRadius: '12px',
  },
}}

// Or just use system detection:
config={{
  endpoint: '/api/chat',
  theme: 'system',  // auto-detects light/dark preference
}}
```

---

## Phase 5: Verify

**Goal:** Confirm the integration works end-to-end.

1. Start the dev server
2. Open the app in a browser
3. Click the chat bubble
4. Send a test message: "What does this project do?"
5. Verify:
   - Agent streams a response
   - Agent uses MCP tools to search docs/code (tool indicators appear)
   - Response is accurate and project-specific (not generic)
   - Session persists across page reload

**If the agent gives generic answers:** The project context MCP server may not have indexed the right files. Check:
- Are `docsDir` and `codeDir` paths correct?
- Are the `include` patterns matching the right file types?
- Is `projectContext.fileCount` > 0?

**If streaming doesn't work:** Check the browser console for CORS errors. The backend may need CORS headers.

---

## Post-integration

### Adding custom MCP context

See [`add-mcp-context.md`](add-mcp-context.md) for adding database queries, API lookups, or other project-specific context.

### Customizing the theme

See [`customize-theme.md`](customize-theme.md) for deep theme customization.

### Production deployment

See [`deploy-project-chat.md`](deploy-project-chat.md) for API key security, rate limiting, and budget caps.
