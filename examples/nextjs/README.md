# Next.js Example

Minimal integration of project-chat with Next.js App Router. Two files, ~20 lines of config.

## Setup

1. Create a Next.js app: `npx create-next-app@latest my-app`
2. Install project-chat: `npm install project-chat`
3. Set your API key: `ANTHROPIC_API_KEY=sk-ant-...` in `.env.local`
4. Add the two files below and start the dev server.

## Files

### `app/api/chat/route.ts`

```typescript
import { createHandler, createNextHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const projectContext = createProjectContextServer({
  docsDir: './docs',      // your docs directory
  codeDir: './src',       // your source code
})

const handler = createHandler({
  systemPrompt: 'You help users understand this Next.js project. Search the docs and code to answer questions.',
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
  },
})

export const { POST } = createNextHandler(handler)
```

### `app/layout.tsx`

```tsx
import { AgentChatProvider, AgentChat } from 'project-chat'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <AgentChatProvider config={{
          endpoint: '/api/chat',
          title: 'Project Help',
          greeting: 'Hi! Ask me anything about this project.',
        }}>
          <AgentChat />
        </AgentChatProvider>
      </body>
    </html>
  )
}
```

That's it. The chat widget appears in the bottom-right corner, the agent can search your docs and code.
