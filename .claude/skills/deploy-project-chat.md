# Deploy project-chat

Production deployment patterns for the project-chat widget.

## When to use

- Moving from development to production
- Need to secure the API key
- Need rate limiting or budget controls
- Deploying to a CDN/edge platform

## API key security

The `ANTHROPIC_API_KEY` must stay server-side. The default handler config reads from the env var automatically.

**Never:**
- Include the API key in client-side bundles
- Pass it via query parameters or client-visible headers
- Commit it to git (use `.env.local` or secrets management)

**Do:**
- Use environment variables on the server
- Use your platform's secrets management (Vercel, Railway, AWS Secrets Manager, etc.)

## Rate limiting

The handler doesn't include built-in rate limiting — use your framework's middleware:

```typescript
// Express example with express-rate-limit
import rateLimit from 'express-rate-limit'

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,   // 1 minute
  max: 20,                // 20 requests per minute per IP
  message: { error: 'Too many requests' },
})

app.post('/api/chat', chatLimiter, createExpressHandler(handler))
```

For Next.js, use middleware or a library like `next-rate-limit`.

## Budget caps

The handler config accepts `maxBudgetUsd` to cap per-request spend:

```typescript
const handler = createHandler({
  maxBudgetUsd: 0.25,    // Max $0.25 per request
  maxTurns: 10,           // Max 10 agent turns per request
})
```

For aggregate budget tracking across all users, implement that in your application layer.

## CORS

If your frontend and backend are on different origins:

```typescript
// Express
import cors from 'cors'
app.use('/api/chat', cors({ origin: 'https://your-app.com' }))

// Next.js — handled automatically for same-origin
// For cross-origin, add headers in the route handler
```

## Model selection

Default is `claude-sonnet-4-5-20250514`. For cost optimization:

- **Haiku** — Fastest, cheapest, good for simple Q&A: `claude-haiku-4-5-20251001`
- **Sonnet** — Best balance of quality and cost (default)
- **Opus** — Highest quality, most expensive: `claude-opus-4-6`

```typescript
const handler = createHandler({
  model: 'claude-haiku-4-5-20251001',  // cheaper for high-volume support
})
```

## Authentication

If the chat should only be available to authenticated users, add auth middleware before the chat handler:

```typescript
app.post('/api/chat', requireAuth, createExpressHandler(handler))
```

Pass user identity via the frontend's metadata for user-scoped MCP tools:

```tsx
<AgentChatProvider config={{
  endpoint: '/api/chat',
  metadata: { userId: session.user.id },
}}>
```

## Monitoring

Use the handler's lifecycle hooks:

```typescript
const handler = createHandler({
  onMessageStart: (sessionId) => {
    metrics.increment('chat.message.start')
  },
  onMessageEnd: (sessionId) => {
    metrics.increment('chat.message.end')
  },
  onError: (error, sessionId) => {
    logger.error('Chat error', { error, sessionId })
    metrics.increment('chat.message.error')
  },
})
```
