# Express Example

Minimal integration of project-chat with Express + a static HTML frontend.

## Setup

```bash
npm install express project-chat
```

## `server.js`

```javascript
import express from 'express'
import { createHandler, createExpressHandler } from 'project-chat/server'
import { createProjectContextServer } from 'project-chat/mcp'

const app = express()
app.use(express.json())
app.use(express.static('public'))

const projectContext = createProjectContextServer({
  docsDir: './docs',
  codeDir: './src',
})

const handler = createHandler({
  systemPrompt: 'You help users understand this project.',
  mcpServers: {
    'project': { type: 'sdk', instance: projectContext.server },
  },
})

app.post('/api/chat', createExpressHandler(handler))

app.listen(3000, () => console.log('Running on http://localhost:3000'))
```

## `public/index.html`

For the frontend, use the `useAgentChat` hook in your React app, or include the full widget:

```html
<!DOCTYPE html>
<html>
<head><title>My Project</title></head>
<body>
  <h1>My Project</h1>
  <div id="root"></div>
  <!-- Mount your React app with <AgentChatProvider> + <AgentChat /> -->
</body>
</html>
```

The Express adapter handles SSE streaming automatically. CORS, rate limiting, and other middleware can be added as needed.
