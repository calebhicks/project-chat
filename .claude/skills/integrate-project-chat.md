# Integrate project-chat

Autonomous integration of the project-chat widget into any web project. Analyzes the host, configures MCP context, creates the backend handler, mounts the widget, and verifies end-to-end.

## When to use

- Asked to "add a chat widget" or "add AI chat" to a project
- Asked to "integrate project-chat" or "let users chat with this project"
- Starting a new project-chat integration from scratch

## Overview

Five phases, each producing concrete artifacts:

```
Phase 1: Analyze    → Understanding of host framework, docs, code, design system
Phase 2: Install    → Package installed, env vars configured
Phase 3: Backend    → API route with handler + MCP context servers
Phase 4: Frontend   → Widget mounted in app layout with matched theme
Phase 5: Verify     → Test message confirms contextual responses
```

**Principle: the value is in the MCP context layer.** Any chat widget can call an LLM. What makes this useful is that the agent can actually search the project's docs and code to give accurate answers. Invest time in Phase 3 — getting the right files indexed with the right system prompt.

### Rollback

All project-chat code is additive. To remove:
1. Delete the API route (e.g., `app/api/chat/route.ts`)
2. Remove the widget component and its import from the layout
3. `npm uninstall project-chat`

---

## Phase 1: Analyze the Host

**Goal:** Map the project before writing code. Understand 6 dimensions:

### 1.1 Framework detection

Read `package.json` and identify the framework:

| Framework | Signals | Backend pattern | Frontend pattern |
|-----------|---------|----------------|-----------------|
| Next.js App Router | `next` ≥13, `app/` dir | `app/api/chat/route.ts` + `createNextHandler` | `dynamic(() => ..., { ssr: false })` wrapper |
| Next.js Pages Router | `next`, `pages/` dir | `pages/api/chat.ts` | Direct import in `_app.tsx` |
| Vite + React | `vite`, `react` | Separate Express/Hono server | Direct import in `App.tsx` |
| Remix | `@remix-run/react` | `app/routes/api.chat.tsx` loader | Direct import in `root.tsx` |
| Astro | `astro` | Astro SSR endpoint or separate server | `mountProjectChat()` from `project-chat/embed` |
| Express + static | `express`, no React | Inline or `routes/chat.ts` | `mountProjectChat()` from `project-chat/embed` |
| SvelteKit | `@sveltejs/kit` | `src/routes/api/chat/+server.ts` | `mountProjectChat()` from `project-chat/embed` |

### 1.2 Documentation directory

Search for docs the agent should know about:

```
Look for: docs/, documentation/, wiki/, guides/
Also: README.md, CONTRIBUTING.md, CHANGELOG.md, API.md at root
Check: any markdown files that describe the project
```

### 1.3 Source code directory

```
Look for: src/, app/, lib/, server/, packages/
Note: the file types present (.ts, .tsx, .js, .py, .go, etc.)
```

### 1.4 Existing API routes

Where do handlers live? This determines where the chat route goes.

```
Next.js App Router: app/api/
Next.js Pages Router: pages/api/
Express: src/routes/ or inline in server.ts/app.ts
Remix: app/routes/
Astro: src/pages/api/
```

### 1.5 Root layout / app shell

Where does the widget get mounted?

```
Next.js App Router: app/layout.tsx
Next.js Pages Router: pages/_app.tsx
Vite + React: src/App.tsx or src/main.tsx
Remix: app/root.tsx
Astro: src/layouts/Base.astro
```

### 1.6 Design system

Extract theme values to match the widget:

```
Tailwind: check tailwind.config.js for colors.primary, fontFamily
CSS variables: grep for --primary, --accent, --font in global CSS
Theme provider: check for ThemeProvider or design tokens
Brand: look at existing buttons/headers for accent color
```

**Output:** Mental model of where each piece goes. No files written yet.

---

## Phase 2: Install

```bash
npm install project-chat
```

The Agent SDK (`@anthropic-ai/claude-agent-sdk`) and Zod v4 come as transitive dependencies — no separate install needed.

Add the API key to the environment:

| Framework | File | Variable |
|-----------|------|----------|
| Next.js | `.env.local` | `ANTHROPIC_API_KEY=sk-ant-...` |
| Express/Hono | `.env` | `ANTHROPIC_API_KEY=sk-ant-...` |
| Docker | `docker-compose.yml` | Under `environment:` |

**Important:** The API key must stay server-side. Never import `project-chat/server` or `project-chat/mcp` from client code.

---

## Phase 3: Backend Setup

**Goal:** Create the API route that handles chat requests with project-aware MCP context.

### 3.1 Configure MCP context

This is the critical step. The agent needs to know about the project.

```typescript
import { createHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',      // ← host's actual docs directory
  codeDir: './src',       // ← host's actual source directory
  // Defaults are sensible. Override only if needed:
  // docExtensions: ['.md', '.mdx', '.txt', '.rst'],
  // codeExtensions: ['.ts', '.tsx', '.js', '.jsx', '.py', ...],
  // excludeDirs: ['node_modules', 'dist', '.git', ...],
  // maxFileSize: 100_000,
})

console.log(`Indexed ${projectContext.fileCount} project files`)
```

**Verify this number makes sense.** If it's 0, the paths are wrong. If it's in the thousands, `excludeDirs` isn't filtering enough.

### 3.2 Write the system prompt

Be specific about what the project does. Generic prompts get generic answers.

```typescript
const handler = createHandler({
  systemPrompt: `You are a helpful assistant for [PROJECT NAME] — [one-sentence description].

You have access to the project's documentation and source code via MCP tools.
Use search_docs and search_code to find accurate information before answering.
If you can't find the answer in the indexed files, say so — don't guess.

Key topics users ask about:
- [topic 1]
- [topic 2]
- [topic 3]`,

  cwd: process.cwd(),
  mcpServers: {
    project: projectContext.server,
  },
  maxBudgetUsd: 0.25,
  maxTurns: 5,
})
```

### 3.3 Wire the framework adapter

**Next.js App Router** — `app/api/chat/route.ts`:

```typescript
import { createHandler, createNextHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({ docsDir: '.', codeDir: './src' })

const handler = createHandler({
  systemPrompt: '...',
  mcpServers: { project: projectContext.server },
})

export const { POST } = createNextHandler(handler)
```

**Express** — inline or `routes/chat.ts`:

```typescript
import express from 'express'
import { createHandler, createExpressHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({ docsDir: './docs', codeDir: './src' })
const handler = createHandler({ systemPrompt: '...', mcpServers: { project: projectContext.server } })

app.post('/api/chat', express.json(), createExpressHandler(handler))
```

**Hono**:

```typescript
import { createHandler, createHonoHandler } from 'project-chat/server'

app.post('/api/chat', createHonoHandler(handler))
```

### 3.4 Optional: Add page context

If the project is a web app (not just docs), add page awareness:

```typescript
import { createPageContextServer } from 'project-chat/mcp'

const pageContext = createPageContextServer()

mcpServers: {
  project: projectContext.server,
  page: pageContext.server,
}
```

### 3.5 Optional: Add custom MCP context

For database queries, API lookups, or user-specific data — see [add-mcp-context.md](add-mcp-context.md).

---

## Phase 4: Frontend Setup

**Goal:** Mount the widget in the app.

### 4.1 Next.js App Router

The widget uses browser APIs (localStorage, window, useContext) that fail during server-side rendering. **You must use `dynamic()` with `ssr: false`.**

Create two files:

```tsx
// app/chat-widget.tsx
"use client"

import dynamic from 'next/dynamic'

const ChatWidgetInner = dynamic(
  () => import('./chat-widget-inner').then(m => ({ default: m.ChatWidgetInner })),
  { ssr: false }
)

export function ChatWidget() {
  return <ChatWidgetInner />
}
```

```tsx
// app/chat-widget-inner.tsx
"use client"

import { AgentChatProvider, AgentChat } from 'project-chat'

export function ChatWidgetInner() {
  return (
    <AgentChatProvider config={{
      endpoint: '/api/chat',
      title: '[Project Name]',
      greeting: 'Hi! Ask me anything about [Project Name].',
    }}>
      <AgentChat />
    </AgentChatProvider>
  )
}
```

Add `<ChatWidget />` to root layout:

```tsx
// app/layout.tsx
import { ChatWidget } from './chat-widget'

export default function RootLayout({ children }) {
  return (
    <html><body>
      {children}
      <ChatWidget />
    </body></html>
  )
}
```

### 4.2 Vite + React / Remix / other React

Direct import — no SSR issue:

```tsx
import { AgentChatProvider, AgentChat } from 'project-chat'

<AgentChatProvider config={{
  endpoint: '/api/chat',
  title: '[Project Name]',
  greeting: 'Hi! Ask me anything.',
}}>
  <AgentChat />
</AgentChatProvider>
```

### 4.3 Astro / static HTML / non-React

```html
<script type="module">
  import { mountProjectChat } from 'project-chat/embed'
  mountProjectChat({
    endpoint: '/api/chat',
    title: '[Project Name]',
    greeting: 'Hi! Ask me anything.',
  })
</script>
```

Requires React 18+ as a peer dependency. For static sites, you need a separate backend server to host `/api/chat`.

### 4.4 Match the theme

Extract the host's brand colors and apply:

```typescript
config={{
  theme: {
    mode: 'dark',
    accentColor: '#3b82f6',    // ← host's primary color
    fontFamily: 'inherit',
  },
}}
```

See [customize-theme.md](customize-theme.md) for extracting from Tailwind, CSS variables, etc.

---

## Phase 5: Verify

**Goal:** Confirm it works end-to-end.

1. Start the dev server
2. Open the app — bubble appears in corner
3. Click bubble — panel slides open with greeting
4. Ask: **"What does this project do?"**
5. Verify:

| Check | Expected | If failing |
|-------|----------|-----------|
| Bubble appears | Floating circle in corner | Check widget is mounted, no JS console errors |
| Panel opens | Slide-out panel with greeting | Check AgentChatProvider wraps AgentChat |
| Message sends | User message appears, loading indicator | Check endpoint matches API route |
| Agent responds | Streamed text with tool indicators | Check ANTHROPIC_API_KEY, server logs |
| Response is accurate | Mentions real project details | Check `projectContext.fileCount > 0` |
| Session persists | Refresh, reopen chat — messages still there | localStorage working |
| Escape closes | Press Escape key | Automatic |
| Stop works | Click stop during streaming | Automatic |

### Common failures

| Symptom | Cause | Fix |
|---------|-------|-----|
| Module not found | Symlink + Turbopack | Install from tarball: `npm pack` then `npm install ./project-chat-*.tgz` |
| useContext null | SSR in Next.js | Use `dynamic(() => ..., { ssr: false })` |
| Generic responses | Empty MCP context | Check docsDir/codeDir paths, verify fileCount |
| 500 error | Missing API key | Set ANTHROPIC_API_KEY |
| CORS errors | Cross-origin | Add CORS middleware |

---

## Post-integration

| Need | Skill |
|------|-------|
| Custom database/API context | [add-mcp-context.md](add-mcp-context.md) |
| Theme customization | [customize-theme.md](customize-theme.md) |
| Production deployment | [deploy-project-chat.md](deploy-project-chat.md) |

## Decision quick-reference

| Decision | Guidance |
|----------|---------|
| Model | Sonnet for quality/cost balance. Haiku for high-volume. |
| Tools | Start read-only: `['Read', 'Glob', 'Grep']`. Never add `Write`/`Bash` for public widgets. |
| Budget | `$0.25/request` default. Lower for high-volume, higher for complex questions. |
| Turns | `5` usually enough. `10` for multi-step. |
| Sessions | `MemorySessionStore` for single-server. Redis/DB for multi-server. |
