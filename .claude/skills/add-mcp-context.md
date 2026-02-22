# Add MCP Context

Add custom context sources to the project-chat agent. Beyond the built-in docs/code search, you can give the agent access to databases, APIs, user data, or any project-specific information.

## When to use

- The agent needs to answer questions that require database queries
- The agent needs access to an API or external service
- The agent should have user-specific context (plan, role, permissions)
- The built-in project context doesn't cover all the knowledge the agent needs

## How it works

The Agent SDK supports in-process MCP servers via `createSdkMcpServer()`. You define tools with Zod schemas, the agent decides when to call them.

## Pattern

### 1. Create a custom MCP server

```typescript
import { createSdkMcpServer, tool } from '@anthropic-ai/claude-agent-sdk'
import { z } from 'zod'

const customServer = createSdkMcpServer({
  name: 'my-project-context',
  tools: [
    tool(
      'get_user_info',
      'Get details about the current user: name, plan, role',
      { userId: z.string().describe('The user ID') },
      async ({ userId }) => {
        const user = await db.users.findUnique({ where: { id: userId } })
        if (!user) return { content: [{ type: 'text', text: 'User not found' }] }
        return {
          content: [{
            type: 'text',
            text: `Name: ${user.name}\nPlan: ${user.plan}\nRole: ${user.role}`,
          }],
        }
      }
    ),

    tool(
      'search_knowledge_base',
      'Search the knowledge base / FAQ for answers to common questions',
      { query: z.string().describe('Search query') },
      async ({ query }) => {
        const results = await db.articles.search(query)
        const text = results.map(r => `### ${r.title}\n${r.content}`).join('\n\n')
        return { content: [{ type: 'text', text: text || 'No results found.' }] }
      }
    ),
  ],
})
```

### 2. Add to handler config

```typescript
const handler = createHandler({
  systemPrompt: '...',
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
    'custom':  { type: 'sdk', instance: customServer },
  },
})
```

### 3. Pass user context from the frontend

If tools need user-specific data, pass it via the request metadata:

```tsx
// Frontend
<AgentChatProvider config={{
  endpoint: '/api/chat',
  // This metadata is sent with every request
  metadata: { userId: currentUser.id },
}}>
```

Then in the handler, extract it and make it available to your MCP tools.

## Common patterns

### Database queries

Expose read-only database queries as MCP tools. Always restrict to safe operations — never expose write operations through the chat widget.

### API documentation

If you have an OpenAPI spec, pass it to `createProjectContextServer({ apiSpec: './openapi.yaml' })`. The agent can then reference API endpoints.

### External MCP servers

You can also connect stdio-based MCP servers:

```typescript
mcpServers: {
  'project': { type: 'sdk', instance: projectContext.server },
  'postgres': { command: 'npx', args: ['@modelcontextprotocol/server-postgres', connectionString] },
}
```

### Context from the request

The handler receives the full `ChatRequest` including `context.metadata`. Use this to scope MCP tool responses to the current user or session.
