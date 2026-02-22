# Next.js Example

Minimal integration of project-chat with Next.js App Router. Three files.

## Setup

1. Create a Next.js app: `npx create-next-app@latest my-app`
2. Install project-chat: `npm install project-chat`
3. Set your API key: `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local`
4. Add the three files below and start the dev server.

## Files

### `app/api/chat/route.ts`

```typescript
import { createHandler, createNextHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',
  codeDir: './src',
})

const handler = createHandler({
  systemPrompt: 'You help users understand this Next.js project. Search the docs and code to answer questions.',
  mcpServers: {
    'project': projectContext.server,
  },
})

export const { POST } = createNextHandler(handler)
```

### `app/chat-widget.tsx`

The widget uses browser APIs (localStorage, window) so it must be client-only.

```tsx
"use client"

import dynamic from 'next/dynamic'

const Inner = dynamic(() => import('project-chat').then(m => {
  const { AgentChatProvider, AgentChat } = m
  return {
    default: () => (
      <AgentChatProvider config={{
        endpoint: '/api/chat',
        title: 'Project Help',
        greeting: 'Hi! Ask me anything about this project.',
      }}>
        <AgentChat />
      </AgentChatProvider>
    )
  }
}), { ssr: false })

export function ChatWidget() {
  return <Inner />
}
```

### `app/layout.tsx`

```tsx
import { ChatWidget } from './chat-widget'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <ChatWidget />
      </body>
    </html>
  )
}
```

That's it. The chat widget appears in the bottom-right corner, the agent can search your docs and code.
